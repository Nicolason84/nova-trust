#!/usr/bin/env python3
from evolve_france_debt_rate import build_dna

def fixture(warnings: int, delta: float, status: str) -> dict:
    return {
        "observed": {"tec10_vs_plf_assumption_bps": delta},
        "summary": {"warnings": warnings, "healthy": 9 - warnings, "monitored": 9},
        "decision_delta": {"status": status, "curve_regime": "STEEPENING"},
        "derived": {},
    }

cases = [
    (fixture(4, 110.3, "MATERIAL_CHANGE"), "EVIDENCE_GUARD", "evidence", "calm"),
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

print("LA_BETE_EVOLUTION_THREE_REGIMES_PASS")
