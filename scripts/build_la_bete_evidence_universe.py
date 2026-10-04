#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
LIVE_PATH = DOCS / "data/france-debt-rate-live.json"
DISCOVERY_PATH = DOCS / "data/la-bete-territory-discovery-candidates-v1.json"
LIVING_PATH = DOCS / "data/la-bete-territory-living-identity-v1.json"
OUT_PATH = DOCS / "data/la-bete-evidence-universe-v1.json"

SCHEMA = "LA_BETE_EVIDENCE_UNIVERSE_V1"
PROOFGRAPH_SCHEMA = "SUPRA_PROOFGRAPH_PUBLIC_PROJECTION_V1"
WEIGHTS = {
    "source_quality": 0.30,
    "provenance": 0.25,
    "coherence": 0.20,
    "crosscheck": 0.20,
    "media_structure": 0.05,
}

SOURCE_STATE_SCORE = {
    "LIVE_VERIFIED": 96,
    "CROSSCHECKED": 96,
    "OFFICIAL_VINTAGE": 88,
    "RETAINED_LAST_GOOD": 66,
    "OFFICIAL_DATASET_CANDIDATE": 92,
    "PUBLIC_CENSUS_CANDIDATE": 74,
    "LICENSE_VERIFIED_LOCATION_CANDIDATE": 84,
    "UNVERIFIED_AUTODISCOVERY_CANDIDATE": 48,
    "VERIFIED_EDITORIAL_SYNTHESIS_FROM_SOURCED_MOTIFS": 90,
    "UNAVAILABLE": 20,
    "DEGRADED": 35,
    "CONTRADICTED": 10,
}

MEDIA_EXT_MAGIC = {
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".webp": (b"RIFF",),
}


def load(path: Path) -> dict:
    return json.loads(path.read_text())


