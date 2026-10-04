import os
import subprocess
import tempfile
import unittest
from pathlib import Path

from app.scic_ohttp_https_harness import OHTTPHTTPSHarness


def make_cert(root: Path, name: str):
    cert = root / (name + ".crt")
    key = root / (name + ".key")
    subprocess.run([
        "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
        "-days", "1", "-subj", "/CN=localhost",
        "-addext", "subjectAltName=DNS:localhost",
        "-keyout", str(key), "-out", str(cert),
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.chmod(key, 0o600)
    return cert, key


class OHTTPHTTPSHarnessTests(unittest.TestCase):
    def setUp(self):
        binary = os.environ.get("SCIC_OHTTP_RUNTIME_BIN")
        if not binary:
            self.skipTest("SCIC_OHTTP_RUNTIME_BIN not supplied")
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        relay_cert, relay_key = make_cert(root, "relay")
        gateway_cert, gateway_key = make_cert(root, "gateway")
        self.harness = OHTTPHTTPSHarness(
            Path(binary),
            relay_cert, relay_key,
            gateway_cert, gateway_key,
        )

    def tearDown(self):
        if hasattr(self, "tmp"):
            self.tmp.cleanup()

    def proof(self):
        return self.harness.roundtrip(b"SCIC_TLS_SECRET_BALLOT_PROBE")

    def test_two_https_hops_and_process_separation(self):
        p = self.proof()
        self.assertTrue(p["https_client_to_relay"])
        self.assertTrue(p["https_relay_to_gateway"])
        self.assertTrue(p["hostname_verification"])
        self.assertTrue(p["separate_http_processes"])
        self.assertEqual(
            len({p["client_pid"], p["relay_pid"], p["gateway_pid"]}), 3
        )

    def test_relay_sees_identifying_headers_but_gateway_does_not(self):
        p = self.proof()
        self.assertIn("x-client-identity", p["relay_incoming_identifying_headers"])
        self.assertIn("x-forwarded-for", p["relay_incoming_identifying_headers"])
        self.assertIn("user-agent", p["relay_incoming_identifying_headers"])
        self.assertIn("cookie", p["relay_incoming_identifying_headers"])
        self.assertEqual(p["gateway_received_identifying_headers"], [])
        self.assertEqual(
            p["relay_forwarded_headers"],
            ["cache-control", "content-type"],
        )

    def test_relay_has_only_opaque_ohttp_and_no_gateway_key(self):
        p = self.proof()
        self.assertFalse(p["relay_request_contains_plaintext"])
        self.assertFalse(p["relay_gateway_key_material_present"])

    def test_gateway_and_client_validate_bhttp_inside_ohttp(self):
        p = self.proof()
        self.assertTrue(p["gateway_bhttp_validated"])
        self.assertTrue(p["client_bhttp_response_validated"])
        self.assertEqual(p["client_response"], "SCIC_OHTTP_ACCEPTED")
        self.assertEqual(p["response_content_type"], "message/ohttp-res")

    def test_external_operator_and_public_pki_remain_open(self):
        p = self.proof()
        self.assertFalse(p["independent_operator_proven"])
        self.assertFalse(p["public_pki_proven"])
        self.assertEqual(
            p["deployment_state"],
            "LOCAL_TLS_TWO_HOP_PROVEN_NOT_PRODUCTION",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
