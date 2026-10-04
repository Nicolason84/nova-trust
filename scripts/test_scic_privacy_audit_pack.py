import json,unittest
from pathlib import Path
from scripts.build_scic_privacy_audit_pack import build
ROOT=Path(__file__).resolve().parents[1]
class AuditPackTests(unittest.TestCase):
 def test_pack_is_review_input_not_fake_audit(self):
  p=build();self.assertEqual(p['purpose'],'INDEPENDENT_REVIEW_INPUT_NOT_AN_AUDIT_VERDICT');self.assertEqual(p['audit_verdict'],'NOT_PERFORMED');self.assertTrue(p['external_review_required'])
 def test_pack_contains_no_private_state_or_absolute_home_paths(self):
  raw=json.dumps(build());self.assertFalse(build()['contains_private_state']);self.assertNotIn('/Users/nicolasalonso',raw);self.assertNotIn('PRIVATE KEY',raw)
 def test_pack_hashes_every_critical_file(self):
  p=build();self.assertGreaterEqual(len(p['critical_files']),20);self.assertTrue(all(len(v['sha256'])==64 for v in p['critical_files'].values()))
 def test_pack_preserves_real_blockers(self):
  b=set(build()['production_blockers']);self.assertIn('INDEPENDENT_OHTTP_RELAY_NOT_DEPLOYED',b);self.assertIn('PUBLIC_OHTTP_TLS_ENDPOINTS_NOT_CONFIGURED',b);self.assertIn('PRODUCTION_OPERATOR_ATTESTATION_NOT_PROVEN',b);self.assertIn('HSM_KEY_CUSTODY_NOT_PROVEN',b);self.assertIn('EXTERNAL_CRYPTO_AUDIT_NOT_COMPLETED',b);self.assertNotIn('REAL_HTTPS_HOPS_NOT_PROVEN',b)
 def test_trusted_party_matrix_matches_outreach_registry(self):
  reg=json.loads((ROOT/'audits/scic_privacy/TRUSTED_THIRD_PARTY_SELECTION_V1.json').read_text());matrix=(ROOT/'audits/scic_privacy/TRUSTED_THIRD_PARTY_EVIDENCE_MATRIX_V1.md').read_text()
  self.assertEqual(reg['state'],'OUTREACH_ACTIVE_WAITING_FOR_TRUSTED_PARTY_REPLIES');self.assertTrue(reg['external_actions']['emails_sent']);self.assertTrue(reg['external_actions']['forms_submitted']);self.assertIn('OUTREACH ACTIVE / WAITING FOR TRUSTED-PARTY REPLIES',matrix);self.assertNotIn('PRE-CONTACT / NO EXTERNAL COMMITMENT',matrix)
if __name__=='__main__':unittest.main(verbosity=2)
