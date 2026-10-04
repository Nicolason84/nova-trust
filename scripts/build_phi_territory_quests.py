#!/usr/bin/env python3
from __future__ import annotations
import json, math, os, re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CULTURE=json.loads((ROOT/'docs/data/la-bete-territory-culture-v1.json').read_text())
PHI=json.loads((ROOT/'docs/data/phi-coins-v1.json').read_text())
RECEIPTS_PATH=Path(os.environ.get('LA_BETE_TERRITORY_CONTRIBUTIONS_FILE',str(ROOT/'docs/data/la-bete-territory-contributions-v1.json')))
OUT=Path(os.environ.get('LA_BETE_TERRITORY_QUESTS_OUT',str(ROOT/'docs/data/phi-territory-quests-v1.json')))

QUESTS=[
 {'id':'language_context','label':'Documenter le parler local','target':1,'weight':10,'phi_per_item':4,'kind':'local_language'},
 {'id':'local_expressions','label':'Documenter 5 expressions locales','target':5,'weight':10,'phi_per_item':4,'kind':'local_language'},
 {'id':'heritage_memory','label':'Sourcer 3 éléments de patrimoine ou mémoire','target':3,'weight':12,'phi_per_item':4,'kind':'heritage_story'},
 {'id':'know_how','label':'Raconter 3 savoir-faire ou métiers','target':3,'weight':12,'phi_per_item':4,'kind':'heritage_story'},
 {'id':'people_stories','label':'Documenter 3 figures ou récits locaux','target':3,'weight':12,'phi_per_item':4,'kind':'heritage_story'},
 {'id':'events_traditions','label':'Sourcer 3 événements ou traditions','target':3,'weight':10,'phi_per_item':3,'kind':'local_place_event'},
 {'id':'nature_risks','label':'Documenter 3 paysages, milieux ou risques','target':3,'weight':10,'phi_per_item':3,'kind':'verified_official_source'},
 {'id':'local_initiatives','label':'Identifier 3 initiatives locales utiles','target':3,'weight':10,'phi_per_item':3,'kind':'local_place_event'},
 {'id':'translations','label':'Traduire et faire relire 2 langues','target':2,'weight':8,'phi_per_item':4,'kind':'verified_translation'},
 {'id':'accessibility','label':'Valider 2 améliorations de compréhension ou accessibilité','target':2,'weight':6,'phi_per_item':3,'kind':'accessibility'},
]
assert sum(q['weight'] for q in QUESTS)==100
PHI_BY_KIND={x['id']:x['phi'] for x in PHI['rewards']}
DEPARTMENTS=CULTURE['departments']

if RECEIPTS_PATH.exists():
    receipts_doc=json.loads(RECEIPTS_PATH.read_text())
else:
    receipts_doc={'schema':'LA_BETE_TERRITORY_CONTRIBUTIONS_V1','state':'EMPTY_VERIFIED_RECEIPT_REGISTRY','receipts':[]}

if receipts_doc.get('schema')!='LA_BETE_TERRITORY_CONTRIBUTIONS_V1':
    raise ValueError('CONTRIBUTION_SCHEMA')

receipts=[]
seen=set();seen_evidence=set()
quest_ids={q['id'] for q in QUESTS}
for r in receipts_doc.get('receipts',[]):
    rid=str(r.get('receipt_id') or '')
    dep=str(r.get('department_code') or '')
    qid=str(r.get('quest_id') or '')
    if not rid or rid in seen: raise ValueError('DUPLICATE_OR_EMPTY_RECEIPT')
    seen.add(rid)
    if dep not in DEPARTMENTS or qid not in quest_ids: raise ValueError('UNKNOWN_RECEIPT_SCOPE')
    if r.get('state')!='VERIFIED': raise ValueError('NON_VERIFIED_RECEIPT_IN_CANON')
    url=str(r.get('evidence_url') or '')
    if not re.match(r'^https://',url): raise ValueError('RECEIPT_EVIDENCE_REQUIRED')
    evidence_key=(dep,qid,url)
    if evidence_key in seen_evidence: raise ValueError('DUPLICATE_QUEST_EVIDENCE')
    seen_evidence.add(evidence_key)
    if r.get('community_contribution') is not True: raise ValueError('COMMUNITY_FLAG_REQUIRED')
    receipts.append(r)

