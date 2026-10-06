#!/usr/bin/env python3
import importlib.util
import json
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDER_PATH = ROOT / "scripts/build_la_bete_evidence_universe.py"
spec = importlib.util.spec_from_file_location("evidence_universe_builder", BUILDER_PATH)
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)

from la_bete_patrimonial_engines import run_legacy_text_engines

doc = B.build()

assert doc["schema"] == "LA_BETE_EVIDENCE_UNIVERSE_V1"
assert doc["object_model"]["schema"] == "LA_BETE_EVIDENCE_OBJECT_MODEL_V2"
assert doc["state"] == "READ_ONLY_PUBLIC_PROOFGRAPH_DERIVED_PROJECTION"
assert doc["coverage"]["departments_with_profiles"] == 101
assert doc["coverage"]["objects_total"] >= 1300

requested_kinds = {
    "DOCUMENT", "PERSON", "ORGANIZATION", "COMPANY", "INITIATIVE", "OPPORTUNITY",
    "DECISION", "VIDEO", "AUDIO", "ARCHIVE", "CONTRIBUTION", "RELATION",
}
assert requested_kinds.issubset(set(doc["object_model"]["supported_kinds"]))
assert doc["object_model"]["single_registry"] is True
assert doc["object_model"]["relations_are_first_class_objects"] is True
assert doc["object_model"]["company_legal_form_inference"] is False
assert doc["object_model"]["unpopulated_kinds_are_not_fabricated"] is True

contract = doc["contract"]
for key in (
    "truth_verdict", "authenticity_verdict", "automatic_promotion",
    "automatic_phi_minting", "automatic_truth_mutation", "external_action",
    "second_runtime", "second_registry", "second_scheduler",
):
    assert contract[key] is False, key
assert contract["proofgraph_is_spine"] is True
assert contract["trust_index_means_evidence_readiness_not_truth"] is True
assert contract["coherence_means_structural_contextual_consistency_not_truth"] is True
assert contract["smca_is_structural_not_semantic"] is True
assert contract["deep_smca_executed"] is True
assert contract["uscrc_profile_is_certificate"] is False

engines = doc["engines"]
assert engines["proofgraph"]["status"] == "REUSED_ACTIVE_PUBLIC_PROJECTION"
assert engines["trust"]["historical_engine_execution"] is True
assert engines["trust"]["executed_document_count"] >= 1
assert engines["coherence"]["historical_engine_execution"] is True
assert engines["coherence"]["executed_document_count"] >= 1
assert engines["smca"]["deep_analysis"] == "EXECUTED"
assert engines["smca"]["executed_media_count"] >= 90
assert engines["uscrc"]["runtime_certificate"] is False
assert engines["uscrc"]["object_execution"] is False
assert engines["trusty"]["status"] == "LABEL_ONLY_NO_SEPARATE_ENGINE"

bindings = doc["patrimonial_engine_bindings"]
assert bindings["schema"] == "LA_BETE_PATRIMONIAL_ENGINE_BINDINGS_V1"
assert bindings["private_source_code_published"] is False
assert bindings["bindings"]["trust_deep_engine"]["status"] == "RECOVERED_EXECUTION_VIA_HASHED_RECEIPTS"
assert bindings["bindings"]["trust_deep_engine"]["truth_verdict"] is False
assert bindings["bindings"]["trust_industrial_engine"]["status"] == "RECOVERED_ALIAS_NO_UNIQUE_EXECUTABLE_FILENAME_PROVEN"
assert bindings["bindings"]["trust_industrial_engine"]["execution"] == "SYSTEM_CONTEXT_ONLY_NO_OBJECT_CERTIFICATION"
assert bindings["bindings"]["coherence_historical"]["status"] == "RECOVERED_EXECUTION_VIA_HASHED_RECEIPTS"
deep_binding = bindings["bindings"]["deep_smca"]
assert deep_binding["method"] == "STRUCTURAL_MEDIA_COHERENCE_ANALYSIS_V0_1"
assert deep_binding["upstream_commit"] == "0c01bb99bdd32efa30814ee6fd430f322ed759e4"
assert deep_binding["status"] == "PINNED_PUBLIC_UPSTREAM_EXECUTABLE_NOT_REPUBLISHED"
assert deep_binding["execution"] == "PINNED_UPSTREAM_SOURCE_VERIFIED_BY_HASH_VIA_ADAPTER"
assert deep_binding["source_code_vendored"] is False
assert deep_binding["license_declared_in_upstream_root"] is False
assert len(deep_binding["source_tree_sha256"]) == 64
assert deep_binding["truth_verdict"] is False
assert deep_binding["authenticity_verdict"] is False
assert bindings["bindings"]["uscrc"]["object_execution"] is False
assert bindings["bindings"]["uscrc"]["certificate_issued"] is False
assert bindings["bindings"]["uscrc"]["scope"] == "HISTORICAL_INTERNAL_SYSTEM_CONTEXT_NOT_LA_BETE_OBJECT_RISK"

