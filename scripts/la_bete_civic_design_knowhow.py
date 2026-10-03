"""Pure civic-design know-how for La Bête.

This is a reusable constraint set, not an engine, scheduler or source mutator.
It lets the existing evolution and learning paths remember *why* the public
surface is neutral/institutional while the artistic presence may remain warmer.
"""
from __future__ import annotations

SCHEMA = "LA_BETE_CIVIC_DESIGN_KNOWHOW_V1"
PALETTE = {
    "civic_night": "#101820",
    "civic_surface": "#16212B",
    "civic_surface_2": "#24313D",
    "civic_ink": "#F3F5F4",
    "civic_blue": "#5B7C99",
    "civic_sage": "#6F8F86",
    "civic_copper": "#B58A62",
    "state_ok": "#6F9B84",
    "state_warn": "#C59C62",
    "state_alert": "#B55E63",
}

TRANSFER_PATTERNS = (
    {
        "id": "CIVIC_VISUAL_NEUTRALITY",
        "contract": "Public chrome uses sober slate/blue/sage surfaces; no partisan color dominance, no decorative tricolor and no alarm red as ordinary emphasis.",
    },
    {
        "id": "ARTISTIC_CIVIC_SEPARATION",
        "contract": "Keep La Bête's artistic presence distinctive and warmer, but do not let its dramatic copper/red language dominate public navigation, evidence, civic or service surfaces.",
    },
    {
        "id": "SEMANTIC_COLOR_DISCIPLINE",
        "contract": "Color carries explicit roles: blue for institutional interaction, sage for cooperative/civic continuity, copper for identity accents, green/amber/red only for verified state semantics.",
    },
    {
        "id": "DESIGN_NON_REGRESSION",
        "contract": "Visual adaptation never changes truth, claim type, political semantics, action authority or reading order; preserve focus visibility, mobile fit, reduced motion and the single existing 3D presence.",
    },
)


def build_civic_design_knowhow(source_snapshot_id: str | None) -> dict:
    return {
        "schema": SCHEMA,
        "source_snapshot_id": source_snapshot_id,
        "intent": "INDEPENDENT_CIVIC_INSTITUTION_NOT_STATE_BRANDING",
        "design_language": "SOBER_CIVIC_INSTITUTIONAL_WITH_DISTINCT_ARTISTIC_PRESENCE",
        "palette": dict(PALETTE),
        "surface_roles": {
            "public_chrome": "NEUTRAL_INSTITUTIONAL",
            "atlas": "NEUTRAL_INSTITUTIONAL",
            "public": "NEUTRAL_INSTITUTIONAL",
            "agir": "NEUTRAL_INSTITUTIONAL",
            "scic": "CIVIC_COOPERATIVE_SAGE",
            "services": "NEUTRAL_PROFESSIONAL",
            "private_boundary": "NEUTRAL_SECURITY_FIRST",
            "artistic_presence_3d": "DISTINCT_WARMER_COPPER_ALLOWED",
        },
        "semantic_color_roles": {
            "institutional_interaction": "civic_blue",
            "cooperative_continuity": "civic_sage",
            "identity_accent": "civic_copper",
            "verified_ok": "state_ok",
            "uncertainty_or_attention": "state_warn",
            "contradiction_or_alert_only": "state_alert",
        },
        "principles": [
            "L'interface publique doit inspirer sérieux, calme, lisibilité et indépendance sans se faire passer pour un service de l'État.",
            "La personnalité artistique de La Bête reste forte mais se concentre dans sa présence, ses médias et ses moments d'identité.",
            "Aucune couleur politique ou partisane ne doit devenir la couleur dominante du produit.",
            "Le rouge n'est pas une décoration de navigation : il est réservé aux contradictions, alertes ou risques explicitement documentés.",
            "Le cuivre signe La Bête sans transformer chaque surface en scène dramatique.",
            "La couleur commerciale ne peut jamais faire paraître une vérité plus fiable ni un service payant plus légitime qu'une information publique.",
        ],
        "constraints": {
            "partisan_color_dominance": False,
            "decorative_tricolor_branding": False,
            "ordinary_red_emphasis": False,
            "commercial_palette_may_signal_truth": False,
            "automatic_source_rewrite": False,
            "semantic_reordering": False,
            "requires_non_regression": True,
            "requires_visible_keyboard_focus": True,
            "requires_mobile_no_overflow": True,
            "requires_reduced_motion_support": True,
            "single_existing_3d_presence": True,
        },
        "autoevolution": {
            "engine": "EXISTING_OJO_LA_BETE_VIRTUOUS_EVOLUTION_V1",
            "second_runtime": False,
            "application_mode": "DEFAULT_CONSTRAINT_FOR_COMPILED_VISUAL_PROPOSALS",
            "proposal_only": True,
            "may_adapt": [
                "surface tone within the civic palette",
                "visual emphasis according to verified uncertainty",
                "spacing and density without hiding evidence",
                "presentation of new public, civic, cooperative or service surfaces",
            ],
            "may_not_adapt_without_human_gate": [
                "political semantics",
                "truth or claim types",
                "external action authority",
                "source code self-modification",
                "security or privacy boundaries",
            ],
            "human_gates": ["self_modification", "political_semantics", "accessibility_regression", "security", "privacy"],
        },
        "evidence_contract": {
            "style_sources": ["docs/assets/la-bete-explorer.css", "docs/assets/la-bete-art.css"],
            "behavior_tests": ["scripts/test_la_bete_explorer.cjs", "scripts/test_la_bete_explorer_browser.cjs"],
            "cache_contract": "20261004-civic-institutional-v1",
        },
    }


