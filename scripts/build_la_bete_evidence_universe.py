#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from la_bete_patrimonial_engines import engine_registry, run_deep_smca, run_legacy_text_engines

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
LIVE_PATH = DOCS / "data/france-debt-rate-live.json"
DISCOVERY_PATH = DOCS / "data/la-bete-territory-discovery-candidates-v1.json"
LIVING_PATH = DOCS / "data/la-bete-territory-living-identity-v1.json"
CONTRIBUTIONS_PATH = DOCS / "data/la-bete-territory-contributions-v1.json"
OUT_PATH = DOCS / "data/la-bete-evidence-universe-v1.json"

PUBLIC_DOCUMENT_NAMES = (
    "FRANCE_BEAST_BINDING.json",
    "budget-2027-live.json",
    "environment-live.json",
    "france-debt-rate-evolution.json",
    "france-debt-rate-live.json",
    "france-organism.json",
    "france-topology.json",
    "la-bete-mobile-access.json",
    "la-bete-territory-contributions-v1.json",
    "la-bete-territory-culture-v1.json",
    "la-bete-territory-discovery-candidates-v1.json",
    "la-bete-territory-living-identity-v1.json",
    "organism-state.json",
    "phi-coins-v1.json",
    "phi-territory-quests-v1.json",
    "property-return-canonical/current.json",
)
PUBLIC_ARCHIVE_PATHS = (
    DOCS / "data/property-return-canonical/history/2026-09-20-v0.1.0.json",
)

SCHEMA = "LA_BETE_EVIDENCE_UNIVERSE_V1"
PROOFGRAPH_SCHEMA = "SUPRA_PROOFGRAPH_PUBLIC_PROJECTION_V1"
OBJECT_MODEL_SCHEMA = "LA_BETE_EVIDENCE_OBJECT_MODEL_V2"
SUPPORTED_KINDS = (
    "SOURCE", "CLAIM", "DOCUMENT", "PERSON", "ORGANIZATION", "COMPANY",
    "INITIATIVE", "OPPORTUNITY", "DECISION", "VIDEO", "AUDIO", "ARCHIVE",
    "CONTRIBUTION", "RELATION", "TERRITORY_CANDIDATE",
    "TERRITORY_MEDIA_CANDIDATE", "VERIFIED_LIVING_MEDIA",
)
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

    baseline_score = 55
    baseline_score += 20 if signature_ok else 0
    baseline_score += 15 if license_name else 0
    baseline_score += 10 if source_page else 0
    baseline_score = min(100, baseline_score)

    deep = run_deep_smca(path, public_asset=asset)
    deep_score = None
    if deep.get("executed") is True:
        value = (deep.get("score") or {}).get("value")
        if isinstance(value, (int, float)):
            deep_score = int(value)
            reasons.append(f"Deep SMCA v0.1 exécuté : cohérence structurelle {deep_score}/100.")
    else:
        reasons.append("Deep SMCA patrimonial indisponible dans cet environnement d'exécution.")

    return {
        "status": "DEEP_SMCA_V0_1_EXECUTED" if deep_score is not None else "PARTIAL_STRUCTURAL_CHECKS_ONLY",
        "score": deep_score if deep_score is not None else baseline_score,
        "baseline_score": baseline_score,
        "deep_smca": "EXECUTED" if deep_score is not None else deep.get("status", "NOT_RUN"),
        "deep_analysis": deep,
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


def claim_crosscheck_score(claim_state: str | None, source_ids: list[str] | None) -> tuple[int, list[str]]:
    ids = list(dict.fromkeys(source_ids or []))
    if claim_state == "CROSSCHECKED":
        return crosscheck_score(ids)
    if claim_state == "CONTRADICTED":
        return 10, ["Des références multiples existent mais elles se contredisent sur la même portée."]
    if ids:
        return 55, ["Référence(s) liée(s), mais le claim n'est pas recoupé sur la même portée et le même millésime."]
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
            lane: str | None = None, patrimonial: dict | None = None,
            object_refs: list[str] | None = None, object_meta: dict | None = None) -> dict:
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
            "engine_binding": "USCRC_PRE_EVENT_PATTERN_CORE_V1_READ_ONLY_CONTEXT",
            "reliability_index": index,
            "certificate_issued": False,
        },
        "patrimonial_analysis": patrimonial or {},
        "object_refs": list(dict.fromkeys(x for x in (object_refs or []) if x)),
        "object_meta": object_meta or {},
        "what_would_raise_confidence": missing or [],
    }
    return result


