
import json, os, tempfile, unittest
from pathlib import Path
from publish_france_beast_impulse import build_knowhow, publish_knowhow, METHOD_FILES
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

if __name__=='__main__':unittest.main()
