"""Public-safe SUPRA know-how projection for La Bête.

This module is a pure constraint/projection builder. It transfers no SUPRA
authority, capability, private path, scheduler, registry or runtime. The
private evidence packet and Megabus receipts remain outside the public repo.
"""
from __future__ import annotations

SCHEMA = "LA_BETE_SUPRA_SYSTEM_KNOWHOW_V1"
KNOWLEDGE_ID = "SUPRA_TO_LA_BETE_METHODS_981ea8a6a0d829e90f974e32"
METHOD_DIGEST = "981ea8a6a0d829e90f974e32cf6bca49d2e41f44509c6e504ee42174ec960abe"
TRANSFER_STATUS = "ROUND_TRIP_CONFIRMED"

TRANSFER_PATTERNS = (
    {
        "id": "SUPRA_MEMORY_FIRST_REUSE_EXISTING",
        "contract": "Recover, compare, fuse and reuse existing governed assets before creating a new engine, registry, scheduler or authority.",
    },
    {
        "id": "SUPRA_SINGLE_CANONICAL_AUTHORITY",
        "contract": "Keep one canonical authority for each object class; projections may enrich or explain but must not become competing truth stores.",
    },
    {
        "id": "SUPRA_SHA_BOUND_MEMORY_PROVENANCE",
        "contract": "Durable memory is reusable only when its source object is still present and its content hash matches the durable memory key.",
    },
    {
        "id": "SUPRA_MATERIAL_EVENT_SEMANTIC_FINGERPRINT",
        "contract": "Detect work from semantic state fingerprints; timestamps, PID/build identity, ordering and observer implementation must not create fake material change.",
    },
    {
        "id": "SUPRA_ONE_EVENT_ONE_CONSUMPTION",
        "contract": "Consume exactly one selected material fingerprint at a time, advance only its baseline, and prove no replay before learning reinjection.",
    },
    {
        "id": "SUPRA_VERIFIED_LEARNING_BEFORE_REINJECTION",
        "contract": "A learning candidate remains non-reinjectable until source event consumption, baseline advancement and no-replay effect verification all pass.",
    },
    {
        "id": "SUPRA_RECEIPT_NOT_ASSIMILATION",
        "contract": "Transport, receipt, registration, adoption and measured effectiveness are separate proofs; RECEIVED never means APPLIED.",
    },
    {
        "id": "SUPRA_HUMAN_GATE_BEFORE_EXTERNAL_ACTION",
        "contract": "External action, authority expansion, irreversible mutation or high-impact commitment stays behind an explicit bounded Human Gate.",
    },
    {
        "id": "SUPRA_LIVE_COCKPIT_PROOF_ACTION_SEPARATION",
        "contract": "Expose current state, next machine action, exact human action, proof/provenance and authorization controls separately instead of hiding them in a static status.",
    },
    {
        "id": "SUPRA_MEDIA_RECOVER_BEFORE_GENERATE",
        "contract": "For documentary/media work, recover and verify existing source-backed media and rights before generating replacement assets.",
    },
    {
        "id": "SUPRA_TESTED_CANDIDATE_NOT_ACTIVE_RUNTIME",
        "contract": "A tested candidate is not a native active runtime; promotion requires explicit runtime proof and rollback.",
    },
    {
        "id": "SUPRA_ROLLBACK_NON_REGRESSION_FIRST",
        "contract": "Every promoted change must preserve rollback and pass targeted non-regression; a new feature cannot silently weaken truth, privacy, authority or provenance.",
    },
)