def build() -> dict:
    live = load(LIVE_PATH)
    discovery = load(DISCOVERY_PATH)
    living = load(LIVING_PATH)
    contributions = load(CONTRIBUTIONS_PATH)
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
        cross = claim_crosscheck_score(claim.get("state"), source_ids)
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
                if lane == "media" and m.get("deep_smca") != "EXECUTED":
                    missing.append("Deep SMCA n'a pas pu être exécuté dans cet environnement ; ne pas inférer d'intégrité structurelle.")
                if cross[0] < 80:
                    missing.append("Ajouter un recoupement indépendant.")
                source_quality = SOURCE_STATE_SCORE.get(state, 50)
                oid = f"territory:{dep_code}:{cid}"
                objects[oid] = profile(
                    object_id=oid,
                    kind="TERRITORY_MEDIA_CANDIDATE" if lane == "media" else "INITIATIVE" if lane == "initiatives" else "TERRITORY_CANDIDATE",
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
            missing = ["Deep SMCA n'a pas pu être exécuté dans cet environnement ; ne pas inférer d'intégrité structurelle."] if m.get("deep_smca") != "EXECUTED" else []
            oid = f"living-media:{dep_code}:{mid}"
            objects[oid] = profile(
                object_id=oid, kind="VERIFIED_LIVING_MEDIA", label=item.get("label", mid),
                evidence_state="VERIFIED_LIVING_IDENTITY_MEDIA", source_quality=96,
                provenance=prov, coherence=coh, crosscheck=cross, media=m,
                proof_refs=[mid], source_urls=refs + [item.get("license_url")],
                contradictions=[], missing=missing, department_code=dep_code, lane="living_media",
            )

    # First-class public documents: exact local materialized corpus + historical TRUST/COHERENCE.
    for name in PUBLIC_DOCUMENT_NAMES:
        path = DOCS / "data" / name
        if not path.is_file():
            continue
        raw_text = path.read_text()
        try:
            payload = json.loads(raw_text)
        except Exception:
            payload = {}
        digest = sha256_file(path)
        patrimonial = run_legacy_text_engines(raw_text, local_name=f"data/{name}", document_sha256=digest)
        prov = provenance_score({
            "id": name,
            "source": f"data/{name}",
            "publisher": "La Bête public materialized corpus",
            "date": payload.get("generated_at") or payload.get("observed_at") or payload.get("timestamp"),
            "digest": digest,
        })
        coh = coherence_score(official=True)
        oid = "document:" + stable_hash(name)[:20]
        objects[oid] = profile(
            object_id=oid, kind="DOCUMENT", label=payload.get("schema") or name,
            evidence_state="PUBLIC_MATERIALIZED_DOCUMENT", source_quality=90 if payload.get("schema") else 78,
            provenance=prov, coherence=coh, crosscheck=crosscheck_score([f"data/{name}"]),
            media=media_structure(None, None, None), proof_refs=[digest, payload.get("schema")],
            source_urls=[f"data/{name}"], patrimonial=patrimonial,
            object_meta={
                "public_path": f"data/{name}",
                "sha256": digest,
                "bytes": path.stat().st_size,
                "schema": payload.get("schema"),
                "document_analysis_scope": "FULL_LOCAL_PUBLIC_DOCUMENT",
            },
        )

    # Public archive snapshots remain distinct from current documents.
    for path in PUBLIC_ARCHIVE_PATHS:
        if not path.is_file():
            continue
        rel = str(path.relative_to(DOCS))
        raw_text = path.read_text()
        digest = sha256_file(path)
        patrimonial = run_legacy_text_engines(raw_text, local_name=rel, document_sha256=digest)
        oid = "archive:" + stable_hash(rel)[:20]
        objects[oid] = profile(
            object_id=oid, kind="ARCHIVE", label=path.name,
            evidence_state="PUBLIC_ARCHIVE_SNAPSHOT", source_quality=88,
            provenance=provenance_score({
                "id": rel, "source": rel, "publisher": "La Bête public archive",
                "date": path.stem[:10], "digest": digest,
            }),
            coherence=coherence_score(official=True), crosscheck=crosscheck_score([rel]),
            media=media_structure(None, None, None), proof_refs=[digest], source_urls=[rel],
            patrimonial=patrimonial,
            object_meta={"public_path": rel, "sha256": digest, "bytes": path.stat().st_size},
        )

    # Living opportunities are evidence objects, not economic promises.
    for dep_code, dep in living.get("departments", {}).items():
        for item in dep.get("opportunities", []) or []:
            item_id = item.get("id") or stable_hash(item)[:16]
            source_url = item.get("source")
            state = item.get("state", "OPEN_DOCUMENTATION_OPPORTUNITY")
            oid = f"opportunity:{dep_code}:{item_id}"
            objects[oid] = profile(
                object_id=oid, kind="OPPORTUNITY", label=item.get("label", item_id),
                evidence_state=state, source_quality=88 if source_url else 58,
                provenance=provenance_score({
                    "id": item_id, "source": source_url, "publisher": "La Bête living identity",
                    "date": living.get("generated_at"), "digest": stable_hash(item),
                }),
                coherence=coherence_score(verified_living=True),
                crosscheck=crosscheck_score([source_url] if source_url else []),
                media=media_structure(None, None, None), proof_refs=[item_id, stable_hash(item)],
                source_urls=[source_url], department_code=dep_code, lane="opportunity",
                object_meta={
                    "family": item.get("family"),
                    "economic_claim": bool(item.get("economic_claim", False)),
                    "opportunity_is_not_market_demand": True,
                },
            )

    # Decision Twin analytical signal: a decision object, never an external act.
    decision_delta = live.get("decision_delta") or {}
    if decision_delta:
        oid = "decision:france-debt-rate:decision-delta"
        objects[oid] = profile(
            object_id=oid, kind="DECISION", label="France debt-rate Decision Delta",
            evidence_state="DERIVED_DECISION_SIGNAL", source_quality=78,
            provenance=provenance_score({
                "id": "decision_delta",
                "source": "data/france-debt-rate-live.json#decision_delta",
                "publisher": "La Bête Decision Twin",
                "date": live.get("observed_at") or live.get("generated_at"),
                "digest": stable_hash(decision_delta),
            }),
            coherence=coherence_score(claim_state="CROSSCHECKED" if decision_delta.get("confidence") == "HIGH" else None),
            crosscheck=crosscheck_score([x.get("id") for x in live.get("sources", []) if x.get("health") in {"LIVE_VERIFIED", "CROSSCHECKED"}]),
            media=media_structure(None, None, None),
            proof_refs=["decision_delta", live.get("snapshot_id")],
            source_urls=["data/france-debt-rate-live.json"],
            missing=["Ce signal reste une aide analytique ; aucune action externe ou recommandation politique n'est autorisée."],
            object_meta={"decision_semantics": "ANALYTICAL_SIGNAL_NOT_ACT", "signal": decision_delta},
        )

    # Verified contribution receipts become first-class objects when the registry is populated.
    for receipt in contributions.get("receipts", []) or []:
        receipt_id = receipt.get("receipt_id") or receipt.get("id") or stable_hash(receipt)[:20]
        source_url = receipt.get("source") or receipt.get("source_url")
        oid = "contribution:" + str(receipt_id)
        objects[oid] = profile(
            object_id=oid, kind="CONTRIBUTION", label=receipt.get("label") or str(receipt_id),
            evidence_state=receipt.get("state", "VERIFIED_CONTRIBUTION_RECEIPT"),
            source_quality=90 if source_url else 72,
            provenance=provenance_score({
                "id": receipt_id, "source": source_url, "publisher": receipt.get("contributor_label") or "Contribution registry",
                "date": receipt.get("verified_at") or receipt.get("created_at"), "digest": stable_hash(receipt),
            }),
            coherence=coherence_score(verified_living=True),
            crosscheck=crosscheck_score([source_url] if source_url else []),
            media=media_structure(None, None, None), proof_refs=[receipt_id, stable_hash(receipt)],
            source_urls=[source_url], department_code=receipt.get("department_code"),
            lane="contribution", object_meta={"receipt": receipt},
        )

    # ProofGraph edges become first-class relation objects.
    for edge in graph_edges:
        rid = stable_hash(edge)[:20]
        source_id = edge.get("from")
        target_id = edge.get("to")
        oid = "relation:proofgraph:" + rid
        objects[oid] = profile(
            object_id=oid, kind="RELATION", label=edge.get("type") or edge.get("relation") or f"{source_id} → {target_id}",
            evidence_state="PROOFGRAPH_RELATION", source_quality=96,
            provenance=provenance_score({
                "id": rid, "source": "data/france-debt-rate-live.json#evidence_graph",
                "publisher": "ProofGraph", "date": live.get("observed_at"), "digest": stable_hash(edge),
            }),
            coherence=coherence_score(claim_state="CROSSCHECKED"), crosscheck=crosscheck_score([source_id, target_id]),
            media=media_structure(None, None, None), proof_refs=[source_id, target_id, rid],
            source_urls=["data/france-debt-rate-live.json"], object_refs=[source_id, target_id],
            object_meta={"relation": edge},
        )

    # Territory relations from verified living identity.
    for dep_code, dep in living.get("departments", {}).items():
        for rel in dep.get("connections", []) or []:
            rid = rel.get("id") or stable_hash(rel)[:20]
            source_url = rel.get("source")
            oid = f"relation:territory:{dep_code}:{rid}"
            objects[oid] = profile(
                object_id=oid, kind="RELATION", label=rel.get("label", rid),
                evidence_state=rel.get("state", "TERRITORY_RELATION"), source_quality=90 if source_url else 62,
                provenance=provenance_score({
                    "id": rid, "source": source_url, "publisher": "La Bête living identity",
                    "date": living.get("generated_at"), "digest": stable_hash(rel),
                }),
                coherence=coherence_score(verified_living=True),
                crosscheck=crosscheck_score([source_url] if source_url else []),
                media=media_structure(None, None, None), proof_refs=[rid],
                source_urls=[source_url], department_code=dep_code, lane="relation",
                object_refs=rel.get("commune_codes") or [], object_meta={"relation": rel},
            )

    # Public media attribution labels become PERSON objects without asserting legal identity.
    people: dict[str, dict[str, Any]] = {}
    for dep_code, dep in discovery.get("departments", {}).items():
        for item in dep.get("media", []) or []:
            if item.get("author"):
                entry = people.setdefault(item["author"], {"urls": [], "refs": [], "departments": set()})
                entry["urls"].append(item.get("source_page"))
                entry["refs"].append(item.get("candidate_id"))
                entry["departments"].add(dep_code)
    for dep_code, dep in living.get("departments", {}).items():
        for item in (dep.get("media", {}) or {}).get("items", []) or []:
            if item.get("author"):
                entry = people.setdefault(item["author"], {"urls": [], "refs": [], "departments": set()})
                entry["urls"].append(item.get("source_page"))
                entry["refs"].append(item.get("id"))
                entry["departments"].add(dep_code)
    for author, entry in people.items():
        oid = "person:attribution:" + stable_hash(author)[:20]
        urls = list(dict.fromkeys(x for x in entry["urls"] if x))
        objects[oid] = profile(
            object_id=oid, kind="PERSON", label=author,
            evidence_state="PUBLIC_MEDIA_ATTRIBUTION_LABEL", source_quality=72,
            provenance=provenance_score({
                "id": oid, "source": urls[0] if urls else None, "publisher": "Wikimedia/public attribution",
                "date": None, "digest": stable_hash({"author": author, "refs": entry["refs"]}),
            }),
            coherence=coherence_score(), crosscheck=crosscheck_score(urls),
            media=media_structure(None, None, None), proof_refs=entry["refs"], source_urls=urls,
            object_refs=entry["refs"],
            object_meta={"identity_claim": False, "attribution_label_only": True, "department_codes": sorted(entry["departments"])},
        )

    # Source publishers/producers become ORGANIZATION objects; no company/legal-form inference.
    organizations: dict[str, dict[str, Any]] = {}
    for source in live.get("sources", []):
        publisher = source.get("publisher")
        if publisher:
            entry = organizations.setdefault(publisher, {"urls": [], "refs": []})
            entry["urls"].append(source.get("url"))
            entry["refs"].append("source:" + source.get("id", ""))
    for dep in discovery.get("departments", {}).values():
        for lane in ("heritage", "nature", "commons", "initiatives"):
            for item in dep.get(lane, []) or []:
                producer = item.get("producer") or item.get("source_provider")
                if producer:
                    entry = organizations.setdefault(producer, {"urls": [], "refs": []})
                    entry["urls"].append(item.get("source"))
                    entry["refs"].append(item.get("candidate_id"))
    for org, entry in organizations.items():
        oid = "organization:source-role:" + stable_hash(org)[:20]
        urls = list(dict.fromkeys(x for x in entry["urls"] if x))
        refs = list(dict.fromkeys(x for x in entry["refs"] if x))
        objects[oid] = profile(
            object_id=oid, kind="ORGANIZATION", label=org,
            evidence_state="PUBLIC_SOURCE_OR_PRODUCER_ROLE", source_quality=80,
            provenance=provenance_score({
                "id": oid, "source": urls[0] if urls else None, "publisher": "Public source metadata",
                "date": None, "digest": stable_hash({"organization": org, "refs": refs}),
            }),
            coherence=coherence_score(official=True), crosscheck=crosscheck_score(urls),
            media=media_structure(None, None, None), proof_refs=refs, source_urls=urls,
            object_refs=refs, object_meta={"legal_form_inferred": False},
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
    deep_smca_count = sum(1 for item in ordered.values() if item.get("smca", {}).get("deep_analysis", {}).get("executed") is True)
    historical_text_count = sum(
        1 for item in ordered.values()
        if item.get("patrimonial_analysis", {}).get("trust_deep", {}).get("execution")
        in {"EXECUTED_PATRIMONIAL_ENGINE_RECEIPT", "LOCAL_PRIVATE_ENGINE_SAFE_FUNCTIONS_EXECUTED", "EXECUTED_PRIVATE_ENGINE_LOCAL"}
    )
    supported_counts = {kind: counts.get(kind, 0) for kind in SUPPORTED_KINDS}
    return {
        "schema": SCHEMA,
        "object_model": {
            "schema": OBJECT_MODEL_SCHEMA,
            "supported_kinds": list(SUPPORTED_KINDS),
            "relations_are_first_class_objects": True,
            "single_registry": True,
            "company_legal_form_inference": False,
            "video": "SUPPORTED_BY_DEEP_SMCA_V0_1_WHEN_PUBLIC_ASSET_EXISTS",
            "audio": "SCHEMA_READY_NO_DEEP_SMCA_V0_1_AUDIO_ANALYZER",
            "unpopulated_kinds_are_not_fabricated": True,
        },
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
            "deep_smca_executed": deep_smca_count > 0,
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
            "trust": {
                "status": "EXPLAINABLE_EVIDENCE_READINESS_PLUS_PATRIMONIAL_TEXT_ENGINE",
                "historical_engine_execution": historical_text_count > 0,
                "executed_document_count": historical_text_count,
            },
            "coherence": {
                "status": "STRUCTURAL_CONTEXT_PROFILE_PLUS_HISTORICAL_MULTILAYER",
                "historical_engine_execution": historical_text_count > 0,
                "executed_document_count": historical_text_count,
            },
            "smca": {
                "status": "DEEP_SMCA_V0_1_BOUND",
                "deep_analysis": "EXECUTED" if deep_smca_count > 0 else "UNAVAILABLE",
                "executed_media_count": deep_smca_count,
            },
            "uscrc": {
                "status": "RECOVERED_READ_ONLY_SYSTEM_CONTEXT_NOT_OBJECT_CERTIFICATE",
                "runtime_certificate": False,
                "object_execution": False,
            },
            "trusty": {"status": "LABEL_ONLY_NO_SEPARATE_ENGINE"},
        },
        "patrimonial_engine_bindings": engine_registry(),
        "score_contract": {
            "weights": WEIGHTS,
            "range": [0, 100],
            "higher_means": "MORE_DOCUMENTARY_EVIDENCE_READY",
            "does_not_mean": ["TRUE", "AUTHENTIC", "SAFE", "ENDORSED", "CANON"],
        },
        "coverage": {
            "objects_total": len(ordered),
            "by_kind": counts,
            "supported_kind_counts": supported_counts,
            "deep_smca_executions": deep_smca_count,
            "historical_text_engine_executions": historical_text_count,
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
