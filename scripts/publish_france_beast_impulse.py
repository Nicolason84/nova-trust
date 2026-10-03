#!/usr/bin/env python3
"""One-shot observer called by the EXISTING watchdog, using the EXISTING bus.

Only observation references are routed. No capability execution request, mission
admission, canonical numerical write, new daemon, or political action is emitted.
"""
import base64, hashlib, json, os, subprocess
from datetime import datetime, timezone
from pathlib import Path

def publish(live, bus, receipt):
    b=live.get('france_binding',{})
    if live.get('schema')!='OJO_FRANCE_DEBT_RATE_LIVE_V1' or b.get('territorial_imputation') is not False:
        return 'SKIP_UNBOUND_CANON'
    if b.get('country_object_id')!='OJO_FRANCE_ORGANISM_V1#/identity' or b.get('organ_id')!=live['schema']:
        raise ValueError('CANONICAL_IDENTITY_MISMATCH')
    if live.get('policy',{}).get('political_recommendation')!='NONE':raise ValueError('POLICY_MISMATCH')
    # Dedup on material canonical revision, never heartbeat or source polling time.
    token=hashlib.sha256((live['snapshot_id']+'|'+str(live['sequence'])+'|'+live['updated_at']).encode()).hexdigest()[:24]
    message_id='france-debt-observation-'+token
    if receipt.exists() and json.loads(receipt.read_text()).get('message_id')==message_id:
        return 'NO_EVENT_NO_IMPULSE'
    required=[bus/'INBOX',bus/'OUTBOX',bus/'EVENTS',bus/'megabus.pid']
    if not all(p.exists() for p in required):raise ValueError('EXISTING_BUS_NOT_AVAILABLE')
    os.kill(int((bus/'megabus.pid').read_text().strip()),0)
    event={'message_id':message_id,'source':b['organ_id'],'target':'supra.megabus',
           'type':'FRANCE_DEBT_RATE_CANONICAL_OBSERVATION_DELTA',
           'payload':{'country_object_id':b['country_object_id'],'system_id':b['system_id'],
                      'organ_id':b['organ_id'],'snapshot_id':live['snapshot_id'],
                      'sequence':str(live['sequence']),'observed_at':live['updated_at'],
                      'territorial_scope':'NATIONAL_ONLY','territorial_imputation':'false',
                      'political_causality':'NONE','requested_action':'OBSERVE_ONLY',
                      'proof_url':'https://nicolason84.github.io/nova-trust/data/france-debt-rate-live.json',
                      'binding_url':'https://nicolason84.github.io/nova-trust/data/FRANCE_BEAST_BINDING.json'}}
    dest=bus/'INBOX'/f'{message_id}.json'
    if not (bus/'OUTBOX'/dest.name).exists() and not dest.exists():
        temp=dest.with_suffix('.tmp');temp.write_text(json.dumps(event,indent=2)+'\n');temp.replace(dest)
    receipt.parent.mkdir(parents=True,exist_ok=True)
    temp=receipt.with_suffix('.tmp');temp.write_text(json.dumps({'message_id':message_id,
        'snapshot_id':live['snapshot_id'],'sequence':live['sequence'],
        'status':'SUBMITTED_NOT_YET_ROUTING_PROOF','at':datetime.now(timezone.utc).isoformat()},indent=2)+'\n');temp.replace(receipt)
    return 'SUBMITTED_OBSERVATION_REFERENCE'