live = json.loads((ROOT / "docs/data/france-debt-rate-live.json").read_text())
objects = doc["objects"]
for oid, item in objects.items():
    assert item["uscrc"]["certificate_issued"] is False, oid
    assert 0 <= item["trust"]["index"] <= 100, oid
    for score in item["trust"]["components"].values():
        if score is not None:
            assert 0 <= score <= 100, (oid, score)

live_source = next(x for x in live["sources"] if x.get("id") == "BDF_TEC")
source = objects["source:BDF_TEC"]
assert source["evidence_state"] == live_source["health"]
assert source["trust"]["components"]["source_quality"] == B.SOURCE_STATE_SCORE.get(live_source["health"], 50)
assert source["proofgraph"]["source_urls"]

live_claim = next(x for x in live["claims"] if x.get("claim_id") == "TEC10")
claim = objects["claim:TEC10"]
assert claim["evidence_state"] == live_claim["state"]
assert {"TEC10", *live_claim.get("source_ids", [])}.issubset(set(claim["proofgraph"]["proof_refs"]))
if live_claim["state"] == "CROSSCHECKED":
    assert claim["trust"]["components"]["crosscheck"] >= 90
elif live_claim["state"] == "CONTRADICTED":
    assert claim["trust"]["components"]["crosscheck"] <= 10
else:
    assert claim["trust"]["components"]["crosscheck"] <= 55

# The public pulse is allowed to degrade when one same-vintage crosscheck is absent.
# Evidence readiness must follow that state instead of fabricating CROSSCHECKED.
assert B.claim_crosscheck_score("CROSSCHECKED", ["BDF_TEC", "BDF_WEBSTAT"])[0] >= 90
assert B.claim_crosscheck_score("LIVE_VERIFIED", ["BDF_TEC", "BDF_WEBSTAT"])[0] == 55
assert B.claim_crosscheck_score("RETAINED_LAST_GOOD", ["BDF_TEC_RETAINED"])[0] == 55
assert B.claim_crosscheck_score("CONTRADICTED", ["BDF_TEC", "BDF_WEBSTAT"])[0] <= 10

media_candidates = [x for x in objects.values() if x["kind"] == "TERRITORY_MEDIA_CANDIDATE"]
assert len(media_candidates) >= 90
with_asset = [x for x in media_candidates if x["smca"].get("asset")]
assert with_asset
assert all(len(x["smca"].get("sha256", "")) == 64 for x in with_asset)
assert all(x["smca"]["deep_smca"] == "EXECUTED" for x in with_asset)
assert all(x["smca"]["deep_analysis"]["executed"] is True for x in with_asset)
assert all(x["smca"]["deep_analysis"]["truth_verdict"] is False for x in with_asset)
assert all(x["smca"]["deep_analysis"]["authenticity_verdict"] is False for x in with_asset)

