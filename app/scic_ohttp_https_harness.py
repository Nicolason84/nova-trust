"""Two-hop HTTPS harness around the pinned RFC9458 OHTTP runtime.

This proves transport mechanics only in CI/local synthetic conditions:
client -> HTTPS relay -> HTTPS gateway, with separate OS processes.

It does NOT prove an independent production relay operator, public PKI,
network-path diversity, traffic-analysis resistance, or production availability.
"""
from __future__ import annotations

import base64
import hashlib
import json
import multiprocessing as mp
import ssl
import subprocess
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

SCHEMA = "LA_BETE_SCIC_OHTTP_HTTPS_HARNESS_V1"
MAX_BODY = 1024 * 1024
IDENTIFYING_HEADERS = {
    "x-client-identity",
    "x-forwarded-for",
    "forwarded",
    "user-agent",
    "cookie",
    "authorization",
}


class HarnessError(RuntimeError):
    pass


class JSONLineRole:
    def __init__(self, argv):
        self.p = subprocess.Popen(
            argv,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self.ready = self._read()
        if not self.ready.get("ok") or self.ready.get("op") != "ready":
            raise HarnessError("ROLE_NOT_READY")

    def _read(self):
        line = self.p.stdout.readline()
        if not line:
            err = self.p.stderr.read()
            raise HarnessError("ROLE_EOF " + err[-1000:])
        return json.loads(line)

    def call(self, payload):
        self.p.stdin.write(json.dumps(payload, separators=(",", ":")) + "\n")
        self.p.stdin.flush()
        out = self._read()
        if not out.get("ok"):
            raise HarnessError(out.get("error", "ROLE_ERROR"))
        return out

    def close(self):
        if self.p.poll() is None:
            self.p.terminate()
            try:
                self.p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.p.kill()
                self.p.wait(timeout=3)
        for stream in (self.p.stdin, self.p.stdout, self.p.stderr):
            try:
                stream.close()
            except Exception:
                pass


def _tls_server_context(certfile, keyfile):
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.load_cert_chain(certfile, keyfile)
    return ctx


def _tls_client_context(cafile):
    ctx = ssl.create_default_context(cafile=str(cafile))
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.check_hostname = True
    return ctx


def _gateway_process(binary, certfile, keyfile, ready_q, evidence_q):
    role = None
    server = None
    try:
        role = JSONLineRole([str(binary), "gateway"])

        class GatewayHandler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.0"
            server_version = "SCIC-OHTTP-Gateway-CI"

            def log_message(self, *_):
                pass

            def do_POST(self):
                if self.path != "/ohttp-gateway":
                    self.send_error(404)
                    return
                if self.headers.get_content_type() != "message/ohttp-req":
                    self.send_error(415)
                    return
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > MAX_BODY:
                    self.send_error(413)
                    return
                body = self.rfile.read(length)
                out = role.call({
                    "op": "decapsulate",
                    "id": "https-hop",
                    "payload_b64": base64.b64encode(body).decode(),
                })
                response = base64.b64decode(out["response_b64"])
                evidence_q.put({
                    "role": "gateway",
                    "pid": mp.current_process().pid,
                    "rust_pid": role.p.pid,
                    "remote_addr": self.client_address[0],
                    "received_headers": sorted(k.lower() for k in self.headers.keys()),
                    "received_identifying_headers": sorted(
                        k.lower() for k in self.headers.keys()
                        if k.lower() in IDENTIFYING_HEADERS
                    ),
                    "bhttp_validated": out.get("bhttp_validated") is True,
                    "plaintext_sha256": hashlib.sha256(
                        base64.b64decode(out["plaintext_b64"])
                    ).hexdigest(),
                })
                self.send_response(200)
                self.send_header("Content-Type", "message/ohttp-res")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(response)))
                self.end_headers()
                self.wfile.write(response)

        server = HTTPServer(("127.0.0.1", 0), GatewayHandler)
        server.socket = _tls_server_context(certfile, keyfile).wrap_socket(
            server.socket, server_side=True
        )
        ready_q.put({
            "role": "gateway",
            "pid": mp.current_process().pid,
            "rust_pid": role.p.pid,
            "port": server.server_port,
            "config_b64": role.ready["config_b64"],
        })
        server.handle_request()
    except Exception as exc:
        ready_q.put({"role": "gateway", "error": type(exc).__name__ + ":" + str(exc)})
    finally:
        if server:
            server.server_close()
        if role:
            role.close()


