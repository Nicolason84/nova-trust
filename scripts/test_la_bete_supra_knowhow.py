
import json, os, tempfile, unittest, hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path
from publish_france_beast_impulse import build_knowhow, publish_knowhow, METHOD_FILES, ART_ENTRY, reconcile_art_exchange, classify_observation_time
ROOT=Path(__file__).resolve().parents[1]

class KnowHowTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)
        self.bus=self.root/'bus';self.bus.mkdir()
        for name in ('INBOX','OUTBOX','EVENTS'): (self.bus/name).mkdir()
        (self.bus/'megabus.pid').write_text(str(os.getpid()))
        self.registry=self.root/'LEARNING_LOOP_REGISTRY_V1.json'
        self.registry.write_text(json.dumps({'schema':'LEARNING_LOOP_REGISTRY_V1','authority':'NICOLAS','entries':[{'id':'existing','value':42}]}))
        self.receipt=self.root/'receipt.json'
        live=json.loads((ROOT/'docs/data/france-debt-rate-live.json').read_text())
        evo=json.loads((ROOT/'docs/data/france-debt-rate-evolution.json').read_text())
        self.contents={p:(ROOT/p).read_text() for p in METHOD_FILES}
        self.live=live; self.evo=evo
        self.package=build_knowhow('a'*40,live,evo,self.contents)
    def tearDown(self):self.tmp.cleanup()
    def route(self,mid,status='ROUTED'):
        p=self.bus/'INBOX'/(mid+'.json');j=json.loads(p.read_text());j['status']=status
        (self.bus/'OUTBOX'/p.name).write_text(json.dumps(j));p.unlink()
    def publish(self):return publish_knowhow(self.package,self.bus,self.registry,self.receipt)
    def test_real_route_required_before_registration(self):
        self.assertEqual(self.publish(),'SUBMITTED')
        self.assertEqual(len(json.loads(self.registry.read_text())['entries']),1)
        r=json.loads(self.receipt.read_text());self.route(r['message_id'],'REJECTED')
        self.assertEqual(self.publish(),'SUBMITTED')
    def test_round_trip_no_execution_and_no_duplicate(self):
        self.publish(); r=json.loads(self.receipt.read_text());self.route(r['message_id'])
        self.assertEqual(self.publish(),'REGISTERED_ACK_PENDING')
        data=json.loads(self.registry.read_text());self.assertEqual(data['entries'][0],{'id':'existing','value':42})
        self.assertEqual(data['entries'][1]['promotion_status'],'RECEIVED_NOT_APPLIED')
        ack=json.loads(self.receipt.read_text())['return_message_id']
        event=json.loads((self.bus/'INBOX'/(ack+'.json')).read_text())
        self.assertEqual(event['target'],'ojo.la_bete')
        self.assertTrue(all(isinstance(v,str) for v in event['payload'].values()))
        self.route(ack);self.assertEqual(self.publish(),'ROUND_TRIP_CONFIRMED')
        mtime=self.registry.stat().st_mtime_ns
        for _ in range(3):self.assertEqual(self.publish(),'ROUND_TRIP_CONFIRMED')
        self.assertEqual(self.registry.stat().st_mtime_ns,mtime)
        self.assertEqual(len(list((self.bus/'OUTBOX').glob('*.json'))),2)
        self.assertFalse(json.loads(self.receipt.read_text())['applied'])
    def test_snapshot_mismatch_blocks(self):
        self.evo['source_snapshot_id']='other'
        with self.assertRaisesRegex(ValueError,'SNAPSHOT_MISMATCH'):
            build_knowhow('a'*40,self.live,self.evo,self.contents)
    def test_pulse_commit_does_not_resend_same_methods(self):
        p=build_knowhow('b'*40,self.live,self.evo,self.contents)
        self.assertEqual(p['method_digest'],self.package['method_digest'])
    def test_embedded_snapshot_does_not_change_method_identity(self):
        name='docs/france-debt-rate-risk-live-2026-10-02.html'
        self.contents[name]+='\n<!-- fresh heartbeat -->'
        p=build_knowhow('b'*40,self.live,self.evo,self.contents)
        self.assertEqual(p['method_digest'],self.package['method_digest'])
    def test_method_change_has_new_identity(self):
        self.contents['scripts/la_bete_health_memory.py']+='\n# revised method\n'
        p=build_knowhow('b'*40,self.live,self.evo,self.contents)
        self.assertNotEqual(p['method_digest'],self.package['method_digest'])
    def test_registry_identity_preserved(self):
        self.publish();self.route(json.loads(self.receipt.read_text())['message_id'])
        self.registry.write_text('{"schema":"WRONG","authority":"NICOLAS","entries":[]}')
        with self.assertRaisesRegex(ValueError,'REGISTRY_MISMATCH'):self.publish()
        self.assertEqual(json.loads(self.registry.read_text())['schema'],'WRONG')
    def test_execution_policy_rejected(self):
        self.package['policy']['capability_execution']=True
        with self.assertRaisesRegex(ValueError,'POLICY_MISMATCH'):self.publish()
        self.assertEqual(list((self.bus/'INBOX').iterdir()),[])