def transfer_patterns() -> list[dict]:
    return [dict(item) for item in TRANSFER_PATTERNS]


def validate_civic_design_knowhow(value: dict, source_snapshot_id: str | None = None) -> None:
    if value.get("schema") != SCHEMA:
        raise ValueError("CIVIC_DESIGN_SCHEMA_MISMATCH")
    if source_snapshot_id is not None and value.get("source_snapshot_id") != source_snapshot_id:
        raise ValueError("CIVIC_DESIGN_SNAPSHOT_MISMATCH")
    if value.get("palette") != PALETTE:
        raise ValueError("CIVIC_DESIGN_PALETTE_MISMATCH")
    roles = value.get("semantic_color_roles", {})
    expected = {
        "institutional_interaction": "civic_blue",
        "cooperative_continuity": "civic_sage",
        "identity_accent": "civic_copper",
        "verified_ok": "state_ok",
        "uncertainty_or_attention": "state_warn",
        "contradiction_or_alert_only": "state_alert",
    }
    if roles != expected:
        raise ValueError("CIVIC_DESIGN_ROLE_MISMATCH")
    c = value.get("constraints", {})
    for key in ("partisan_color_dominance", "decorative_tricolor_branding", "ordinary_red_emphasis",
                "commercial_palette_may_signal_truth", "automatic_source_rewrite", "semantic_reordering"):
        if c.get(key) is not False:
            raise ValueError("CIVIC_DESIGN_FORBIDDEN_CAPABILITY:" + key)
    for key in ("requires_non_regression", "requires_visible_keyboard_focus", "requires_mobile_no_overflow",
                "requires_reduced_motion_support", "single_existing_3d_presence"):
        if c.get(key) is not True:
            raise ValueError("CIVIC_DESIGN_GUARD_MISSING:" + key)
    auto = value.get("autoevolution", {})
    if auto.get("engine") != "EXISTING_OJO_LA_BETE_VIRTUOUS_EVOLUTION_V1" or auto.get("second_runtime") is not False:
        raise ValueError("CIVIC_DESIGN_SECOND_RUNTIME_FORBIDDEN")
    if auto.get("application_mode") != "DEFAULT_CONSTRAINT_FOR_COMPILED_VISUAL_PROPOSALS" or auto.get("proposal_only") is not True:
        raise ValueError("CIVIC_DESIGN_AUTOEVOLUTION_SCOPE_INVALID")
