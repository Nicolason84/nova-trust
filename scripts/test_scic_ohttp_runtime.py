import os,tempfile,unittest
from pathlib import Path
from app.scic_ohttp_runtime import OHTTPRuntimeBinding

class OHTTPRuntimeTests(unittest.TestCase):
 def setUp(self):
  binary=os.environ.get('SCIC_OHTTP_RUNTIME_BIN')
  if not binary:self.skipTest('SCIC_OHTTP_RUNTIME_BIN not supplied')
  self.binding=OHTTPRuntimeBinding(Path(binary))
 def tearDown(self):
  if hasattr(self,'binding'):self.binding.close()
 def test_three_roles_are_distinct_processes(self):
  p=self.binding.roundtrip(b'SCIC_SECRET_BALLOT_PROBE_001')
  self.assertTrue(p['separate_processes']);self.assertEqual(len({p['client_pid'],p['relay_pid'],p['gateway_pid']}),3)
 def test_relay_never_sees_plaintext_probe(self):
  p=self.binding.roundtrip(b'SCIC_SECRET_BALLOT_PROBE_002')
  self.assertFalse(p['relay_request_contains_plaintext']);self.assertFalse(p['relay_response_contains_plaintext'])
  self.assertFalse(p['relay_has_gateway_key'])
 def test_gateway_decrypts_and_client_decapsulates_response(self):
  p=self.binding.roundtrip(b'SCIC_SECRET_BALLOT_PROBE_003')
  self.assertTrue(p['gateway_plaintext_matches']);self.assertEqual(p['client_response'],'SCIC_OHTTP_ACCEPTED')
 def test_runtime_uses_rfc9458_backend(self):
  p=self.binding.roundtrip(b'SCIC_SECRET_BALLOT_PROBE_004')
  self.assertEqual(p['backend'],'martinthomson/ohttp');self.assertEqual(p['backend_version'],'0.8.0');self.assertEqual(p['profile'],'RFC9458_OBLIVIOUS_HTTP')
  self.assertEqual(p['bhttp_profile'],'RFC9292_BINARY_HTTP');self.assertTrue(p['bhttp_request_validated']);self.assertTrue(p['bhttp_response_validated'])
  self.assertEqual(p['runtime_binding'],'PROVEN_CI_THREE_PROCESS_RFC9458')
 def test_network_operator_proof_remains_open(self):
  p=self.binding.roundtrip(b'SCIC_SECRET_BALLOT_PROBE_005')
  self.assertFalse(p['https_hops_proven']);self.assertFalse(p['independent_operator_proven'])

if __name__=='__main__':unittest.main(verbosity=2)
