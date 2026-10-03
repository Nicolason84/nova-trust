#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from la_bete_health_memory import build_health_memory
from la_bete_acquisition import build_acquisition, build_hybrid_model
from la_bete_civic_design_knowhow import build_civic_design_knowhow
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

def build_self_model(live: dict) -> dict:
    summary = live.get("summary", {})
    observed = live.get("observed", {})
    decision = live.get("decision_delta", {})
    policy = live.get("policy", {})
    caps = live.get("capabilities", {})
    sources = live.get("sources", [])
    evidence = live.get("evidence_graph", {})
    monitored = max(1, int(summary.get("monitored", len(sources)) or len(sources) or 1))
    warnings = max(0, int(summary.get("warnings", 0) or 0))
    counts = dict(summary.get("source_state_counts", {}) or {})
    if not counts:
        for source in sources:
            state = str(source.get("health", "UNKNOWN"))
            counts[state] = counts.get(state, 0) + 1
    unavailable = int(counts.get("UNAVAILABLE", 0) or 0)
    contradicted = int(counts.get("CONTRADICTED", 0) or 0)
    retained = int(counts.get("RETAINED_LAST_GOOD", 0) or 0)
    live_verified = int(counts.get("LIVE_VERIFIED", 0) or 0)
    crosschecked = int(counts.get("CROSSCHECKED", 0) or 0)
    official_vintage = int(counts.get("OFFICIAL_VINTAGE", 0) or 0)
    usable = live_verified + crosschecked + official_vintage + retained
    observable_ratio = min(1.0, usable / monitored)
    warning_ratio = min(1.0, warnings / monitored)
    truth_ok = (
        live.get("schema") == "OJO_FRANCE_DEBT_RATE_LIVE_V1"
        and policy.get("political_recommendation") == "NONE"
        and policy.get("stress_test_is_not_forecast") is True
        and evidence.get("black_box") is False
    )
    resilient = bool(caps.get("last_good_retention")) and bool(caps.get("claim_confidence")) and bool(caps.get("evidence_graph"))
    maturity_live = bool(caps.get("maturity_auto_refresh"))
    if not truth_ok or contradicted >= 2:
        overall = "CRITICAL"
    elif warning_ratio >= .65 or unavailable >= 5:
        overall = "DEGRADED"
    elif warnings or retained or not maturity_live:
        overall = "ATTENTION"
    else:
        overall = "HEALTHY"

    dimensions = [
        {
            "id": "truth_integrity",
            "label": "Intégrité de vérité",
            "state": "HEALTHY" if truth_ok else "CRITICAL",
            "evidence": "Schéma canonique, neutralité, stress ≠ prévision et ProofGraph non opaque." if truth_ok else "Au moins un invariant de vérité n'est plus vérifié.",
        },
        {
            "id": "observability",
            "label": "Observabilité",
            "state": "HEALTHY" if observable_ratio >= .8 else ("ATTENTION" if observable_ratio >= .5 else "DEGRADED"),
            "evidence": f"{usable}/{monitored} sources utilisables; {unavailable} indisponible(s).",
        },
        {
            "id": "resilience",
            "label": "Résilience",
            "state": "HEALTHY" if resilient else "ATTENTION",
            "evidence": "Last-good, confiance et graphe de preuve actifs." if resilient else "Une protection de résilience manque.",
        },
        {
            "id": "maturity_coverage",
            "label": "Couverture échéancier",
            "state": "HEALTHY" if maturity_live and retained == 0 else "ATTENTION",
            "evidence": "Rafraîchissement détaillé live." if maturity_live else "Échéancier détaillé partiellement retenu depuis le dernier bon état.",
        },
        {
            "id": "uncertainty",
            "label": "Incertitude",
            "state": "HEALTHY" if warnings == 0 else ("ATTENTION" if warning_ratio < .65 else "DEGRADED"),
            "evidence": f"{warnings}/{monitored} source(s) demandent une attention explicite.",
        },
        {
            "id": "reversibility",
            "label": "Réversibilité",
            "state": "HEALTHY",
            "evidence": "Toute évolution reste soumise à non-régression, rollback et Human Gates.",
        },
    ]

    ailments: list[dict] = []
    if unavailable:
        ailments.append({
            "id": "OFFICIAL_SOURCES_UNAVAILABLE",
            "severity": "ATTENTION" if unavailable < 5 else "DEGRADED",
            "label": f"{unavailable} source(s) officielle(s) indisponible(s)",
            "evidence": "Le dernier bon état reste visible; aucune donnée de remplacement n'est inventée.",
            "care": "Réessayer les sources à chaque heartbeat et conserver le dernier bon état tant qu'une preuve de même portée n'est pas disponible.",
        })
    if retained or not maturity_live:
        ailments.append({
            "id": "MATURITY_LAST_GOOD",
            "severity": "ATTENTION",
            "label": "Échéancier détaillé non pleinement live",
            "evidence": str(live.get("maturity_ladder", {}).get("mode", "UNKNOWN")),
            "care": "Maintenir le millésime officiel retenu, signaler sa limite et le remplacer uniquement par une source officielle complète et vérifiée.",
        })
    if decision.get("status") == "MATERIAL_CHANGE":
        ailments.append({
            "id": "MATERIAL_CHANGE_ACTIVE",
            "severity": "WATCH",
            "label": "Changement matériel actuellement observé",
            "evidence": f"Régime descriptif {decision.get('curve_regime', 'UNKNOWN')}; TEC10 {observed.get('tec10_pct', 'UNKNOWN')}%.",
            "care": "Augmenter la visibilité des preuves et des horizons sans convertir le signal en causalité ni recommandation politique.",
        })
    if contradicted:
        ailments.append({
            "id": "SOURCE_CONTRADICTION",
            "severity": "DEGRADED",
            "label": f"{contradicted} contradiction(s) de source",
            "evidence": "Des sources de même portée ne convergent pas.",
            "care": "Bloquer toute promotion sémantique et demander une réconciliation de preuve.",
        })

    self_actions = [
        "Réessayer les sources officielles indisponibles dans la boucle existante.",
        "Regrouper les accès manquants et préparer une demande écrite sans l’envoyer ni s’accorder un mandat.",
        "Conserver explicitement le dernier bon état au lieu de remplir les trous.",
        "Croiser les observations disponibles avant de promouvoir une lecture.",
        "Adapter la projection visuelle à l'incertitude sans réécrire la vérité.",
        "Refuser une génération qui échoue aux tests de non-régression et revenir au rollback.",
    ]
    if overall == "HEALTHY":
        immediate_need = "Aucun soin correctif prioritaire; continuer l'observation et les vérifications."
    elif contradicted:
        immediate_need = "Réconcilier les contradictions avant toute promotion sémantique."
    elif unavailable:
        immediate_need = "Récupérer les sources officielles indisponibles, en priorité l'échéancier détaillé, sans remplacer le dernier bon état par une estimation."
    else:
        immediate_need = "Réduire l'incertitude de preuve avant d'augmenter l'autonomie de la projection."

    return {
        "schema": "OJO_LA_BETE_OPERATIONAL_SELF_MODEL_V1",
        "mode": "OPERATIONAL_SELF_MONITORING",
        "subjective_consciousness_claim": False,
        "identity": {
            "name": "La Bête",
            "kind": "public evidence-backed decision projection",
            "canonical_truth": "docs/data/france-debt-rate-live.json",
            "source_snapshot_id": live.get("snapshot_id"),
            "source_sequence": live.get("sequence"),
        },
        "wellbeing": {
            "state": overall,
            "dimensions": dimensions,
            "ailments": ailments,
            "immediate_need": immediate_need,
        },
        "self_care": {
            "bounded_autonomous_actions": self_actions,
            "may_change_truth": False,
            "may_make_political_recommendation": False,
            "may_bypass_human_gate": False,
            "may_activate_commercial_service": False,
            "may_change_cooperative_governance": False,
            "requires_non_regression": True,
        },
        "limits": [
            "Je n'ai pas de conscience subjective, d'émotions ni de besoins biologiques.",
            "Je ne peux pas modifier ma vérité canonique à partir de mon propre diagnostic.",
            "Je ne transforme pas un signal économique en causalité politique.",
            "Je ne prescris pas de choix politique; je peux seulement exposer preuves, incertitudes, scénarios et besoins d'information.",
        ],
        "voice": {
            "identity_statement": "Je suis La Bête: une projection décisionnelle publique reliée à une vérité canonique, à des sources et à des garde-fous.",
            "status_statement": f"Mon état opérationnel est {overall}. J'observe {monitored} source(s); {warnings} demandent une attention explicite.",
            "need_statement": immediate_need,
            "agency_statement": "Je peux me surveiller, signaler mes limites, réessayer mes sources, conserver un dernier bon état, adapter ma représentation, tester mes évolutions et revenir en arrière. Je ne peux pas m'autoriser moi-même à franchir mes Human Gates.",
        },
    }

