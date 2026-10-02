#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

LIVE = Path("docs/data/france-debt-rate-live.json")
OUT = Path("docs/data/france-debt-rate-evolution.json")
PALETTES = {
    "BALANCED": {"accent_a": "#c8f09a", "accent_b": "#8bd6e5", "gold": "#e7bd72", "glow": "#173443"},
    "HIGH_SIGNAL": {"accent_a": "#d8ff8b", "accent_b": "#7fe2ef", "gold": "#ffc96b", "glow": "#244653"},
    "EVIDENCE_GUARD": {"accent_a": "#bfe8a0", "accent_b": "#8fd8e8", "gold": "#f0c47b", "glow": "#3c3425"},
}

def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def build_dna(live: dict) -> tuple[dict, list[str]]:
    observed = live.get("observed", {})
    summary = live.get("summary", {})
    decision = live.get("decision_delta", {})
    warnings = int(summary.get("warnings", 0) or 0)
    delta_bps = float(observed.get("tec10_vs_plf_assumption_bps", 0) or 0)
    material = decision.get("status") == "MATERIAL_CHANGE"
    if warnings >= 4:
        mode = "EVIDENCE_GUARD"
        focus = "evidence"
    elif material or abs(delta_bps) >= 100:
        mode = "HIGH_SIGNAL"
        focus = "decision"
    else:
        mode = "BALANCED"
        focus = "market"
    motion = "calm" if warnings else ("active" if material else "balanced")
    curve_regime = live.get("derived", {}).get("curve_regime") or decision.get("curve_regime", "UNKNOWN")
    reasons = [
        f"{warnings} source(s) require explicit attention.",
        f"TEC10 delta versus the published budget assumption: {delta_bps:+.1f} bp.",
        f"Decision Delta status: {decision.get('status', 'UNKNOWN')}.",
    ]
    dna = {
        "mode": mode,
        "section_focus": focus,
        "motion": motion,
        "palette": PALETTES[mode],
        "feature_flags": {
            "adaptive_palette": True,
            "freshness_guard": True,
            "emphasize_evidence": focus == "evidence",
            "emphasize_decision": focus == "decision",
            "emphasize_market": focus == "market",
            "compact_sources": warnings == 0,
            "semantic_reordering": False,
        },
        "signal": {
            "warnings": warnings,
            "healthy": int(summary.get("healthy", 0) or 0),
            "monitored": int(summary.get("monitored", 0) or 0),
            "tec10_delta_bps": delta_bps,
            "curve_regime": curve_regime,
            "decision_delta_status": decision.get("status", "UNKNOWN"),
        },
    }
    return dna, reasons

def main() -> None:
    live = json.loads(LIVE.read_text())
    try:
        previous = json.loads(OUT.read_text())
    except Exception:
        previous = {}
    dna, reasons = build_dna(live)
    if previous.get("dna") == dna:
        print("EVOLUTION_STABLE")
        return
    generation = int(previous.get("generation", 0) or 0) + 1
    receipt = {
        "generation": generation,
        "at": now(),
        "from_mode": previous.get("dna", {}).get("mode"),
        "to_mode": dna["mode"],
        "reason": reasons,
        "verdict": "CANDIDATE_COMPILED_FOR_VERIFICATION",
    }
    receipts = (previous.get("receipts", []) + [receipt])[-40:]
    state = {
        "schema": "OJO_LA_BETE_VIRTUOUS_EVOLUTION_V1",
        "generation": generation,
        "updated_at": receipt["at"],
        "source_snapshot_id": live.get("snapshot_id"),
        "source_sequence": live.get("sequence"),
        "dna": dna,
        "change_summary": f"{dna['mode']} · focus {dna['section_focus']} · motion {dna['motion']}",
        "policy": {
            "single_canonical_truth": "docs/data/france-debt-rate-live.json",
            "truth_mutation": False,
            "political_recommendation": False,
            "semantic_claim_autopromotion": False,
            "external_action": False,
            "rollback_required": True,
            "human_gate": ["truth", "sources", "claims", "security", "privacy", "camera", "political_semantics"],
        },
        "previous_dna": previous.get("dna"),
        "receipts": receipts,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"status": "EVOLUTION_WRITTEN", "generation": generation, "mode": dna["mode"]}))

if __name__ == "__main__":
    main()
