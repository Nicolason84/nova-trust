"""Lossless public-detail projection for the EXISTING France topology collector.
No new scheduler or source registry. Commune files are content-addressed shards
of france-topology.json and can only be read through its current manifest.
"""
from __future__ import annotations
import hashlib
import json
import math
import re
from collections import defaultdict
from pathlib import Path

SCHEMA = 'OJO_FRANCE_TOPOLOGY_DETAIL_V1'
SHARD_SCHEMA = 'OJO_FRANCE_COMMUNES_SHARD_V1'

def raw_json(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n').encode()

def sha(value):
    return hashlib.sha256(raw_json(value)).hexdigest()

def checked_code(value, pattern):
    value = str(value or '')
    if not re.fullmatch(pattern, value):
        raise ValueError('INVALID_TERRITORIAL_CODE')
    return value

def numeric(value, integer=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        return None
    return int(value) if integer else value

def compile_detail(regions, departments, epcis, communes, official_codes, source_meta, observed_at, root):
    """Validate the complete input before writing immutable shards; preserve old versions."""
    root = Path(root)
    region_codes = {checked_code(r['code'], r'\d{2}') for r in regions}
    if len(region_codes) != len(regions): raise ValueError('DUPLICATE_REGION')
    deps = {}
    for d in departments:
        code = checked_code(d['code'], r'(?:\d{2,3}|2[AB])')
        region = str(d.get('codeRegion') or d.get('region', {}).get('code') or '')
        if code in deps or region not in region_codes: raise ValueError('DEPARTMENT_LINEAGE')
        deps[code] = {'code': code, 'name': str(d['nom']), 'region_code': region}
    es = {}
    for e in epcis:
        code = checked_code(e['code'], r'\d{9}')
        if code in es: raise ValueError('DUPLICATE_EPCI')
        es[code] = {'code': code, 'name': str(e['nom']),
                    'region_codes': sorted(set(map(str, e.get('codesRegions', [])))),
                    'department_codes': sorted(set(map(str, e.get('codesDepartements', [])))),
                    'population': numeric(e.get('population'), True),
                    'type': e.get('type'), 'financing': e.get('financement')}
    groups = defaultdict(list); index = []; seen = set(); epci_members = defaultdict(list)
    field_counts = defaultdict(int); unresolved_epci = []; name_checks = 0
    for c in sorted(communes, key=lambda x: str(x['code'])):
        code = checked_code(c['code'], r'[0-9AB]{5}')
        if code not in official_codes: continue
        if code in seen: raise ValueError('DUPLICATE_COMMUNE')
        seen.add(code)
        dep = str(c.get('codeDepartement') or '')
        region = str(c.get('codeRegion') or '')
        if dep not in deps or deps[dep]['region_code'] != region: raise ValueError('COMMUNE_LINEAGE')
        epci = str(c.get('codeEpci') or '') or None
        if epci and epci not in es: unresolved_epci.append({'commune': code, 'epci': epci})
        point = c.get('centre') or {}; coordinates = point.get('coordinates')
        if not isinstance(coordinates, list) or len(coordinates) != 2 or any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in coordinates): coordinates = None
        elif not (-180 <= coordinates[0] <= 180 and -90 <= coordinates[1] <= 90): coordinates = None
        row = {'code': code, 'name': str(c['nom']), 'department_code': dep, 'region_code': region,
               'epci_code': epci, 'population': numeric(c.get('population'), True),
               'population_vintage': None, 'postal_codes': sorted(set(map(str, c.get('codesPostaux', [])))),
               'siren': str(c.get('siren') or '') or None, 'surface_api': numeric(c.get('surface')),
               'center': coordinates, 'source_url': 'https://geo.api.gouv.fr/communes/' + code,
               'identity_scope': 'COG_2026_TYPECOM_COM', 'local_debt_effect': 'NOT_DOCUMENTED'}
        groups[dep].append(row); index.append([code, row['name'], dep, region, epci])
        if epci: epci_members[epci].append(row)
        for field in ('population', 'postal_codes', 'siren', 'surface_api', 'center', 'epci_code'):
            if row[field] is not None and row[field] != []: field_counts[field] += 1
    if seen != set(official_codes):
        raise ValueError('COG_COVERAGE_MISMATCH:' + str(len(set(official_codes) - seen)))
    for dep, d in deps.items():
        children = groups.get(dep, [])
        d.update(commune_count=len(children), epci_codes=sorted({r['epci_code'] for r in children if r['epci_code'] in es}),
                 population_sum=sum(r['population'] or 0 for r in children), population_known_count=sum(r['population'] is not None for r in children))
    for code, e in es.items():
        children = epci_members.get(code, [])
        e['member_count_in_cog_scope'] = len(children)
        e['member_department_codes'] = sorted({r['department_code'] for r in children})
        e['member_region_codes'] = sorted({r['region_code'] for r in children})
        # Membership is an observed cross-territorial relation, not a fabricated hierarchy.
    manifest = {}
    for dep in sorted(groups):
        payload = {'schema': SHARD_SCHEMA, 'department_code': dep, 'identity_scope': 'COG_2026_TYPECOM_COM', 'communes': groups[dep]}
        content = raw_json(payload); digest = hashlib.sha256(content).hexdigest()
        rel = 'france-topology-detail/' + dep + '-' + digest[:20] + '.json'
        manifest[dep] = {'path': 'data/' + rel, 'sha256': digest, 'count': len(groups[dep]), 'bytes': len(content)}
    ds = sorted(deps.values(), key=lambda x: x['code']); es_list = sorted(es.values(), key=lambda x: x['code'])
    semantic = {'departments': ds, 'epcis': es_list, 'commune_index': index, 'shards': manifest}
    version = sha(semantic)[:24]
    detail = {'schema': SCHEMA, 'snapshot_id': 'FR-TOPO-' + version, 'observed_at': observed_at,
              'identity_vintage': '2026-01-01', 'health': 'OBSERVED',
              'sources': source_meta, 'counts': {'regions': len(region_codes), 'departments': len(ds), 'epcis_catalog': len(es_list), 'communes_cog': len(index)},
              'fields_present': dict(field_counts), 'population_vintage': 'NOT_PROVIDED_BY_THIS_API_RESPONSE',
              'epci_count_scope': 'API catalog, not silently equated to the fiscal-EPCI statistical perimeter',
              'unresolved_epci_links': unresolved_epci,
              'index_fields': ['code', 'name', 'department_code', 'region_code', 'epci_code'], **semantic}
    for dep, descriptor in manifest.items():
        file = root / descriptor['path'].removeprefix('data/')
        payload = {'schema': SHARD_SCHEMA, 'department_code': dep, 'identity_scope': 'COG_2026_TYPECOM_COM', 'communes': groups[dep]}
        content = raw_json(payload)
        if file.exists():
            if file.read_bytes() != content: raise ValueError('IMMUTABLE_SHARD_CONFLICT')
        else:
            file.parent.mkdir(parents=True, exist_ok=True)
            tmp = file.with_suffix('.tmp'); tmp.write_bytes(content); tmp.replace(file)
    return detail

def validate_detail(topo, root):
    d = topo.get('detail') or {}
    if d.get('schema') != SCHEMA: raise ValueError('DETAIL_SCHEMA')
    if d.get('counts', {}).get('communes_cog') != len(d.get('commune_index', [])): raise ValueError('INDEX_COUNT')
    index = {r[0]: r for r in d['commune_index']}
    if len(index) != len(d['commune_index']): raise ValueError('DUPLICATE_INDEX_ID')
    seen = set()
    for dep, descriptor in d['shards'].items():
        if not re.fullmatch(r'data/france-topology-detail/(?:\d{2,3}|2[AB])-[a-f0-9]{20}\.json', descriptor['path']): raise ValueError('UNSAFE_SHARD_PATH')
        content = (Path(root) / descriptor['path'].removeprefix('data/')).read_bytes()
        if hashlib.sha256(content).hexdigest() != descriptor['sha256']: raise ValueError('SHARD_DIGEST')
        p = json.loads(content)
        if p['schema'] != SHARD_SCHEMA or p['department_code'] != dep or len(p['communes']) != descriptor['count']: raise ValueError('SHARD_SCHEMA_OR_COUNT')
        for c in p['communes']:
            if c['code'] in seen or c['department_code'] != dep or c['code'] not in index: raise ValueError('SHARD_LINEAGE')
            if index[c['code']] != [c['code'], c['name'], dep, c['region_code'], c['epci_code']]: raise ValueError('INDEX_SHARD_CONFLICT')
            seen.add(c['code'])
    if seen != set(index): raise ValueError('SHARD_COVERAGE')
    return {'status': 'PASS', **d['counts'], 'shards': len(d['shards'])}
