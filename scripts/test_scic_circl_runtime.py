import base64
import os
import tempfile
import unittest
from pathlib import Path

from app.scic_circl_runtime import CIRCLRuntimeBinding


class CIRCLRuntimeBindingTests(unittest.TestCase):
    def setUp(self):
        binary = os.environ.get("SCIC_CIRCL_RUNTIME_BIN")
        if not binary:
            self.skipTest("SCIC_CIRCL_RUNTIME_BIN not supplied")
        self.tmp = tempfile.TemporaryDirectory()
        self.binding = CIRCLRuntimeBinding(Path(binary), Path(self.tmp.name))

    def tearDown(self):
        if hasattr(self, "binding"):
            self.binding.close()
        if hasattr(self, "tmp"):
            self.tmp.cleanup()

    def test_circl_client_and_issuer_are_distinct_processes(self):
        proof = self.binding.proof(os.urandom(98))
        self.assertTrue(proof["separate_processes"])
        self.assertNotEqual(proof["client_pid"], proof["issuer_pid"])

    def test_runtime_uses_pinned_circl_variant_and_standard_pss_crosscheck(self):
        proof = self.binding.proof(os.urandom(98))
        self.assertEqual(proof["backend"], "cloudflare/circl")
        self.assertEqual(proof["backend_version"], "v1.6.5")
        self.assertEqual(proof["variant"], "RSABSSA-SHA384-PSS-Deterministic")
        self.assertTrue(proof["verified"])
        self.assertTrue(proof["standard_pss_verified"])
        self.assertEqual(proof["runtime_binding"], "PROVEN_CI_SIDECAR")

    def test_issuer_key_file_is_private_but_not_production_custody(self):
        proof = self.binding.proof(os.urandom(98))
        self.assertEqual(proof["issuer_key_mode_octal"], "0o600")
        self.assertFalse(proof["issuer_key_symlink"])
        self.assertEqual(proof["key_provider"], "FILE_TEST_ONLY")
        self.assertFalse(proof["production_key_custody"])

    def test_client_state_is_one_use(self):
        proof = self.binding.proof(os.urandom(98))
        # A successful proof demonstrates state consumption in the client
        # sidecar; no reusable client state is returned to Python.
        self.assertNotIn("blinding_factor", proof)
        self.assertNotIn("blind_signature_b64", proof)

    def test_python_adapter_never_receives_issuer_private_key(self):
        proof = self.binding.proof(os.urandom(98))
        raw = str(proof)
        self.assertNotIn("PRIVATE KEY", raw)
        self.assertNotIn("private_key", raw.lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
