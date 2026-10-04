#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import html
import io
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOPO = json.loads((ROOT / "docs/data/france-topology.json").read_text())
CULTURE = json.loads((ROOT / "docs/data/la-bete-territory-culture-v1.json").read_text())
OUT = ROOT / "docs/data/la-bete-territory-discovery-candidates-v1.json"
ASSET_ROOT = ROOT / "docs/assets/territory-candidates"
UA = "LaBeteTerritoryDiscovery/1.0 (+https://github.com/Nicolason84/nova-trust)"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
WIKIPEDIA_API = "https://fr.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
TABULAR_API = "https://tabular-api.data.gouv.fr/api/resources"
MERIMEE_RESOURCE = "3a52af4a-f9da-4dcc-8110-b07774dfb3bc"
LIBRARIES_RESOURCE = "806a8aa1-952f-404d-9857-3f27b7c0ca86"
TIERS_IDENTITY_URL = "https://static.data.gouv.fr/resources/recensement-des-tiers-lieux-en-france-2026/20260902-111854/bdftl-2026-01-fiche-identite.csv"
MERIMEE_DATASET = "https://www.data.gouv.fr/datasets/immeubles-proteges-au-titre-des-monuments-historiques-2"
LIBRARIES_DATASET = "https://www.data.gouv.fr/datasets/adresses-des-bibliotheques-publiques-2"
TIERS_DATASET = "https://www.data.gouv.fr/datasets/recensement-des-tiers-lieux-en-france-2026"
SCHEMA = "LA_BETE_TERRITORY_DISCOVERY_CANDIDATES_V1"
MAX_CANDIDATES = 3

LANES = {
    "heritage": {
        "queries": ["monument historique {commune}", "château {commune}", "patrimoine {name}"],
        "quest_id": "heritage_memory",
        "label": "Patrimoine",
    },
    "nature": {
        "queries": ["parc {commune}", "forêt {commune}", "réserve naturelle {name}"],
        "quest_id": "nature_risks",
        "label": "Nature",
    },
    "commons": {
        "queries": ["médiathèque {commune}", "centre culturel {commune}", "tiers-lieu {name}"],
        "quest_id": "local_initiatives",
        "label": "Communs utiles",
    },
    "initiatives": {
        "queries": ["association {commune}", "coopérative {commune}", "fablab {commune}"],
        "quest_id": "local_initiatives",
        "label": "Initiatives",
    },
}

ENTITY_CACHE: dict[str, dict] = {}
TIERS_ROWS: list[dict] | None = None

