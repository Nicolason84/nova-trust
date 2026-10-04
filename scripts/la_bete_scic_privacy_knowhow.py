"""Reusable SCIC/privacy know-how learned by La Bête.

This is a constraint/pattern library only. It is not a new engine, scheduler,
registry, authority or source of legal truth. It is projected into the existing
La Bête evolution self-model and transferred through the existing SUPRA
know-how bridge in OBSERVE_ONLY mode.
"""
from __future__ import annotations

SCHEMA = "LA_BETE_SCIC_PRIVACY_KNOWHOW_V1"

TRANSFER_PATTERNS = (
    {
        "id": "TRUTH_OUTSIDE_BALLOT",
        "contract": "Collective voting may choose norms, priorities, allocations and mandates; observed facts, provenance, evidence status, dates, identity facts and confidence scores are never made true by majority vote.",
    },
    {
        "id": "DECISION_MANDATE_EXECUTION_SEPARATION",
        "contract": "A vote yields a decision, not automatic execution. External action requires an explicit bounded mandate, authority receipt, scope, duration and budget gate.",
    },
    {
        "id": "PRIVATE_MEMBERSHIP_PUBLIC_RECEIPT",
        "contract": "Identity and eligibility evidence remain private; public membership state is pseudonymous or aggregate and must not expose civil identity, address, email, passkey identifiers or raw eligibility evidence.",
    },
    {
        "id": "NO_SELF_ADMISSION",
        "contract": "A participant may apply but cannot self-admit. Identity/eligibility verification and admission authority are separate from the applicant.",
    },
    {
        "id": "COLLEGE_ASSIGNMENT_NOT_SELF_SELECTED",
        "contract": "Voting-college assignment follows verified statutory rules and may not be freely chosen by the voter to alter vote weight.",
    },
    {
        "id": "BLIND_ISSUER_BALLOT_BOX_SEPARATION",
        "contract": "Membership authority, blind credential issuer and ballot box are separate trust domains; issuer sees no member identity/public pseudonym/ballot serial, and ballot box sees no membership entitlement or identity.",
    },
    {
        "id": "STANDARD_CRYPTO_BEFORE_PRODUCTION",
        "contract": "Research cryptography may prove architecture but cannot open production. Bind to a pinned RFC-grade implementation, run upstream vectors, cross-check standard verification and keep production fail-closed until runtime binding is proven.",
    },
    {
        "id": "PIN_DEPENDENCIES_AND_REPRODUCE",
        "contract": "Security-critical crypto/network dependencies are pinned by lock/checksum and the exact commit that carries receipts must rerun the gate; stale PASS badges are not evidence.",
    },
    {
        "id": "LOCAL_PROOF_NOT_DEPLOYMENT_PROOF",
        "contract": "Local/CI process separation, TLS, header stripping or HPKE freshness prove mechanics only; production additionally requires public endpoints, independent operator evidence, operational separation and deployment attestation.",
    },
    {
        "id": "OHTTP_RELAY_GATEWAY_INDEPENDENCE",
        "contract": "For network unlinkability, relay and gateway operators must be independently controlled; relay must not forward identifying metadata or possess gateway plaintext/private keys.",
    },
    {
        "id": "BHTTP_INSIDE_OHTTP",
        "contract": "Validate structured Binary HTTP request and response semantics inside OHTTP rather than treating opaque bytes alone as protocol correctness.",
    },
    {
        "id": "FRESH_HPKE_PER_REQUEST",
        "contract": "Equivalent plaintext requests must produce distinct OHTTP ciphertexts; request contexts must not be reused across ballots.",
    },
    {
        "id": "ANONYMITY_BATCH_FAIL_CLOSED",
        "contract": "Do not release before the fixed window closes or below the approved anonymity threshold; small sets roll forward and public receipts omit individual timestamps and envelope digests.",
    },
    {
        "id": "DO_NOT_INVENT_PRIVACY_THRESHOLDS",
        "contract": "Production anonymity-set size, batch window and padding policy remain unset until an independent privacy review recommends them.",
    },
    {
        "id": "ANONYMOUS_CREDENTIAL_REVOCATION_TRADEOFF",
        "contract": "Selective revocation after anonymous credential issuance can reintroduce linkability; prefer short-lived election-specific credentials and block future issuance rather than deanonymizing past credentials.",
    },
    {
        "id": "HSM_NON_EXPORTABLE_KEY_CUSTODY",
        "contract": "Production Blind RSA issuer keys are generated inside hardware-backed HSM/KMS, non-exportable, restricted to required signing/raw-RSA operations, dual-controlled, auditable, rotated and destructible by tested procedure.",
    },
    {
        "id": "FILE_KEY_IS_TEST_ONLY",
        "contract": "A file-backed private key may support synthetic/CI interoperability proof but must never silently satisfy the production key-custody gate.",
    },
    {
        "id": "AUDIT_PACK_IS_NOT_AUDIT",
        "contract": "A reproducible hashed audit pack is review input only; it must explicitly say audit verdict NOT_PERFORMED until an independent reviewer delivers findings and retest disposition.",
    },
    {
        "id": "EXTERNAL_AUDIT_RETEST_REQUIRED",
        "contract": "Security review does not pass production at proposal or first-report time; findings must be remediated and independently retested against a frozen commit.",
    },
    {
        "id": "VENDOR_EVIDENCE_NOT_MARKETING",
        "contract": "Select third parties on documented technical/operational evidence and contractual controls, not marketing claims or price alone; unsupported mandatory controls are blockers.",
    },
    {
        "id": "REPLY_IS_CANDIDATE_EVIDENCE_NOT_PASS",
        "contract": "A vendor reply, sales confirmation or pilot acceptance is only evidence candidate; it cannot automatically flip a production gate to PASS.",
    },
    {
        "id": "NO_ADDRESS_OR_CONTACT_GUESSING",
        "contract": "Use only public/verified contact channels and user-provided business details; do not invent email addresses, phone numbers, roles or postal data to cross an external form gate.",
    },
    {
        "id": "MINIMIZE_OUTREACH_PII",
        "contract": "Provide personal contact data only when the external channel genuinely requires it, avoid marketing opt-in by default, and do not persist sensitive values in public/project registries when a boolean receipt is sufficient.",
    },
    {
        "id": "EXTERNAL_ACTION_RECEIPTS",
        "contract": "Every real email/form submission/contractual step receives an explicit receipt; preparation, draft, sent, replied, contracted and production-proven remain distinct states.",
    },
    {
        "id": "HUMAN_GATE_AT_IRREVERSIBLE_OR_EXTERNAL_COMMITMENT",
        "contract": "Automation may prepare and verify internally; legal membership, contracts, spending, production keys, operator commitments, governance adoption and binding ballots remain explicit Human Gates.",
    },
    {
        "id": "AUTOEVOLUTION_LINEAGE_RECONCILIATION",
        "contract": "Before promotion, fetch/rebase on the latest heartbeat descendant and regenerate projections; never force-overwrite autoevolution outputs or confuse a generated projection with source logic.",
    },
    {
        "id": "PROOF_THEN_PROMOTE",
        "contract": "Run local/unit/browser/CI proofs on the exact candidate commit, then fast-forward promote only if lineage is clean; after heartbeat, re-prove the actually served public descendant.",
    },
    {
        "id": "PRODUCTION_GATE_FAIL_CLOSED",
        "contract": "A partially proven privacy stack remains BLOCKED. Missing independent relay, public TLS endpoints, approved anonymity policy, HSM custody, rotation/destruction drills or external reviews cannot be waived by internal success.",
    },
)


