#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDER_PATH = ROOT / "scripts/build_la_bete_evidence_universe.py"
spec = importlib.util.spec_from_file_location("evidence_universe_builder", BUILDER_PATH)
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)

doc = B.build()

assert doc["schema"] == "LA_BETE_EVIDENCE_UNIVERSE_V1"
assert doc["state"] == "READ_ONLY_PUBLIC_PROOFGRAPH_DERIVED_PROJECTION"
assert doc["coverage"]["departments_with_profiles"] == 101
assert doc["coverage"]["objects_total"] >= 1200

contract = doc["contract"]
for key in (
    "truth_verdict","authenticity_verdict","automatic_promotion",
    "automatic_phi_minting","automatic_truth_mutation","external_action",
    "second_runtime","second_registry","second_scheduler",
):
    assert contract[key] is False, key
assert contract["proofgraph_is_spine"] is True
assert contract["trust_index_means_evidence_readiness_not_truth"] is True
assert contract["coherence_means_structural_contextual_consistency_not_truth"] is True
assert contract["smca_is_structural_not_semantic"] is True
assert contract["deep_smca_executed"] is False
assert contract["uscrc_profile_is_certificate"] is False

engines = doc["engines"]
assert engines["proofgraph"]["status"] == "REUSED_ACTIVE_PUBLIC_PROJECTION"
assert engines["trust"]["historical_engine_execution"] is False
assert engines["coherence"]["historical_engine_execution"] is False
assert engines["smca"]["deep_analysis"] == "NOT_RUN"
assert engines["uscrc"]["runtime_certificate"] is False
assert engines["trusty"]["status"] == "LABEL_ONLY_NO_SEPARATE_ENGINE"

objects = doc["objects"]
for oid, item in objects.items():
    assert item["uscrc"]["certificate_issued"] is False, oid
    assert 0 <= item["trust"]["index"] <= 100, oid
    for score in item["trust"]["components"].values():
        if score is not None:
            assert 0 <= score <= 100, (oid, score)

source = objects["source:BDF_TEC"]
assert source["evidence_state"] == "LIVE_VERIFIED"
assert source["trust"]["index"] >= 80
assert source["proofgraph"]["source_urls"]

claim = objects["claim:TEC10"]
assert claim["evidence_state"] == "CROSSCHECKED"
assert claim["trust"]["components"]["crosscheck"] >= 90
assert len(claim["proofgraph"]["proof_refs"]) >= 3

media_candidates = [x for x in objects.values() if x["kind"] == "TERRITORY_MEDIA_CANDIDATE"]
assert len(media_candidates) >= 90
assert all(x["smca"]["authenticity_verdict"] is False for x in media_candidates)
with_asset = [x for x in media_candidates if x["smca"].get("asset")]
assert with_asset
assert all(len(x["smca"].get("sha256","")) == 64 for x in with_asset)
assert all(x["smca"]["deep_smca"] == "DEEP_SMCA_NOT_RUN" for x in with_asset)

living = [x for x in objects.values() if x["kind"] == "VERIFIED_LIVING_MEDIA"]
assert living
assert all(x["evidence_state"] == "VERIFIED_LIVING_IDENTITY_MEDIA" for x in living)
assert all(x["uscrc"]["certificate_issued"] is False for x in living)

official = [x for x in objects.values() if x["evidence_state"] == "OFFICIAL_DATASET_CANDIDATE"]
assert official
assert all(x["trust"]["components"]["source_quality"] >= 90 for x in official)

encoded = json.dumps(doc, ensure_ascii=False, sort_keys=True)
for forbidden in (
    '"truth_certified": true',
    '"authenticity_certified": true',
    '"certificate_issued": true',
    '"automatic_phi_minting": true',
):
    assert forbidden not in encoded

print("LA_BETE_EVIDENCE_UNIVERSE_V1_PASS", doc["coverage"], doc["projection_fingerprint"])
