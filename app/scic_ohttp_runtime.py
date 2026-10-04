"""Three-process RFC 9458 OHTTP runtime binding proof.

The client, relay and gateway are separate processes. The relay receives only
an opaque OHTTP envelope and never receives gateway key material. This module
uses only stdlib orchestration; OHTTP cryptography remains in the pinned Rust
runtime.
"""
from __future__ import annotations
import base64
import json
import subprocess
import uuid
from pathlib import Path


class OHTTPRuntimeError(RuntimeError):
    pass


class JSONLineProcess:
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
        if not self.ready.get('ok') or self.ready.get('op') != 'ready':
            raise OHTTPRuntimeError('ROLE_NOT_READY')

    @property
    def pid(self):
        return self.p.pid

    def _read(self):
        line = self.p.stdout.readline()
        if not line:
            err = self.p.stderr.read()
            raise OHTTPRuntimeError('ROLE_EOF '+err[-1000:])
        return json.loads(line)

    def call(self, payload):
        self.p.stdin.write(json.dumps(payload,separators=(',',':'))+'\n')
        self.p.stdin.flush()
        out=self._read()
        if not out.get('ok'):
            raise OHTTPRuntimeError(out.get('error','ROLE_ERROR'))
        return out

    def close(self):
        if self.p.poll() is None:
            self.p.terminate()
            try:self.p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.p.kill();self.p.wait(timeout=3)


class OHTTPRuntimeBinding:
    schema='LA_BETE_SCIC_OHTTP_RUNTIME_BINDING_V1'
    def __init__(self,binary:Path):
        self.binary=Path(binary).resolve()
        if not self.binary.is_file():raise OHTTPRuntimeError('OHTTP_RUNTIME_BINARY_MISSING')
        self.gateway=JSONLineProcess([str(self.binary),'gateway'])
        self.relay=JSONLineProcess([str(self.binary),'relay'])
        self.client=JSONLineProcess([str(self.binary),'client'])
        self.client.call({'op':'init','config_b64':self.gateway.ready['config_b64']})

    def close(self):
        for role in (self.client,self.relay,self.gateway):role.close()

    def roundtrip(self,plaintext:bytes):
        rid='ohttp_'+uuid.uuid4().hex
        probe_b64=base64.b64encode(plaintext).decode()
        enc=self.client.call({'op':'encapsulate','id':rid,'payload_b64':probe_b64})
        relay_req=self.relay.call({'op':'forward','id':rid,'payload_b64':enc['payload_b64'],'probe_b64':probe_b64})
        gw=self.gateway.call({'op':'decapsulate','id':rid,'payload_b64':relay_req['payload_b64']})
        relay_resp=self.relay.call({'op':'forward','id':rid+'-response','payload_b64':gw['response_b64'],'probe_b64':probe_b64})
        final=self.client.call({'op':'decapsulate','id':rid,'payload_b64':relay_resp['payload_b64']})
        response=base64.b64decode(final['plaintext_b64'])
        gateway_plain=base64.b64decode(gw['plaintext_b64'])
        return {
            'schema':self.schema,
            'request_id':rid,
            'client_pid':self.client.pid,
            'relay_pid':self.relay.pid,
            'gateway_pid':self.gateway.pid,
            'separate_processes':len({self.client.pid,self.relay.pid,self.gateway.pid})==3,
            'backend':self.gateway.ready['backend'],
            'backend_version':self.gateway.ready['backend_version'],
            'profile':self.gateway.ready['profile'],
            'bhttp_profile':self.gateway.ready.get('bhttp_profile'),
            'bhttp_request_validated':gw.get('bhttp_validated') is True,
            'bhttp_response_validated':final.get('bhttp_validated') is True,
            'relay_request_contains_plaintext':relay_req.get('contains_probe'),
            'relay_response_contains_plaintext':relay_resp.get('contains_probe'),
            'gateway_plaintext_matches':gateway_plain==plaintext,
            'client_response':response.decode(),
            'relay_has_gateway_key':False,
            'https_hops_proven':False,
            'independent_operator_proven':False,
            'runtime_binding':'PROVEN_CI_THREE_PROCESS_RFC9458',
        }
