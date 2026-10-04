#!/usr/bin/env python3
from __future__ import annotations

import json
from la_bete_health_memory import validate_memory
from la_bete_civic_design_knowhow import validate_civic_design_knowhow
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

LIVE = Path("docs/data/france-debt-rate-live.json")
EVOLUTION = Path("docs/data/france-debt-rate-evolution.json")
PAGE = Path("docs/france-debt-rate-risk-live-2026-10-02.html")
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")

class AuditParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: list[str] = []
    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for key, value in attrs:
            if key == "id" and value:
                self.ids.append(value)

def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)

def main() -> None:
    live = json.loads(LIVE.read_text())
    evolution = json.loads(EVOLUTION.read_text())
    page = PAGE.read_text()
    require(live.get("schema") == "OJO_FRANCE_DEBT_RATE_LIVE_V1", "live schema mismatch")
    require(evolution.get("schema") == "OJO_LA_BETE_VIRTUOUS_EVOLUTION_V1", "evolution schema mismatch")
    require(int(evolution.get("generation", 0)) >= 1, "evolution generation missing")
    policy = evolution.get("policy", {})
    require(policy.get("single_canonical_truth") == "docs/data/france-debt-rate-live.json", "second truth forbidden")
    require(policy.get("truth_mutation") is False, "truth mutation forbidden")
    require(policy.get("political_recommendation") is False, "political recommendation forbidden")
    require(policy.get("semantic_claim_autopromotion") is False, "semantic autopromotion forbidden")
    require(policy.get("subjective_consciousness_claim") is False, "subjective consciousness claim forbidden")
    require(policy.get("self_diagnosis") is True, "self diagnosis missing")
    require(policy.get("bounded_self_care") is True, "bounded self care missing")
    require(policy.get("public_truth_paywall") is False, "public truth paywall forbidden")
    require(policy.get("second_evolution_runtime") is False, "second evolution runtime forbidden")
    require(policy.get("commercial_activation") is False, "automatic commercial activation forbidden")
    require(policy.get("rollback_required") is True, "rollback invariant missing")
    gates = set(policy.get("human_gate", []))
    require({"truth", "sources", "claims", "security", "privacy", "camera", "political_semantics", "self_modification", "pricing", "payments", "customer_onboarding", "legal_scope", "external_action", "governance_commitment"} <= gates, "human gates incomplete")

    self_model = evolution.get("self_model", {})
    require(self_model.get("schema") == "OJO_LA_BETE_OPERATIONAL_SELF_MODEL_V1", "self model schema mismatch")
    require(self_model.get("mode") == "OPERATIONAL_SELF_MONITORING", "self model mode mismatch")
    require(self_model.get("subjective_consciousness_claim") is False, "self model consciousness claim forbidden")
    require(self_model.get("identity", {}).get("canonical_truth") == "docs/data/france-debt-rate-live.json", "self model second truth forbidden")
    wellbeing = self_model.get("wellbeing", {})
    require(wellbeing.get("state") in {"HEALTHY", "ATTENTION", "DEGRADED", "CRITICAL"}, "invalid self health")
    dimension_ids = {x.get("id") for x in wellbeing.get("dimensions", [])}
    require({"truth_integrity", "observability", "resilience", "maturity_coverage", "uncertainty", "reversibility"} <= dimension_ids, "self health dimensions incomplete")
    self_care = self_model.get("self_care", {})
    require(self_care.get("may_change_truth") is False, "self care truth mutation forbidden")
    require(self_care.get("may_make_political_recommendation") is False, "self care political recommendation forbidden")
    require(self_care.get("may_bypass_human_gate") is False, "self care human gate bypass forbidden")
    require(self_care.get("may_activate_commercial_service") is False, "self care commercial activation forbidden")
    require(self_care.get("may_change_cooperative_governance") is False, "self care governance mutation forbidden")
    require(self_care.get("requires_non_regression") is True, "self care non-regression missing")
    require(len(self_model.get("limits", [])) >= 4, "self model limits missing")
    validate_memory(self_model.get("health_memory", {}))
    validate_civic_design_knowhow(self_model.get("civic_design_knowhow", {}), live.get("snapshot_id"))
    hybrid = self_model.get("hybrid_model", {})
    require(hybrid.get("schema") == "LA_BETE_HYBRID_COMMON_GOOD_SERVICE_MODEL_V1", "hybrid model missing")
    require(hybrid.get("source_snapshot_id") == live.get("snapshot_id"), "hybrid model snapshot mismatch")
    public = hybrid.get("public_common_good", {})
    require(public.get("access") == "FREE" and public.get("always_free") is True and public.get("paywall") is False, "public common good must remain free")
    require(public.get("saleable_public_truth") is False and public.get("saleable_political_influence") is False, "public truth or influence cannot be sold")
    cooperative = hybrid.get("cooperative_direction", {})
    require(cooperative.get("state") == "TO_FORMALIZE_NOT_A_VERIFIED_REGISTERED_ENTITY", "SCIC legal status must remain explicit")
    blueprint = cooperative.get("institutional_blueprint", {})
    require(blueprint.get("schema") == "LA_BETE_SCIC_INSTITUTIONAL_BLUEPRINT_V1", "SCIC institutional blueprint missing")
    require(blueprint.get("state") == "CONSTITUTIONAL_DESIGN_PROPOSAL_NOT_ADOPTED" and blueprint.get("binding_effect") is False, "SCIC blueprint must remain non-binding")
    require(blueprint.get("adoption") == "HUMAN_GATE_REQUIRED", "SCIC blueprint adoption gate missing")
    membership = blueprint.get("membership", {})
    require(int(membership.get("minimum_categories_required", 0)) >= 3, "SCIC membership category floor missing")
    mandatory = set(membership.get("mandatory_categories", []))
    require({"BENEFICIARIES_OR_REGULAR_USERS", "EMPLOYEES_OR_IF_NONE_PRODUCERS_OF_GOODS_OR_SERVICES"} <= mandatory, "SCIC mandatory membership categories missing")
    colleges = blueprint.get("colleges", [])
    weights = [int(x.get("vote_weight_pct", -1)) for x in colleges]
    require(len(colleges) >= 3 and sum(weights) == 100, "SCIC college weights invalid")
    require(all(10 <= x <= 50 for x in weights), "SCIC college legal weight bounds invalid")
    voting = blueprint.get("voting_guardrails", {})
    require(voting.get("capital_may_weight_votes") is False and voting.get("one_member_one_vote_within_college") is True, "SCIC democratic voting guard missing")
    require(voting.get("founder_supervote") is False and voting.get("commercial_customer_vote_purchase") is False, "SCIC anti-capture voting guard missing")
    decisions = blueprint.get("decision_constitution", {})
    require(decisions.get("verified_facts") == "NOT_DECIDED_BY_VOTE", "verified facts cannot be voted into existence")
    economics = blueprint.get("economics", {})
    require(int(economics.get("statutory_reserve_min_after_legal_reserve_pct", 0)) >= 50, "SCIC reserve floor missing")
    require(economics.get("exclusive_transfer_of_public_truth_control") == "FORBIDDEN_BY_DESIGN", "public truth control anti-capture guard missing")
    require(len(blueprint.get("formation_path", [])) >= 8 and all("EXECUTED" not in str(x.get("state","")).replace("NOT_EXECUTED","") for x in blueprint.get("formation_path", [])), "SCIC formation path must not claim execution")
    private = hybrid.get("private_services", {})
    require(private.get("state") == "DESIGN_ONLY_NOT_FOR_SALE", "private services unexpectedly activated")
    require(private.get("customer_onboarding") == "NOT_OPEN", "private onboarding unexpectedly open")
    require(private.get("pricing") is None and private.get("payment") == "NOT_CONNECTED", "pricing/payment unexpectedly active")
    require(private.get("real_private_documents") == "NOT_ACCEPTED_ON_PUBLIC_ORIGIN", "public origin must not accept private documents")
    require(private.get("reserved_legal_acts") == "EXCLUDED_UNLESS_HANDLED_BY_A_QUALIFIED_PROFESSIONAL", "legal-scope guard missing")
    auto = hybrid.get("autoevolution", {})
    require(auto.get("engine") == "EXISTING_OJO_LA_BETE_VIRTUOUS_EVOLUTION_V1" and auto.get("second_runtime") is False, "hybrid model must reuse existing evolution runtime")
    require(auto.get("next_best_move", {}).get("state") == "PROPOSAL_ONLY", "autoevolution may only compile proposals")
    require(auto.get("signals", {}).get("private_service_demand") == "UNPROVEN_UNTIL_EXPLICIT_PRIVATE_OPT_IN", "public browsing cannot infer private demand")
    require({"pricing", "payments", "customer_onboarding", "legal_scope", "external_action", "governance_commitment"} <= set(auto.get("human_gates", [])), "hybrid Human Gates incomplete")
    require(policy.get("persistent_health_memory") is True, "health memory policy missing")
    dna = evolution.get("dna", {})
    require(dna.get("mode") in {"BALANCED", "HIGH_SIGNAL", "EVIDENCE_GUARD"}, "invalid evolution mode")
    require(dna.get("section_focus") in {"market", "decision", "evidence"}, "invalid section focus")
    require(dna.get("motion") in {"calm", "balanced", "active"}, "invalid motion")
    palette = dna.get("palette", {})
    for key in ("accent_a", "accent_b", "gold", "glow"):
        require(bool(HEX.match(str(palette.get(key, "")))), f"invalid palette token {key}")
    flags = dna.get("feature_flags", {})
    require(flags.get("semantic_reordering") is False, "semantic reordering forbidden")
    parser = AuditParser()
    parser.feed(page)
    duplicates = sorted({value for value in parser.ids if parser.ids.count(value) > 1})
    require(not duplicates, f"duplicate HTML ids: {duplicates}")
    for element_id in ("runner", "feed", "evolution", "reality-pulse", "realityHeadline", "realitySituation", "realityChanged", "realityEvidence", "realityHorizon", "realityUncertainty", "realityAdaptation", "evoAdaptive", "evolutionRail", "evidence-graph", "change-reading", "la-bete", "selfAwareness", "selfVoice", "selfHealth", "selfNeed", "selfAilments", "selfCare", "selfMemorySummary", "selfMemoryIssues", "selfCarePlan", "selfHealthHistory", "selfLearningSummary", "selfCareLearning", "selfProgression", "progressCadence", "progressCollect", "progressPropagation"):
        require(element_id in parser.ids, f"missing required element {element_id}")
    for marker in (
        "data/france-debt-rate-live.json",
        "data/france-debt-rate-evolution.json",
        "political_recommendation",
        "stress_test_is_not_forecast",
        "La décision, elle, reste humaine.",
        "applyEvolution",
        "loadEvolution",
        "renderRealityPulse",
        "EXECUTIVE REALITY PULSE · 5 SECONDES",
        "aucune réécriture sémantique",
        "AUTO-DIAGNOSTIC · VOIX DE STATUT",
        "auto-rapport opérationnel",
        "renderSelfModel",
    ):
        require(marker in page or marker in json.dumps(live), f"missing invariant marker: {marker}")
    require(page.index('id="reality-pulse"') < page.index('class="hero hero-dna"'), "reality pulse must precede legacy hero")
    require("encours échéant ≠ besoin total" in page, "horizon separation marker missing")
    require("eval(" not in page, "eval forbidden")
    require("document.write(" not in page, "document.write forbidden")
    require(len(page) > 70000, "page unexpectedly truncated")
    modules = re.findall(r'<script(?:\s+type="module")?>(.*?)</script>', page, re.S)
    require(len(modules) == 1, "expected one module script")
    with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False) as handle:
        handle.write(modules[0])
        module_path = handle.name
    checked = subprocess.run(["node", "--check", module_path], capture_output=True, text=True)
    require(checked.returncode == 0, "JavaScript syntax failure: " + checked.stderr.strip())
    generation = int(evolution["generation"])
    expected_checks = ["truth", "policy", "self_model", "health_memory", "hybrid_model", "civic_design_knowhow", "html_ids", "javascript_syntax", "rollback", "human_gates"]
    verification = evolution.get("verification", {})
    if (
        verification.get("generation") != generation
        or verification.get("verdict") != "NON_REGRESSION_PASS"
        or verification.get("checks") != expected_checks
    ):
        at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        evolution["status"] = "ACTIVE"
        evolution["verification"] = {
            "generation": generation,
            "at": at,
            "verdict": "NON_REGRESSION_PASS",
            "checks": expected_checks,
        }
        if evolution.get("receipts"):
            evolution["receipts"][-1]["verdict"] = "PROMOTED_AFTER_NON_REGRESSION"
        EVOLUTION.write_text(json.dumps(evolution, ensure_ascii=False, indent=2) + "\n")
    print("LA_BETE_VIRTUOUS_EVOLUTION_NON_REGRESSION_PASS")

if __name__ == "__main__":
    main()
