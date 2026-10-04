#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from build_la_bete_evidence_universe import (
    DOCS,
    PUBLIC_ARCHIVE_PATHS,
    PUBLIC_DOCUMENT_NAMES,
    sha256_file,
)
from la_bete_patrimonial_engines import (
    PRIVATE_SOURCE_ENV,
    RECEIPTS_PATH,
    execute_legacy_text_engines_from_sources,
    private_source_paths,
    stable_hash,
)

def main() -> None:
    sources = private_source_paths()
    missing = [key for key in ("trust_deep", "coherence_multilayer") if key not in sources]
    if missing:
        required = [PRIVATE_SOURCE_ENV[key] for key in missing]
        raise SystemExit("MISSING_PRIVATE_ENGINE_SOURCE_ENV:" + ",".join(required))

    existing = {}
    if RECEIPTS_PATH.is_file():
        try:
            existing = json.loads(RECEIPTS_PATH.read_text())
        except Exception:
            existing = {}

    engine_sources = dict(existing.get("engine_sources") or {})
    for logical_id, path in sorted(sources.items()):
        engine_sources[logical_id] = {
            "sha256": sha256_file(path),
            "private_source_code_published": False,
        }

    documents = {}
    targets: list[tuple[str, Path]] = []
    for name in PUBLIC_DOCUMENT_NAMES:
        targets.append(("data/" + name, DOCS / "data" / name))
    for path in PUBLIC_ARCHIVE_PATHS:
        targets.append((str(path.relative_to(DOCS)), path))

    for receipt_key, path in targets:
        if not path.is_file():
            continue
        raw_text = path.read_text()
        result = execute_legacy_text_engines_from_sources(
            raw_text,
            local_name=receipt_key,
            trust_source=sources["trust_deep"],
            coherence_source=sources["coherence_multilayer"],
        )
        documents[receipt_key] = {
            "document_sha256": sha256_file(path),
            "result": result,
        }

    system_context = existing.get("system_context") or {}
    engine_families = existing.get("engine_families") or {}
    public_contract = existing.get("public_contract") or {
        "private_engine_source_embedded": False,
        "local_paths_embedded": False,
        "truth_verdict": False,
        "authenticity_verdict": False,
        "uscrc_object_certificate": False,
        "receipts_bind_results_to_document_and_engine_hashes": True,
    }

    payload_core = {
        "engine_sources": engine_sources,
        "documents": documents,
        "system_context": system_context,
    }
    doc = {
        "schema": "LA_BETE_PATRIMONIAL_ENGINE_RECEIPTS_V1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "policy": {
            "receipt_requires_exact_document_sha256": True,
            "private_source_code_published": False,
            "receipt_is_not_truth_verdict": True,
            "receipt_is_not_authenticity_verdict": True,
            "stale_receipt_must_not_execute": True,
            "system_context_is_not_object_verdict": True,
        },
        "public_contract": public_contract,
        "engine_sources": engine_sources,
        "engine_families": engine_families,
        "system_context": system_context,
        "documents": documents,
        "receipts_fingerprint": stable_hash(payload_core),
    }
    encoded = json.dumps(doc, ensure_ascii=False, indent=2) + "\n"
    for forbidden in ("/Users/", "Library/Application Support", "NOVA_LABS/", "NOVA_OS/"):
        if forbidden in encoded:
            raise SystemExit("PRIVATE_PATH_LEAK:" + forbidden)
    RECEIPTS_PATH.write_text(encoded)
    print(
        "PATRIMONIAL_ENGINE_RECEIPTS_WRITTEN",
        len(documents),
        len(engine_sources),
        doc["receipts_fingerprint"],
    )

if __name__ == "__main__":
    main()
