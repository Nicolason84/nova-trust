import copy
import unittest

from app.scic_privacy_gate import (
    BatchWindow,
    default_gate_state,
    evaluate_gate,
    public_projection,
)


class PrivacyGateTests(unittest.TestCase):
    def test_default_gate_is_fail_closed(self):
        state = default_gate_state()
        verdict = evaluate_gate(state)
        self.assertEqual(verdict["verdict"], "BLOCKED")
        self.assertFalse(verdict["production_activation_allowed"])
        self.assertIn("CRYPTO_PROJECT_CI_NOT_PASS", verdict["failures"])
        self.assertIn("OHTTP_OPERATORS_NOT_CONFIGURED", verdict["failures"])
        self.assertIn("ANONYMITY_POLICY_NOT_APPROVED", verdict["failures"])
        self.assertIn("EXTERNAL_CRYPTO_REVIEW_NOT_PASS", verdict["failures"])

    def test_crypto_pass_alone_does_not_open_production(self):
        state = default_gate_state()
        state["cryptographic_gate"].update({
            "project_ci": "PASS",
            "upstream_rfc9474_vectors": "PASS",
            "standard_rsa_pss_crosscheck": "PASS",
        })
        verdict = evaluate_gate(state)
        self.assertFalse(verdict["production_activation_allowed"])
        self.assertIn("OHTTP_OPERATORS_NOT_CONFIGURED", verdict["failures"])

    def test_same_ohttp_operator_is_rejected(self):
        state = self.fully_approved_fixture()
        state["network_gate"]["gateway_operator"] = state["network_gate"]["relay_operator"]
        verdict = evaluate_gate(state)
        self.assertFalse(verdict["production_activation_allowed"])
        self.assertIn("OHTTP_RELAY_GATEWAY_OPERATOR_NOT_INDEPENDENT", verdict["failures"])

    def test_fully_approved_fixture_can_open_gate_logic(self):
        verdict = evaluate_gate(self.fully_approved_fixture())
        self.assertEqual(verdict["verdict"], "PASS")
        self.assertTrue(verdict["production_activation_allowed"])

    def test_public_projection_remains_blocked_and_unconfigured(self):
        p = public_projection()
        self.assertFalse(p["production_activation"])
        self.assertEqual(p["state"], "IMPLEMENTED_FAIL_CLOSED")
        self.assertEqual(p["current_verdict"], "BLOCKED")
        self.assertEqual(
            p["batching_target"]["production_minimum_set_size"],
            "UNSET_REQUIRES_PRIVACY_REVIEW",
        )

    def test_batch_does_not_release_before_window_closes(self):
        gate = BatchWindow(minimum_set_size=3, window_seconds=60)
        for i in range(3):
            gate.submit(("opaque-" + str(i)).encode().ljust(16, b"x"), "CITIZENS_USERS", 10+i)
        result = gate.release("CITIZENS_USERS", 0, 59)
        self.assertFalse(result["released"])
        self.assertEqual(result["reason"], "WINDOW_OPEN")

    def test_batch_does_not_release_small_anonymity_set(self):
        gate = BatchWindow(minimum_set_size=3, window_seconds=60)
        for i in range(2):
            gate.submit(("opaque-" + str(i)).encode().ljust(16, b"x"), "CITIZENS_USERS", 10+i)
        result = gate.release("CITIZENS_USERS", 0, 61)
        self.assertFalse(result["released"])
        self.assertEqual(result["reason"], "ANONYMITY_SET_TOO_SMALL")
        self.assertEqual(result["count"], 2)

    def test_batch_releases_only_after_threshold_and_window(self):
        gate = BatchWindow(minimum_set_size=3, window_seconds=60)
        for i in range(3):
            gate.submit(("opaque-" + str(i)).encode().ljust(16, b"x"), "CITIZENS_USERS", 10+i)
        result = gate.release("CITIZENS_USERS", 0, 61)
        self.assertTrue(result["released"])
        self.assertEqual(result["count"], 3)
        self.assertFalse(result["individual_timestamps"])

    def test_public_batch_receipt_does_not_expose_envelopes_or_timestamps(self):
        gate = BatchWindow(minimum_set_size=2, window_seconds=60)
        gate.submit(b"a" * 16, "CITIZENS_USERS", 1)
        gate.submit(b"b" * 16, "CITIZENS_USERS", 2)
        release = gate.release("CITIZENS_USERS", 0, 61)
        receipt = gate.public_receipt(release)
        self.assertTrue(receipt["released"])
        self.assertEqual(receipt["count"], 2)
        self.assertFalse(receipt["individual_timestamps"])
        self.assertFalse(receipt["envelope_digests_public"])
        self.assertNotIn("opaque_envelope_digests", receipt)

    def test_duplicate_opaque_envelope_rejected(self):
        gate = BatchWindow(minimum_set_size=2, window_seconds=60)
        gate.submit(b"a" * 16, "CITIZENS_USERS", 1)
        with self.assertRaises(ValueError):
            gate.submit(b"a" * 16, "CITIZENS_USERS", 2)

    @staticmethod
    def fully_approved_fixture():
        state = default_gate_state()
        state["cryptographic_gate"].update({
            "project_ci": "PASS",
            "upstream_rfc9474_vectors": "PASS",
            "standard_rsa_pss_crosscheck": "PASS",
        })
        state["network_gate"].update({
            "relay_operator": "independent-relay-operator",
            "gateway_operator": "scic-ballot-gateway-operator",
            "https_client_to_relay": True,
            "https_relay_to_gateway": True,
            "relay_strips_identifying_headers": True,
            "fresh_hpke_context_per_request": True,
            "padding_policy": "APPROVED",
        })
        state["anonymity_gate"].update({
            "policy_state": "APPROVED_BY_PRIVACY_REVIEW",
            "minimum_set_size": 20,
            "window_seconds": 300,
            "individual_public_timestamps": False,
            "small_set_release": "FORBIDDEN",
        })
        state["key_gate"].update({
            "issuer_private_key_exportable": False,
            "rotation_policy": "APPROVED",
            "compromise_runbook": "APPROVED",
        })
        state["review_gate"].update({
            "external_cryptographic_review": "COMPLETED_PASS",
            "privacy_threat_model_review": "COMPLETED_PASS",
            "independent_relay_operator_verified": True,
        })
        return state


if __name__ == "__main__":
    unittest.main(verbosity=2)
