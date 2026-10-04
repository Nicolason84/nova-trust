"""Runtime binding adapter for the pinned CIRCL Blind RSA sidecars.

This module does not implement cryptography. It orchestrates two separate
processes built from privacy/rfc9474_gate/cmd/scic-circl-runtime:

- client process: prepares, blinds, finalizes and verifies;
- issuer process: holds the RSA signing key and only blind-signs opaque inputs.

The issuer key is file-backed in the CI proof only. Production key custody
remains blocked until a non-exportable HSM/KMS provider is bound and audited.
"""
from __future__ import annotations

import base64
import json
import os
import subprocess
import uuid
from pathlib import Path


class RuntimeBindingError(RuntimeError):
    pass


class JSONLineProcess:
    def __init__(self, argv, *, env=None):
        self.p = subprocess.Popen(
            argv,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            env=env,
        )
        self.ready = self._read()
        if not self.ready.get("ok") or self.ready.get("op") != "ready":
            raise RuntimeBindingError("SIDECAR_NOT_READY")

    @property
    def pid(self):
        return self.p.pid

    def _read(self):
        line = self.p.stdout.readline()
        if not line:
            err = self.p.stderr.read()
            raise RuntimeBindingError("SIDECAR_EOF " + err[-1000:])
        return json.loads(line)

    def call(self, payload):
        self.p.stdin.write(json.dumps(payload, separators=(",", ":")) + "\n")
        self.p.stdin.flush()
        out = self._read()
        if not out.get("ok"):
            raise RuntimeBindingError(out.get("error", "SIDECAR_ERROR"))
        return out

    def close(self):
        if self.p.poll() is None:
            self.p.terminate()
            try:
                self.p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.p.kill()
                self.p.wait(timeout=3)


class CIRCLRuntimeBinding:
    schema = "LA_BETE_SCIC_CIRCL_RUNTIME_BINDING_V1"

    def __init__(self, binary: Path, state_root: Path):
        self.binary = Path(binary).resolve()
        self.state_root = Path(state_root).resolve()
        if not self.binary.is_file():
            raise RuntimeBindingError("CIRCL_RUNTIME_BINARY_MISSING")
        self.state_root.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.state_root, 0o700)
        key_file = self.state_root / "issuer" / "blind-rsa-pkcs8.pem"
        self.issuer = JSONLineProcess(
            [str(self.binary), "--mode=issuer", "--key-file", str(key_file)]
        )
        self.client = JSONLineProcess([str(self.binary), "--mode=client"])
        self.client.call({
            "op": "init",
            "public_key_pem_b64": self.issuer.ready["public_key_pem_b64"],
        })
        self.key_file = key_file

    def close(self):
        self.client.close()
        self.issuer.close()

    def roundtrip(self, token_input: bytes):
        request_id = "bind_" + uuid.uuid4().hex
        blind = self.client.call({
            "op": "blind",
            "id": request_id,
            "message_b64": base64.b64encode(token_input).decode(),
        })
        signed = self.issuer.call({
            "op": "sign",
            "id": request_id,
            "blinded_b64": blind["blinded_b64"],
        })
        final = self.client.call({
            "op": "finalize",
            "id": request_id,
            "blind_signature_b64": signed["blind_signature_b64"],
        })
        return {
            "schema": self.schema,
            "request_id": request_id,
            "client_pid": self.client.pid,
            "issuer_pid": self.issuer.pid,
            "separate_processes": self.client.pid != self.issuer.pid,
            "backend": final["backend"],
            "backend_version": final["backend_version"],
            "variant": final["variant"],
            "verified": final["verified"],
            "standard_pss_verified": final["standard_pss_verified"],
            "prepared_message_b64": final["prepared_message_b64"],
            "signature_b64": final["signature_b64"],
            "issuer_saw_plain_message": False,
            "key_provider": "FILE_TEST_ONLY",
            "production_key_custody": False,
        }

    def proof(self, token_input: bytes):
        out = self.roundtrip(token_input)
        mode = self.key_file.stat().st_mode & 0o777
        out.update({
            "issuer_key_mode_octal": oct(mode),
            "issuer_key_symlink": self.key_file.is_symlink(),
            "runtime_binding": (
                "PROVEN_CI_SIDECAR"
                if out["verified"]
                and out["standard_pss_verified"]
                and out["separate_processes"]
                else "NOT_PROVEN"
            ),
        })
        return out
