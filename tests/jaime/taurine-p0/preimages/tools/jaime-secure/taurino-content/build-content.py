#!/usr/bin/env python3
"""Assemble the reviewed public content without network access.

From any directory: python3 path/to/build-content.py [--output /local/file.json]
Default output follows the work tree or the tools/jaime-secure publication tree.
Audio files are published by the caller; this script does not create media or
infer their durations. The two durations below were supplied after generation.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import sys
import tempfile


HERE = Path(__file__).resolve().parent
DEFAULT_OUTPUT = ((HERE.parents[2] / "docs" / "jaime" / "data" / "taurino-content.json")
                  if HERE.name == "taurino-content" and HERE.parent.name == "jaime-secure"
                  else HERE.parent / "app" / "dist" / "data" / "taurino-content.json")
MAX_INPUT_BYTES = 2 * 1024 * 1024
ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
REFERENCE_KEYS = {"sourceId", "primarySourceId", "linkedBySourceId", "sourcePageId"}


class BuildError(Exception):
    pass


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise BuildError("DUPLICATE_JSON_KEY")
        value[key] = item
    return value


def read_text(path: Path, limit: int) -> str:
    if path.is_symlink() or path.stat().st_size > limit:
        raise BuildError("INPUT_SIZE_OR_SYMLINK")
    raw = path.read_text(encoding="utf-8")
    if "\0" in raw:
        raise BuildError("INPUT_NUL")
    return raw


def read_document(path: Path) -> dict:
    value = json.loads(read_text(path, MAX_INPUT_BYTES), object_pairs_hook=unique_object)
    if not isinstance(value, dict) or value.get("schemaVersion") != 1 or value.get("language") != "es":
        raise BuildError("INPUT_SCHEMA")
    return value


def merge_sources(*tables) -> list[dict]:
    merged = {}
    for table in tables:
        if not isinstance(table, list) or len(table) > 200:
            raise BuildError("SOURCE_TABLE_INVALID")
        for source in table:
            if not isinstance(source, dict) or not isinstance(source.get("id"), str) or not ID.fullmatch(source["id"]):
                raise BuildError("SOURCE_ID_INVALID")
            existing = merged.get(source["id"])
            if existing is not None and existing != source:
                raise BuildError("SOURCE_ID_COLLISION")
            merged[source["id"]] = source
    return list(merged.values())


def check_references(value, known: set[str]) -> None:
    if isinstance(value, list):
        for item in value:
            check_references(item, known)
    elif isinstance(value, dict):
        for key, item in value.items():
            if key == "sourceIds":
                if not isinstance(item, list) or any(not isinstance(ref, str) or ref not in known for ref in item):
                    raise BuildError("UNKNOWN_SOURCE_REFERENCE")
            elif key in REFERENCE_KEYS and item is not None:
                if not isinstance(item, str) or item not in known:
                    raise BuildError("UNKNOWN_SOURCE_REFERENCE")
            if isinstance(item, (dict, list)):
                check_references(item, known)


def assemble() -> dict:
    learning = read_document(HERE / "research-learning.json")
    events = read_document(HERE / "research-events.json")
    supplement = json.loads(read_text(HERE / "glossary-supplement.json", MAX_INPUT_BYTES), object_pairs_hook=unique_object)
    if not isinstance(supplement, dict) or set(supplement) != {"sources", "glossary"} or not isinstance(supplement["glossary"], list):
        raise BuildError("GLOSSARY_SUPPLEMENT_INVALID")
    result = {key: value for key, value in learning.items()
              if key not in {"sources", "researchRefs", "sourceWordAudit"}}
    for key, value in events.items():
        if key in {"sources", "research"}:
            continue
        if key in result and result[key] != value:
            raise BuildError("TOP_LEVEL_KEY_COLLISION")
        result[key] = value
    result["glossary"] = result["glossary"] + supplement["glossary"]
    result["sources"] = merge_sources(events.get("sources"), learning.get("sources"), supplement.get("sources"))
    access_notes = {item["sourceId"]: item["access"] for item in learning.get("researchRefs", [])
                    if isinstance(item, dict) and isinstance(item.get("sourceId"), str)
                    and isinstance(item.get("access"), str)}
    for source in result["sources"]:
        if source["id"] in access_notes:
            source["accessNote"] = access_notes[source["id"]]
    if isinstance(result.get("editorialPolicy"), dict):
        result["editorialPolicy"]["accessLimits"] = (
            "Las notas de acceso de las fuentes distinguen texto consultado y contenido oficial "
            "recuperado por búsqueda cuando la apertura directa estaba restringida.")
    # Keep public source labels and caveats, not transport audit or sample items.
    if "refreshSources" in result:
        if not isinstance(result["refreshSources"], list):
            raise BuildError("REFRESH_SOURCES_INVALID")
        result["refreshSources"] = [{key: value for key, value in source.items()
                                     if key not in {"observation", "exampleItem"}}
                                    for source in result["refreshSources"]]
    result["episodes"] = [
        {
            "id": "episodio-01",
            "title": "El marcador no cuenta toda la tarde",
            "summary": "Separar resultado, interpretación y evidencia al comentar una corrida.",
            "src": "audio/taurino/episodio-01.mp3",
            "durationSeconds": 186.502676,
            "date": "2026-10-30",
            "transcript": read_text(HERE / "episode-01.txt", 64 * 1024).strip(),
            "sourceIds": [],
        },
        {
            "id": "episodio-02",
            "eventId": "madrid-2026-10-11",
            "title": "Ferrera y Román: más allá de dos orejas",
            "summary": "Preguntas para comparar las actuaciones de Antonio Ferrera y Román en Las Ventas el 11 de octubre de 2026.",
            "src": "audio/taurino/episodio-02.mp3",
            "durationSeconds": 205.078639,
            "date": "2026-10-30",
            "transcript": read_text(HERE / "episode-02.txt", 64 * 1024).strip(),
            "sourceIds": ["ventas-20261011"],
        },
    ]
    if any(not episode["transcript"] for episode in result["episodes"]):
        raise BuildError("EMPTY_TRANSCRIPT")
    if not any(event.get("id") == "madrid-2026-10-11" and event.get("primarySourceId") == "ventas-20261011"
               for event in result.get("events", [])):
        raise BuildError("EPISODE_EVENT_NOT_FOUND")
    check_references(result, {source["id"] for source in result["sources"]})
    return result


def write_output(path: Path, value: dict) -> int:
    if path.is_symlink():
        raise BuildError("OUTPUT_SYMLINK_REJECTED")
    raw = (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
    if len(raw) > MAX_INPUT_BYTES:
        raise BuildError("OUTPUT_TOO_LARGE")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", dir=path.parent, prefix=".taurino-content-", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return len(raw)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)
    if "://" in str(args.output):
        print(json.dumps({"status": "failed", "code": "OUTPUT_MUST_BE_LOCAL"}), file=sys.stderr)
        return 2
    try:
        content = assemble()
        size = write_output(args.output, content)
    except (BuildError, OSError, UnicodeError, ValueError, TypeError, AttributeError) as error:
        code = str(error) if isinstance(error, BuildError) else "CONTENT_BUILD_FAILED"
        print(json.dumps({"status": "failed", "code": code}), file=sys.stderr)
        return 2
    print(json.dumps({"status": "written", "bytes": size, "events": len(content["events"]),
                      "lessons": len(content["lessons"]), "episodes": len(content["episodes"])}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
