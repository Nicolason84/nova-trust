import copy,json,os,tempfile,unittest,subprocess,sys
from pathlib import Path
from la_bete_bridge_health import *

class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.r=Path(self.tmp.name);self.bus=self.r/'bus';self.bus.mkdir()
        for c in ('INBOX','OUTBOX','EVENTS'):(self.bus/c).mkdir()
        (self.bus/'megabus.pid').write_text(str(os.getpid()))
        self.registry=self.r/'registry.json';self.transfer=self.r/'receipt.json';self.proj=self.r/'projection.json'
        self.original={'id':'unrelated','value':42}
        atomic_json(self.registry,{'schema':'LEARNING_LOOP_REGISTRY_V1','authority':'NICOLAS','entries':[self.original,{'id':'LEARN_LA_BETE_HOMEOSTASIS','method_digest':'hash','knowledge':{'knowledge_id':'K','source_commit':'c'}}]})
        atomic_json(self.transfer,{'knowledge_id':'K'})
    def tearDown(self):self.tmp.cleanup()
    def mem(self):return memory(load(self.registry))[1]
    def observation(self,i,states=None):
        return {'id':'event-'+str(i),'observed_at':f'2026-10-02T21:{i:02d}:00+00:00','context':'CONTROLLED',
          'metrics':{'forward_delay_s':None},'states':states or {'proof':'UNKNOWN'},'thresholds':calibration(self.mem()),'evidence':{'fixture':True}}
    def trial(self):
        m=self.mem();o=self.observation(0);observe(m,o);plan=choose(m,o)[0];t=declare(m,o,plan,{'id':'K'},'CONTROLLED');t['executed_at']=o['observed_at'];return m,t
    def test_restart_and_lifetime_replay(self):
        m=self.mem()
        for i in range(17):observe(m,self.observation(i))
        data=load(self.registry);entry,_=memory(data);entry['health_memory']=m;atomic_json(self.registry,data)
        child=subprocess.run([sys.executable,'-c',"from la_bete_bridge_health import *; import sys; print(len(memory(load(Path(sys.argv[1])))[1]['observations']))",str(self.registry)],capture_output=True,text=True,check=True)
        self.assertEqual(child.stdout.strip(),'17')
        m=self.mem();self.assertEqual(len(m['observations']),17);self.assertEqual(len(m['issues']['proof']['episodes']),1)
        before=copy.deepcopy(m);self.assertFalse(observe(m,self.observation(0)));self.assertEqual(m,before)
    def test_recovery_and_recurrence(self):
        m=self.mem()
        for i,s in enumerate(['DEGRADED','HEALTHY','HEALTHY','DEGRADED']):observe(m,self.observation(i,{'delay':s}))
        self.assertEqual(len(m['issues']['delay']['episodes']),2)
        self.assertIn('recovered_at',m['issues']['delay']['episodes'][0])
    def test_delay_error_and_missing_decisions(self):
        for key,state in [('delay','DEGRADED'),('errors','DEGRADED'),('proof','UNKNOWN')]:
            m=self.mem();o=self.observation(0,{key:state});observe(m,o)
            self.assertEqual(choose(m,o)[0]['action'],'CORRELATION_PROBE')
            t=declare(m,o,choose(m,o)[0],{'id':'K'});self.assertEqual(choose(m,o)[0]['action'],'WAIT_FOR_EVIDENCE')
    def test_failures_stop_repetition_and_late_recovery(self):
        m,t=self.trial()
        for i in range(1,4):evaluate(t,self.observation(i),{'known':True,'healthy':False})
        self.assertEqual(t['result'],'NOT_MET');evaluate(t,self.observation(4),{'known':True,'healthy':True})
        self.assertEqual(t['result'],'NOT_MET');self.assertIn('late_recovery',t)
        m['trials'].append(dict(t,id='second'))
        self.assertEqual(choose(m,self.observation(5))[0]['action'],'REVIEW_STRATEGY')
    def test_missing_defers_and_late_success_not_relabelled(self):
        m,t=self.trial()
        for i in [1,20]:evaluate(t,self.observation(i),{'known':False})
        self.assertEqual(t['result'],'PENDING');self.assertEqual(t['known_observations'],0)
        evaluate(t,self.observation(21),{'known':True,'healthy':True})
        self.assertEqual(t['result'],'NOT_MET')
    def test_goal_met_and_duplicate_evaluation(self):
        m,t=self.trial();o=self.observation(1)
        evaluate(t,o,{'known':True,'healthy':True});evaluate(t,o,{'known':True,'healthy':True})
        self.assertEqual(t['known_observations'],1)
        evaluate(t,self.observation(2),{'known':True,'healthy':True});self.assertEqual(t['result'],'GOAL_MET')
    def test_calibration_from_measured_trials(self):
        m=self.mem();self.assertEqual(calibration(m)['sample_count'],0)
        m['trials']=[{'result_evidence':{'forward_delay_s':x}} for x in [2,3,4,5,10]]
        self.assertEqual(calibration(m)['delay_s'],30);self.assertEqual(calibration(m)['basis'],'MEASURED_P95')
    def test_corruption_blocks_without_erasure(self):
        d=load(self.registry);entry,m=memory(d);m['schema']='BROKEN';atomic_json(self.registry,d);raw=self.registry.read_bytes()
        with self.assertRaises(ValueError):advance(self.registry,self.bus,self.transfer,self.proj,context="CONTROLLED")
        self.assertEqual(raw,self.registry.read_bytes())
    def test_observation_replay_no_extra_trial(self):
        advance(self.registry,self.bus,self.transfer,self.proj,context="CONTROLLED")
        advance(self.registry,self.bus,self.transfer,self.proj,context="CONTROLLED")
        n=len(self.mem()['observations']);t=len(self.mem()['trials']);advance(self.registry,self.bus,self.transfer,self.proj,context="CONTROLLED")
        self.assertEqual(len(self.mem()['trials']),t)
        self.assertEqual(load(self.registry)['entries'][0],self.original)
    def test_replayed_routed_envelope_cannot_refresh_proof(self):
        path=self.bus/'OUTBOX'/'la-bete-example.json'
        atomic_json(path,{'message_id':'la-bete-example','status':'ROUTED','routed_at':'2026-10-02T21:00:00Z'})
        m=self.mem();data=load(self.registry)
        first=collect(self.bus,data,self.transfer,self.proj,m,at='2026-10-02T21:01:00Z');observe(m,first)
        atomic_json(path,{'message_id':'la-bete-example','status':'ROUTED','routed_at':'2026-10-02T21:00:59Z'})
        replay=collect(self.bus,data,self.transfer,self.proj,m,at='2026-10-02T21:01:00Z')
        self.assertEqual(first['id'],replay['id']);self.assertEqual(replay['metrics']['proof_age_s'],60)
        self.assertFalse(observe(m,replay));self.assertEqual(len(m['observations']),1)
    def test_stale_native_is_not_visible_proof(self):
        atomic_json(self.proj,{'SCHEMA':'SUPRA_NERVOUS_SYSTEM_V1','GENERATED_AT':'2026-10-02T00:00:00Z','IMPULSES':[{'source':'ojo.la-bete'}]})
        o=collect(self.bus,load(self.registry),self.transfer,self.proj,self.mem(),at='2026-10-02T21:00:00Z')
        self.assertEqual(o['states']['native_visibility'],'UNPROVEN')
    def test_fresh_bus_heartbeat_and_same_event_replay(self):
        (self.bus/'TERMINALS').mkdir()
        atomic_json(self.bus/'TERMINALS/CURRENT.json',{'schema':'SUPRA_TERMINAL_REGISTRY_V1','terminals':[{'seen_at':'2026-10-02T21:00:00Z'}]})
        o=collect(self.bus,load(self.registry),self.transfer,self.proj,self.mem(),at='2026-10-02T21:00:01Z')
        self.assertEqual(o['states']['bus'],'HEALTHY')
        m=self.mem();observe(m,o);raw=copy.deepcopy(m);self.assertFalse(observe(m,o));self.assertEqual(m,raw)
    def test_correlation_mismatch_defers(self):
        m,t=self.trial();t['return_submitted_at']=t['executed_at']
        for mid in [t['forward_id'],t['return_id']]:
            atomic_json(self.bus/'OUTBOX'/(mid+'.json'),{'message_id':mid,'status':'ROUTED','routed_at':t['executed_at'],'payload':{'received_message_id':'wrong'}})
        self.assertFalse(route_evidence(self.bus,t)['known'])
    def test_real_channels_simulated_roundtrip_and_registry_preserved(self):
        # Controlled routing fixture: never described as live daemon evidence.
        advance(self.registry,self.bus,self.transfer,self.proj,context="CONTROLLED")
        advance(self.registry,self.bus,self.transfer,self.proj,context="CONTROLLED")
        def route_all():
            for p in (self.bus/'INBOX').glob('*.json'):
                j=load(p);j.update(status='ROUTED',routed_at=stamp());atomic_json(self.bus/'OUTBOX'/p.name,j);p.unlink()
        route_all();advance(self.registry,self.bus,self.transfer,self.proj,context="CONTROLLED");route_all()
        for i in range(1,5):
            atomic_json(self.proj,{'SCHEMA':'SUPRA_NERVOUS_SYSTEM_V1','GENERATED_AT':str(i),'IMPULSES':[]})
            advance(self.registry,self.bus,self.transfer,self.proj,allow_probe=False,context="CONTROLLED");route_all()
        self.assertEqual(self.mem()['trials'][0]['result'],'GOAL_MET')
        self.assertEqual(self.mem()['experiences'][0]['status'],'ROUND_TRIP_CONFIRMED')
        self.assertEqual(load(self.registry)['entries'][0],self.original)
        self.assertEqual(self.mem()['observations'][-1]['states']['native_visibility'],'UNPROVEN')


    def test_retention_preserves_lifetime_replay_and_validates_digest(self):
        d=load(self.registry);entry,m=memory(d)
        for i in range(130):
            o=self.observation(0);o['id']='retained-'+str(i);o['observed_at']='2026-10-02T21:00:00+00:00' if i==0 else __import__('datetime').datetime.fromtimestamp(1790974800+i,tz=__import__('datetime').timezone.utc).isoformat()
            observe(m,o)
        self.assertEqual(len(m['observations']),120);self.assertEqual(len(m['seen']),130)
        memory(d);before=copy.deepcopy(m)
        self.assertFalse(observe(m,dict(m['observations'][0],id='retained-0')));self.assertEqual(m,before)
        m['observations'][-1]['context']='TAMPERED'
        with self.assertRaisesRegex(ValueError,'INVALID_OBSERVATION_DIGEST'):memory(d)

    def test_unmarked_history_loss_remains_blocked(self):
        d=load(self.registry);entry,m=memory(d);o=self.observation(0);observe(m,o)
        m['observations']=[]
        with self.assertRaises(ValueError):memory(d)

    def test_archived_index_tampering_remains_blocked(self):
        d=load(self.registry);entry,m=memory(d);o=self.observation(0);observe(m,o)
        m['seen']['historic']='a'*64
        m['retention']={'schema':'LA_BETE_BRIDGE_RETENTION_V1','archived_count':1,'archived_index_sha256':digest({'historic':'a'*64})}
        memory(d);m['seen']['historic']='b'*64
        with self.assertRaises(ValueError):memory(d)

if __name__=='__main__':unittest.main()