def norm(value: str) -> str:
    s = unicodedata.normalize("NFD", str(value or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()

def clean_html(value: str | None) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", value or ""))
    return re.sub(r"\s+", " ", text).strip()

def fetch_json(url: str, timeout: int = 12) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        raw = response.read(2_500_000)
        if len(raw) >= 2_500_000:
            raise ValueError("REMOTE_RESPONSE_TOO_LARGE")
        return json.loads(raw)

def tabular_rows(resource_id: str, filters: dict[str, str], page_size: int = 6) -> list[dict]:
    params = {"page_size": page_size}
    params.update({k + "__exact": v for k, v in filters.items()})
    url = TABULAR_API + "/" + resource_id + "/data/?" + urllib.parse.urlencode(params)
    return fetch_json(url, timeout=15).get("data", [])

def load_tiers_rows() -> list[dict]:
    global TIERS_ROWS
    if TIERS_ROWS is not None:
        return TIERS_ROWS
    req = urllib.request.Request(TIERS_IDENTITY_URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as response:
        raw = response.read(4_000_000)
    text = raw.decode("utf-8-sig", "replace")
    TIERS_ROWS = list(csv.DictReader(io.StringIO(text), delimiter=";"))
    return TIERS_ROWS

def heritage_candidates(dep_code: str) -> list[dict]:
    rows = tabular_rows(MERIMEE_RESOURCE, {"Departement_format_numerique": dep_code}, 6)
    out = []
    for row in rows:
        ref = row.get("Reference")
        if not ref:
            continue
        label = row.get("Titre_editorial_de_la_notice") or row.get("Denomination_de_l_edifice") or "Monument historique"
        commune = row.get("Commune_forme_editoriale") or row.get("Commune_forme_index")
        out.append({
            "candidate_id": "heritage:merimee:" + ref,
            "state": "OFFICIAL_DATASET_CANDIDATE",
            "lane": "heritage",
            "label": label,
            "commune": commune,
            "description": row.get("Historique") or row.get("Description_de_l_edifice"),
            "source": "https://pop.culture.gouv.fr/notice/merimee/" + ref,
            "dataset": MERIMEE_DATASET,
            "producer": "Ministère de la Culture",
            "license": "Licence Ouverte / Open Licence 2.0",
            "quest_id": "heritage_memory",
            "gate": "La protection patrimoniale est sourcée officiellement. La sélection éditoriale et la représentation visuelle restent à valider avant promotion.",
        })
        if len(out) >= MAX_CANDIDATES:
            break
    return out

def library_candidates(dep_code: str) -> list[dict]:
    rows = tabular_rows(LIBRARIES_RESOURCE, {"code_departement": dep_code}, 6)
    out = []
    for row in rows:
        rid = row.get("Code_bib")
        label = row.get("nom_de_l_etablissement")
        if not rid or not label:
            continue
        out.append({
            "candidate_id": "commons:library:" + rid,
            "state": "OFFICIAL_DATASET_CANDIDATE",
            "lane": "commons",
            "label": label,
            "commune": row.get("Ville"),
            "address": row.get("Adresse"),
            "website": row.get("site_internet"),
            "source": LIBRARIES_DATASET,
            "producer": "Ministère de la Culture",
            "license": "Licence Ouverte / Open Licence 2.0",
            "quest_id": "local_initiatives",
            "gate": "Établissement public sourcé. Son rôle comme commun utile dans La Bête reste une sélection éditoriale à valider.",
        })
        if len(out) >= MAX_CANDIDATES:
            break
    return out

def tier_place_candidates(dep_name: str) -> list[dict]:
    rows = [r for r in load_tiers_rows() if norm(r.get("DEPARTEMENT_TL")) == norm(dep_name)]
    rows.sort(key=lambda r: (r.get("NOM") or "", r.get("ID_UNIQUE") or ""))
    out = []
    for row in rows:
        rid = row.get("ID_UNIQUE")
        label = row.get("NOM")
        if not rid or not label:
            continue
        out.append({
            "candidate_id": "initiative:tierslieu:" + rid,
            "state": "PUBLIC_CENSUS_CANDIDATE",
            "lane": "initiatives",
            "label": label,
            "commune": row.get("VILLE"),
            "address": row.get("ADRESSE"),
            "postal_code": row.get("CODPOST"),
            "latitude": row.get("LATITUDE"),
            "longitude": row.get("LONGITUDE"),
            "website": row.get("INTERNET"),
            "project_state": row.get("état du projet"),
            "families": row.get("familles_tiers_lieux"),
            "initiative_origin": row.get("initiative_origine"),
            "source": TIERS_DATASET,
            "producer": "France Tiers-Lieux",
            "license": "Licence Ouverte / Open Licence 2.0",
            "quest_id": "local_initiatives",
            "gate": "Recensement public 2026. Vérifier l'état actuel du lieu et son utilité locale avant promotion ; aucune activité économique n'est inférée.",
        })
        if len(out) >= MAX_CANDIDATES:
            break
    return out

def wikipedia_search(query: str, limit: int = 8) -> list[dict]:
    url = WIKIPEDIA_API + "?" + urllib.parse.urlencode({
        "action": "query",
        "list": "search",
        "srsearch": query,
        "srlimit": limit,
        "format": "json",
        "utf8": 1,
        "origin": "*",
    })
    return fetch_json(url, timeout=12).get("query", {}).get("search", [])

def wikipedia_pageprops(titles: list[str]) -> dict[str, dict]:
    if not titles:
        return {}
    url = WIKIPEDIA_API + "?" + urllib.parse.urlencode({
        "action": "query",
        "titles": "|".join(titles[:20]),
        "prop": "pageprops|info",
        "inprop": "url",
        "format": "json",
        "origin": "*",
    })
    pages = fetch_json(url, timeout=12).get("query", {}).get("pages", {})
    return {p.get("title"): p for p in pages.values() if p.get("title")}

def nature_candidates(dep_code: str, dep_name: str, dep_qid: str | None) -> list[dict]:
    seen = set()
    out = []
    for query in (f"réserve naturelle {dep_name}", f"forêt {dep_name}", f"parc naturel {dep_name}"):
        rows = wikipedia_search(query, 8)
        pages = wikipedia_pageprops([r["title"] for r in rows])
        for row in rows:
            title = row.get("title")
            page = pages.get(title) or {}
            qid = (page.get("pageprops") or {}).get("wikibase_item")
            if not title or not qid or qid in seen:
                continue
            title_norm = norm(title)
            nature_title_terms = (
                "reserve naturelle", "foret", "parc", "baie", "marais", "dune",
                "massif", "vallee", "estuaire", "lac", "etang", "arboretum",
                "jardin botanique", "zone humide", "littoral",
            )
            generic_title = (
                title_norm in {norm(dep_name), norm(dep_name + " departement")}
                or title_norm.startswith("geographie ")
                or title_norm in {"reserves naturelles en france", "reserve naturelle en france"}
                or title_norm.startswith("liste ")
            )
            if generic_title or not any(term in title_norm for term in nature_title_terms):
                continue
            seen.add(qid)
            path = None
            if dep_qid:
                try:
                    path = administrative_path_to_department(qid, dep_qid)
                except Exception:
                    path = None
            text_hint = norm(dep_name) in norm(title + " " + re.sub(r"<[^>]+>", " ", row.get("snippet") or ""))
            if not path and not text_hint:
                continue
            out.append({
                "candidate_id": "nature:wikipedia:" + qid,
                "state": "UNVERIFIED_AUTODISCOVERY_CANDIDATE",
                "lane": "nature",
                "label": title,
                "description": clean_html(row.get("snippet")),
                "wikidata_id": qid,
                "source": page.get("fullurl") or ("https://fr.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))),
                "administrative_binding": "P131_PATH_TO_DEPARTMENT" if path else "TEXT_LOCALITY_HINT_ONLY",
                "administrative_path": path,
                "quest_id": "nature_risks",
                "gate": "Découverte encyclopédique seulement. Vérifier une source naturaliste ou institutionnelle avant promotion.",
            })
            if len(out) >= MAX_CANDIDATES:
                return out
    return out

def wikidata_search(search: str, limit: int = 8) -> list[dict]:
    url = WIKIDATA_API + "?" + urllib.parse.urlencode({
        "action": "wbsearchentities",
        "search": search,
        "language": "fr",
        "uselang": "fr",
        "format": "json",
        "limit": limit,
        "type": "item",
        "origin": "*",
    })
    return fetch_json(url).get("search", [])

def wikidata_entities(qids: list[str] | set[str]) -> dict[str, dict]:
    wanted = [q for q in dict.fromkeys(qids) if q and q not in ENTITY_CACHE]
    for start in range(0, len(wanted), 40):
        batch = wanted[start:start + 40]
        url = WIKIDATA_API + "?" + urllib.parse.urlencode({
            "action": "wbgetentities",
            "ids": "|".join(batch),
            "props": "claims|labels|descriptions",
            "languages": "fr|en",
            "format": "json",
            "origin": "*",
        })
        ENTITY_CACHE.update(fetch_json(url).get("entities", {}))
    return {qid: ENTITY_CACHE.get(qid, {}) for qid in qids}

def wikidata_entity(qid: str) -> dict:
    return wikidata_entities([qid]).get(qid, {})

def parent_qids(entity: dict) -> set[str]:
    out = set()
    for claim in (entity.get("claims") or {}).get("P131", []):
        try:
            out.add(claim["mainsnak"]["datavalue"]["value"]["id"])
        except Exception:
            pass
    return out

def administrative_path_to_department(qid: str, department_qid: str, max_depth: int = 5) -> list[str] | None:
    frontier = {qid}
    parents_of: dict[str, str | None] = {qid: None}
    seen = set()
    for _depth in range(max_depth + 1):
        if department_qid in frontier:
            path = [department_qid]
            cur = department_qid
            while parents_of.get(cur) is not None:
                cur = parents_of[cur]
                path.append(cur)
            return list(reversed(path))
        current = frontier - seen
        if not current:
            break
        seen |= current
        entities = wikidata_entities(current)
        nxt = set()
        for child, entity in entities.items():
            for parent in parent_qids(entity):
                if parent not in parents_of:
                    parents_of[parent] = child
                nxt.add(parent)
        frontier = nxt
    return None

def department_qid(name: str) -> tuple[str | None, dict | None]:
    target = norm(name)
    rows = wikidata_search(name, 10)
    ranked = []
    for row in rows:
        label = norm(row.get("label"))
        desc = norm(row.get("description"))
        exact = label == target
        dept = ("departement" in desc or "department" in desc) and ("france" in desc or "french" in desc)
        ranked.append((int(exact) * 4 + int(dept) * 3, row))
    ranked.sort(key=lambda x: -x[0])
    if not ranked or ranked[0][0] < 3:
        return None, None
    return ranked[0][1].get("id"), ranked[0][1]

def commons_image(filename: str, dep_code: str, qid: str) -> dict | None:
    url = COMMONS_API + "?" + urllib.parse.urlencode({
        "action": "query",
        "titles": "File:" + filename,
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|mime|size",
        "iiurlwidth": 960,
        "format": "json",
        "origin": "*",
    })
    pages = fetch_json(url).get("query", {}).get("pages", {})
    if not pages:
        return None
    page = next(iter(pages.values()))
    info = (page.get("imageinfo") or [None])[0]
    if not info:
        return None
    meta = info.get("extmetadata") or {}
    license_name = clean_html((meta.get("LicenseShortName") or {}).get("value"))
    license_url = clean_html((meta.get("LicenseUrl") or {}).get("value"))
    allowed = bool(
        re.search(r"\bCC\b|Creative Commons|Public domain|CC0|PDM", license_name, re.I)
        or "creativecommons.org/" in license_url
    )
    if not allowed:
        return None
    thumb = info.get("thumburl") or info.get("url")
    if not thumb or not thumb.startswith("https://"):
        return None
    asset_name = hashlib.sha256((qid + "|" + filename).encode()).hexdigest()[:16] + ".jpg"
    rel = f"assets/territory-candidates/{dep_code}/{asset_name}"
    dest = ROOT / "docs" / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        req = urllib.request.Request(thumb, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as response:
            ctype = response.headers.get("Content-Type", "")
            raw = response.read(1_800_000)
        if len(raw) >= 1_800_000 or not ctype.startswith("image/"):
            raise ValueError("CANDIDATE_IMAGE_INVALID")
        dest.write_bytes(raw)
    except Exception:
        rel = None
    return {
        "candidate_id": "media:" + qid,
        "state": "LICENSE_VERIFIED_LOCATION_CANDIDATE",
        "kind": "representative_department_media",
        "wikidata_id": qid,
        "label": filename,
        "source_page": "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(filename.replace(" ", "_"), safe="/()_',-."),
        "thumbnail_source": thumb,
        "asset": rel,
        "license": license_name or "UNKNOWN",
        "license_url": license_url or None,
        "author": clean_html((meta.get("Artist") or {}).get("value")) or "UNKNOWN",
        "description": clean_html((meta.get("ImageDescription") or {}).get("value"))[:500],
        "gate": "Licence vérifiée. Pertinence éditoriale et représentativité restent à valider avant promotion.",
        "quest_id": "heritage_memory",
    }

def department_media(dep_code: str, qid: str) -> list[dict]:
    entity = wikidata_entity(qid)
    claims = entity.get("claims") or {}
    p18 = claims.get("P18") or []
    if not p18:
        return []
    try:
        filename = p18[0]["mainsnak"]["datavalue"]["value"]
    except Exception:
        return []
    item = commons_image(filename, dep_code, qid)
    return [item] if item else []

def locality_tokens(dep_code: str, dep_name: str) -> set[str]:
    tokens = {norm(dep_name)}
    for row in TOPO["detail"]["commune_index"]:
        if row[2] == dep_code and len(norm(row[1])) >= 5:
            tokens.add(norm(row[1]))
    return tokens

def top_communes(dep_code: str, limit: int = 2) -> list[str]:
    descriptor = (TOPO["detail"].get("shards") or {}).get(dep_code) or {}
    path = descriptor.get("path")
    if path:
        full = ROOT / "docs" / path
        if full.exists():
            try:
                payload = json.loads(full.read_text())
                rows = [x for x in payload.get("communes", []) if isinstance(x.get("population"), (int, float))]
                rows.sort(key=lambda x: (-x["population"], x["name"]))
                names = [x["name"] for x in rows[:limit]]
                if names:
                    return names
            except Exception:
                pass
    return [row[1] for row in TOPO["detail"]["commune_index"] if row[2] == dep_code][:limit]

def candidate_search(dep_code: str, dep_name: str, lane: str, dep_qid: str | None) -> list[dict]:
    config = LANES[lane]
    local = locality_tokens(dep_code, dep_name)
    communes = top_communes(dep_code) or [dep_name]
    seen = set()
    accepted = []
    for template in config["queries"]:
        commune = communes[min(len(seen), len(communes) - 1)]
        query = template.format(name=dep_name, commune=commune)
        try:
            rows = wikidata_search(query, 10)
            wikidata_entities([row.get("id") for row in rows if row.get("id")])
        except Exception:
            continue
        for row in rows:
            qid = row.get("id")
            if not qid or qid in seen:
                continue
            seen.add(qid)
            hay = norm((row.get("label") or "") + " " + (row.get("description") or ""))
            matched = next((token for token in local if token and token in hay), None)
            path = None
            if dep_qid:
                try:
                    path = administrative_path_to_department(qid, dep_qid)
                except Exception:
                    path = None
            if not path and not matched:
                continue
            accepted.append({
                "candidate_id": f"{lane}:{qid}",
                "state": "UNVERIFIED_AUTODISCOVERY_CANDIDATE",
                "lane": lane,
                "label": row.get("label") or qid,
                "description": row.get("description"),
                "wikidata_id": qid,
                "source": "https://www.wikidata.org/wiki/" + qid,
                "search_query": query,
                "matched_locality": matched,
                "administrative_binding": "P131_PATH_TO_DEPARTMENT" if path else "TEXT_LOCALITY_HINT_ONLY",
                "administrative_path": path,
                "quest_id": config["quest_id"],
                "gate": "Découverte automatique seulement. Vérifier la nature de l'entité, une source locale ou officielle et l'utilité avant promotion.",
            })
            if len(accepted) >= MAX_CANDIDATES:
                return accepted
    return accepted

def relation_summary(dep_code: str) -> dict:
    groups: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for code, name, dcode, _region, epci in TOPO["detail"]["commune_index"]:
        if dcode == dep_code and epci:
            groups[epci].append((code, name))
    pair_count = sum(len(rows) * (len(rows) - 1) // 2 for rows in groups.values())
    largest = sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0]))[:6]
    return {
        "state": "VERIFIED_CANONICAL_TOPOLOGY_RELATION",
        "relation": "same_epci",
        "epci_cluster_count": len(groups),
        "same_epci_pair_count": pair_count,
        "examples": [
            {
                "epci_code": epci,
                "member_count": len(rows),
                "communes": [{"code": c, "name": n} for c, n in rows[:8]],
            }
            for epci, rows in largest
        ],
        "source": "france-topology.json",
        "gate": "Relation administrative vérifiée. Elle ne prouve aucune proximité culturelle, économique ou affective.",
    }

def load_existing() -> dict:
    if not OUT.exists():
        return {}
    try:
        doc = json.loads(OUT.read_text())
        return doc if doc.get("schema") == SCHEMA else {}
    except Exception:
        return {}

def choose_codes(explicit: str | None, batch_size: int, all_codes: bool) -> list[str]:
    codes = list(CULTURE["departments"].keys())
    if all_codes:
        return codes
    if explicit:
        wanted = [x.strip().upper() for x in explicit.split(",") if x.strip()]
        unknown = [x for x in wanted if x not in CULTURE["departments"]]
        if unknown:
            raise SystemExit("UNKNOWN_DEPARTMENT_CODES:" + ",".join(unknown))
        return wanted
    existing = load_existing().get("departments") or {}
    def key(code: str):
        row = existing.get(code) or {}
        never = 0 if not row.get("scanned_at") else 1
        return (never, row.get("scanned_at") or "", code)
    return sorted(codes, key=key)[:batch_size]

def scan_department(code: str, offline: bool = False) -> dict:
    profile = CULTURE["departments"][code]
    name = profile["name"]
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    base = {
        "code": code,
        "name": name,
        "scanned_at": now,
        "state": "DISCOVERY_CANDIDATES_NOT_CANON",
        "promotion_authorized": False,
        "mints_phi": False,
        "changes_documentation_score": False,
        "relations": relation_summary(code),
        "media": [],
        "heritage": [],
        "nature": [],
        "commons": [],
        "initiatives": [],
        "source_health": {},
    }
    if offline:
        base["state"] = "OFFLINE_RELATION_BASELINE_ONLY"
        return base
    qid = None
    try:
        qid, dept_row = department_qid(name)
        base["source_health"]["wikidata_department"] = "PASS" if qid else "NO_MATCH"
        if qid:
            base["wikidata_department"] = {
                "id": qid,
                "label": dept_row.get("label"),
                "description": dept_row.get("description"),
                "source": "https://www.wikidata.org/wiki/" + qid,
            }
            base["media"] = department_media(code, qid)
            base["source_health"]["commons_license_media"] = "PASS" if base["media"] else "NO_LICENSED_MEDIA"
    except Exception as exc:
        base["source_health"]["wikidata_department"] = "ERROR:" + type(exc).__name__
    try:
        base["heritage"] = heritage_candidates(code)
        base["source_health"]["merimee_tabular"] = "PASS" if base["heritage"] else "NO_MATCH"
    except Exception as exc:
        base["source_health"]["merimee_tabular"] = "ERROR:" + type(exc).__name__
    try:
        base["commons"] = library_candidates(code)
        base["source_health"]["libraries_tabular"] = "PASS" if base["commons"] else "NO_MATCH"
    except Exception as exc:
        base["source_health"]["libraries_tabular"] = "ERROR:" + type(exc).__name__
    try:
        base["initiatives"] = tier_place_candidates(name)
        base["source_health"]["tiers_lieux_2026_csv"] = "PASS" if base["initiatives"] else "NO_MATCH"
    except Exception as exc:
        base["source_health"]["tiers_lieux_2026_csv"] = "ERROR:" + type(exc).__name__
    try:
        base["nature"] = nature_candidates(code, name, qid)
        base["source_health"]["nature_wikipedia_wikidata"] = "PASS" if base["nature"] else "NO_MATCH"
    except Exception as exc:
        base["source_health"]["nature_wikipedia_wikidata"] = "ERROR:" + type(exc).__name__
    return base

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--codes")
    ap.add_argument("--batch-size", type=int, default=12)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--out")
    args = ap.parse_args()
    global OUT
    if args.out:
        OUT = Path(args.out)
    if args.batch_size < 1 or args.batch_size > 101:
        raise SystemExit("INVALID_BATCH_SIZE")
    selected = choose_codes(args.codes, args.batch_size, args.all)
    existing = load_existing()
    departments = dict(existing.get("departments") or {})
    for code in selected:
        previous = departments.get(code)
        try:
            scanned = scan_department(code, args.offline)
            if previous and scanned["state"].startswith("DISCOVERY") and not any(scanned[l] for l in ("media","heritage","nature","commons","initiatives")):
                scanned["last_good_candidates"] = {
                    lane: previous.get(lane, []) for lane in ("media","heritage","nature","commons","initiatives") if previous.get(lane)
                }
            departments[code] = scanned
            print(code, CULTURE["departments"][code]["name"], scanned["state"],
                  "media", len(scanned["media"]), "heritage", len(scanned["heritage"]),
                  "nature", len(scanned["nature"]), "commons", len(scanned["commons"]),
                  "initiatives", len(scanned["initiatives"]))
        except Exception as exc:
            if previous:
                previous = dict(previous)
                previous["last_scan_error"] = type(exc).__name__
                previous["last_scan_error_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                departments[code] = previous
                print(code, "RETAINED_LAST_GOOD", type(exc).__name__)
            else:
                departments[code] = scan_department(code, True)
                departments[code]["last_scan_error"] = type(exc).__name__
                print(code, "FAIL_CLOSED_RELATION_BASELINE", type(exc).__name__)
    scanned_count = sum(bool(x.get("scanned_at")) for x in departments.values())
    candidate_count = sum(
        len(x.get(lane) or [])
        for x in departments.values()
        for lane in ("media","heritage","nature","commons","initiatives")
    )
    doc = {
        "schema": SCHEMA,
        "state": "AUTODISCOVERY_CANDIDATES_SEPARATE_FROM_CANON",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "topology_snapshot": TOPO["detail"]["snapshot_id"],
        "culture_schema": CULTURE["schema"],
        "contract": {
            "automatic_discovery_is_proof": False,
            "automatic_discovery_can_promote_living_identity": False,
            "automatic_discovery_mints_phi": False,
            "automatic_discovery_changes_documentation_score": False,
            "verified_receipt_required_for_phi": True,
            "human_or_external_source_verification_required_for_promotion": True,
            "last_good_retention": True,
        },
        "batch_policy": {
            "default_batch_size": 12,
            "selection": "UNSCANNED_FIRST_THEN_OLDEST_SCAN",
            "scheduled_cadence": "DAILY",
            "full_cycle_target_runs": 9,
        },
        "sources": {
            "wikidata": WIKIDATA_API,
            "wikipedia_fr": WIKIPEDIA_API,
            "wikimedia_commons": COMMONS_API,
            "merimee_monuments_historiques": MERIMEE_DATASET,
            "bibliotheques_publiques": LIBRARIES_DATASET,
            "tiers_lieux_2026": TIERS_DATASET,
            "canonical_relations": "docs/data/france-topology.json",
        },
        "coverage": {
            "departments_total": len(CULTURE["departments"]),
            "departments_with_scan_record": scanned_count,
            "candidate_items": candidate_count,
            "selected_this_run": selected,
        },
        "departments": departments,
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    print("DISCOVERY_COVERAGE", scanned_count, "/", len(CULTURE["departments"]))
    print("DISCOVERY_CANDIDATES", candidate_count)

if __name__ == "__main__":
    main()