by_dep={code:[] for code in DEPARTMENTS}
for r in receipts: by_dep[r['department_code']].append(r)

territories={}
for code,p in DEPARTMENTS.items():
    qrows=[]
    foundation=[]
    local=p.get('local_language') or {}
    # Official evidence can establish a quest baseline, but never mints community Φ.
    if local.get('state')=='DEPARTMENT_PICARD_CONTEXT_VERIFIED_LOCAL_VARIANTS_TO_DOCUMENT' and local.get('options'):
        foundation.append({
          'evidence_id':'OFFICIAL_LANGUAGE_CONTEXT_'+code,
          'quest_id':'language_context',
          'state':'VERIFIED_OFFICIAL_BASELINE',
          'items':1,
          'phi_awarded':0,
          'source':local['options'][0].get('source'),
          'note':'Socle officiel ; aucun Φ communautaire n’est attribué.'
        })
    score=0.0
    verified_total=0
    target_total=0
    community_phi=0
    community_items=0
    for q in QUESTS:
        official=sum(int(x['items']) for x in foundation if x['quest_id']==q['id'])
        matching=[r for r in by_dep[code] if r['quest_id']==q['id']]
        capacity=max(0,q['target']-official)
        if len(matching)>capacity: raise ValueError('QUEST_RECEIPT_OVERFLOW:'+code+':'+q['id'])
        community=len(matching)
        verified=official+community
        completion=verified/q['target']
        weighted=completion*q['weight']
        score+=weighted;verified_total+=verified;target_total+=q['target'];community_items+=community
        reward=PHI_BY_KIND.get(q['kind'],q['phi_per_item'])
        phi=sum(reward for _ in matching)
        community_phi+=phi
        qrows.append({
          **q,
          'verified_items':verified,
          'official_baseline_items':official,
          'community_verified_items':community,
          'completion_pct':round(completion*100),
          'weighted_points':round(weighted,2),
          'state':'COMPLETE' if verified>=q['target'] else 'OPEN',
          'remaining_items':max(0,q['target']-verified),
          'community_phi_awarded':phi,
        })
    territories[code]={
      'code':code,'name':p['name'],'region_name':p.get('region_name'),
      'documentation_score_pct':round(score),
      'score_basis':'VERIFIED_LOCAL_DOCUMENTATION_ONLY',
      'official_foundation_evidence':foundation,
      'verified_items':verified_total,'target_items':target_total,
      'community_verified_items':community_items,'community_phi_awarded':community_phi,
      'quests_complete':sum(x['state']=='COMPLETE' for x in qrows),
      'quests_total':len(qrows),'quests':qrows,
      'guard':'Ce score mesure la documentation vérifiée, jamais la valeur, la richesse ou le mérite du territoire.'
    }

ranking=sorted(
 ({'code':x['code'],'name':x['name'],'documentation_score_pct':x['documentation_score_pct'],
   'community_verified_items':x['community_verified_items'],'community_phi_awarded':x['community_phi_awarded']}
  for x in territories.values()),
 key=lambda x:(-x['documentation_score_pct'],-x['community_verified_items'],x['code'])
)

out={
 'schema':'LA_BETE_PHI_TERRITORY_QUESTS_V1',
 'state':'VERIFIED_DOCUMENTATION_PROGRESS',
 'score_contract':{
   'meaning':'Part pondérée des objectifs de connaissance locale couverts par des preuves acceptées.',
   'total_weight':100,
   'economic_inputs':False,'population_inputs':False,'wealth_inputs':False,'political_inputs':False,
   'competition_rule':'Comparer la progression documentaire, jamais les territoires eux-mêmes.',
   'official_baseline_may_progress_score':True,
   'official_baseline_mints_phi':False,
   'community_verified_receipt_mints_phi':True,
   'submission_without_verification_mints_phi':False,
 },
 'quest_catalog':QUESTS,
 'verified_receipts_count':len(receipts),
 'territories':territories,
 'progress_board':ranking,
}
OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('QUEST_TERRITORIES',len(territories))
print('VERIFIED_RECEIPTS',len(receipts))
print('OISE_SCORE',territories['60']['documentation_score_pct'])
print('SOMME_SCORE',territories['80']['documentation_score_pct'])
