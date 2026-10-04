import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
QUESTS=json.loads((ROOT/'docs/data/phi-territory-quests-v1.json').read_text())

class QuestContractTests(unittest.TestCase):
    def test_all_departments_have_same_quest_catalog(self):
        self.assertEqual(QUESTS['schema'],'LA_BETE_PHI_TERRITORY_QUESTS_V1')
        self.assertEqual(len(QUESTS['territories']),101)
        ids=[q['id'] for q in QUESTS['quest_catalog']]
        self.assertEqual(len(ids),10); self.assertEqual(len(ids),len(set(ids)))
        self.assertEqual(sum(q['weight'] for q in QUESTS['quest_catalog']),100)
        for t in QUESTS['territories'].values():
            self.assertEqual([q['id'] for q in t['quests']],ids)
            self.assertIn(t['documentation_score_pct'],range(101))
    def test_score_excludes_economic_and_population_inputs(self):
        c=QUESTS['score_contract']
        self.assertFalse(c['economic_inputs']); self.assertFalse(c['population_inputs'])
        self.assertFalse(c['wealth_inputs']); self.assertFalse(c['political_inputs'])
        self.assertEqual(c['competition_rule'],'Comparer la progression documentaire, jamais les territoires eux-mêmes.')
    def test_oise_official_picard_progresses_without_minting_phi(self):
        o=QUESTS['territories']['60']; s=QUESTS['territories']['80']
        self.assertEqual(o['documentation_score_pct'],10)
        self.assertEqual(o['community_phi_awarded'],0)
        self.assertEqual(o['community_verified_items'],0)
        self.assertEqual(o['quests'][0]['official_baseline_items'],1)
        self.assertEqual(s['documentation_score_pct'],0)
    def test_unverified_submission_never_mints_phi(self):
        self.assertFalse(QUESTS['score_contract']['submission_without_verification_mints_phi'])
        self.assertTrue(QUESTS['score_contract']['community_verified_receipt_mints_phi'])
    def test_verified_receipt_changes_only_its_department_and_mints_fixed_phi(self):
        with tempfile.TemporaryDirectory() as td:
            td=Path(td); receipts=td/'receipts.json'; out=td/'quests.json'
            receipts.write_text(json.dumps({
              'schema':'LA_BETE_TERRITORY_CONTRIBUTIONS_V1','state':'TEST_FIXTURE',
              'receipts':[{
                'receipt_id':'TEST-ONE','department_code':'80','quest_id':'local_expressions',
                'state':'VERIFIED','evidence_url':'https://example.invalid/proof',
                'community_contribution':True
              }]
            }))
            env={**os.environ,'LA_BETE_TERRITORY_CONTRIBUTIONS_FILE':str(receipts),'LA_BETE_TERRITORY_QUESTS_OUT':str(out)}
            subprocess.run([sys.executable,str(ROOT/'scripts/build_phi_territory_quests.py')],check=True,cwd=ROOT,env=env,capture_output=True,text=True)
            j=json.loads(out.read_text()); somme=j['territories']['80']; oise=j['territories']['60']
            self.assertEqual(somme['community_verified_items'],1)
            self.assertEqual(somme['community_phi_awarded'],4)
            self.assertEqual(somme['documentation_score_pct'],2)
            self.assertEqual(oise['community_phi_awarded'],0)
            self.assertEqual(oise['documentation_score_pct'],10)

if __name__=='__main__':
    unittest.main(verbosity=2)
