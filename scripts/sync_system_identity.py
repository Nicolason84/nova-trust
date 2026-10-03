#!/usr/bin/env python3
"""Project or verify the canonical SUPRA identity in the static PWA."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "app/system_identity.json"
TARGET = ROOT / "docs/system_identity.json"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if the static projection is stale")
    args = parser.parse_args()

    identity = json.loads(SOURCE.read_text(encoding="utf-8"))
    assert identity["schema_version"] in ("1.0", "1.1")
    assert identity["music"]["playback"] == "click_to_load"
    projected = json.dumps(identity, ensure_ascii=False, indent=2) + "\n"

    if args.check:
        if not TARGET.exists() or TARGET.read_text(encoding="utf-8") != projected:
            raise SystemExit("Identity projection is stale; run scripts/sync_system_identity.py")
        print(f"Identity projection verified: {TARGET.relative_to(ROOT)}")
        return

    TARGET.write_text(projected, encoding="utf-8")
    print(f"Identity projection synchronized: {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