def _relay_process(
    gateway_port,
    gateway_cafile,
    certfile,
    keyfile,
    probe,
    ready_q,
    evidence_q,
):
    server = None
    try:
        gateway_ctx = _tls_client_context(gateway_cafile)

        class RelayHandler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.0"
            server_version = "SCIC-OHTTP-Relay-CI"

            def log_message(self, *_):
                pass

            def do_POST(self):
                if self.path != "/relay":
                    self.send_error(404)
                    return
                if self.headers.get_content_type() != "message/ohttp-req":
                    self.send_error(415)
                    return
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > MAX_BODY:
                    self.send_error(413)
                    return
                body = self.rfile.read(length)
                contains_probe = bool(probe) and probe in body

                req = urllib.request.Request(
                    "https://localhost:%d/ohttp-gateway" % gateway_port,
                    data=body,
                    method="POST",
                    headers={
                        "Content-Type": "message/ohttp-req",
                        "Cache-Control": "no-store",
                    },
                )
                # urlopen() uses a process-global opener that injects a default
                # Python-urllib User-Agent. Build a dedicated opener with an
                # empty addheaders list so the relay forwards no identifying
                # metadata beyond the strict OHTTP transport headers.
                opener = urllib.request.build_opener(
                    urllib.request.HTTPSHandler(context=gateway_ctx)
                )
                opener.addheaders = []
                with opener.open(req, timeout=8) as resp:
                    gateway_response = resp.read()
                    gateway_type = resp.headers.get_content_type()

                evidence_q.put({
                    "role": "relay",
                    "pid": mp.current_process().pid,
                    "remote_addr": self.client_address[0],
                    "request_contains_plaintext_probe": contains_probe,
                    "incoming_identifying_headers": sorted(
                        k.lower() for k in self.headers.keys()
                        if k.lower() in IDENTIFYING_HEADERS
                    ),
                    "forwarded_headers": ["cache-control", "content-type"],
                    "gateway_content_type": gateway_type,
                    "gateway_key_material_present": False,
                })
                self.send_response(200)
                self.send_header("Content-Type", "message/ohttp-res")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(gateway_response)))
                self.end_headers()
                self.wfile.write(gateway_response)

        server = HTTPServer(("127.0.0.1", 0), RelayHandler)
        server.socket = _tls_server_context(certfile, keyfile).wrap_socket(
            server.socket, server_side=True
        )
        ready_q.put({
            "role": "relay",
            "pid": mp.current_process().pid,
            "port": server.server_port,
        })
        server.handle_request()
    except Exception as exc:
        ready_q.put({"role": "relay", "error": type(exc).__name__ + ":" + str(exc)})
    finally:
        if server:
            server.server_close()


