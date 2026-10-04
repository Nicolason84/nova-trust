import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CULTURE=json.loads((ROOT/'docs/data/la-bete-territory-culture-v1.json').read_text())
PHI=json.loads((ROOT/'docs/data/phi-coins-v1.json').read_text())

class TerritoryCultureTests(unittest.TestCase):
    def test_all_departments_have_same_narrative_contract(self):
        self.assertEqual(CULTURE['schema'],'LA_BETE_TERRITORY_CULTURE_V1')
        self.assertEqual(CULTURE['departments_count'],101)
        self.assertEqual(len(CULTURE['departments']),101)
        for code,p in CULTURE['departments'].items():
            self.assertFalse(p['narrative_contract']['economy_only'])
            self.assertTrue(p['narrative_contract']['no_fabrication'])
            self.assertGreaterEqual(len(p['story_slots']),8)
            self.assertIn('langue_locale',p['contribution_topics'])
    def test_foreign_and_local_modes_are_explicit(self):
        modes={x['id']:x['state'] for x in CULTURE['language_modes']['interface']}
        self.assertEqual(modes['fr'],'AVAILABLE')
        self.assertEqual(modes['en'],'AVAILABLE_ESSENTIAL_LAYER')
        self.assertEqual(modes['es'],'AVAILABLE_ESSENTIAL_LAYER')
        self.assertEqual(modes['local'],'CONTEXTUAL_ONLY_WHEN_SOURCED')
    def test_oise_has_department_specific_picard_evidence(self):
        oise=CULTURE['departments']['60']['local_language']
        self.assertEqual(oise['state'],'DEPARTMENT_PICARD_CONTEXT_VERIFIED_LOCAL_VARIANTS_TO_DOCUMENT')
        self.assertEqual([x['label'] for x in oise['options']],['Picard'])
        self.assertIn('archives.oise.fr',oise['options'][0]['source'])
        self.assertIn('commune par commune',oise['warning'])
    def test_regional_context_does_not_become_blanket_department_claim(self):
        north=CULTURE['departments']['59']['local_language']
        self.assertEqual(north['options'],[])
        self.assertEqual({x['label'] for x in north['regional_context']},{'Picard','Flamand occidental'})
        self.assertIn('ne permet pas',north['warning'])

class PhiTests(unittest.TestCase):
    def test_phi_is_not_money_or_cryptoasset(self):
        f=PHI['financial_status']
        for key in ('money','cryptoasset','transferable','purchasable','redeemable_for_cash','investment_return'):
            self.assertFalse(f[key])
        self.assertIsNone(f['market_price'])
        self.assertEqual(f['wallet'],'NOT_IMPLEMENTED')
        self.assertEqual(f['ledger'],'NOT_IMPLEMENTED')
    def test_phi_only_rewards_verified_contribution(self):
        self.assertIn('vérification',PHI['award_rule'])
        self.assertGreaterEqual(len(PHI['rewards']),7)
        self.assertTrue(all(isinstance(r['phi'],int) and r['phi']>0 for r in PHI['rewards']))
        self.assertIn('revue juridique',PHI['future_gate'])

if __name__=='__main__':
    unittest.main(verbosity=2)
