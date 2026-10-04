#!/usr/bin/env python3
from evolve_france_debt_rate import build_dna, build_self_model
from la_bete_civic_design_knowhow import build_civic_design_knowhow, validate_civic_design_knowhow
from la_bete_scic_privacy_knowhow import build_scic_privacy_knowhow, validate_scic_privacy_knowhow

def fixture(warnings: int, delta: float, status: str, *, unavailable: int = 0, contradicted: int = 0, maturity_live: bool = True) -> dict:
    monitored = 9
    live_verified = max(0, monitored - warnings)
    sources = [{"health": "LIVE_VERIFIED"} for _ in range(live_verified)]
    sources += [{"health": "UNAVAILABLE"} for _ in range(unavailable)]
    sources += [{"health": "CONTRADICTED"} for _ in range(contradicted)]
    sources += [{"health": "RETAINED_LAST_GOOD"} for _ in range(max(0, warnings - unavailable - contradicted))]
    return {
        "schema": "OJO_FRANCE_DEBT_RATE_LIVE_V1",
        "snapshot_id": "OJO-TEST",
        "sequence": 1,
        "policy": {"political_recommendation": "NONE", "stress_test_is_not_forecast": True},
        "observed": {"tec10_vs_plf_assumption_bps": delta, "tec10_pct": 4.5},
        "summary": {
            "warnings": warnings, "healthy": monitored - warnings, "monitored": monitored,
            "source_state_counts": {
                "LIVE_VERIFIED": live_verified, "CROSSCHECKED": 0, "OFFICIAL_VINTAGE": 0,
                "RETAINED_LAST_GOOD": max(0, warnings - unavailable - contradicted),
                "UNAVAILABLE": unavailable, "CONTRADICTED": contradicted,
            },
        },
        "decision_delta": {"status": status, "curve_regime": "STEEPENING"},
        "derived": {},
        "evidence_graph": {"black_box": False},
        "capabilities": {
            "last_good_retention": True, "claim_confidence": True, "evidence_graph": True,
            "maturity_auto_refresh": maturity_live,
        },
        "maturity_ladder": {"mode": "OFFICIAL_LIVE" if maturity_live else "RETAINED_LAST_GOOD"},
        "sources": sources,
    }

cases = [
    (fixture(4, 110.3, "MATERIAL_CHANGE", unavailable=4, maturity_live=False), "EVIDENCE_GUARD", "evidence", "calm"),
    (fixture(0, 150.0, "NO_MATERIAL_CURVE_CHANGE"), "HIGH_SIGNAL", "decision", "balanced"),
    (fixture(0, 20.0, "NO_MATERIAL_CURVE_CHANGE"), "BALANCED", "market", "balanced"),
]
for live, mode, focus, motion in cases:
    dna, reasons = build_dna(live)
    assert dna["mode"] == mode, (dna, mode)
    assert dna["section_focus"] == focus, (dna, focus)
    assert dna["motion"] == motion, (dna, motion)
    assert dna["feature_flags"]["semantic_reordering"] is False
    assert len(reasons) == 3

attention = build_self_model(fixture(4, 110.3, "MATERIAL_CHANGE", unavailable=4, maturity_live=False))
assert attention["wellbeing"]["state"] == "ATTENTION", attention
assert any(x["id"] == "OFFICIAL_SOURCES_UNAVAILABLE" for x in attention["wellbeing"]["ailments"])
assert attention["self_care"]["may_change_truth"] is False
assert attention["subjective_consciousness_claim"] is False

healthy = build_self_model(fixture(0, 20.0, "NO_MATERIAL_CURVE_CHANGE", maturity_live=True))
assert healthy["wellbeing"]["state"] == "HEALTHY", healthy

critical_live = fixture(3, 20.0, "NO_MATERIAL_CURVE_CHANGE", contradicted=2)
critical = build_self_model(critical_live)
assert critical["wellbeing"]["state"] == "CRITICAL", critical
assert any(x["id"] == "SOURCE_CONTRADICTION" for x in critical["wellbeing"]["ailments"])


knowhow = build_civic_design_knowhow("OJO-TEST")
validate_civic_design_knowhow(knowhow, "OJO-TEST")
assert knowhow["palette"]["civic_blue"] == "#5B7C99"
assert knowhow["palette"]["civic_sage"] == "#6F8F86"
assert knowhow["palette"]["civic_copper"] == "#B58A62"
assert knowhow["semantic_color_roles"]["contradiction_or_alert_only"] == "state_alert"
assert knowhow["constraints"]["ordinary_red_emphasis"] is False
assert knowhow["constraints"]["commercial_palette_may_signal_truth"] is False
assert knowhow["autoevolution"]["second_runtime"] is False
assert knowhow["autoevolution"]["proposal_only"] is True

print("LA_BETE_EVOLUTION_THREE_REGIMES_AND_SELF_MODEL_PASS")

scic_knowhow = build_scic_privacy_knowhow("OJO-TEST")
validate_scic_privacy_knowhow(scic_knowhow, "OJO-TEST")
assert scic_knowhow["operating_rules"]["second_runtime"] is False
assert scic_knowhow["operating_rules"]["second_registry"] is False
assert scic_knowhow["transfer_policy"]["requested_action"] == "OBSERVE_ONLY"
assert scic_knowhow["transfer_policy"]["target_status"] == "RECEIVED_NOT_APPLIED"
assert {"TRUTH_OUTSIDE_BALLOT","BLIND_ISSUER_BALLOT_BOX_SEPARATION","OHTTP_RELAY_GATEWAY_INDEPENDENCE","ANONYMITY_BATCH_FAIL_CLOSED","HSM_NON_EXPORTABLE_KEY_CUSTODY","AUDIT_PACK_IS_NOT_AUDIT","VENDOR_EVIDENCE_NOT_MARKETING","REPLY_IS_CANDIDATE_EVIDENCE_NOT_PASS","AUTOEVOLUTION_LINEAGE_RECONCILIATION"} <= {x["id"] for x in scic_knowhow["patterns"]}