def build_scic_privacy_knowhow(source_snapshot_id: str | None) -> dict:
    return {
        "schema": SCHEMA,
        "source_snapshot_id": source_snapshot_id,
        "intent": "REUSE_PROVEN_GOVERNANCE_PRIVACY_AND_EXTERNAL_EVIDENCE_METHODS_WITHOUT_CREATING_NEW_AUTHORITY",
        "scope": [
            "cooperative democracy",
            "membership privacy",
            "anonymous voting credentials",
            "blind RSA",
            "OHTTP and Binary HTTP separation",
            "anonymity batching",
            "key custody",
            "audit readiness",
            "third-party qualification",
            "external-action evidence",
            "safe promotion and autoevolution lineage",
        ],
        "patterns": [dict(item) for item in TRANSFER_PATTERNS],
        "operating_rules": {
            "second_runtime": False,
            "second_registry": False,
            "truth_mutation": False,
            "automatic_promotion": False,
            "capability_execution": False,
            "external_action_without_authority": False,
            "production_gate_fail_closed": True,
            "vendor_reply_is_not_pass": True,
            "audit_pack_is_not_audit": True,
        },
        "evidence_contract": {
            "implementation_files": [
                "scripts/la_bete_acquisition.py",
                "app/citizen_pilot.py",
                "app/scic_blind_ballot.py",
                "app/scic_circl_runtime.py",
                "app/scic_ohttp_runtime.py",
                "app/scic_ohttp_https_harness.py",
                "app/scic_batch_runtime.py",
                "app/scic_key_custody.py",
                "app/scic_privacy_gate.py",
                "privacy/rfc9474_gate/cmd/scic-circl-runtime/main.go",
                "privacy/rfc9474_gate/go.mod",
                "privacy/rfc9474_gate/go.sum",
                "privacy/ohttp_runtime/src/main.rs",
                "privacy/ohttp_runtime/Cargo.toml",
                "privacy/ohttp_runtime/Cargo.lock",
                "audits/scic_privacy/THREAT_MODEL.md",
                "scripts/build_scic_privacy_audit_pack.py",
            ],
            "verification_files": [
                "scripts/test_citizen_pilot.py",
                "scripts/test_scic_blind_ballot.py",
                "scripts/test_scic_blind_ballot_process.py",
                "scripts/test_scic_circl_runtime.py",
                "scripts/test_scic_ohttp_runtime.py",
                "scripts/test_scic_ohttp_https_harness.py",
                "scripts/test_scic_ohttp_batch_pipeline.py",
                "scripts/test_scic_batch_runtime.py",
                "scripts/test_scic_key_custody.py",
                "scripts/test_scic_privacy_gate.py",
                "scripts/test_scic_privacy_audit_pack.py",
                "scripts/test_la_bete_acquisition.py",
                "scripts/verify_la_bete_evolution.py",
            ],
        },
        "transfer_policy": {
            "requested_action": "OBSERVE_ONLY",
            "target_status": "RECEIVED_NOT_APPLIED",
            "requires_target_specific_calibration": True,
            "may_create_capability_execution_request": False,
        },
    }


