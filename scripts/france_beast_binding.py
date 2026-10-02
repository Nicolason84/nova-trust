"""Bind existing France identities and evidence; never compute a second debt model."""
from __future__ import annotations
import hashlib, json
from pathlib import Path

FRANCE = Path('docs/data/france-organism.json')
BINDING = Path('docs/data/FRANCE_BEAST_BINDING.json')
LIVE = 'docs/data/france-debt-rate-live.json'

def binding(france=None):
    france = france or json.loads(FRANCE.read_text())
    assert france['schema'] == 'OJO_FRANCE_ORGANISM_V1'
    assert france['identity']['name'] == 'France'
    assert {'finance', 'budget'} <= set(france['physiology']['systems'])
    return {
        'schema': 'FRANCE_BEAST_BINDING_V1',
        'mode': 'REFERENCES_TO_EXISTING_CANONICAL_OBJECTS',
        'country_object_id': france['schema'] + '#/identity',
        'system_id': france['schema'] + '#/physiology/systems/finance',
        'related_system_ids': [france['schema'] + '#/physiology/systems/budget'],
        'organ_id': 'OJO_FRANCE_DEBT_RATE_LIVE_V1',
        'output_id': 'EXECUTIVE_OUTPUT',
        'label': 'France → Finances publiques → Dette / Taux / Refinancement',
        'country_ref': FRANCE.as_posix() + '#/identity',
        'system_ref': FRANCE.as_posix() + '#/physiology/systems/finance',
        'organ_ref': LIVE,
        'projection_ref': 'docs/france-debt-rate-risk-live-2026-10-02.html',
        'territorial_scope': 'NATIONAL_ONLY',
        'territorial_imputation': False,
        'territorial_evidence_required': True,
        'territorial_topology_ref': 'docs/data/france-topology.json',
        'body_schema': 'SUPRA_BODY_SCHEMA_V1',
        'nervous_system': 'SUPRA_NERVOUS_SYSTEM_V1',
        'event_bus': 'EXISTING_SUPRA_TERMINAL_MEGABUS_V1',
        'signal_semantics': 'OBSERVATION_DELTA_NOT_POLITICAL_CAUSALITY',
        'single_truth': LIVE,
        'new_runtime': False, 'new_country': False, 'new_beast': False,
        'identity_note': 'Existing schema + JSON pointer is the identity where no opaque ID existed. No second country object is allocated.'
    }

def enrich(live):
    b = binding()
    live['france_binding'] = b
    live.setdefault('policy', {})['national_signal_is_not_territorial_effect'] = True
    freshness = live.setdefault('freshness', {})
    freshness.update({
        'last_material_change_at': live['updated_at'],
        'last_market_observation_date': live['observed'].get('yield_curve_date'),
        'runner_truth': 'GitHub Actions workflow run status; independent from material state',
        'runner_api_unavailable': 'UNKNOWN_KEEP_LAST_MATERIAL_STATE',
    })
    sources = {s['id']: s for s in live.get('sources', [])}
    # Existing official publication already referenced by PAP_STRESS, now resolvable.
    publications = {'PAP2026': {
        'id': 'PAP2026', 'publisher': 'Assemblée nationale',
        'url': 'https://www.assemblee-nationale.fr/dyn/contenu/visualisation/1087975/file/PAP2026_BG_Engagements_financiers_Etat_EB.pdf',
        'health': 'OFFICIAL_VINTAGE', 'vintage': 'PLF 2026',
    }}
    live['evidence_graph']['publication_refs'] = publications
    identity = {k:b[k] for k in ('country_object_id','system_id','organ_id','output_id')}
    paths = {'TEC10':'observed/tec10_pct','TEC_CURVE':'observed/yield_curve',
             'CURVE_REGIME':'curve_regime_memory/regime','MATURITY_LADDER':'maturity_ladder/years',
             'PAP_STRESS':'sensitivity/pap2026/annual_extra_charge_bne'}
    for c in live.get('claims', []):
        cid = c['claim_id']
        digest = hashlib.sha256(json.dumps({'claim':cid,'value':c.get('value'),
            'date':c.get('date'),'sources':c.get('source_ids')},sort_keys=True).encode()).hexdigest()[:20]
        c.update(identity)
        c.update({'metric_id':cid, 'observation_id':f'{cid}:{digest}',
                  'transformation_id': 'curve_regime_memory' if c['type']=='DERIVED' else
                      'PAP2026_FIXED_VINTAGE_SENSITIVITY' if c['type']=='STRESS' else 'SOURCE_OBSERVATION_IDENTITY',
                  'scenario_id':'PAP_STRESS' if c['type']=='STRESS' else None,
                  'source_id':c.get('source_ids',[None])[0],
                  'metric_ref':LIVE + '#/' + paths.get(cid,'claims'),
                  'proof':[{**sources.get(sid, publications.get(sid, {'id':sid,'health':'UNKNOWN'})),
                            'observation_date':c.get('date')} for sid in c.get('source_ids',[])]})
    graph = live['evidence_graph']
    graph.update(identity)
    existing = {n['id'] for n in graph['nodes']}
    for node in [{'id':b['country_object_id'],'kind':'COUNTRY','label':'France'},
                 {'id':b['system_id'],'kind':'SYSTEM','label':'Finances publiques · finance / budget'},
                 {'id':b['organ_id'],'kind':'ORGAN','label':'Dette / Taux / Refinancement'}]:
        if node['id'] not in existing: graph['nodes'].append(node)
    edges=[{'from':b['country_object_id'],'to':b['system_id'],'relation':'CONTAINS'},
           {'from':b['system_id'],'to':b['organ_id'],'relation':'INSTRUMENTED_BY'},
           {'from':b['organ_id'],'to':'EXECUTIVE_OUTPUT','relation':'PROJECTS'}]
    for edge in edges:
        if edge not in graph['edges']: graph['edges'].append(edge)
    for s in live.get('sources',[]):
        if s.get('health')=='RETAINED_LAST_GOOD':
            s.setdefault('confidence','MEDIUM')
            s.setdefault('replacement_condition','A complete, verified same-scope official vintage becomes accessible.')
    return live

def write_binding():
    BINDING.write_text(json.dumps(binding(),ensure_ascii=False,indent=2)+'\n')

if __name__ == '__main__':
    write_binding()
