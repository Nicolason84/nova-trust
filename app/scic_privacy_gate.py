"""Fail-closed production privacy gate for future SCIC voting.

This module contains policy and batching mechanics only. It does not expose a
network service and does not activate production voting.

Cryptographic conformance is proven separately in CI. Network unlinkability
requires an independently operated RFC 9458 OHTTP relay/gateway deployment.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field

SCHEMA = "LA_BETE_SCIC_PRODUCTION_PRIVACY_GATE_V1"
RFC9474_VARIANT = "RSABSSA-SHA384-PSS-Deterministic"
RFC9578_PROFILE = "RFC9578_PUBLICLY_VERIFIABLE_BLIND_RSA_TOKEN_TYPE_0x0002"
CIRCL_VERSION = "v1.6.5"
NETWORK_PROFILE = "RFC9458_OHTTP_OR_EQUIVALENT_INDEPENDENT_RELAY"


def default_gate_state():
    return {
        "schema": SCHEMA,
        "production_activation": False,
        "cryptographic_gate": {
            "profile": RFC9578_PROFILE,
            "variant": RFC9474_VARIANT,
            "backend": "CLOUDFLARE_CIRCL",
            "backend_version": CIRCL_VERSION,
            "project_ci": "PASS",
            "upstream_rfc9474_vectors": "PASS",
            "standard_rsa_pss_crosscheck": "PASS",
            "runtime_binding": "PROVEN_CI_SIDECAR",
        },
        "network_gate": {
            "profile": NETWORK_PROFILE,
            "runtime_binding": "PROVEN_CI_THREE_PROCESS_RFC9458",
            "backend": "MARTINTHOMSON_OHTTP",
            "backend_version": "0.8.0",
            "relay_plaintext_probe": False,
            "relay_operator": None,
            "gateway_operator": None,
            "https_client_to_relay": False,
            "https_relay_to_gateway": False,
            "relay_strips_identifying_headers": False,
            "fresh_hpke_context_per_request": False,
            "padding_policy": "NOT_APPROVED",
        },
        "anonymity_gate": {
            "runtime_binding": "PROVEN_PERSISTENT_SQLITE_OPAQUE_BATCHER",
            "persistence_restart_proven": True,
            "small_set_behavior": "ROLL_FORWARD",
            "policy_state": "PROPOSAL_ONLY",
            "minimum_set_size": None,
            "window_seconds": None,
            "individual_public_timestamps": False,
            "small_set_release": "FORBIDDEN",
        },
        "key_gate": {
            "contract_state": "IMPLEMENTED_FAIL_CLOSED",
            "current_provider": "FILE_TEST_ONLY",
            "custody_verdict": "BLOCKED",
            "issuer_private_key_exportable": True,
            "rotation_policy": "NOT_APPROVED",
            "compromise_runbook": "NOT_APPROVED",
        },
        "review_gate": {
            "internal_threat_model": "V1_COMPLETE",
            "audit_pack": "READY_FOR_EXTERNAL_REVIEW",
            "external_cryptographic_review": "NOT_COMPLETED",
            "privacy_threat_model_review": "NOT_COMPLETED",
            "independent_relay_operator_verified": False,
        },
    }


def evaluate_gate(state):
    """Return a deterministic fail-closed production verdict."""
    failures = []
    c = state.get("cryptographic_gate", {})
    if c.get("profile") != RFC9578_PROFILE:
        failures.append("CRYPTO_PROFILE_MISMATCH")
    if c.get("variant") != RFC9474_VARIANT:
        failures.append("RFC9474_VARIANT_MISMATCH")
    if c.get("backend") != "CLOUDFLARE_CIRCL" or c.get("backend_version") != CIRCL_VERSION:
        failures.append("PINNED_BACKEND_MISMATCH")
    for key in ("project_ci", "upstream_rfc9474_vectors", "standard_rsa_pss_crosscheck"):
        if c.get(key) != "PASS":
            failures.append("CRYPTO_" + key.upper() + "_NOT_PASS")
    if c.get("runtime_binding") != "PROVEN_CI_SIDECAR":
        failures.append("CRYPTO_RUNTIME_BINDING_NOT_PROVEN")

    n = state.get("network_gate", {})
    if n.get("runtime_binding") != "PROVEN_CI_THREE_PROCESS_RFC9458":
        failures.append("OHTTP_RUNTIME_BINDING_NOT_PROVEN")
    relay, gateway = n.get("relay_operator"), n.get("gateway_operator")
    if not relay or not gateway:
        failures.append("OHTTP_OPERATORS_NOT_CONFIGURED")
    elif relay == gateway:
        failures.append("OHTTP_RELAY_GATEWAY_OPERATOR_NOT_INDEPENDENT")
    if not n.get("https_client_to_relay"):
        failures.append("CLIENT_RELAY_HTTPS_NOT_PROVEN")
    if not n.get("https_relay_to_gateway"):
        failures.append("RELAY_GATEWAY_HTTPS_NOT_PROVEN")
    if not n.get("relay_strips_identifying_headers"):
        failures.append("RELAY_HEADER_MINIMIZATION_NOT_PROVEN")
    if not n.get("fresh_hpke_context_per_request"):
        failures.append("OHTTP_FRESH_HPKE_CONTEXT_NOT_PROVEN")
    if n.get("padding_policy") != "APPROVED":
        failures.append("PADDING_POLICY_NOT_APPROVED")

    a = state.get("anonymity_gate", {})
    if a.get("runtime_binding") != "PROVEN_PERSISTENT_SQLITE_OPAQUE_BATCHER":
        failures.append("PERSISTENT_BATCH_RUNTIME_NOT_PROVEN")
    if a.get("small_set_behavior") != "ROLL_FORWARD":
        failures.append("SMALL_SET_ROLL_FORWARD_NOT_PROVEN")
    if a.get("policy_state") != "APPROVED_BY_PRIVACY_REVIEW":
        failures.append("ANONYMITY_POLICY_NOT_APPROVED")
    size = a.get("minimum_set_size")
    if not isinstance(size, int) or size < 2:
        failures.append("ANONYMITY_SET_THRESHOLD_NOT_APPROVED")
    window = a.get("window_seconds")
    if not isinstance(window, int) or window <= 0:
        failures.append("BATCH_WINDOW_NOT_APPROVED")
    if a.get("individual_public_timestamps") is not False:
        failures.append("INDIVIDUAL_PUBLIC_TIMESTAMPS_FORBIDDEN")
    if a.get("small_set_release") != "FORBIDDEN":
        failures.append("SMALL_SET_RELEASE_MUST_BE_FORBIDDEN")

    k = state.get("key_gate", {})
    if k.get("contract_state") != "IMPLEMENTED_FAIL_CLOSED":
        failures.append("KEY_CUSTODY_CONTRACT_NOT_IMPLEMENTED")
    if k.get("custody_verdict") != "PASS":
        failures.append("HSM_KEY_CUSTODY_NOT_PROVEN")
    if k.get("issuer_private_key_exportable") is not False:
        failures.append("ISSUER_PRIVATE_KEY_EXPORTABILITY_NOT_BLOCKED")
    if k.get("rotation_policy") != "APPROVED":
        failures.append("KEY_ROTATION_POLICY_NOT_APPROVED")
    if k.get("compromise_runbook") != "APPROVED":
        failures.append("KEY_COMPROMISE_RUNBOOK_NOT_APPROVED")

    r = state.get("review_gate", {})
    if r.get("external_cryptographic_review") != "COMPLETED_PASS":
        failures.append("EXTERNAL_CRYPTO_REVIEW_NOT_PASS")
    if r.get("privacy_threat_model_review") != "COMPLETED_PASS":
        failures.append("PRIVACY_REVIEW_NOT_PASS")
    if r.get("independent_relay_operator_verified") is not True:
        failures.append("INDEPENDENT_RELAY_OPERATOR_NOT_VERIFIED")

    return {
        "schema": SCHEMA,
        "production_activation_allowed": not failures,
        "verdict": "PASS" if not failures else "BLOCKED",
        "failures": failures,
    }


@dataclass
class BatchWindow:
    """Opaque-envelope batching proof.

    The gate stores only an envelope digest, a college label and a coarse bucket.
    It never stores an identity, pseudonym or per-envelope public timestamp.
    """

    minimum_set_size: int
    window_seconds: int
    _buckets: dict = field(default_factory=dict)

    def __post_init__(self):
        if self.minimum_set_size < 2:
            raise ValueError("MINIMUM_ANONYMITY_SET_TOO_SMALL")
        if self.window_seconds <= 0:
            raise ValueError("INVALID_BATCH_WINDOW")

    def _bucket_id(self, timestamp: int) -> int:
        if not isinstance(timestamp, int) or timestamp < 0:
            raise ValueError("INVALID_TIMESTAMP")
        return timestamp // self.window_seconds

    def submit(self, envelope: bytes, college: str, timestamp: int):
        if not isinstance(envelope, bytes) or len(envelope) < 16:
            raise ValueError("OPAQUE_ENVELOPE_REQUIRED")
        if not isinstance(college, str) or not college:
            raise ValueError("COLLEGE_REQUIRED")
        bucket = self._bucket_id(timestamp)
        key = (college, bucket)
        digest = hashlib.sha256(envelope).hexdigest()
        rows = self._buckets.setdefault(key, [])
        if digest in rows:
            raise ValueError("DUPLICATE_ENVELOPE")
        rows.append(digest)
        return {
            "college": college,
            "bucket": bucket,
            "queued": True,
            "individual_timestamp_published": False,
        }

    def release(self, college: str, bucket: int, now: int):
        if self._bucket_id(now) <= bucket:
            return {
                "released": False,
                "reason": "WINDOW_OPEN",
                "college": college,
                "bucket": bucket,
            }
        rows = list(self._buckets.get((college, bucket), []))
        if len(rows) < self.minimum_set_size:
            return {
                "released": False,
                "reason": "ANONYMITY_SET_TOO_SMALL",
                "college": college,
                "bucket": bucket,
                "count": len(rows),
            }
        self._buckets.pop((college, bucket), None)
        return {
            "released": True,
            "college": college,
            "bucket": bucket,
            "count": len(rows),
            "opaque_envelope_digests": rows,
            "individual_timestamps": False,
        }

    def public_receipt(self, release_result):
        return {
            "schema": "LA_BETE_SCIC_ANONYMITY_BATCH_PUBLIC_RECEIPT_V1",
            "released": bool(release_result.get("released")),
            "college": release_result.get("college"),
            "bucket": release_result.get("bucket"),
            "count": release_result.get("count", 0),
            "individual_timestamps": False,
            "envelope_digests_public": False,
        }


def public_projection():
    state = default_gate_state()
    verdict = evaluate_gate(state)
    return {
        "schema": SCHEMA,
        "state": "IMPLEMENTED_FAIL_CLOSED",
        "production_activation": False,
        "current_verdict": verdict["verdict"],
        "blocking_reasons": verdict["failures"],
        "cryptographic_target": {
            "rfc9474_variant": RFC9474_VARIANT,
            "rfc9578_profile": RFC9578_PROFILE,
            "backend": "CLOUDFLARE_CIRCL",
            "backend_version": CIRCL_VERSION,
            "runtime_binding": "PROVEN_CI_SIDECAR",
            "ci_workflow": ".github/workflows/scic-production-privacy-gate.yml",
        },
        "network_target": {
            "profile": NETWORK_PROFILE,
            "runtime_binding": "PROVEN_CI_THREE_PROCESS_RFC9458",
            "backend": "MARTINTHOMSON_OHTTP_0_8_0",
            "bhttp_profile": "RFC9292_BINARY_HTTP",
            "local_https_transport": "PROVEN_CI_TWO_HOP_TLS_HOSTNAME_VERIFIED",
            "local_header_minimization": "PROVEN_CI_RELAY_STRIPS_IDENTIFYING_HEADERS",
            "fresh_hpke_context_per_request": "PROVEN_CI_DISTINCT_CIPHERTEXT",
            "public_tls_endpoints": "NOT_CONFIGURED",
            "independent_operator": "NOT_VERIFIED",
            "relay_gateway_same_operator_allowed": False,
            "relay_may_forward_identifying_headers": False,
            "fresh_hpke_context_per_request_required": True,
        },
        "batching_target": {
            "mechanism": "FIXED_WINDOW_OPAQUE_ENVELOPE_BATCH",
            "runtime_binding": "PROVEN_PERSISTENT_SQLITE_OPAQUE_BATCHER",
            "small_set_behavior": "ROLL_FORWARD",
            "production_minimum_set_size": "UNSET_REQUIRES_PRIVACY_REVIEW",
            "production_window_seconds": "UNSET_REQUIRES_PRIVACY_REVIEW",
            "small_set_release": "FORBIDDEN",
            "individual_public_timestamps": False,
        },
        "key_custody_target": {
            "contract_state": "IMPLEMENTED_FAIL_CLOSED",
            "current_provider": "FILE_TEST_ONLY",
            "production_hsm": "REQUIRED",
        },
        "audit_target": {
            "internal_threat_model": "V1_COMPLETE",
            "audit_pack": "READY_FOR_EXTERNAL_REVIEW",
            "external_cryptographic_review": "REQUIRED",
            "privacy_threat_model_review": "REQUIRED",
            "independent_relay_operator": "REQUIRED",
        },
    }