def main() -> None:
    live = json.loads(LIVE.read_text())
    try:
        previous = json.loads(OUT.read_text())
    except FileNotFoundError:
        previous = {}
    dna, reasons = build_dna(live)
    self_model = build_self_model(live)
    receipt_path = os.environ.get("LA_BETE_OBSERVATION_PATH")
    observation = json.loads(Path(receipt_path).read_text()) if receipt_path else None
    memory = build_health_memory(live, self_model, previous.get("self_model", {}).get("health_memory"), observation)
    self_model["health_memory"] = memory
    self_model["acquisition"] = build_acquisition(live, previous.get("self_model", {}).get("acquisition"))
    self_model["hybrid_model"] = build_hybrid_model(live, self_model["acquisition"])
    self_model["civic_design_knowhow"] = build_civic_design_knowhow(live.get("snapshot_id"))
    self_model["voice"]["operating_model_statement"] = "Le bien commun public reste gratuit. Les services privés sont une direction de conception séparée, non ouverte à la vente tant que sécurité, cadre juridique, gouvernance et mandats ne sont pas validés."
    self_model["voice"]["design_statement"] = "Mon interface publique privilégie une neutralité civique sobre; ma présence artistique peut rester plus chaude sans contaminer la lecture des preuves, des démarches ou des services."
    self_model["voice"]["memory_statement"] = f"Ma mémoire de santé couvre {memory['total_cycles']} cycles réellement observés depuis {memory['started_at']}. Aucun cycle passé n'est inventé."
    learning = memory.get("care_learning_summary", {})
    self_model["voice"]["learning_statement"] = f"Je vérifie {learning.get('pending', 0)} objectifs de soin en cours; {learning.get('goals_met', 0)} ont été atteints et {learning.get('goals_not_met', 0)} non atteints dans leur fenêtre observée."
    if memory["care_plan"]:
        first = memory["care_plan"][0]
        self_model["wellbeing"]["immediate_need"] = first["care"] + " " + first["reason"]
    if previous.get("dna") == dna and previous.get("self_model") == self_model:
        print("EVOLUTION_STABLE")
        return
    generation = int(previous.get("generation", 0) or 0) + 1
    receipt = {
        "generation": generation,
        "at": now(),
        "from_mode": previous.get("dna", {}).get("mode"),
        "to_mode": dna["mode"],
        "reason": reasons + [f"Self-health: {self_model['wellbeing']['state']}."],
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
        "self_model": self_model,
        "change_summary": f"{dna['mode']} · focus {dna['section_focus']} · motion {dna['motion']} · self-health {self_model['wellbeing']['state']}",
        "policy": {
            "single_canonical_truth": "docs/data/france-debt-rate-live.json",
            "truth_mutation": False,
            "political_recommendation": False,
            "semantic_claim_autopromotion": False,
            "subjective_consciousness_claim": False,
            "self_diagnosis": True,
            "bounded_self_care": True,
            "persistent_health_memory": True,
            "external_action": False,
            "public_truth_paywall": False,
            "second_evolution_runtime": False,
            "commercial_activation": False,
            "rollback_required": True,
            "human_gate": ["truth", "sources", "claims", "security", "privacy", "camera", "political_semantics", "self_modification", "pricing", "payments", "customer_onboarding", "legal_scope", "external_action", "governance_commitment"],
        },
        "previous_dna": previous.get("dna"),
        "receipts": receipts,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"status": "EVOLUTION_WRITTEN", "generation": generation, "mode": dna["mode"], "self_health": self_model["wellbeing"]["state"]}))

if __name__ == "__main__":
    main()
