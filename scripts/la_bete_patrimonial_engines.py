#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
VENDOR = ROOT / "vendor/patrimonial-engines"
MANIFEST_PATH = VENDOR / "manifest.json"
SMCA_SOURCE_ENV = "LA_BETE_SMCA_SOURCE_ROOT"
RECEIPTS_PATH = DOCS / "data/la-bete-patrimonial-engine-receipts-v1.json"
SMCA_RUNNER = ROOT / "scripts/run_patrimonial_smca.py"

PRIVATE_SOURCE_ENV = {
    "trust_deep": "LA_BETE_PRIVATE_TRUST_DEEP_SOURCE",
    "coherence_multilayer": "LA_BETE_PRIVATE_COHERENCE_MULTILAYER_SOURCE",
    "trust_proof_checker": "LA_BETE_PRIVATE_TRUST_PROOF_CHECKER_SOURCE",
    "coherence_scorer": "LA_BETE_PRIVATE_COHERENCE_SCORER_SOURCE",
    "uscrc_pre_event": "LA_BETE_PRIVATE_USCRC_PRE_EVENT_SOURCE",
    "uscrc_symbolic_proofgraph": "LA_BETE_PRIVATE_USCRC_SYMBOLIC_PROOFGRAPH_SOURCE",
}

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def stable_hash(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()

def private_source_paths() -> dict[str, Path]:
    result: dict[str, Path] = {}
    for logical_id, env_name in PRIVATE_SOURCE_ENV.items():
        raw = os.environ.get(env_name)
        if not raw:
            continue
        path = Path(raw).expanduser().resolve()
        if path.is_file():
            result[logical_id] = path
    return result

def _extract_function(text: str, name: str) -> str:
    lines = text.splitlines()
    start = next((i for i, line in enumerate(lines) if line.startswith(f"def {name}(")), None)
    if start is None:
        raise RuntimeError("PATRIMONIAL_FUNCTION_NOT_FOUND:" + name)
    out = [lines[start]]
    for line in lines[start + 1:]:
        if line and not line[0].isspace() and not line.startswith("#"):
            break
        out.append(line)
    return "\n".join(out).rstrip() + "\n"

def _extract_assignment(text: str, name: str) -> str:
    lines = text.splitlines()
    start = next(
        (i for i, line in enumerate(lines) if line.startswith(name + " =") or line.startswith(name + "=")),
        None,
    )
    if start is None:
        raise RuntimeError("PATRIMONIAL_ASSIGNMENT_NOT_FOUND:" + name)
    out: list[str] = []
    depth = 0
    seen = False
    for line in lines[start:]:
        out.append(line)
        for ch in line:
            if ch in "([{":
                depth += 1
                seen = True
            elif ch in ")]}":
                depth -= 1
        if seen and depth == 0:
            break
    return "\n".join(out) + "\n"

def execute_legacy_text_engines_from_sources(
    raw_text: str,
    *,
    local_name: str,
    trust_source: Path,
    coherence_source: Path,
) -> dict[str, Any]:
    trust_text = trust_source.read_text(errors="ignore")
    trust_logic = _extract_assignment(trust_text, "WHITELIST")
    for name in ("domain_of", "count", "trust_score", "analyze"):
        trust_logic += "\n" + _extract_function(trust_text, name)
    trust_ns: dict[str, Any] = {"urlparse": urlparse}
    exec(compile(trust_logic, "<recovered-trust-safe-functions>", "exec"), trust_ns, trust_ns)

    coherence_text = coherence_source.read_text(errors="ignore")
    coherence_names = (
        "normalize", "count", "split_sentences", "detect_facts", "detect_hypotheses",
        "detect_pressure", "detect_emotional_framing", "detect_proof_layer",
        "detect_contradictions", "compute_level",
    )
    coherence_logic = "\n".join(_extract_function(coherence_text, n) for n in coherence_names)
    coherence_ns: dict[str, Any] = {"re": re}
    exec(
        compile(coherence_logic, "<recovered-coherence-safe-functions>", "exec"),
        coherence_ns,
        coherence_ns,
    )

    local_url = "file://" + Path(local_name).name
    trust_score = trust_ns["trust_score"](local_url, raw_text, "FETCHED_LOCAL_FILE")
    trust_analysis = trust_ns["analyze"](raw_text, "FETCHED_LOCAL_FILE")
    sentences = coherence_ns["split_sentences"](raw_text)
    pressure = coherence_ns["detect_pressure"](raw_text)
    proof = coherence_ns["detect_proof_layer"](raw_text)
    coherence = {
        "level": coherence_ns["compute_level"](pressure, proof),
        "facts_detected": len(coherence_ns["detect_facts"](sentences)),
        "hypotheses_detected": len(coherence_ns["detect_hypotheses"](sentences)),
        "pressure": pressure,
        "emotional_framing": coherence_ns["detect_emotional_framing"](raw_text),
        "proof_layer": proof,
        "contradictions": coherence_ns["detect_contradictions"](raw_text),
    }
    return {
        "trust_deep": {
            "engine": "REAL_FETCH_PIPELINE_WITH_TRUST_SCORING_V1",
            "execution": "LOCAL_PRIVATE_ENGINE_SAFE_FUNCTIONS_EXECUTED",
            "engine_source_sha256": sha256_file(trust_source),
            "extracted_logic_sha256": hashlib.sha256(trust_logic.encode()).hexdigest(),
            "trust": trust_score,
            "analysis": trust_analysis,
            "truth_verdict": False,
        },
        "coherence_historical": {
            "engine": "COHERENCE_MULTI_LAYER_ANALYSIS_V1",
            "execution": "LOCAL_PRIVATE_ENGINE_SAFE_FUNCTIONS_EXECUTED",
            "engine_source_sha256": sha256_file(coherence_source),
            "extracted_logic_sha256": hashlib.sha256(coherence_logic.encode()).hexdigest(),
            **coherence,
            "truth_verdict": False,
        },
    }

def _load_receipts() -> dict[str, Any]:
    if not RECEIPTS_PATH.is_file():
        return {
            "schema": "LA_BETE_PATRIMONIAL_ENGINE_RECEIPTS_V1",
            "policy": {},
            "engine_sources": {},
            "documents": {},
            "system_context": {},
        }
    return json.loads(RECEIPTS_PATH.read_text())

def patrimonial_text_receipt(path: Path, *, public_path: str) -> dict[str, Any]:
    receipts = _load_receipts()
    receipt = (receipts.get("documents") or {}).get(public_path)
    current = sha256_file(path)
    if not receipt:
        return {
            "status": "NO_MATCHING_PATRIMONIAL_RECEIPT",
            "document_sha256": current,
            "truth_verdict": False,
        }
    if receipt.get("document_sha256") != current:
        return {
            "status": "PATRIMONIAL_RECEIPT_STALE_FOR_CURRENT_DOCUMENT",
            "document_sha256": current,
            "receipt_document_sha256": receipt.get("document_sha256"),
            "truth_verdict": False,
        }
    result = json.loads(json.dumps(receipt.get("result") or {}))
    return {
        "status": "HASH_BOUND_PATRIMONIAL_RECEIPT",
        "document_sha256": current,
        "truth_verdict": False,
        **result,
    }

def _not_executed(document_sha256: str) -> dict[str, Any]:
    return {
        "trust_deep": {
            "execution": "NOT_EXECUTED_NO_MATCHING_RECEIPT",
            "document_sha256": document_sha256,
            "truth_verdict": False,
        },
        "coherence_historical": {
            "execution": "NOT_EXECUTED_NO_MATCHING_RECEIPT",
            "document_sha256": document_sha256,
            "truth_verdict": False,
        },
    }

def run_legacy_text_engines(
    raw_text: str,
    *,
    local_name: str,
    document_sha256: str,
) -> dict[str, Any]:
    receipts = _load_receipts()
    documents = receipts.get("documents") or {}
    keys = [local_name]
    if "/" not in local_name:
        keys.extend(["data/" + local_name, "history/" + local_name])
    receipt = next((documents.get(key) for key in keys if documents.get(key)), None)
    if receipt and receipt.get("document_sha256") == document_sha256:
        result = json.loads(json.dumps(receipt.get("result") or {
            "trust_deep": receipt.get("trust_deep"),
            "coherence_historical": receipt.get("coherence_historical"),
        }))
        for key in ("trust_deep", "coherence_historical"):
            if isinstance(result.get(key), dict):
                result[key]["execution"] = "EXECUTED_PATRIMONIAL_ENGINE_RECEIPT"
                result[key]["receipt_document_sha256"] = document_sha256
        return result

    sources = private_source_paths()
    if {"trust_deep", "coherence_multilayer"}.issubset(sources):
        return execute_legacy_text_engines_from_sources(
            raw_text,
            local_name=local_name,
            trust_source=sources["trust_deep"],
            coherence_source=sources["coherence_multilayer"],
        )
    return _not_executed(document_sha256)

def _candidate_smca_python() -> str:
    override = os.environ.get("LA_BETE_SMCA_PYTHON")
    return override or sys.executable

def run_deep_smca(path: Path, *, public_asset: str) -> dict[str, Any]:
    python = _candidate_smca_python()
    try:
        proc = subprocess.run(
            [python, str(SMCA_RUNNER), str(path), public_asset],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except Exception as exc:
        return {
            "status": "DEEP_SMCA_EXECUTION_UNAVAILABLE",
            "executed": False,
            "error_class": type(exc).__name__,
            "truth_verdict": False,
            "authenticity_verdict": False,
        }
    if proc.returncode != 0:
        return {
            "status": "DEEP_SMCA_EXECUTION_FAILED",
            "executed": False,
            "returncode": proc.returncode,
            "error_class": "SUBPROCESS_NONZERO",
            "truth_verdict": False,
            "authenticity_verdict": False,
        }
    try:
        result = json.loads(proc.stdout)
    except Exception:
        return {
            "status": "DEEP_SMCA_EXECUTION_FAILED",
            "executed": False,
            "error_class": "INVALID_JSON_OUTPUT",
            "truth_verdict": False,
            "authenticity_verdict": False,
        }
    result["status"] = "DEEP_SMCA_V0_1_EXECUTED"
    result["executed"] = True
    result["truth_verdict"] = False
    result["authenticity_verdict"] = False
    manifest = json.loads(MANIFEST_PATH.read_text())
    result["engine_source_sha256"] = manifest["media_coherence_check_upstream"]["source_tree_sha256"]
    result["known_limits"] = [
        "V0.1 MIME matching is intentionally simple and may over-flag equivalent MIME/extension forms.",
        "V0.1 image timestamp rules do not map cleanly to every video container.",
        "Structural coherence score is not an authenticity or truth score.",
        "The original report writer has second-level output naming; this adapter calls the analyzer directly and does not use that writer.",
    ]
    return result

def engine_registry() -> dict[str, Any]:
    manifest = json.loads(MANIFEST_PATH.read_text())
    receipts = _load_receipts()
    engine_sources = receipts.get("engine_sources") or {}
    system_context = json.loads(json.dumps(receipts.get("system_context") or {}))
    if "uscrc" in system_context:
        system_context["uscrc"]["scope"] = "HISTORICAL_INTERNAL_SYSTEM_CONTEXT_NOT_LA_BETE_OBJECT_RISK"
    return {
        "schema": "LA_BETE_PATRIMONIAL_ENGINE_BINDINGS_V1",
        "manifest_sha256": sha256_file(MANIFEST_PATH),
        "receipts_fingerprint": receipts.get("receipts_fingerprint"),
        "private_source_code_published": False,
        "recovery_rule": manifest["recovery_rule"],
        "bindings": {
            "trust_deep_engine": {
                "status": "RECOVERED_EXECUTION_VIA_HASHED_RECEIPTS",
                "object_safe_component": "REAL_FETCH_PIPELINE_WITH_TRUST_SCORING_V1",
                "source_sha256": (engine_sources.get("trust_deep") or {}).get("sha256"),
                "source_embedded": False,
                "truth_verdict": False,
            },
            "trust_industrial_engine": {
                "status": "RECOVERED_ALIAS_NO_UNIQUE_EXECUTABLE_FILENAME_PROVEN",
                "source_sha256": (engine_sources.get("trust_proof_checker") or {}).get("sha256"),
                "system_context_only": True,
                "source_embedded": False,
                "execution": "SYSTEM_CONTEXT_ONLY_NO_OBJECT_CERTIFICATION",
                "truth_verdict": False,
            },
            "coherence_historical": {
                "status": "RECOVERED_EXECUTION_VIA_HASHED_RECEIPTS",
                "object_safe_component": "COHERENCE_MULTI_LAYER_ANALYSIS_V1",
                "source_sha256": (engine_sources.get("coherence_multilayer") or {}).get("sha256"),
                "registered_source_hashes": {
                    "coherence_multi_document": (engine_sources.get("coherence_multi_document") or {}).get("sha256"),
                    "coherence_scorer": (engine_sources.get("coherence_scorer") or {}).get("sha256"),
                },
                "source_embedded": False,
                "truth_verdict": False,
            },
            "deep_smca": {
                "status": "PINNED_PUBLIC_UPSTREAM_EXECUTABLE_NOT_REPUBLISHED",
                "method": "STRUCTURAL_MEDIA_COHERENCE_ANALYSIS_V0_1",
                "upstream_repository": manifest["media_coherence_check_upstream"]["repository"],
                "upstream_commit": manifest["media_coherence_check_upstream"]["commit"],
                "source_tree_sha256": manifest["media_coherence_check_upstream"]["source_tree_sha256"],
                "source_code_vendored": False,
                "license_declared_in_upstream_root": manifest["media_coherence_check_upstream"]["license_declared_in_upstream_root"],
                "execution": "PINNED_UPSTREAM_SOURCE_VERIFIED_BY_HASH_VIA_ADAPTER",
                "truth_verdict": False,
                "authenticity_verdict": False,
            },
            "uscrc": {
                "status": "RECOVERED_SYSTEM_CONTEXT_ASSETS_HASH_BOUND_READ_ONLY",
                "source_hashes": {
                    "uscrc_pre_event": (engine_sources.get("uscrc_pre_event") or {}).get("sha256"),
                    "uscrc_symbolic_proofgraph": (engine_sources.get("uscrc_symbolic_proofgraph") or {}).get("sha256"),
                },
                "object_execution": False,
                "reason": "Historical uSCRC assets score internal system/pre-event state and are not content certificates.",
                "scope": "HISTORICAL_INTERNAL_SYSTEM_CONTEXT_NOT_LA_BETE_OBJECT_RISK",
                "certificate_issued": False,
            },
        },
        "system_context": system_context,
    }
