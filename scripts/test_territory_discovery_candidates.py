import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = json.loads((ROOT / "docs/data/la-bete-territory-discovery-candidates-v1.json").read_text())
QUESTS = json.loads((ROOT / "docs/data/phi-territory-quests-v1.json").read_text())
CULTURE = json.loads((ROOT / "docs/data/la-bete-territory-culture-v1.json").read_text())

class DiscoveryContractTests(unittest.TestCase):
    def test_candidate_layer_is_separate_and_fail_closed(self):
        self.assertEqual(DOC["schema"], "LA_BETE_TERRITORY_DISCOVERY_CANDIDATES_V1")
        c = DOC["contract"]
        self.assertFalse(c["automatic_discovery_is_proof"])
        self.assertFalse(c["automatic_discovery_can_promote_living_identity"])
        self.assertFalse(c["automatic_discovery_mints_phi"])
        self.assertFalse(c["automatic_discovery_changes_documentation_score"])
        self.assertTrue(c["verified_receipt_required_for_phi"])
        self.assertTrue(c["last_good_retention"])

    def test_national_batch_policy_reaches_all_departments(self):
        p = DOC["batch_policy"]
        self.assertEqual(p["default_batch_size"], 12)
        self.assertEqual(p["selection"], "UNSCANNED_FIRST_THEN_OLDEST_SCAN")
        self.assertLessEqual(p["full_cycle_target_runs"], 9)
        self.assertEqual(DOC["coverage"]["departments_total"], 101)
        for source in ("merimee_monuments_historiques","bibliotheques_publiques","tiers_lieux_2026","wikimedia_commons","wikipedia_fr","canonical_relations"):
            self.assertIn(source, DOC["sources"])
        self.assertNotIn("openstreetmap_overpass", DOC["sources"])

    def test_every_scan_record_has_verified_topology_relations(self):
        for code, d in DOC["departments"].items():
            self.assertIn(code, CULTURE["departments"])
            r = d["relations"]
            self.assertEqual(r["state"], "VERIFIED_CANONICAL_TOPOLOGY_RELATION")
            self.assertEqual(r["relation"], "same_epci")
            self.assertGreaterEqual(r["epci_cluster_count"], 0)
            self.assertGreaterEqual(r["same_epci_pair_count"], 0)
            self.assertIn("ne prouve aucune proximité", r["gate"])

    def test_candidates_preserve_source_specific_evidence_state(self):
        for d in DOC["departments"].values():
            for x in d.get("heritage", []):
                self.assertEqual(x["state"], "OFFICIAL_DATASET_CANDIDATE")
                self.assertEqual(x["producer"], "Ministère de la Culture")
                self.assertTrue(x["source"].startswith("https://pop.culture.gouv.fr/notice/merimee/"))
                self.assertIn("Open Licence", x["license"])
                self.assertIn("promotion", x["gate"])
            for x in d.get("commons", []):
                self.assertEqual(x["state"], "OFFICIAL_DATASET_CANDIDATE")
                self.assertEqual(x["producer"], "Ministère de la Culture")
                self.assertIn("Open Licence", x["license"])
                self.assertTrue(x["quest_id"])
            for x in d.get("initiatives", []):
                self.assertEqual(x["state"], "PUBLIC_CENSUS_CANDIDATE")
                self.assertEqual(x["producer"], "France Tiers-Lieux")
                self.assertIn("Open Licence", x["license"])
                self.assertIn("Vérifier", x["gate"])
            for x in d.get("nature", []):
                self.assertEqual(x["state"], "UNVERIFIED_AUTODISCOVERY_CANDIDATE")
                self.assertTrue(x["source"].startswith("https://fr.wikipedia.org/"))
                self.assertRegex(x["label"].lower(), r"(réserve|forêt|parc|baie|marais|dune|massif|vallée|estuaire|lac|étang|arboretum|jardin|zone humide|littoral)")
                self.assertIn(x["administrative_binding"], {"P131_PATH_TO_DEPARTMENT","TEXT_LOCALITY_HINT_ONLY"})
                self.assertIn("Vérifier", x["gate"])
            for x in d.get("media", []):
                self.assertEqual(x["state"], "LICENSE_VERIFIED_LOCATION_CANDIDATE")
                self.assertTrue(x["license"])
                self.assertTrue(x["source_page"].startswith("https://commons.wikimedia.org/"))
                if x.get("asset"):
                    self.assertTrue((ROOT / "docs" / x["asset"]).is_file())

    def test_candidate_file_does_not_change_phi_scores(self):
        self.assertEqual(QUESTS["schema"], "LA_BETE_PHI_TERRITORY_QUESTS_V1")
        self.assertEqual(QUESTS["verified_receipts_count"], 0)
        self.assertEqual(QUESTS["territories"]["60"]["documentation_score_pct"], 10)
        for d in DOC["departments"].values():
            self.assertFalse(d["promotion_authorized"])
            self.assertFalse(d["mints_phi"])
            self.assertFalse(d["changes_documentation_score"])

    def test_offline_builder_never_needs_network_to_create_safe_record(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "candidates.json"
            runner = ROOT / "scripts/build_territory_discovery_candidates.py"
            subprocess.run([sys.executable, str(runner), "--codes", "80", "--offline", "--out", str(out)], cwd=ROOT, check=True, capture_output=True, text=True)
            j = json.loads(out.read_text())
            self.assertEqual(j["departments"]["80"]["state"], "OFFLINE_RELATION_BASELINE_ONLY")
            self.assertEqual(j["departments"]["80"]["media"], [])

if __name__ == "__main__":
    unittest.main(verbosity=2)