class ReadOnlyContinuityTests(unittest.TestCase):
    """Synthetic fixtures in a temporary directory, never production evidence."""
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        self.bus=self.root/'bus';self.bus.mkdir()
        for name in ('INBOX','OUTBOX','EVENTS','TERMINALS'):(self.bus/name).mkdir()
        (self.bus/'megabus.pid').write_text(str(os.getpid()))
        self.registry=self.root/'LEARNING_LOOP_REGISTRY_V1.json';self.projection=self.root/'NERVOUS_SYSTEM.json'
        self.start=datetime(2026,10,3,12,tzinfo=timezone.utc)
        self.packet={'knowledge_id':'TEST_ONLY_ART_METHODS','patterns':[{'id':'TRUTHFUL_FRESHNESS'},{'id':'RECEIPT_NOT_ASSIMILATION'}],
          'evidence':{'fixture':{'sha256':'TEST_ONLY'}},'policy':{'requested_action':'OBSERVE_ONLY','capability_execution':False,'automatic_promotion':False}}
        self.packet['method_digest']=hashlib.sha256(json.dumps({'patterns':self.packet['patterns'],'evidence':self.packet['evidence']},sort_keys=True).encode()).hexdigest()
        self.receivers={}
        for name in ('supra.megabus','supra.action_center','supra.homeostasis'):
            token=hashlib.sha256((self.packet['method_digest']+'|'+name).encode()).hexdigest()[:24]
            self.receivers[name]={'message_id':'la-bete-art-dna-organ-'+token,'adoption':'UNPROVEN','effectiveness':'UNPROVEN'}
        self.original={'id':'existing','do_not_modify':[1,2,3]}
        self.registry.write_text(json.dumps({'schema':'LEARNING_LOOP_REGISTRY_V1','authority':'NICOLAS','entries':[self.original,
          {'id':ART_ENTRY,'knowledge':self.packet,'receivers':self.receivers}]}))
        self.sources(0)
    def tearDown(self):self.tmp.cleanup()
    def stamp(self,n):return(self.start+timedelta(seconds=n)).isoformat()
    def sources(self,n):
        (self.bus/'TERMINALS/CURRENT.json').write_text(json.dumps({'schema':'SUPRA_TERMINAL_REGISTRY_V1','terminals':[{'pid':'123','seen_at':self.stamp(n)}]}))
        (self.root/'AUTONOMY_HEARTBEAT.json').write_text(json.dumps({'schema':'SUPRA_CONTINUOUS_AUTONOMY_HEARTBEAT_V1','timestamp':self.stamp(n),'runner_health':'ALIVE'}))
        (self.root/'HOMEOSTASIS.json').write_text(json.dumps({'schema':'SUPRA_HOMEOSTASIS_V1','observed_at':self.stamp(n),'state':'BALANCED'}))
    def run_cycle(self,n):return reconcile_art_exchange(self.bus,self.registry,self.projection,at=self.stamp(n))
    def state(self):return next(e for e in json.loads(self.registry.read_text())['entries'] if e['id']==ART_ENTRY)['readonly_continuity']
    def route(self):
        for p in list((self.bus/'INBOX').glob('*.json')):
            doc=json.loads(p.read_text());doc['status']='ROUTED';(self.bus/'OUTBOX'/p.name).write_text(json.dumps(doc));p.unlink()
    def complete(self):
        self.run_cycle(0);self.route();self.sources(1);self.run_cycle(2);self.sources(3);self.run_cycle(4);self.route();return self.run_cycle(5)
    def test_three_actual_observer_applications_then_consumed_returns(self):
        first=self.run_cycle(0);self.assertEqual(set(first['pilots'].values()),{'DECLARED'});self.assertEqual(first['returned_result_count'],0)
        self.sources(1);self.run_cycle(2);self.sources(3);result=self.run_cycle(4)
        self.assertEqual(set(result['pilots'].values()),{'APPLIED_OBSERVATION_VERIFIED'})
        self.assertEqual(result['returned_result_count'],0)
        self.route();result=self.run_cycle(5);self.assertEqual(result['returned_result_count'],3);self.assertEqual(result['native_adoption'],'UNPROVEN')
        self.assertEqual(json.loads(self.registry.read_text())['entries'][0],self.original)
    def test_result_evidence_is_frozen_and_returned(self):
        self.complete()
        proofs={key:value['result_evidence'] for key,value in self.state()['pilots'].items()}
        for i in range(7,25):self.sources(i);self.run_cycle(i+0.1)
        for key,value in self.state()['pilots'].items():
            self.assertEqual(value['result_evidence'],proofs[key]);self.assertEqual(len(value['result_evidence']),2)
        for p in (self.bus/'OUTBOX').glob('la-bete-art-readonly-result-*.json'):
            result=json.loads(json.loads(p.read_text())['payload']['result_json']);self.assertEqual(len(result['result_evidence']),2)
    def test_repeated_source_does_not_invent_observations(self):
        self.run_cycle(0);self.sources(1);self.run_cycle(2)
        for n in (3,4,5):self.run_cycle(n)
        for p in self.state()['pilots'].values():self.assertEqual(len(p['observations']),1);self.assertEqual(p['status'],'RUNNING')
    def test_predeclaration_snapshot_does_not_count(self):
        self.run_cycle(0);self.run_cycle(3)
        self.assertTrue(all(len(p['observations'])==0 for p in self.state()['pilots'].values()))
    def test_missing_native_source_is_unknown(self):
        self.run_cycle(0);(self.root/'HOMEOSTASIS.json').unlink();self.run_cycle(3)
        p=self.state()['pilots']['supra.homeostasis'];self.assertEqual(p['latest_observation']['state'],'UNKNOWN');self.assertNotEqual(p['status'],'APPLIED_OBSERVATION_VERIFIED')
    def test_old_success_does_not_mean_fresh(self):
        self.run_cycle(0);self.run_cycle(300)
        p=self.state()['pilots']['supra.action_center'];self.assertEqual(p['latest_observation']['state'],'STALE')
    def test_future_clock_is_unknown(self):
        self.run_cycle(0);self.sources(100);self.run_cycle(5)
        for p in self.state()['pilots'].values():self.assertEqual(p['latest_observation']['state'],'UNKNOWN');self.assertEqual(len(p['observations']),0)
    def test_failure_cannot_be_relabelled_after_deadline(self):
        self.run_cycle(0);self.run_cycle(901);self.sources(902);self.run_cycle(903);self.sources(904);self.run_cycle(905)
        self.assertEqual({p['status'] for p in self.state()['pilots'].values()},{'NOT_MET'})
    def test_delivery_is_not_native_execution(self):
        self.complete();e=json.loads(self.registry.read_text())['entries'][1]
        self.assertTrue(all(p['adoption']=='UNPROVEN' for p in e['receivers'].values()))
        for p in list((self.bus/'INBOX').glob('*.json'))+list((self.bus/'OUTBOX').glob('*.json')):
            event=json.loads(p.read_text());self.assertEqual(event['payload']['requested_action'],'OBSERVE_ONLY');self.assertNotEqual(event['type'],'CAPABILITY_EXECUTION_REQUEST')
    def test_duplicate_cycle_keeps_registry_and_messages_stable(self):
        self.complete();before=self.registry.stat().st_mtime_ns;count=len(list((self.bus/'OUTBOX').glob('*.json')))
        for _ in range(3):self.run_cycle(5)
        self.assertEqual(before,self.registry.stat().st_mtime_ns);self.assertEqual(count,len(list((self.bus/'OUTBOX').glob('*.json'))))
    def test_unregistered_target_rejected_before_any_write(self):
        j=json.loads(self.registry.read_text());j['entries'][1]['receivers']['supra.unknown']={'message_id':'anything'};self.registry.write_text(json.dumps(j));before=self.registry.read_bytes()
        with self.assertRaisesRegex(ValueError,'UNREGISTERED_RECIPIENT'):self.run_cycle(0)
        self.assertEqual(before,self.registry.read_bytes());self.assertEqual(list((self.bus/'INBOX').glob('*')),[])
    def test_modified_packet_rejected(self):
        j=json.loads(self.registry.read_text());j['entries'][1]['knowledge']['patterns'].append({'id':'TAMPERED'});self.registry.write_text(json.dumps(j))
        with self.assertRaisesRegex(ValueError,'DIGEST_MISMATCH'):self.run_cycle(0)
    def test_execution_policy_rejected(self):
        j=json.loads(self.registry.read_text());j['entries'][1]['knowledge']['policy']['capability_execution']=True;self.registry.write_text(json.dumps(j))
        with self.assertRaisesRegex(ValueError,'POLICY_REJECTED'):self.run_cycle(0)
    def test_tampered_return_is_not_consumed(self):
        self.run_cycle(0);self.sources(1);self.run_cycle(2);self.sources(3);self.run_cycle(4);self.route()
        p=next((self.bus/'OUTBOX').glob('la-bete-art-readonly-result-*.json'));doc=json.loads(p.read_text());doc['payload']['result_json']='{}';p.write_text(json.dumps(doc));before=self.registry.read_bytes()
        with self.assertRaisesRegex(ValueError,'CONTENT_MISMATCH'):self.run_cycle(5)
        self.assertEqual(before,self.registry.read_bytes())
    def test_timezone_and_threshold_boundaries(self):
        now=self.start.timestamp()
        self.assertEqual(classify_observation_time(self.stamp(0),now+15,15)['state'],'FRESH')
        self.assertEqual(classify_observation_time(self.stamp(0),now+15.01,15)['state'],'STALE')
        for value in (None,'bad','2026-10-03T12:00:00',self.stamp(9)):
            self.assertEqual(classify_observation_time(value,now,15)['state'],'UNKNOWN')

if __name__=='__main__':unittest.main()
