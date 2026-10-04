import tempfile,unittest
from pathlib import Path
from app.scic_key_custody import evaluate_key_custody,inspect_file_test_key,production_contract

class KeyCustodyTests(unittest.TestCase):
 def test_file_key_is_always_blocked_even_with_0600(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td)/'issuer.pem';p.write_text('TEST');p.chmod(0o600)
   e=inspect_file_test_key(p);self.assertEqual(e['path_permissions'],'0o600');v=evaluate_key_custody(e);self.assertEqual(v['verdict'],'BLOCKED');self.assertIn('HSM_PROVIDER_NOT_PROVEN',v['failures']);self.assertIn('KEY_NON_EXPORTABILITY_NOT_PROVEN',v['failures'])
 def test_symlink_is_visible_in_evidence(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);target=root/'real';target.write_text('TEST');target.chmod(0o600);link=root/'link';link.symlink_to(target);self.assertTrue(inspect_file_test_key(link)['symlink'])
 def test_complete_hsm_fixture_can_satisfy_contract_logic(self):
  e={'provider_type':'PKCS11_HSM','algorithm':'RSA-2048','non_exportable':True,'hardware_backed':True,'attestation_id':'SYNTHETIC_ATTESTATION','dual_control':True,'usage_policy':'BLIND_RSA_SIGN_ONLY','rotation_test':'PASS','destruction_test':'PASS','immutable_audit_log':True,'issuer_operator':'issuer-op','ballot_box_operator':'box-op'}
  v=evaluate_key_custody(e);self.assertEqual(v['verdict'],'PASS');self.assertTrue(v['production_key_custody'])
 def test_same_issuer_and_ballot_operator_is_blocked(self):
  e={'provider_type':'MANAGED_HSM','algorithm':'RSA-2048','non_exportable':True,'hardware_backed':True,'attestation_id':'SYNTHETIC','dual_control':True,'usage_policy':'BLIND_RSA_SIGN_ONLY','rotation_test':'PASS','destruction_test':'PASS','immutable_audit_log':True,'issuer_operator':'same','ballot_box_operator':'same'}
  v=evaluate_key_custody(e);self.assertIn('ISSUER_BALLOT_OPERATOR_SEPARATION_NOT_PROVEN',v['failures'])
 def test_public_contract_never_claims_current_hsm(self):
  c=production_contract();self.assertEqual(c['current_provider'],'FILE_TEST_ONLY');self.assertEqual(c['current_verdict'],'BLOCKED');self.assertFalse(c['production_activation'])

if __name__=='__main__':unittest.main(verbosity=2)
