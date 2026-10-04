#!/usr/bin/env python3
from la_bete_supra_system_knowhow import (
    KNOWLEDGE_ID,
    METHOD_DIGEST,
    TRANSFER_PATTERNS,
    build_supra_system_knowhow,
    validate_supra_system_knowhow,
)

value = build_supra_system_knowhow("OJO-TEST")
validate_supra_system_knowhow(value, "OJO-TEST")

assert value["knowledge_id"] == KNOWLEDGE_ID
assert value["method_digest"] == METHOD_DIGEST
assert value["adoption_status"] == "AVAILABLE_NOT_APPLIED"
assert value["application_mode"] == "CONSTRAINTS_FOR_EXISTING_LA_BETE_EVOLUTION_ONLY"
assert len(value["patterns"]) == len(TRANSFER_PATTERNS) == 12
ids = {x["id"] for x in value["patterns"]}
assert {
    "SUPRA_MEMORY_FIRST_REUSE_EXISTING",
    "SUPRA_MATERIAL_EVENT_SEMANTIC_FINGERPRINT",
    "SUPRA_VERIFIED_LEARNING_BEFORE_REINJECTION",
    "SUPRA_RECEIPT_NOT_ASSIMILATION",
    "SUPRA_HUMAN_GATE_BEFORE_EXTERNAL_ACTION",
    "SUPRA_MEDIA_RECOVER_BEFORE_GENERATE",
    "SUPRA_ROLLBACK_NON_REGRESSION_FIRST",
} <= ids
c = value["constraints"]
for key in (
    "authority_transfer", "capability_execution", "automatic_promotion",
    "automatic_truth_mutation", "automatic_phi_minting", "external_action",
    "second_runtime", "second_registry", "second_scheduler",
):
    assert c[key] is False
assert c["requires_receiver_validation"] is True
assert c["requires_non_regression"] is True
assert c["requires_rollback"] is True
assert value["evidence_contract"]["private_transfer_evidence_publicly_exposed"] is False
assert value["evidence_contract"]["public_projection_contains_internal_paths"] is False
assert value["evidence_contract"]["transport_proof_is_not_adoption_proof"] is True
assert value["evidence_contract"]["registered_or_received_is_not_applied"] is True

print("LA_BETE_SUPRA_SYSTEM_KNOWHOW_PASS")