def build_supra_system_knowhow(source_snapshot_id: str | None) -> dict:
    return {
        "schema": SCHEMA,
        "source_snapshot_id": source_snapshot_id,
        "source_system": "SUPRA",
        "target_system": "LA_BETE",
        "knowledge_id": KNOWLEDGE_ID,
        "method_digest": METHOD_DIGEST,
        "transfer_status": TRANSFER_STATUS,
        "adoption_status": "AVAILABLE_NOT_APPLIED",
        "application_mode": "CONSTRAINTS_FOR_EXISTING_LA_BETE_EVOLUTION_ONLY",
        "patterns": [dict(item) for item in TRANSFER_PATTERNS],
        "applicability": {
            "memory_and_learning": "USE_AS_CONSTRAINT",
            "territorial_verification": "USE_AS_CONSTRAINT",
            "public_action_surfaces": "USE_AS_CONSTRAINT",
            "media_workflows": "USE_AS_CONSTRAINT",
            "autoevolution": "USE_AS_PROPOSAL_CONSTRAINT_ONLY",
        },
        "constraints": {
            "authority_transfer": False,
            "capability_execution": False,
            "automatic_promotion": False,
            "automatic_truth_mutation": False,
            "automatic_phi_minting": False,
            "external_action": False,
            "second_runtime": False,
            "second_registry": False,
            "second_scheduler": False,
            "requires_receiver_validation": True,
            "requires_non_regression": True,
            "requires_rollback": True,
        },
        "human_gates": [
            "external_action",
            "authority_expansion",
            "self_modification",
            "truth",
            "claims",
            "security",
            "privacy",
        ],
        "evidence_contract": {
            "private_transfer_evidence_publicly_exposed": False,
            "public_projection_contains_internal_paths": False,
            "method_digest_is_public_reference": True,
            "transport_proof_is_not_adoption_proof": True,
            "registered_or_received_is_not_applied": True,
        },
    }


def transfer_patterns() -> list[dict]:
    return [dict(item) for item in TRANSFER_PATTERNS]


def validate_supra_system_knowhow(value: dict, source_snapshot_id: str | None = None) -> None:
    if value.get("schema") != SCHEMA:
        raise ValueError("SUPRA_SYSTEM_KNOWHOW_SCHEMA_MISMATCH")
    if source_snapshot_id is not None and value.get("source_snapshot_id") != source_snapshot_id:
        raise ValueError("SUPRA_SYSTEM_KNOWHOW_SNAPSHOT_MISMATCH")
    if value.get("source_system") != "SUPRA" or value.get("target_system") != "LA_BETE":
        raise ValueError("SUPRA_SYSTEM_KNOWHOW_DIRECTION_MISMATCH")
    if value.get("knowledge_id") != KNOWLEDGE_ID or value.get("method_digest") != METHOD_DIGEST:
        raise ValueError("SUPRA_SYSTEM_KNOWHOW_IDENTITY_MISMATCH")
    if value.get("transfer_status") not in {"FORWARD_ROUTED_ACK_PENDING", "ROUND_TRIP_CONFIRMED"}:
        raise ValueError("SUPRA_SYSTEM_KNOWHOW_TRANSFER_STATE_INVALID")
    if value.get("adoption_status") != "AVAILABLE_NOT_APPLIED":
        raise ValueError("SUPRA_SYSTEM_KNOWHOW_ADOPTION_OVERCLAIM")
    ids = {x.get("id") for x in value.get("patterns", [])}
    expected = {x["id"] for x in TRANSFER_PATTERNS}
    if ids != expected:
        raise ValueError("SUPRA_SYSTEM_KNOWHOW_PATTERN_SET_MISMATCH")
    constraints = value.get("constraints", {})
    for key in (
        "authority_transfer", "capability_execution", "automatic_promotion",
        "automatic_truth_mutation", "automatic_phi_minting", "external_action",
        "second_runtime", "second_registry", "second_scheduler",
    ):
        if constraints.get(key) is not False:
            raise ValueError("SUPRA_SYSTEM_KNOWHOW_FORBIDDEN_CAPABILITY:" + key)
    for key in ("requires_receiver_validation", "requires_non_regression", "requires_rollback"):
        if constraints.get(key) is not True:
            raise ValueError("SUPRA_SYSTEM_KNOWHOW_GUARD_MISSING:" + key)
    evidence = value.get("evidence_contract", {})
    if evidence.get("private_transfer_evidence_publicly_exposed") is not False:
        raise ValueError("SUPRA_SYSTEM_KNOWHOW_PRIVATE_EVIDENCE_EXPOSURE")
    if evidence.get("public_projection_contains_internal_paths") is not False:
        raise ValueError("SUPRA_SYSTEM_KNOWHOW_INTERNAL_PATH_EXPOSURE")
    if evidence.get("transport_proof_is_not_adoption_proof") is not True:
        raise ValueError("SUPRA_SYSTEM_KNOWHOW_TRANSPORT_ADOPTION_CONFLATION")
    if evidence.get("registered_or_received_is_not_applied") is not True:
        raise ValueError("SUPRA_SYSTEM_KNOWHOW_RECEIPT_ASSIMILATION_CONFLATION")