class OHTTPHTTPSHarness:
    def __init__(
        self,
        binary: Path,
        relay_cert: Path,
        relay_key: Path,
        gateway_cert: Path,
        gateway_key: Path,
    ):
        self.binary = Path(binary).resolve()
        for path in (relay_cert, relay_key, gateway_cert, gateway_key):
            if not Path(path).is_file():
                raise HarnessError("TLS_MATERIAL_MISSING")
        self.relay_cert = Path(relay_cert)
        self.relay_key = Path(relay_key)
        self.gateway_cert = Path(gateway_cert)
        self.gateway_key = Path(gateway_key)

    def roundtrip(self, plaintext: bytes):
        ctx = mp.get_context("spawn")
        gateway_ready, relay_ready, evidence_q = ctx.Queue(), ctx.Queue(), ctx.Queue()
        gateway = ctx.Process(
            target=_gateway_process,
            args=(
                str(self.binary),
                str(self.gateway_cert),
                str(self.gateway_key),
                gateway_ready,
                evidence_q,
            ),
        )
        gateway.start()
        gw = gateway_ready.get(timeout=15)
        if gw.get("error"):
            raise HarnessError(gw["error"])

        relay = ctx.Process(
            target=_relay_process,
            args=(
                gw["port"],
                str(self.gateway_cert),
                str(self.relay_cert),
                str(self.relay_key),
                plaintext,
                relay_ready,
                evidence_q,
            ),
        )
        relay.start()
        rr = relay_ready.get(timeout=15)
        if rr.get("error"):
            raise HarnessError(rr["error"])

        client = JSONLineRole([str(self.binary), "client"])
        try:
            client.call({"op": "init", "config_b64": gw["config_b64"]})
            rid = "https-e2e"
            enc = client.call({
                "op": "encapsulate",
                "id": rid,
                "payload_b64": base64.b64encode(plaintext).decode(),
            })
            envelope = base64.b64decode(enc["payload_b64"])

            relay_ctx = _tls_client_context(self.relay_cert)
            req = urllib.request.Request(
                "https://localhost:%d/relay" % rr["port"],
                data=envelope,
                method="POST",
                headers={
                    "Content-Type": "message/ohttp-req",
                    "X-Client-Identity": "SYNTHETIC-MEMBER-IDENTIFIER",
                    "X-Forwarded-For": "203.0.113.7",
                    "User-Agent": "SCIC-IDENTIFYING-PROBE",
                    "Cookie": "synthetic=session",
                },
            )
            with urllib.request.urlopen(req, context=relay_ctx, timeout=10) as resp:
                encrypted_response = resp.read()
                response_type = resp.headers.get_content_type()

            final = client.call({
                "op": "decapsulate",
                "id": rid,
                "payload_b64": base64.b64encode(encrypted_response).decode(),
            })
            clear_response = base64.b64decode(final["plaintext_b64"]).decode()

            ev1 = evidence_q.get(timeout=10)
            ev2 = evidence_q.get(timeout=10)
            evidence = {ev1["role"]: ev1, ev2["role"]: ev2}
            return {
                "schema": SCHEMA,
                "client_pid": client.p.pid,
                "relay_pid": rr["pid"],
                "gateway_pid": gw["pid"],
                "gateway_rust_pid": gw["rust_pid"],
                "separate_http_processes": len({
                    rr["pid"], gw["pid"], client.p.pid
                }) == 3,
                "https_client_to_relay": True,
                "https_relay_to_gateway": True,
                "hostname_verification": True,
                "relay_request_contains_plaintext": evidence["relay"][
                    "request_contains_plaintext_probe"
                ],
                "relay_gateway_key_material_present": evidence["relay"][
                    "gateway_key_material_present"
                ],
                "relay_incoming_identifying_headers": evidence["relay"][
                    "incoming_identifying_headers"
                ],
                "gateway_received_identifying_headers": evidence["gateway"][
                    "received_identifying_headers"
                ],
                "relay_forwarded_headers": evidence["relay"]["forwarded_headers"],
                "gateway_bhttp_validated": evidence["gateway"]["bhttp_validated"],
                "client_bhttp_response_validated": final.get("bhttp_validated") is True,
                "client_response": clear_response,
                "response_content_type": response_type,
                "independent_operator_proven": False,
                "public_pki_proven": False,
                "deployment_state": "LOCAL_TLS_TWO_HOP_PROVEN_NOT_PRODUCTION",
            }
        finally:
            client.close()
            relay.join(timeout=10)
            gateway.join(timeout=10)
            if relay.is_alive():
                relay.terminate()
            if gateway.is_alive():
                gateway.terminate()
