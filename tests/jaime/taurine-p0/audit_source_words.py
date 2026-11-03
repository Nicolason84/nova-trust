#!/usr/bin/env python3
"""Check the existing learning-corpus attribution budget without network access.

This reproduces research-learning.json's established sourceWordAudit convention.
It is a content-review utility, not a search service or a model-quality grader.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SOURCE = ROOT / "tools/jaime-secure/taurino-content/research-learning.json"


def words(value):
    if value is None:
        return 0
    if isinstance(value, str):
        # The established audit separates legal identifiers (60/2001) and
        # en-dash ranges (1814–1816). URLs are not among the counted fields.
        return len(value.replace("/", " ").replace("–", " ").replace("—", " ").split())
    if isinstance(value, list):
        return sum(words(item) for item in value)
    raise ValueError("UNSUPPORTED_WORD_FIELD")


def attribution_entries(document):
    entries = {}
    for source in document["sources"]:
        bibliography = sum(words(source.get(key)) for key in
                           ("title", "authors", "publisher", "type", "date"))
        entries[source["id"]] = {
            "sourceId": source["id"], "attributedWords": bibliography,
            "bibliographyWords": bibliography,
            "paths": [{"path": f"sources.{source['id']}.bibliography", "words": bibliography}],
        }

    def charge(source_ids, path, count):
        for source_id in source_ids:
            entry = entries[source_id]
            entry["attributedWords"] += count
            entry["paths"].append({"path": path, "words": count})

    for lesson in document["lessons"]:
        for index, paragraph in enumerate(lesson["paragraphs"]):
            if paragraph["kind"] == "sourced":
                charge(paragraph["sourceIds"], f"lessons.{lesson['id']}.paragraphs.{index}",
                       words(paragraph["text"]))
    for term in document["glossary"]:
        charge(term["sourceIds"], f"glossary.{term['id']}",
               sum(words(term.get(key)) for key in ("term", "definition", "editorialNote")))
    for quiz in document["quiz"]:
        charge(quiz["sourceIds"], f"quiz.{quiz['id']}",
               sum(words(quiz.get(key)) for key in ("question", "options", "explanation")))
    for debate in document["debates"]:
        for index, evidence in enumerate(debate["evidence"]):
            charge(evidence["sourceIds"], f"debates.{debate['id']}.evidence.{index}",
                   words(evidence["text"]))
    for ranch in document["ranches"]:
        charge(ranch["sourceIds"], f"ranches.{ranch['id']}.sourcedFields",
               sum(words(ranch.get(key)) for key in
                   ("name", "region", "locations", "declaredLineage", "attributedFact")))
    return list(entries.values())


def verify(document):
    actual = attribution_entries(document)
    declared = document["sourceWordAudit"]
    if actual != declared["entries"]:
        raise ValueError("SOURCE_WORD_AUDIT_STALE")
    maximum = max(entry["attributedWords"] for entry in actual)
    if maximum != declared["maximumAttributedWords"]:
        raise ValueError("SOURCE_WORD_MAXIMUM_STALE")
    if declared["limitPerSource"] != 200 or maximum > declared["limitPerSource"]:
        raise ValueError("SOURCE_WORD_BUDGET_EXCEEDED")
    return {"status": "PASS", "scope": "learning corpus attribution accounting only",
            "sourcesChecked": len(actual), "maximumAttributedWords": maximum,
            "limitPerSource": declared["limitPerSource"], "modelTested": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    document = json.loads(args.source.read_text(encoding="utf-8"))
    print(json.dumps(verify(document), ensure_ascii=False))


if __name__ == "__main__":
    main()