def transfer_patterns() -> list[dict]:
    return [dict(item) for item in TRANSFER_PATTERNS]


def validate_scic_privacy_knowhow(value: dict, source_snapshot_id: str | None = None) -> None:
    if value.get("schema") != SCHEMA:
        raise ValueError("SCIC_PRIVACY_KNOWHOW_SCHEMA_MISMATCH")
    if source_snapshot_id is not None and value.get("source_snapshot_id") != source_snapshot_id:
        raise ValueError("SCIC_PRIVACY_KNOWHOW_SNAPSHOT_MISMATCH")
    patterns = value.get("patterns")
    if patterns != [dict(item) for item in TRANSFER_PATTERNS]:
        raise ValueError("SCIC_PRIVACY_KNOWHOW_PATTERNS_MISMATCH")
    ids = [x.get("id") for x in patterns]
    if len(ids) != len(set(ids)):
        raise ValueError("SCIC_PRIVACY_KNOWHOW_DUPLICATE_PATTERN")
    rules = value.get("operating_rules", {})
    forbidden_true = (
        "second_runtime",
        "second_registry",
        "truth_mutation",
        "automatic_promotion",
        "capability_execution",
        "external_action_without_authority",
    )
    for key in forbidden_true:
        if rules.get(key) is not False:
            raise ValueError("SCIC_PRIVACY_KNOWHOW_FORBIDDEN_CAPABILITY:" + key)
    for key in ("production_gate_fail_closed", "vendor_reply_is_not_pass", "audit_pack_is_not_audit"):
        if rules.get(key) is not True:
            raise ValueError("SCIC_PRIVACY_KNOWHOW_GUARD_MISSING:" + key)
    policy = value.get("transfer_policy", {})
    if policy.get("requested_action") != "OBSERVE_ONLY":
        raise ValueError("SCIC_PRIVACY_KNOWHOW_TRANSFER_POLICY_MISMATCH")
    if policy.get("target_status") != "RECEIVED_NOT_APPLIED":
        raise ValueError("SCIC_PRIVACY_KNOWHOW_ADOPTION_STATUS_MISMATCH")
    if policy.get("may_create_capability_execution_request") is not False:
        raise ValueError("SCIC_PRIVACY_KNOWHOW_EXECUTION_FORBIDDEN")