documents = [x for x in objects.values() if x["kind"] == "DOCUMENT"]
assert len(documents) >= 10
def is_executed_receipt(item):
    p = item["patrimonial_analysis"]
    return (
        p.get("status") == "HASH_BOUND_PATRIMONIAL_RECEIPT"
        or p.get("trust_deep", {}).get("execution") == "EXECUTED_PATRIMONIAL_ENGINE_RECEIPT"
    )
executed_docs = [x for x in documents if is_executed_receipt(x)]
assert executed_docs
for item in executed_docs:
    p = item["patrimonial_analysis"]
    assert p["trust_deep"]["truth_verdict"] is False
    assert p["coherence_historical"]["truth_verdict"] is False
    expected_sha = item["object_meta"]["sha256"]
    bound_sha = (
        p.get("document_sha256")
        or p["trust_deep"].get("receipt_document_sha256")
        or p["coherence_historical"].get("receipt_document_sha256")
    )
    assert bound_sha == expected_sha

# Exact-document hash gate: a changed digest must not inherit a prior result.
stale = run_legacy_text_engines(
    '{"changed":true}\n',
    local_name="data/france-organism.json",
    document_sha256="0" * 64,
)
assert stale["trust_deep"]["execution"] == "NOT_EXECUTED_NO_MATCHING_RECEIPT"
assert stale["coherence_historical"]["execution"] == "NOT_EXECUTED_NO_MATCHING_RECEIPT"

people = [x for x in objects.values() if x["kind"] == "PERSON"]
assert people
assert all(x["object_meta"].get("identity_claim") is False for x in people)
assert all(x["object_meta"].get("attribution_label_only") is True for x in people)

organizations = [x for x in objects.values() if x["kind"] == "ORGANIZATION"]
assert organizations
assert all(x["object_meta"].get("legal_form_inferred") is False for x in organizations)

initiatives = [x for x in objects.values() if x["kind"] == "INITIATIVE"]
assert initiatives
opportunities = [x for x in objects.values() if x["kind"] == "OPPORTUNITY"]
assert opportunities
assert all(x["object_meta"].get("opportunity_is_not_market_demand") is True for x in opportunities)

decisions = [x for x in objects.values() if x["kind"] == "DECISION"]
assert decisions
assert all(x["object_meta"].get("decision_semantics") == "ANALYTICAL_SIGNAL_NOT_ACT" for x in decisions)

archives = [x for x in objects.values() if x["kind"] == "ARCHIVE"]
assert archives
relations = [x for x in objects.values() if x["kind"] == "RELATION"]
assert relations

# Supported but absent kinds remain zero instead of fabricated entities.
supported_counts = doc["coverage"]["supported_kind_counts"]
for kind in ("COMPANY", "VIDEO", "AUDIO", "CONTRIBUTION"):
    assert kind in supported_counts
    assert supported_counts[kind] >= 0

receipts = json.loads((ROOT / "docs/data/la-bete-patrimonial-engine-receipts-v1.json").read_text())
assert receipts["schema"] == "LA_BETE_PATRIMONIAL_ENGINE_RECEIPTS_V1"
assert receipts["public_contract"]["private_engine_source_embedded"] is False
assert receipts["public_contract"]["local_paths_embedded"] is False
assert receipts["public_contract"]["truth_verdict"] is False
assert receipts["public_contract"]["authenticity_verdict"] is False
assert receipts["public_contract"]["uscrc_object_certificate"] is False
assert receipts["public_contract"]["receipts_bind_results_to_document_and_engine_hashes"] is True
assert len(receipts["documents"]) >= 10
assert receipts["engine_families"]["trust_deep_engine"]["source_sha256"]
assert receipts["engine_families"]["coherence_historical"]["source_sha256"]
assert receipts["engine_families"]["trust_industrial_engine"]["system_context_only"] is True
assert receipts["engine_families"]["uscrc"]["object_certificate"] is False
uscrc_context = (receipts.get("system_context") or {}).get("uscrc") or {}
if uscrc_context:
    assert uscrc_context["object_execution"] is False
    assert uscrc_context["certificate_issued"] is False
    assert uscrc_context["scope"] == "HISTORICAL_INTERNAL_SYSTEM_CONTEXT_NOT_LA_BETE_OBJECT_RISK"