METHOD_FILES = (
    'scripts/la_bete_health_memory.py', 'scripts/test_la_bete_health_memory.py',
    'scripts/update_france_debt_rate_live.py', 'scripts/test_france_beast_convergence.py',
    'docs/france-debt-rate-risk-live-2026-10-02.html', 'scripts/test_france_beast_hydration.cjs',
)
# HTML embeds changing observations: hash transferable functions, not the whole page.
def build_knowhow(commit, live, evolution, contents):
    if evolution.get('source_snapshot_id') != live.get('snapshot_id'):
        raise ValueError('KNOWHOW_SNAPSHOT_MISMATCH')
    if evolution.get('self_model',{}).get('health_memory',{}).get('schema') != 'OJO_LA_BETE_HEALTH_MEMORY_V1':
        raise ValueError('HEALTH_MEMORY_NOT_PROVEN')
    evidence={}
    for name in METHOD_FILES:
        value=contents[name]
        if name.endswith('.html'):
            import re
            blocks=[]
            for fn in ('pulseFetch','refreshPulse','renderHealthMemory','renderProgression'):
                match=re.search(r'(?:async )?function '+fn+r'\b',value)
                if not match: raise ValueError('MISSING_TRANSFERABLE_FUNCTION:'+fn)
                start=value.index('{',match.end()); depth=1; pos=start+1
                # The named JS functions have balanced braces, including their strings.
                while depth and pos<len(value):
                    depth += (value[pos]=='{')-(value[pos]=='}'); pos+=1
                if depth: raise ValueError('UNBALANCED_FUNCTION:'+fn)
                blocks.append(value[match.start():pos])
            value='\n'.join(blocks)
        evidence[name]={'sha256':hashlib.sha256(value.encode()).hexdigest(),
                        'url':f'https://github.com/Nicolason84/nova-trust/blob/{commit}/{name}'}
    # Proof URLs change with a pulse commit; method identity does not.
    hashes={k:v['sha256'] for k,v in evidence.items()}
    digest=hashlib.sha256(json.dumps(hashes,sort_keys=True).encode()).hexdigest()
    patterns=[
      {'id':'HEALTH_HISTORY','contract':'Count only fresh observed cycles; deduplicate; preserve history; distinguish consecutive deterioration and recurring episodes.'},
      {'id':'PROSPECTIVE_CARE','contract':'Declare recovery goal and observation window before evaluating care; use PENDING, GOAL_MET, NOT_MET; defer when evidence is missing.'},
      {'id':'STRATEGY_REVISION','contract':'Increase care priority after repeated failed attempts; do not relabel a failed prediction after late recovery; improvement alone is not causal proof.'},
      {'id':'BOUNDED_PARALLELISM','contract':'Collect independent sources concurrently with bounded workers; reconcile and commit sequentially; retain last good evidence.'},
      {'id':'ADAPTIVE_PROPAGATION','contract':'Poll faster while visible; slow while hidden or failing; bound network deadlines; prevent overlapping refreshes; require matching canonical snapshots.'},
    ]
    return {'schema':'LA_BETE_SUPRA_KNOWHOW_V1','knowledge_id':'LA_BETE_METHODS_'+digest[:24],
      'method_digest':digest,'source_commit':commit,'evidence':evidence,'patterns':patterns,
      'source_status':'IMPLEMENTED_AND_TESTED_ON_LA_BETE','target_status':'RECEIVED_NOT_APPLIED',
      'applicability':'Calibrate thresholds, cadence and resource limits separately for each SUPRA organ.',
      'policy':{'requested_action':'OBSERVE_ONLY','capability_execution':False,'automatic_promotion':False}}

