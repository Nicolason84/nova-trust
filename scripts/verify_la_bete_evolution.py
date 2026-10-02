#!/usr/bin/env python3
from __future__ import annotations

import json
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
    require(policy.get("rollback_required") is True, "rollback invariant missing")
    gates = set(policy.get("human_gate", []))
    require({"truth", "sources", "claims", "security", "privacy", "camera", "political_semantics"} <= gates, "human gates incomplete")
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
    for element_id in ("runner", "feed", "evolution", "evoAdaptive", "evolutionRail", "evidence-graph", "change-reading", "la-bete"):
        require(element_id in parser.ids, f"missing required element {element_id}")
    for marker in (
        "data/france-debt-rate-live.json",
        "data/france-debt-rate-evolution.json",
        "political_recommendation",
        "stress_test_is_not_forecast",
        "La décision, elle, reste humaine.",
        "applyEvolution",
        "loadEvolution",
    ):
        require(marker in page or marker in json.dumps(live), f"missing invariant marker: {marker}")
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
    if evolution.get("verification", {}).get("generation") != generation:
        at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        evolution["status"] = "ACTIVE"
        evolution["verification"] = {
            "generation": generation,
            "at": at,
            "verdict": "NON_REGRESSION_PASS",
            "checks": ["truth", "policy", "html_ids", "javascript_syntax", "rollback", "human_gates"],
        }
        if evolution.get("receipts"):
            evolution["receipts"][-1]["verdict"] = "PROMOTED_AFTER_NON_REGRESSION"
        EVOLUTION.write_text(json.dumps(evolution, ensure_ascii=False, indent=2) + "\n")
    print("LA_BETE_VIRTUOUS_EVOLUTION_NON_REGRESSION_PASS")

if __name__ == "__main__":
    main()