def stable_hash(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def media_structure(asset: str | None, license_name: str | None, source_page: str | None) -> dict:
    if not asset:
        return {
            "status": "NOT_APPLICABLE",
            "score": None,
            "deep_smca": "NOT_APPLICABLE",
            "authenticity_verdict": False,
            "reasons": [],
        }
    path = DOCS / asset
    reasons: list[str] = []
    if not path.is_file():
        return {
            "status": "LOCAL_ASSET_MISSING",
            "score": 0,
            "deep_smca": "NOT_RUN",
            "authenticity_verdict": False,
            "asset": asset,
            "reasons": ["Le média référencé n'est pas présent dans le corpus local."],
        }
    raw = path.read_bytes()[:16]
    ext = path.suffix.lower()
    signatures = MEDIA_EXT_MAGIC.get(ext, ())
    signature_ok = any(raw.startswith(sig) for sig in signatures) if signatures else False
    if signature_ok:
        reasons.append("Extension et signature binaire sont cohérentes.")
    else:
        reasons.append("La signature binaire n'est pas reconnue comme cohérente avec l'extension.")
    if license_name and source_page:
        reasons.append("Licence et page source sont présentes.")
    score = 55
    score += 20 if signature_ok else 0
    score += 15 if license_name else 0
    score += 10 if source_page else 0
    return {
        "status": "PARTIAL_STRUCTURAL_CHECKS_ONLY",
        "score": min(100, score),
        "deep_smca": "DEEP_SMCA_NOT_RUN",
        "authenticity_verdict": False,
        "smca_contract": "STRUCTURAL_COHERENCE_ONLY_NOT_TRUTH_OR_AUTHENTICITY",
        "asset": asset,
        "sha256": sha256_file(path),
        "bytes": path.stat().st_size,
        "extension": ext,
        "signature_matches_extension": signature_ok,
        "license_present": bool(license_name),
        "source_page_present": bool(source_page),
        "reasons": reasons,
    }


def provenance_score(fields: dict[str, Any]) -> tuple[int, list[str]]:
    checks = [
        ("identifiant stable", bool(fields.get("id"))),
        ("source ou URL", bool(fields.get("source"))),
        ("producteur / éditeur", bool(fields.get("publisher"))),
        ("date / millésime", bool(fields.get("date"))),
        ("empreinte / référence de preuve", bool(fields.get("digest"))),
    ]
    score = round(100 * sum(ok for _, ok in checks) / len(checks))
    reasons = [label for label, ok in checks if ok]
    return score, reasons


def coherence_score(*, binding: str | None = None, claim_state: str | None = None,
                    contradiction: bool = False, official: bool = False,
                    verified_living: bool = False) -> tuple[int, list[str]]:
    reasons: list[str] = []
    if contradiction:
        return 10, ["Une contradiction explicite est présente."]
    if claim_state == "CROSSCHECKED":
        return 96, ["Le claim est explicitement recoupé."]
    if binding == "P131_PATH_TO_DEPARTMENT":
        return 94, ["Rattachement administratif explicite P131 au département."]
    if binding == "TEXT_LOCALITY_HINT_WITH_FRANCE_P17":
        return 80, ["Indice territorial textuel renforcé par P17=France."]
    if verified_living:
        return 90, ["Objet déjà présent dans l'identité vivante sourcée."]
    if official:
        return 82, ["Objet issu d'une source officielle mais représentativité à interpréter séparément."]
    return 52, ["Cohérence contextuelle partielle ; preuve indépendante supplémentaire utile."]


def crosscheck_score(source_ids: list[str] | None, extra_refs: int = 0) -> tuple[int, list[str]]:
    ids = list(dict.fromkeys(source_ids or []))
    total = len(ids) + max(0, extra_refs)
    if total >= 2:
        return 92, [f"{total} références indépendantes ou complémentaires sont reliées."]
    if total == 1:
        return 55, ["Une seule référence principale est reliée."]
    return 20, ["Aucun recoupement indépendant n'est encore relié."]


def readiness(components: dict[str, int | None]) -> tuple[int, str]:
    total_weight = 0.0
    value = 0.0
    for key, weight in WEIGHTS.items():
        score = components.get(key)
        if score is None:
            continue
        total_weight += weight
        value += weight * float(score)
    score = round(value / total_weight) if total_weight else 0
    label = "FORTE" if score >= 85 else "SOLIDE" if score >= 70 else "PARTIELLE" if score >= 50 else "FAIBLE"
    return score, label


def profile(*, object_id: str, kind: str, label: str, evidence_state: str,
            source_quality: int, provenance: tuple[int, list[str]],
            coherence: tuple[int, list[str]], crosscheck: tuple[int, list[str]],
            media: dict, proof_refs: list[str], source_urls: list[str],
            contradictions: list[str] | None = None,
            missing: list[str] | None = None, department_code: str | None = None,
            lane: str | None = None) -> dict:
    components = {
        "source_quality": source_quality,
        "provenance": provenance[0],
        "coherence": coherence[0],
        "crosscheck": crosscheck[0],
        "media_structure": media.get("score"),
    }
    index, label_score = readiness(components)
    reasons = {
        "provenance": provenance[1],
        "coherence": coherence[1],
        "crosscheck": crosscheck[1],
        "media_structure": media.get("reasons", []),
    }
    result = {
        "object_id": object_id,
        "kind": kind,
        "label": label,
        "department_code": department_code,
        "lane": lane,
        "evidence_state": evidence_state,
        "proofgraph": {
            "spine_schema": PROOFGRAPH_SCHEMA,
            "proof_refs": list(dict.fromkeys(x for x in proof_refs if x)),
            "source_urls": list(dict.fromkeys(x for x in source_urls if x)),
        },
        "trust": {
            "index": index,
            "label": label_score,
            "components": components,
            "reasons": reasons,
        },
        "coherence": {
            "score": coherence[0],
            "reasons": coherence[1],
            "contradictions": contradictions or [],
        },
        "smca": media,
        "uscrc": {
            "status": "COMPATIBILITY_PROFILE_NOT_CERTIFICATE",
            "reliability_index": index,
            "certificate_issued": False,
        },
        "what_would_raise_confidence": missing or [],
    }
    return result


def build() -> dict:
    live = load(LIVE_PATH)
    discovery = load(DISCOVERY_PATH)
    living = load(LIVING_PATH)
    if live.get("evidence_graph", {}).get("schema") != PROOFGRAPH_SCHEMA:
        raise ValueError("PROOFGRAPH_SPINE_REQUIRED")
    if discovery.get("schema") != "LA_BETE_TERRITORY_DISCOVERY_CANDIDATES_V1":
        raise ValueError("DISCOVERY_SCHEMA_REQUIRED")
    if living.get("schema") != "LA_BETE_TERRITORY_LIVING_IDENTITY_V1":
        raise ValueError("LIVING_IDENTITY_SCHEMA_REQUIRED")

    objects: dict[str, dict] = {}

    source_by_id = {s["id"]: s for s in live.get("sources", []) if s.get("id")}
    graph_edges = live.get("evidence_graph", {}).get("edges", [])

    for source in live.get("sources", []):
        sid = source.get("id")
        if not sid:
            continue
        prov = provenance_score({
            "id": sid, "source": source.get("url"), "publisher": source.get("publisher"),
            "date": source.get("checked_at") or source.get("vintage"),
            "digest": source.get("digest"),
        })
        coh = coherence_score(contradiction=source.get("health") == "CONTRADICTED",
                              official=source.get("health") in {"LIVE_VERIFIED", "CROSSCHECKED", "OFFICIAL_VINTAGE"})
        linked = [e.get("to") for e in graph_edges if e.get("from") == sid]
        cross = crosscheck_score([sid], extra_refs=1 if linked else 0)
        score = SOURCE_STATE_SCORE.get(source.get("health"), 50)
        oid = "source:" + sid
        objects[oid] = profile(
            object_id=oid, kind="SOURCE", label=source.get("label", sid),
            evidence_state=source.get("health", "UNKNOWN"), source_quality=score,
            provenance=prov, coherence=coh, crosscheck=cross,
            media=media_structure(None, None, None), proof_refs=[sid] + linked,
            source_urls=[source.get("url")], contradictions=[source.get("error")] if source.get("health") == "CONTRADICTED" and source.get("error") else [],
            missing=[] if score >= 85 else ["Rafraîchir ou recouper la source avec une preuve de même portée."],
        )

    for claim in live.get("claims", []):
        cid = claim.get("claim_id")
        if not cid:
            continue
        source_ids = claim.get("source_ids") or []
        proof = claim.get("proof") or []
        prov = provenance_score({
            "id": cid, "source": claim.get("metric_ref"), "publisher": "ProofGraph",
            "date": claim.get("date"), "digest": stable_hash(proof) if proof else None,
        })
        coh = coherence_score(claim_state=claim.get("state"), contradiction=claim.get("state") == "CONTRADICTED")
        cross = crosscheck_score(source_ids)
        base = 96 if claim.get("confidence") == "HIGH" else 78 if claim.get("confidence") in {"MEDIUM", "MODEL_BOUND"} else 55
        urls = [source_by_id.get(sid, {}).get("url") for sid in source_ids]
        missing = []
        if len(set(source_ids)) < 2:
            missing.append("Ajouter une source indépendante de même portée.")
        if claim.get("type") in {"DERIVED", "STRESS"}:
            missing.append("Conserver la distinction entre observation et transformation/modèle.")
        oid = "claim:" + cid
        objects[oid] = profile(
            object_id=oid, kind="CLAIM", label=claim.get("label", cid),
            evidence_state=claim.get("state", "UNKNOWN"), source_quality=base,
            provenance=prov, coherence=coh, crosscheck=cross,
            media=media_structure(None, None, None), proof_refs=[cid] + source_ids,
            source_urls=urls, contradictions=[],
            missing=missing,
        )

    for dep_code, dep in discovery.get("departments", {}).items():
        for lane in ("media", "heritage", "nature", "commons", "initiatives"):
            for item in dep.get(lane, []) or []:
                cid = item.get("candidate_id")
                if not cid:
                    continue
                state = item.get("state", "UNKNOWN")
                source_url = item.get("source") or item.get("source_page")
                publisher = item.get("producer") or item.get("source_provider") or (
                    "Wikimedia Commons" if item.get("source_page") else None
                )
                prov = provenance_score({
                    "id": cid, "source": source_url, "publisher": publisher,
                    "date": dep.get("scanned_at"),
                    "digest": item.get("wikidata_id") or item.get("record_id") or item.get("asset"),
                })
                official = state == "OFFICIAL_DATASET_CANDIDATE"
                verified_media = state == "LICENSE_VERIFIED_LOCATION_CANDIDATE"
                binding = item.get("administrative_binding")
                coh = coherence_score(binding=binding, official=official, verified_living=False)
                extra = 1 if item.get("wikidata_id") and source_url else 0
                cross = crosscheck_score([source_url] if source_url else [], extra_refs=extra)
                m = media_structure(item.get("asset"), item.get("license"), item.get("source_page"))
                missing = []
                if state in {"UNVERIFIED_AUTODISCOVERY_CANDIDATE", "PUBLIC_CENSUS_CANDIDATE"}:
                    missing.append("Obtenir une confirmation locale, humaine ou institutionnelle récente.")
                if lane == "media" and m.get("deep_smca") == "DEEP_SMCA_NOT_RUN":
                    missing.append("Exécuter une analyse SMCA approfondie avant toute conclusion d'intégrité structurelle.")
                if cross[0] < 80:
                    missing.append("Ajouter un recoupement indépendant.")
                source_quality = SOURCE_STATE_SCORE.get(state, 50)
                oid = f"territory:{dep_code}:{cid}"
                objects[oid] = profile(
                    object_id=oid, kind="TERRITORY_MEDIA_CANDIDATE" if lane == "media" else "TERRITORY_CANDIDATE",
                    label=item.get("label", cid), evidence_state=state,
                    source_quality=source_quality, provenance=prov, coherence=coh, crosscheck=cross, media=m,
                    proof_refs=[cid, item.get("wikidata_id"), binding],
                    source_urls=[source_url, item.get("license_url")],
                    contradictions=[], missing=missing, department_code=dep_code, lane=lane,
                )

    for dep_code, dep in living.get("departments", {}).items():
        media_obj = dep.get("media", {}) or {}
        for item in media_obj.get("items", []) or []:
            mid = item.get("id")
            if not mid:
                continue
            prov = provenance_score({
                "id": mid, "source": item.get("source_page"), "publisher": item.get("author"),
                "date": living.get("generated_from_topology_snapshot"),
                "digest": item.get("asset"),
            })
            coh = coherence_score(verified_living=True)
            refs = [x for x in [item.get("source_page"), item.get("place_source")] if x]
            cross = crosscheck_score(refs)
            m = media_structure(item.get("asset"), item.get("license"), item.get("source_page"))
            missing = ["Exécuter une analyse SMCA approfondie si l'historique technique du fichier devient un enjeu."] if m.get("deep_smca") == "DEEP_SMCA_NOT_RUN" else []
            oid = f"living-media:{dep_code}:{mid}"
            objects[oid] = profile(
                object_id=oid, kind="VERIFIED_LIVING_MEDIA", label=item.get("label", mid),
                evidence_state="VERIFIED_LIVING_IDENTITY_MEDIA", source_quality=96,
                provenance=prov, coherence=coh, crosscheck=cross, media=m,
                proof_refs=[mid], source_urls=refs + [item.get("license_url")],
                contradictions=[], missing=missing, department_code=dep_code, lane="living_media",
            )

    ordered = {key: objects[key] for key in sorted(objects)}
    counts: dict[str, int] = {}
    for item in ordered.values():
        counts[item["kind"]] = counts.get(item["kind"], 0) + 1
    fingerprint = stable_hash(ordered)
    generated_from = {
        "live_snapshot_id": live.get("snapshot_id"),
        "live_sequence": live.get("sequence"),
        "territory_discovery_fingerprint": stable_hash({
            "topology_snapshot": discovery.get("topology_snapshot"),
            "coverage": discovery.get("coverage"),
            "departments": discovery.get("departments"),
        }),
        "living_identity_fingerprint": stable_hash(living),
    }
    return {
        "schema": SCHEMA,
        "state": "READ_ONLY_PUBLIC_PROOFGRAPH_DERIVED_PROJECTION",
        "projection_fingerprint": fingerprint,
        "generated_from": generated_from,
        "contract": {
            "proofgraph_is_spine": True,
            "truth_verdict": False,
            "authenticity_verdict": False,
            "trust_index_means_evidence_readiness_not_truth": True,
            "coherence_means_structural_contextual_consistency_not_truth": True,
            "smca_is_structural_not_semantic": True,
            "deep_smca_executed": False,
            "uscrc_profile_is_certificate": False,
            "automatic_promotion": False,
            "automatic_phi_minting": False,
            "automatic_truth_mutation": False,
            "external_action": False,
            "second_runtime": False,
            "second_registry": False,
            "second_scheduler": False,
        },
        "engines": {
            "proofgraph": {"status": "REUSED_ACTIVE_PUBLIC_PROJECTION", "schema": PROOFGRAPH_SCHEMA},
            "trust": {"status": "EXPLAINABLE_EVIDENCE_READINESS_PROJECTION", "historical_engine_execution": False},
            "coherence": {"status": "EXPLAINABLE_STRUCTURAL_CONTEXT_PROFILE", "historical_engine_execution": False},
            "smca": {"status": "PARTIAL_STRUCTURAL_CHECKS_ONLY", "deep_analysis": "NOT_RUN"},
            "uscrc": {"status": "COMPATIBILITY_PROFILE_NOT_CERTIFICATE", "runtime_certificate": False},
            "trusty": {"status": "LABEL_ONLY_NO_SEPARATE_ENGINE"},
        },
        "score_contract": {
            "weights": WEIGHTS,
            "range": [0, 100],
            "higher_means": "MORE_DOCUMENTARY_EVIDENCE_READY",
            "does_not_mean": ["TRUE", "AUTHENTIC", "SAFE", "ENDORSED", "CANON"],
        },
        "coverage": {
            "objects_total": len(ordered),
            "by_kind": counts,
            "departments_with_profiles": len({x["department_code"] for x in ordered.values() if x.get("department_code")}),
        },
        "objects": ordered,
    }


def main() -> None:
    result = build()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if OUT_PATH.exists() and OUT_PATH.read_text() == encoded:
        print("EVIDENCE_UNIVERSE_STABLE", result["projection_fingerprint"])
        return
    OUT_PATH.write_text(encoded)
    print("EVIDENCE_UNIVERSE_WRITTEN", result["coverage"], result["projection_fingerprint"])


if __name__ == "__main__":
    main()