def atomic_json(path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
    tmp.replace(path)

def submit(bus, event):
    os.kill(int((bus/'megabus.pid').read_text().strip()),0)
    for channel in ('INBOX','OUTBOX','EVENTS'):
        if not (bus/channel).is_dir(): raise ValueError('EXISTING_BUS_NOT_AVAILABLE')
    name=event['message_id']+'.json'
    if not (bus/'OUTBOX'/name).exists() and not (bus/'INBOX'/name).exists():
        atomic_json(bus/'INBOX'/name,event)

def routed(bus, message_id):
    p=bus/'OUTBOX'/(message_id+'.json')
    if not p.exists(): return False
    j=json.loads(p.read_text())
    return j.get('message_id')==message_id and j.get('status')=='ROUTED'

def publish_knowhow(package,bus,registry,receipt):
    import fcntl
    if package['policy']['requested_action']!='OBSERVE_ONLY' or package['policy']['capability_execution']:
        raise ValueError('KNOWHOW_POLICY_MISMATCH')
    kid=package['knowledge_id']; mid='la-bete-knowhow-'+package['method_digest'][:24]
    event={'message_id':mid,'source':'ojo.la_bete','target':'supra.megabus',
      'type':'LA_BETE_PROVEN_KNOW_HOW_AVAILABLE','payload':{
        'knowledge_id':kid,'method_digest':package['method_digest'],'source_commit':package['source_commit'],
        'requested_action':'OBSERVE_ONLY','adoption_status':'RECEIVED_NOT_APPLIED',
        'knowledge_json':json.dumps(package,ensure_ascii=False,sort_keys=True)}}
    submit(bus,event)
    state={'schema':'LA_BETE_SUPRA_TRANSFER_RECEIPT_V1','knowledge_id':kid,
           'message_id':mid,'source_commit':package['source_commit'],'status':'SUBMITTED',
           'applied':False}
    if receipt.exists():
        previous=json.loads(receipt.read_text())
        if previous.get('message_id')==mid:
            state['source_commit']=previous['source_commit']
    if routed(bus,mid):
        # Register only a transfer actually routed by the existing daemon.
        # Preserve the registry identity and every unrelated learning entry.
        with registry.with_suffix('.lock').open('a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX)
            raw=registry.read_text(); data=json.loads(raw)
            if data.get('schema')!='LEARNING_LOOP_REGISTRY_V1' or data.get('authority')!='NICOLAS':
                raise ValueError('EXISTING_LEARNING_REGISTRY_MISMATCH')
            entries=data['entries']; entry_id='LEARN_LA_BETE_HOMEOSTASIS'
            old=next((x for x in entries if x.get('id')==entry_id),None)
            if old is None or old.get('method_digest')!=package['method_digest']:
                backup=registry.with_name(registry.name+'.before-'+package['method_digest'][:24])
                if not backup.exists(): backup.write_text(raw)
                entry={'id':entry_id,'method_digest':package['method_digest'],'knowledge':package,
                  'observed_limit':'SUPRA needs reusable, evidenced care and propagation methods.',
                  'recovered_existing_solution':['La Bête health memory','existing Megabus','existing learning registry'],
                  'promotion_status':'RECEIVED_NOT_APPLIED','rollback_required':True,
                  'memory_return':'Reuse after organ-specific calibration and measured validation.',
                  'received_message_id':mid}
                if old is None: entries.append(entry)
                else: entries[entries.index(old)]=entry
                atomic_json(registry,data)
        ack=mid+'-received'
        submit(bus,{'message_id':ack,'source':'supra.learning_registry','target':'ojo.la_bete',
          'type':'SUPRA_KNOW_HOW_RECEIVED','payload':{'knowledge_id':kid,
            'method_digest':package['method_digest'],'requested_action':'OBSERVE_ONLY',
            'received_message_id':mid,'adoption_status':'RECEIVED_NOT_APPLIED'}})
        state.update(status='REGISTERED_ACK_PENDING',return_message_id=ack,registry_registered=True)
        if routed(bus,ack): state['status']='ROUND_TRIP_CONFIRMED'
    # Do not rewrite a stable receipt on each heartbeat.
    if not receipt.exists() or json.loads(receipt.read_text())!=state: atomic_json(receipt,state)
    return state['status']

def github_json(endpoint):
    result=subprocess.run(['/opt/homebrew/bin/gh','api',endpoint],capture_output=True,text=True,check=True,timeout=30)
    return json.loads(result.stdout)

def github_text(commit,path):
    j=github_json('repos/Nicolason84/nova-trust/contents/'+path+'?ref='+commit)
    return base64.b64decode(j['content']).decode()

def main():
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--bus',type=Path,required=True)
    parser.add_argument('--receipt',type=Path,required=True)
    parser.add_argument('--learning-registry',type=Path)
    parser.add_argument('--knowhow-receipt',type=Path)
    args=parser.parse_args()
    import fcntl
    args.receipt.parent.mkdir(parents=True,exist_ok=True)
    observer_lock=args.receipt.with_suffix('.observer.lock').open('a')
    try:
        fcntl.flock(observer_lock,fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print('SKIP_EXISTING_OBSERVER_ACTIVE')
        return
    if args.learning_registry:
        from la_bete_bridge_health import advance
        projection=args.bus.parent/'SUPRA_GRANDE_MISSION_V1'/'NERVOUS_SYSTEM.json'
        transfer=args.knowhow_receipt or args.receipt.with_name('la-bete-supra-knowhow-receipt.json')
        try:
            print('BRIDGE_HEALTH', json.dumps(advance(args.learning_registry,args.bus,transfer,projection),sort_keys=True))
        except Exception as exc:
            # A failed health adapter cannot suppress canonical observation/transfer.
            print('BRIDGE_HEALTH_BLOCKED', type(exc).__name__, str(exc))
    if args.learning_registry:
        try:
            print('ART_KNOWHOW_CONTINUITY',json.dumps(reconcile_art_exchange(args.bus,args.learning_registry,projection),sort_keys=True),flush=True)
        except Exception as exc:
            print('ART_KNOWHOW_BLOCKED',type(exc).__name__,str(exc),flush=True)
    commit=github_json('repos/Nicolason84/nova-trust/commits/main')['sha']
    live=json.loads(github_text(commit,'docs/data/france-debt-rate-live.json'))
    print(publish(live,args.bus,args.receipt))
    if args.learning_registry:
        evo=json.loads(github_text(commit,'docs/data/france-debt-rate-evolution.json'))
        contents={p:github_text(commit,p) for p in METHOD_FILES}
        package=build_knowhow(commit,live,evo,contents)
        receipt=args.knowhow_receipt or args.receipt.with_name('la-bete-supra-knowhow-receipt.json')
        print(publish_knowhow(package,args.bus,args.learning_registry,receipt))



# Narrow adoption of already registered methods: data and read-only observations.
# No process lifecycle control, executable payload, new scheduler, native mutation,
# endpoint discovery, permission changes, or external publication occurs here.
ART_ENTRY = 'LEARN_LA_BETE_ART_DNA_AND_PRISM_ASSIMILATION_V1'
ART_RECIPIENTS = frozenset(('ojo.human_graph','ojo.la_bete','supra.action_center',
    'supra.bridge_health','supra.homeostasis','supra.learning_registry',
    'supra.living_beast','supra.local_execution_agent','supra.megabus',
    'supra.runtime.observatory','supra.sovereign_boot_health'))


def classify_observation_time(value, now_s, max_age_s):
    """Pure, non-executable method: UNKNOWN is never silently healthy."""
    import math
    if not isinstance(value,str) or not math.isfinite(now_s) or max_age_s<=0:
        return {'state':'UNKNOWN','age_s':None,'reason':'MISSING_OR_INVALID_TIME'}
    try:
        instant=datetime.fromisoformat(value.replace('Z','+00:00'))
        if instant.tzinfo is None:raise ValueError('timezone required')
        age=now_s-instant.timestamp()
        if not math.isfinite(age) or age < -1:raise ValueError('clock anomaly')
    except (ValueError,TypeError,OverflowError):
        return {'state':'UNKNOWN','age_s':None,'reason':'INVALID_TIME_OR_CLOCK'}
    return {'state':'FRESH' if age<=max_age_s else 'STALE','age_s':max(0,age),
            'reason':'OBSERVATION_AGE_ONLY_NOT_GENERAL_HEALTH'}


def read_art_clock(path,schema,key,now_s,bound):
    """Consume only a fixed existing producer file; no embedded action is used."""
    result={'source':str(path),'max_age_s':bound,'source_sha256':None,'observed_at':None}
    try:
        with path.open('rb') as handle:raw=handle.read(1048577)
        if len(raw)>1048576:raise ValueError('source bound')
        doc=json.loads(raw)
        if not isinstance(doc,dict) or doc.get('schema',doc.get('SCHEMA'))!=schema:
            raise ValueError('source schema')
        if key=='terminals':
            value=max([r.get('seen_at','') for r in doc.get('terminals',[])
                       if isinstance(r,dict) and str(r.get('pid','')).isdigit()],default=None)
        else:value=doc.get(key)
        result.update(source_sha256=hashlib.sha256(raw).hexdigest(),observed_at=value)
        result.update(classify_observation_time(value,now_s,bound))
    except (OSError,ValueError,TypeError):
        result.update(state='UNKNOWN',age_s=None,reason='SOURCE_MISSING_OR_INVALID')
    return result


def reconcile_art_exchange(bus,registry,projection,at=None):
    """Called by the pre-existing observer; local references only, never eval."""
    import fcntl,re
    now=datetime.fromisoformat(at.replace('Z','+00:00')) if at else datetime.now(timezone.utc)
    if now.tzinfo is None:raise ValueError('OBSERVATION_TIMEZONE_REQUIRED')
    now_s=now.timestamp();stamp=now.isoformat()
    with registry.with_suffix('.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        original=registry.read_text();data=json.loads(original)
        if data.get('schema')!='LEARNING_LOOP_REGISTRY_V1' or data.get('authority')!='NICOLAS':
            raise ValueError('EXISTING_LEARNING_REGISTRY_MISMATCH')
        entry=next((e for e in data['entries'] if e.get('id')==ART_ENTRY),None)
        if entry is None:return {'status':'NO_REGISTERED_ART_PACKET','native_adoption':'UNPROVEN'}
        packet=entry.get('knowledge',{})
        if packet.get('policy')!={'requested_action':'OBSERVE_ONLY','capability_execution':False,'automatic_promotion':False}:
            raise ValueError('ART_METHOD_POLICY_REJECTED')
        expected=hashlib.sha256(json.dumps({'patterns':packet.get('patterns'),
            'evidence':packet.get('evidence')},sort_keys=True).encode()).hexdigest()
        if packet.get('method_digest')!=expected:raise ValueError('ART_METHOD_DIGEST_MISMATCH')
        methods={p.get('id') for p in packet.get('patterns',[]) if isinstance(p,dict)}
        if not {'TRUTHFUL_FRESHNESS','RECEIPT_NOT_ASSIMILATION'}.issubset(methods):
            raise ValueError('REQUIRED_APPROVED_CONTRACT_MISSING')
        recipients=entry.get('receivers',{})
        if not isinstance(recipients,dict) or not set(recipients).issubset(ART_RECIPIENTS):
            raise ValueError('UNREGISTERED_RECIPIENT_REJECTED')
        bus_clock=read_art_clock(bus/'TERMINALS/CURRENT.json','SUPRA_TERMINAL_REGISTRY_V1','terminals',now_s,15)
        bus_available=bus_clock['state']=='FRESH'
        # Validate references before doing any write. The original routing IDs
        # and registry entry remain authoritative; no second method store.
        for target,row in recipients.items():
            mid=row.get('message_id','')
            token=hashlib.sha256((expected+'|'+target).encode()).hexdigest()[:24]
            if mid!='la-bete-art-dna-organ-'+token:raise ValueError('RECIPIENT_REFERENCE_MISMATCH')
            p=bus/'OUTBOX'/(mid+'.json')
            if p.exists():
                routed_doc=json.loads(p.read_text())
                if routed_doc.get('target')!=target or routed_doc.get('payload',{}).get('method_digest')!=expected:
                    raise ValueError('ROUTED_REFERENCE_MISMATCH')
        continuity=entry.setdefault('readonly_continuity',{
            'schema':'LA_BETE_READONLY_KNOWHOW_CONTINUITY_V1','installed_at':stamp,
            'method_digest':expected,'scope':'EXISTING_OBSERVER_ONLY','native_adoption':'UNPROVEN',
            'pilots':{},'pending_results':{},'returned_results':[]})
        if continuity.get('method_digest')!=expected:raise ValueError('METHOD_REVISION_REQUIRES_REVALIDATION')
        for target,row in recipients.items():
            if bus_available:
                submit(bus,{'message_id':row['message_id'],'source':'supra.learning_registry',
                    'target':target,'type':'LA_BETE_KNOW_HOW_REFERENCE','payload':{
                        'knowledge_id':packet['knowledge_id'],'method_digest':expected,
                        'registry_entry':ART_ENTRY,'requested_action':'OBSERVE_ONLY',
                        'adoption_status':'AVAILABLE_NOT_APPLIED'}})
            row['transport']='ROUTED' if routed(bus,row['message_id']) else 'PENDING'
            # Routing is not execution; keep receiver-side state separate.
            row.setdefault('adoption','UNPROVEN');row.setdefault('effectiveness','UNPROVEN')
        roots=projection.parent
        clocks={
            'supra.megabus':bus_clock,
            'supra.action_center':read_art_clock(roots/'AUTONOMY_HEARTBEAT.json',
                'SUPRA_CONTINUOUS_AUTONOMY_HEARTBEAT_V1','timestamp',now_s,180),
            'supra.homeostasis':read_art_clock(roots/'HOMEOSTASIS.json',
                'SUPRA_HOMEOSTASIS_V1','observed_at',now_s,180)}
        for target,observation in clocks.items():
            if target not in recipients:continue
            pilot=continuity['pilots'].get(target)
            if pilot is None:
                continuity['pilots'][target]={'method':'TRUTHFUL_FRESHNESS','context':'REAL',
                    'declared_at':stamp,'window_s':900,'required_distinct_observations':2,
                    'goal':'Classify two distinct post-declaration producer timestamps, preserving unknown/stale semantics.',
                    'implementation_scope':'EXISTING_BRIDGE_OBSERVER_READ_ONLY',
                    'status':'DECLARED','observations':[],'causal_effect_proven':False}
                continue  # A goal is persisted before execution, never backfilled.
            declared=datetime.fromisoformat(pilot['declared_at']).timestamp()
            if pilot['status']=='DECLARED':pilot['status']='RUNNING'
            if observation['source_sha256'] and observation['observed_at']:
                try:producer_at=datetime.fromisoformat(observation['observed_at'].replace('Z','+00:00')).timestamp()
                except (ValueError,TypeError):producer_at=None
                seen={x['producer_at'] for x in pilot['observations']}
                if producer_at is not None and declared<producer_at<=now_s+1 and observation['observed_at'] not in seen:
                    pilot['observations'].append({'producer_at':observation['observed_at'],
                        'checked_at':stamp,'source_sha256':observation['source_sha256'],
                        'state':observation['state'],'source':observation['source']})
                    pilot['observations']=pilot['observations'][-12:]
            pilot['latest_observation']=observation
            if pilot['status'] in ('DECLARED','RUNNING'):
                eligible=[x for x in pilot['observations'] if x['state']!='UNKNOWN']
                within=[x for x in eligible if datetime.fromisoformat(x['checked_at']).timestamp()<=declared+pilot['window_s']]
                if len(within)>=pilot['required_distinct_observations']:pilot.update(status='APPLIED_OBSERVATION_VERIFIED',result_at=stamp,result_evidence=within[:pilot['required_distinct_observations']])
                elif now_s>declared+pilot['window_s']:pilot.update(status='NOT_MET',result_at=stamp)
            # A completed trial is immutable. Later observations do not relabel a failure.
            if pilot['status'] in ('APPLIED_OBSERVATION_VERIFIED','NOT_MET'):
                result={'target':target,'method':'TRUTHFUL_FRESHNESS','status':pilot['status'],
                    'declared_at':pilot['declared_at'],'result_at':pilot['result_at'],
                    'scope':'BRIDGE_OBSERVER_NOT_NATIVE_CODE','native_adoption':'UNPROVEN',
                    'causal_effect_proven':False,'method_digest':expected,
                    'result_evidence':pilot.get('result_evidence',[])}
                digest=hashlib.sha256(json.dumps(result,sort_keys=True).encode()).hexdigest()
                mid='la-bete-art-readonly-result-'+digest[:24]
                continuity['pending_results'].setdefault(mid,{'result':result,'digest':digest,'state':'PENDING'})
        for mid,row in continuity['pending_results'].items():
            if bus_available:
                submit(bus,{'message_id':mid,'source':'supra.bridge_health','target':'ojo.la_bete',
                    'type':'SUPRA_READ_ONLY_METHOD_RESULT','payload':{'requested_action':'OBSERVE_ONLY',
                        'result_digest':row['digest'],'result_json':json.dumps(row['result'],sort_keys=True)}})
            if routed(bus,mid):
                p=bus/'OUTBOX'/(mid+'.json');raw=p.read_bytes();doc=json.loads(raw)
                result=json.loads(doc.get('payload',{}).get('result_json','{}'))
                if hashlib.sha256(json.dumps(result,sort_keys=True).encode()).hexdigest()!=row['digest']:
                    raise ValueError('RETURNED_RESULT_CONTENT_MISMATCH')
                row['state']='RETURNED_AND_CONSUMED_BY_EXISTING_OBSERVER'
                if mid not in continuity['returned_results']:continuity['returned_results'].append(mid)
        continuity['status']='RUNNING_IN_EXISTING_OBSERVER'
        continuity['last_observed_at']=stamp
        continuity['bus_observation']=bus_clock
        continuity['receiver_delivery_count']=sum(x['transport']=='ROUTED' for x in recipients.values())
        continuity['applied_observer_pilot_count']=sum(x['status']=='APPLIED_OBSERVATION_VERIFIED' for x in continuity['pilots'].values())
        continuity['returned_result_count']=len(continuity['returned_results'])
        # Persist only the existing entry; unrelated knowledge and protected state are untouched.
        if json.loads(original)!=data:atomic_json(registry,data)
        return {'status':continuity['status'],'observed_at':stamp,'receiver_count':len(recipients),
            'delivery_count':continuity['receiver_delivery_count'],
            'pilots':{k:v['status'] for k,v in continuity['pilots'].items()},
            'returned_result_count':continuity['returned_result_count'],
            'bus':bus_clock['state'],'native_adoption':'UNPROVEN'}

if __name__=='__main__':main()