manifest = json.loads((ROOT / "vendor/patrimonial-engines/manifest.json").read_text())
assert manifest["schema"] == "LA_BETE_PATRIMONIAL_ENGINE_MANIFEST_V3"
assert manifest["private_engine_source_code_published"] is False
assert manifest["source_code_vendored"] is False
assert manifest["execution_guards"]["private_engine_source_embedded"] is False
assert manifest["execution_guards"]["upstream_source_republished"] is False
assert manifest["execution_guards"]["truth_certification"] is False
assert manifest["execution_guards"]["authenticity_certification"] is False
assert manifest["execution_guards"]["uscrc_object_certificate"] is False
upstream = manifest["media_coherence_check_upstream"]
assert upstream["commit"] == "0c01bb99bdd32efa30814ee6fd430f322ed759e4"
assert upstream["repository"] == "https://github.com/banna652/media-coherence-check"
assert upstream["license_declared_in_upstream_root"] is False
assert len(upstream["files_sha256"]) >= 10
assert len(upstream["source_tree_sha256"]) == 64
assert not any("__pycache__" in name or name.endswith(".pyc") for name in upstream["files_sha256"])

encoded = json.dumps(doc, ensure_ascii=False, sort_keys=True)
receipts_encoded = json.dumps(receipts, ensure_ascii=False, sort_keys=True)
for forbidden in (
    '"truth_certified": true',
    '"authenticity_certified": true',
    '"certificate_issued": true',
    '"automatic_phi_minting": true',
    "/Users/",
    "Library/Application Support",
    "NOVA_LABS/",
    "NOVA_OS/",
):
    assert forbidden not in encoded
    assert forbidden not in receipts_encoded

materialized = json.loads((ROOT / "docs/data/la-bete-evidence-universe-v1.json").read_text())
assert materialized == doc, "materialized Evidence Universe does not match deterministic builder"

gitignore = (ROOT / ".gitignore").read_text()
assert "vendor/patrimonial-engines/legacy/" in gitignore
assert "vendor/patrimonial-engines/media-coherence-check/" in gitignore
assert not (ROOT / "vendor/patrimonial-engines/media-coherence-check").exists()

workflow = (ROOT / ".github/workflows/france-debt-rate-live.yml").read_text()
trigger_section = workflow.split("permissions:", 1)[0]
for required_trigger in (
    '"scripts/build_la_bete_evidence_universe.py"',
    '"scripts/test_la_bete_evidence_universe.py"',
    '"scripts/la_bete_patrimonial_engines.py"',
    '"scripts/run_patrimonial_smca.py"',
    '"scripts/refresh_la_bete_patrimonial_receipts.py"',
    '"docs/data/la-bete-patrimonial-engine-receipts-v1.json"',
    '"vendor/patrimonial-engines/**"',
):
    assert required_trigger in trigger_section, required_trigger
assert '"docs/data/la-bete-evidence-universe-v1.json"' not in trigger_section
assert workflow.count("python3 scripts/build_la_bete_evidence_universe.py") >= 2
assert workflow.count("python3 scripts/test_la_bete_evidence_universe.py") >= 2
assert "https://github.com/banna652/media-coherence-check.git" in workflow
assert "0c01bb99bdd32efa30814ee6fd430f322ed759e4" in workflow
assert "LA_BETE_SMCA_SOURCE_ROOT" in workflow
assert 'python3 -m pip install --quiet -r "$smca_root/requirements.txt"' in workflow
assert "libimage-exiftool-perl" in workflow
assert "ffmpeg" in workflow
assert "libmagic1" in workflow
assert "docs/data/la-bete-evidence-universe-v1.json" in workflow.split("tracked=(", 1)[1]

print("LA_BETE_EVIDENCE_UNIVERSE_V2_CAPABILITIES_PASS", doc["coverage"], doc["projection_fingerprint"])
