"""Bridge adaptation of La Bete health/care contracts, driven by existing observer.
Canonical memory is embedded in existing learning registry, never a second daemon.
"""
import fcntl
import hashlib
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from publish_france_beast_impulse import atomic_json, submit, routed
from la_bete_health_memory import RECOVERY_CYCLES

ENTRY = 'LEARN_LA_BETE_SUPRA_BRIDGE_HOMEOSTASIS'
SCHEMA = 'LA_BETE_SUPRA_BRIDGE_HEALTH_V1'
VERSION = '1.0.0'

def stamp():
    return datetime.now(timezone.utc).isoformat()

def seconds(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()

def load(path):
    if not path.exists():
        return None
    return json.loads(path.read_text())

def memory(registry):
    if registry.get('schema') != 'LEARNING_LOOP_REGISTRY_V1' or registry.get('authority') != 'NICOLAS':
        raise ValueError('EXISTING_LEARNING_REGISTRY_MISMATCH')
    entry = next((e for e in registry['entries'] if e.get('id') == ENTRY), None)
    if entry is None:
        entry = {'id': ENTRY, 'promotion_status': 'APPLIED_EFFECTIVENESS_PENDING',
                 'health_memory': {'schema': SCHEMA, 'origin': 'NEW_OBSERVATIONS_NO_BACKFILL',
                    'observations': [], 'seen': {}, 'issues': {}, 'trials': [], 'experiences': []}}
        registry['entries'].append(entry)
    m = entry['health_memory']
    if m.get('schema') != SCHEMA or not all(isinstance(m.get(k), t) for k,t in
            [('observations',list),('seen',dict),('issues',dict),('trials',list),('experiences',list)]):
        raise ValueError('INVALID_BRIDGE_MEMORY_REFUSE_ERASURE')
    if len(m['observations'])!=len(m['seen']) or any(o['id'] not in m['seen'] for o in m['observations']):
        raise ValueError('INVALID_OBSERVATION_LINEAGE')
    for t in m['trials']:
        if t.get('result') not in {'PENDING','GOAL_MET','NOT_MET'} or t.get('causal_effect_proven') is not False:
            raise ValueError('INVALID_CARE_RESULT')
        if t.get('executed_at') and seconds(t['executed_at'])<seconds(t['declared_at']):
            raise ValueError('RETROSPECTIVE_CARE_FORBIDDEN')
    return entry, m

def calibration(m, cadence=300):
    # Calibrate on own completed probes only; never pretend historic send times exist.
    values = [t['result_evidence']['forward_delay_s'] for t in m['trials']
              if isinstance(t.get('result_evidence',{}).get('forward_delay_s'), (int,float))]
    values = sorted(values[-30:])
    p95 = values[max(0, math.ceil(.95*len(values))-1)] if values else None
    delay = max(20, min(cadence, 3*p95)) if p95 is not None else 20
    return {'delay_s': delay, 'proof_freshness_s': cadence*2+delay,
            'window_s': cadence*3+delay, 'window_observations': 3,
            'recovery_observations': RECOVERY_CYCLES, 'failure_limit': 2,
            'sample_count': len(values), 'basis': 'MEASURED_P95' if len(values)>=5 else 'PROVISIONAL_2S_BUS_300S_OBSERVER_WITH_MEASURED_SAMPLES',
            'p95_s': p95, 'cadence_s': cadence}

def collect(bus, registry, transfer, projection, m, at=None):
    at = at or stamp(); now = seconds(at)
    receipt = load(transfer) or {}
    kid = receipt.get('knowledge_id')
    package = next((x for x in registry['entries'] if x.get('id')=='LEARN_LA_BETE_HOMEOSTASIS'), {})
    terminal_registry=load(bus/"TERMINALS"/"CURRENT.json") or {}
    heartbeat=max([r.get("seen_at","") for r in terminal_registry.get("terminals",[])],default=None)
    heartbeat_age=max(0,now-seconds(heartbeat)) if heartbeat else None
    alive = False
    pid_text = (bus/'megabus.pid').read_text().strip() if (bus/'megabus.pid').exists() else None
    if pid_text:
        try: os.kill(int(pid_text),0); alive=True
        except (OSError,ValueError): pass
    def own(j):
        return 'la-bete' in str(j.get('message_id','')) or 'france-debt-observation' in str(j.get('message_id',''))
    # A routed message has one canonical first receipt. Replaying its envelope
    # cannot refresh proof age or manufacture another message observation.
    first_routes={}
    for prior in m['observations']:
        for row in prior.get('evidence',{}).get('routes',[]):first_routes.setdefault(row['id'],row)
    pending=[]; errors=[]; routes=[]; malformed=[]
    for channel in ('INBOX','OUTBOX'):
        for p in (bus/channel).glob('*.json'):
            try: j=load(p)
            except (ValueError,OSError):
                if 'la-bete' in p.name or 'france-debt-observation' in p.name: malformed.append(str(p))
                continue
            if not isinstance(j,dict) or not own(j): continue
            row={'id':j.get('message_id'), 'path':str(p), 'sha256':digest(j)}
            if channel=='INBOX':
                row['age_s']=max(0,now-p.stat().st_mtime); pending.append(row)
            elif j.get('status')=='ROUTED': routes.append(first_routes.get(row['id'],dict(row,at=j.get('routed_at'))))
            elif j.get('routed_at') and now-seconds(j['routed_at'])<=600: errors.append(row)
    native=load(projection)
    visible=None
    if native and native.get('SCHEMA')=='SUPRA_NERVOUS_SYSTEM_V1':
        visible=any('la-bete' in json.dumps(x) or 'france-debt-observation' in json.dumps(x)
                    for x in native.get('IMPULSES',[]))
    proof_at=max([r['at'] for r in routes if r['at']],default=None)
    bounds=calibration(m)
    latest=m['trials'][-1] if m['trials'] else None
    forward=back=None
    if latest and latest.get('executed_at'):
        f=load(bus/'OUTBOX'/(latest['forward_id']+'.json'))
        b=load(bus/'OUTBOX'/(latest['return_id']+'.json'))
        if f and f.get('status')=='ROUTED': forward=max(0,seconds(f['routed_at'])-seconds(latest['executed_at']))
        if b and b.get('status')=='ROUTED' and latest.get('return_submitted_at'):
            back=max(0,seconds(b['routed_at'])-seconds(latest['return_submitted_at']))
    metrics={'bus_heartbeat_age_s':heartbeat_age,'forward_delay_s':forward, 'return_delay_s':back,
        'bridge_pending':len(pending), 'bus_pending':len(list((bus/'INBOX').glob('*.json'))),
        'transmission_errors':len(errors)+len(malformed),
        'proof_age_s':max(0,now-seconds(proof_at)) if proof_at else None,
        'oldest_pending_s':max([x['age_s'] for x in pending],default=0)}
    fingerprint={'pid':pid_text,'alive':alive,'heartbeat':heartbeat,'pending':pending,'errors':errors,'malformed':malformed,
                 'routes':routes,'projection':digest(native) if native else None,'registered':package.get('knowledge',{}).get('knowledge_id')==kid if kid else None}
    # Age bands are fresh elapsed-time measurements, not invented past cycles.
    fingerprint['proof_age_band']=int(metrics['proof_age_s']//bounds['proof_freshness_s']) if metrics['proof_age_s'] is not None else None
    states={'bus':'HEALTHY' if alive and heartbeat_age is not None and heartbeat_age<=bounds['delay_s'] else 'DEGRADED' if not alive or heartbeat_age is not None else 'UNKNOWN',
      'registration':'HEALTHY' if kid and package.get('knowledge',{}).get('knowledge_id')==kid else 'UNKNOWN',
      'native_visibility':'HEALTHY' if visible and native.get('GENERATED_AT') and 0<=now-seconds(native['GENERATED_AT'])<=bounds['proof_freshness_s'] else 'UNPROVEN',
      'delay':'DEGRADED' if metrics['oldest_pending_s']>bounds['delay_s'] or any(v is not None and v>bounds['delay_s'] for v in (forward,back)) else 'HEALTHY',
      'errors':'DEGRADED' if errors or malformed else 'HEALTHY',
      'proof':'UNKNOWN' if proof_at is None else 'DEGRADED' if metrics['proof_age_s']>bounds['proof_freshness_s'] else 'HEALTHY'}
    return {'id':'bridge-observation-'+digest(fingerprint)[:32], 'observed_at':at,
            'context':'REAL', 'metrics':metrics,'states':states,'thresholds':bounds,
            'evidence':{'transfer':str(transfer),'projection':str(projection),
                'native_generated_at':native.get('GENERATED_AT') if native else None,
                'bus_heartbeat_at':heartbeat,'bus_heartbeat_path':str(bus/'TERMINALS/CURRENT.json'),
                'routes':routes,'errors':errors,'pending':pending,'malformed':malformed}}

def observe(m, o):
    if o['id'] in m['seen']:
        if m['seen'][o['id']] != digest(o):
            # Live recollection of unchanged evidence may have a later sampling timestamp.
            return False
        return False
    if m['observations'] and seconds(o['observed_at'])<=seconds(m['observations'][-1]['observed_at']): return False
    m['seen'][o['id']]=digest(o); m['observations'].append(o)
    for key,state in o['states'].items():
        issue=m['issues'].setdefault(key,{'episodes':[],'good_streak':0,'affected':0})
        issue['state']=state
        if state=='HEALTHY':
            issue['good_streak']+=1
            if issue.get('active_episode') is not None and issue['good_streak']>=RECOVERY_CYCLES:
                issue['episodes'][issue['active_episode']]['recovered_at']=o['observed_at']; issue.pop('active_episode')
        else:
            issue['good_streak']=0;issue['affected']+=1
            if 'active_episode' not in issue:
                issue['active_episode']=len(issue['episodes'])
                issue['episodes'].append({'started_at':o['observed_at'],'first_observation':o['id'],'state':state})
    return True

def choose(m,o):
    plans=[]
    for key,state in o['states'].items():
        if state=='HEALTHY': continue
        issue=m['issues'][key]; ep=issue['episodes'][issue['active_episode']]
        duration=max(0,seconds(o['observed_at'])-seconds(ep['started_at']))
        failures=sum(t['result']=='NOT_MET' and t['problem']==key for t in m['trials'])
        severity={'bus':100,'errors':90,'delay':70,'registration':60,'proof':45,'native_visibility':30}[key]
        score=severity+min(50,duration/o['thresholds']['cadence_s'])+10*len(issue['episodes'])+20*failures
        action='CORRELATION_PROBE'
        if key in ('registration','native_visibility'): action='REVIEW_BINDING'
        if key=='bus':action='REVIEW_EXISTING_WATCHDOG'
        if failures>=o['thresholds']['failure_limit']:action='REVIEW_STRATEGY'
        if any(t['result']=='PENDING' for t in m['trials']):action='WAIT_FOR_EVIDENCE'
        elif failures<o['thresholds']['failure_limit'] and any(t['problem']==key and t['episode']==issue['active_episode'] for t in m['trials']):action='MAINTAIN_OBSERVATION'
        plans.append({'problem':key,'priority':score,'action':action,'severity':severity,'duration_s':duration,
                      'recurrences':len(issue['episodes'])-1,'previous_failures':failures,
                      'episode':issue['active_episode']})
    return sorted(plans,key=lambda p:(-p['priority'],p['problem']))

def declare(m,o,plan,method,context='REAL'):
    # Persist this intent BEFORE invoking action. Replays reuse the same trial identity.
    tid='la-bete-bridge-care-'+digest([o['id'],plan['problem'],plan['episode']])[:24]
    existing=next((t for t in m['trials'] if t['id']==tid),None)
    if existing:return existing
    t={'id':tid,'problem':plan['problem'],'episode':plan['episode'],'context':context,
       'action':'CORRELATION_PROBE','method_version':VERSION,'method':method,
       'declared_at':o['observed_at'],'expected':'Both correlated messages ROUTED within calibrated per-leg deadline; two fresh confirming observations.',
       'window_s':o['thresholds']['window_s'],'window_observations':3,
       'criteria':{'max_leg_delay_s':o['thresholds']['delay_s'],'healthy_observations':RECOVERY_CYCLES},
       'before':o,'forward_id':tid+'-forward','return_id':tid+'-return',
       'result':'PENDING','known_observations':0,'healthy_streak':0,'evaluated_ids':[],
       'causal_effect_proven':False,'rollback':'Only observation envelopes; no canonical numeric data, configuration or runtime altered.'}
    m['trials'].append(t);return t

def envelope(mid,source,target,kind,payload):
    return {'message_id':mid,'source':source,'target':target,'type':kind,
            'payload':{k: v if isinstance(v,str) else json.dumps(v,sort_keys=True) for k,v in payload.items()}}

def evaluate(t,o,evidence):
    if not t.get('executed_at') or o['id'] in t['evaluated_ids']: return
    t['evaluated_ids'].append(o['id'])
    # Missing proof postpones judgment, including beyond the nominal time window.
    if evidence.get('known') is not True:
        t['evaluation_status']='WAITING_FOR_EVIDENCE';return
    good=evidence.get('healthy') is True
    if t['result']!='PENDING':
        if t['result']=='NOT_MET' and good: t.setdefault('late_recovery',{'at':o['observed_at'],'evidence':evidence})
        return
    t['known_observations']+=1;t['healthy_streak']=t['healthy_streak']+1 if good else 0
    expired=seconds(o['observed_at'])>seconds(t['executed_at'])+t['window_s']
    if expired or t['known_observations']>=t['window_observations'] and t['healthy_streak']<t['criteria']['healthy_observations']:
        t['result']='NOT_MET'
    elif t['healthy_streak']>=t['criteria']['healthy_observations']: t['result']='GOAL_MET'
    t['evaluation_status']='EVALUATING' if t['result']=='PENDING' else 'CLOSED'
    if t['result']!='PENDING':t.update(result_at=o['observed_at'],after=o,result_evidence=evidence)

def route_evidence(bus,t):
    f=load(bus/'OUTBOX'/(t['forward_id']+'.json'));b=load(bus/'OUTBOX'/(t['return_id']+'.json'))
    if any(j and j.get('status')=='REJECTED' for j in (f,b)):return {'known':True,'healthy':False,'reason':'REJECTED'}
    if not (f and b and f.get('status')==b.get('status')=='ROUTED'):return {'known':False}
    if f.get('message_id')!=t['forward_id'] or b.get('message_id')!=t['return_id'] or b.get('payload',{}).get('received_message_id')!=t['forward_id']:
        return {'known':False,'reason':'CORRELATION_MISMATCH'}
    fd=seconds(f['routed_at'])-seconds(t['executed_at'])
    bd=seconds(b['routed_at'])-seconds(t['return_submitted_at'])
    return {'known':True,'healthy':0<=fd<=t['criteria']['max_leg_delay_s'] and 0<=bd<=t['criteria']['max_leg_delay_s'],
            'forward_delay_s':fd,'return_delay_s':bd,'forward_sha256':digest(f),'return_sha256':digest(b),
            'limits':'Routing demonstrates transport, not native rendering or causal recovery.'}

def advance(registry,bus,transfer,projection,at=None,allow_probe=True,context="REAL"):
    lockpath=registry.with_suffix('.lock');lockpath.parent.mkdir(parents=True,exist_ok=True)
    with lockpath.open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        raw=registry.read_text();data=json.loads(raw);entry,m=memory(data)
        o=collect(bus,data,transfer,projection,m,at)
        o["context"]=context
        fresh=observe(m,o)
        def save():
            if not registry.with_name(registry.name+'.before-bridge-homeostasis-v1').exists():
                registry.with_name(registry.name+'.before-bridge-homeostasis-v1').write_text(raw)
            if json.loads(registry.read_text()) != data: atomic_json(registry,data)
        for t in m['trials']:
            if not t.get('executed_at'):
                # Recovery of persisted prospective intent; identical envelope id on crash retry.
                t['executed_at']=stamp();save()
                submit(bus,envelope(t['forward_id'],'ojo.la_bete','supra.megabus','LA_BETE_BRIDGE_CARE_PROBE',{'trial_id':t['id'],'requested_action':'OBSERVE_ONLY'}))
                t['execution_confirmed']=True;save()
            elif not t.get('execution_confirmed'):
                submit(bus,envelope(t['forward_id'],'ojo.la_bete','supra.megabus','LA_BETE_BRIDGE_CARE_PROBE',{'trial_id':t['id'],'requested_action':'OBSERVE_ONLY'}))
                t['execution_confirmed']=True;save()
            if routed(bus,t['forward_id']) and not t.get('return_submitted_at'):
                t['return_submitted_at']=stamp();save()
            if t.get('return_submitted_at'):
                submit(bus,envelope(t['return_id'],'supra.learning_registry','ojo.la_bete','SUPRA_BRIDGE_CARE_PROBE_RETURN',{'trial_id':t['id'],'received_message_id':t['forward_id'],'requested_action':'OBSERVE_ONLY'}))
            if fresh:evaluate(t,o,route_evidence(bus,t))
            if t['result']!='PENDING':
                eid=t['id']+'-experience';ack=eid+'-received'
                exp=next((x for x in m['experiences'] if x['id']==eid),None)
                if exp is None:
                    exp={'id':eid,'trial_id':t['id'],'method':t['method'],'method_version':t['method_version'],
                         'context':t['context'],'action':t['action'],'before':t['before'],'after':t['after'],
                         'result':t['result'],'causal_effect_proven':False,
                         'limits':'Transport probe only; no general bridge recovery, native visibility or causality proven.',
                         'status':'SUBMITTED','forward_message_id':eid,'return_message_id':ack,
                         'method_received':True,'method_applied':True,'effectiveness_observed':t['result'],
                         'reuse_status':'CANDIDATE_REQUIRES_ORGAN_CALIBRATION' if t['result']=='GOAL_MET' else 'RETAIN_FAILED_EXPERIENCE'}
                    m['experiences'].append(exp);save()
                submit(bus,envelope(eid,'supra.bridge_health','supra.megabus','SUPRA_BRIDGE_CARE_EXPERIENCE',{'experience_json':exp,'requested_action':'OBSERVE_ONLY'}))
                if routed(bus,eid):
                    exp['registry_registered']=True
                    submit(bus,envelope(ack,'supra.learning_registry','ojo.la_bete','SUPRA_BRIDGE_CARE_EXPERIENCE_RECEIVED',{'experience_id':eid,'trial_id':t['id'],'result':t['result'],'method_version':VERSION,'context':exp['context'],'experience_json':exp,'requested_action':'OBSERVE_ONLY'}))
                    exp['status']='ROUND_TRIP_CONFIRMED' if routed(bus,ack) else 'REGISTERED_ACK_PENDING'
        if fresh:
            m['care_plan']=choose(m,o)
            candidate=next((p for p in m['care_plan'] if p['action']=='CORRELATION_PROBE'),None)
            if allow_probe and candidate:
                source=next((x for x in data['entries'] if x.get('id')=='LEARN_LA_BETE_HOMEOSTASIS'),{})
                method={'knowledge_id':source.get('knowledge',{}).get('knowledge_id'),'digest':source.get('method_digest'),
                        'source_commit':source.get('knowledge',{}).get('source_commit')}
                if not all(method.values()):raise ValueError('RECEIVED_METHOD_REQUIRED')
                declare(m,o,candidate,method,context=context);save()
                # Dispatch occurs on next advance after persisted intent, never retrospectively.
            entry['promotion_status']='APPLIED_TRANSPORT_GOAL_OBSERVED' if any(t['result']=='GOAL_MET' for t in m['trials']) else 'APPLIED_EFFECTIVENESS_PENDING'
        save()
        return {'fresh':fresh,'observations':len(m['observations']),'trials':[(t['id'],t['result']) for t in m['trials']],
                'experiences':[(x['id'],x['status']) for x in m['experiences']],'states':o['states'],'metrics':o['metrics']}
