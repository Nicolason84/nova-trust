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

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--bus',type=Path,required=True);parser.add_argument('--receipt',type=Path,required=True)
    args=parser.parse_args()
    result=subprocess.run(['/opt/homebrew/bin/gh','api','repos/Nicolason84/nova-trust/contents/docs/data/france-debt-rate-live.json?ref=main','--jq','.content'],capture_output=True,text=True,check=True)
    live=json.loads(base64.b64decode(result.stdout))
    print(publish(live,args.bus,args.receipt))
