import json
import unittest
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DOC = json.loads((ROOT / "docs/data/la-bete-territory-living-identity-v1.json").read_text())
TOPO = json.loads((ROOT / "docs/data/france-topology.json").read_text())

class TerritoryLivingIdentityTests(unittest.TestCase):
    def test_national_baseline_is_complete_but_not_fabricated(self):
        self.assertEqual(DOC["schema"], "LA_BETE_TERRITORY_LIVING_IDENTITY_V1")
        self.assertEqual(DOC["departments_count"], 101)
        self.assertEqual(len(DOC["departments"]), 101)
        self.assertTrue(DOC["guards"]["no_random_identity_color"])
        self.assertTrue(DOC["guards"]["empty_is_better_than_fabricated"])
        pending = [d for d in DOC["departments"].values() if d["palette"]["identity"]["state"] == "PENDING_LOCAL_EVIDENCE"]
        self.assertGreaterEqual(len(pending), 100)
        for d in pending:
            self.assertEqual(d["palette"]["identity"]["colors"], [])
            self.assertEqual(d["media"]["items"], [])

    def test_three_human_reading_modes_and_media_grammar_exist(self):
        self.assertEqual([x["id"] for x in DOC["reading_modes"]], ["feel", "explore", "deepen"])
        self.assertEqual({x["id"] for x in DOC["media_grammar"]}, {"presence", "culture", "useful", "social"})

    def test_oise_is_rich_verified_pilot_with_attributed_media(self):
        o = DOC["departments"]["60"]
        self.assertEqual(o["state"], "LIVING_IDENTITY_VERIFIED_PILOT")
        self.assertEqual(o["palette"]["identity"]["state"], "VERIFIED_EDITORIAL_SYNTHESIS_FROM_SOURCED_MOTIFS")
        self.assertGreaterEqual(len(o["palette"]["identity"]["colors"]), 5)
        self.assertGreaterEqual(len(o["media"]["items"]), 3)
        self.assertGreaterEqual(len(o["points_of_interest"]), 4)
        self.assertGreaterEqual(len(o["opportunities"]), 3)
        self.assertTrue(any(x["family"] == "nature" for x in o["points_of_interest"]))
        self.assertTrue(any(x["family"] == "patrimoine" for x in o["points_of_interest"]))
        for media in o["media"]["items"]:
            self.assertTrue(media["author"])
            self.assertTrue(media["license"])
            self.assertEqual(urlparse(media["source_page"]).scheme, "https")
            self.assertEqual(urlparse(media["license_url"]).scheme, "https")
            p = ROOT / "docs" / media["asset"]
            self.assertTrue(p.is_file(), media["asset"])
            self.assertLess(p.stat().st_size, 2_000_000)

    def test_oise_opportunities_do_not_claim_market_demand(self):
        for item in DOC["departments"]["60"]["opportunities"]:
            self.assertFalse(item["economic_claim"])
            self.assertIn(item["state"], {"OPEN_VERIFIED_CONTRIBUTION", "PRODUCT_OPPORTUNITY_TO_VALIDATE", "OPEN_DOCUMENTATION_GAP"})

    def test_commune_overlays_reference_real_communes(self):
        index = {row[0]: row[1] for row in TOPO["detail"]["commune_index"]}
        for code, overlay in DOC["commune_overlays"].items():
            self.assertIn(code, index)
            self.assertEqual(overlay["name"], index[code])
            for linked in overlay["shared_links"]:
                self.assertIn(linked, index)
            for action in overlay["things_to_do"]:
                self.assertTrue(action["source"].startswith("https://"))

    def test_seasonal_layer_is_explicitly_editorial(self):
        self.assertTrue(DOC["guards"]["season_is_editorial_not_weather_observation"])
        o = DOC["departments"]["60"]["palette"]["seasonal"]
        self.assertTrue(o["state"].startswith("EDITORIAL_"))
        self.assertIn("météo", o["rule"])

if __name__ == "__main__":
    unittest.main(verbosity=2)
