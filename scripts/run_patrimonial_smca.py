#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "vendor/patrimonial-engines/manifest.json"
SOURCE_ENV = "LA_BETE_SMCA_SOURCE_ROOT"

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def verify_upstream_source(source_root: Path) -> tuple[dict[str, str], str, str]:
    manifest = json.loads(MANIFEST_PATH.read_text())
    upstream = manifest["media_coherence_check_upstream"]
    expected = upstream["files_sha256"]
    actual: dict[str, str] = {}
    for rel, digest in sorted(expected.items()):
        path = source_root / rel
        if not path.is_file():
            raise SystemExit("SMCA_UPSTREAM_FILE_MISSING:" + rel)
        got = sha256_file(path)
        if got != digest:
            raise SystemExit("SMCA_UPSTREAM_HASH_MISMATCH:" + rel)
        actual[rel] = got
    tree = hashlib.sha256(
        json.dumps(actual, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    if tree != upstream["source_tree_sha256"]:
        raise SystemExit("SMCA_UPSTREAM_TREE_HASH_MISMATCH")
    return actual, tree, upstream["commit"]

def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: run_patrimonial_smca.py FILE PUBLIC_ASSET")
    raw_root = os.environ.get(SOURCE_ENV)
    if not raw_root:
        raise SystemExit("MISSING_" + SOURCE_ENV)
    source_root = Path(raw_root).expanduser().resolve()
    _, source_tree_sha256, upstream_commit = verify_upstream_source(source_root)

    sys.path.insert(0, str(source_root))
    from app.analyzer import MediaAnalyzer

    file_path = Path(sys.argv[1]).resolve()
    public_asset = sys.argv[2]
    result = MediaAnalyzer().analyze(file_path)
    result.pop("analysis_timestamp", None)
    info = dict(result.get("input_file") or {})
    info["path"] = public_asset
    result["input_file"] = info
    result["adapter"] = {
        "mode": "PINNED_UPSTREAM_DIRECT_ANALYZER_CALL_NO_REPORT_WRITER",
        "engine": "MEDIA_COHERENCE_CHECK_V0_1",
        "method": "SMCA_STRUCTURAL_MEDIA_COHERENCE_ANALYSIS",
        "upstream_commit": upstream_commit,
        "source_tree_sha256": source_tree_sha256,
        "source_code_republished_here": False,
    }
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))

if __name__ == "__main__":
    main()
