#!/usr/bin/env python3
"""Regression tests for real source ambiguity, identity binding and projections."""
import copy, hashlib, json, os, re, subprocess, tempfile, unittest, shutil
from unittest.mock import patch
from pathlib import Path
from update_france_debt_rate_live import parse_dgfip_date, normalize_dgfip_publication
from france_beast_binding import binding, enrich

class Convergence(unittest.TestCase):
    def test_isolated_evolution_gate_and_rollback(self):
        files=['docs/data/france-debt-rate-live.json','docs/data/france-debt-rate-evolution.json',
               'docs/france-debt-rate-risk-live-2026-10-02.html','scripts/evolve_france_debt_rate.py',
               'scripts/verify_la_bete_evolution.py','scripts/la_bete_health_memory.py','scripts/la_bete_acquisition.py']
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for name in files:
                dest=root/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(name,dest)
            evo=root/files[1];good=evo.read_bytes();original=json.loads(good)
            live=root/files[0];fixture=json.loads(live.read_text());fixture['summary']['warnings']=0
            live.write_text(json.dumps(fixture))
            subprocess.run(['python3','scripts/evolve_france_debt_rate.py'],cwd=root,env={k:v for k,v in os.environ.items() if k!="LA_BETE_OBSERVATION_PATH"},check=True,capture_output=True)
            candidate=json.loads(evo.read_text());self.assertEqual(candidate['previous_dna'],original['dna'])
            subprocess.run(['python3','scripts/verify_la_bete_evolution.py'],cwd=root,env={k:v for k,v in os.environ.items() if k!="LA_BETE_OBSERVATION_PATH"},check=True,capture_output=True)
            candidate=json.loads(evo.read_text());candidate['policy']['truth_mutation']=True;evo.write_text(json.dumps(candidate))
            rejected=subprocess.run(['python3','scripts/verify_la_bete_evolution.py'],cwd=root,capture_output=True)
            self.assertNotEqual(rejected.returncode,0);self.assertIn(b'truth mutation forbidden',rejected.stderr)
            evo.write_bytes(good)
            subprocess.run(['python3','scripts/verify_la_bete_evolution.py'],cwd=root,env={k:v for k,v in os.environ.items() if k!="LA_BETE_OBSERVATION_PATH"},check=True,capture_output=True)
            self.assertEqual(evo.read_bytes(),good)

    def test_actual_updater_retains_values_when_sources_unavailable(self):
        import update_france_debt_rate_live as updater
        live=json.loads(Path('docs/data/france-debt-rate-live.json').read_text())
        sources={s['id']:s for s in live['sources']}
        def failed(key):return {**sources[key],'health':'ERROR','error':'TEST_SOURCE_UNAVAILABLE'}
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'live.json';out.write_text(json.dumps(live))
            with patch.dict(os.environ, {"LA_BETE_OBSERVATION_PATH":""}),patch.object(updater,'OUT',out),patch.object(updater,'fetch_bdf_html',return_value=(failed('BDF_TEC'),{})),patch.object(updater,'fetch_bdf_csv',return_value=(failed('BDF_WEBSTAT'),{})),patch.object(updater,'fetch_watch',return_value=failed('AFT_RSS')),patch.object(updater,'fetch_dgfip_execution',return_value=(failed('DGFIP_EXECUTION'),{})),patch.object(updater,'fetch_aft_maturity',return_value=({**live['maturity_ladder'],'mode':'RETAINED_LAST_GOOD'},[])):
                updater.main()
            retained=json.loads(out.read_text())
        self.assertEqual(retained['observed']['yield_curve'],live['observed']['yield_curve'])
        self.assertEqual(retained['observed']['tec10_pct'],live['observed']['tec10_pct'])
        self.assertEqual(retained['budget_execution']['period'],live['budget_execution']['period'])
        self.assertEqual(retained['claims'][0]['state'],'RETAINED_LAST_GOOD')
        proof=retained['claims'][0]['proof'][0]
        for field in ['url','vintage','reason','confidence','replacement_condition']:self.assertTrue(proof[field])
        self.assertIsNone(retained['derived']['webstat_crosscheck_bps'])

    def test_independent_source_groups_really_overlap(self):
        import threading
        import update_france_debt_rate_live as updater
        barrier=threading.Barrier(5)
        def result(value):
            def work(*args):
                barrier.wait(timeout=3)
                return value
            return work
        with patch.object(updater,'fetch_bdf_html',side_effect=result(('BDF',{}))),patch.object(updater,'fetch_bdf_csv',side_effect=result(('WEBSTAT',{}))),patch.object(updater,'fetch_watch',side_effect=result('RSS')),patch.object(updater,'fetch_dgfip_execution',side_effect=result(('DGFIP',{}))),patch.object(updater,'fetch_aft_maturity',side_effect=result(('MATURITY',[]))):
            sources=updater.collect_sources({})
        self.assertEqual(list(sources),['bdf','webstat','rss','dgfip','maturity'])
        self.assertEqual(sources['maturity'],('MATURITY',[]))

    def test_french_dates_and_iso(self):
        for raw, expected in [('03/09/2026','2026-09-03'),('09/03/2026','2026-03-09'),
                              ('03 septembre 2026','2026-09-03'),('2026-03-09','2026-03-09'),
                              ('01/02/2026','2026-02-01'),('29/02/2024','2024-02-29')]:
            self.assertEqual(parse_dgfip_date(raw),expected)
        for raw in ['02/29/2026','31/04/2026','03-09-26','September 3, 2026',None]:
            with self.assertRaises(ValueError):parse_dgfip_date(raw)

    def test_upstream_inversion_needs_exact_document_proof(self):
        evidence=json.loads(Path('docs/data/dgfip-publication-evidence.json').read_text())
        doc={'date_publication':'2026-03-09','url_fichier':evidence['document_url']}
        normalized=normalize_dgfip_publication(doc,'2026-07',evidence)
        self.assertEqual(normalized['date_publication'],'2026-09-03')
        self.assertEqual(normalized['date_publication_raw'],'2026-03-09')
        for period,url in [('2026-08',doc['url_fichier']),('2026-07','other.pdf')]:
            self.assertIsNone(normalize_dgfip_publication({**doc,'url_fichier':url},period,evidence)['date_publication'])

    def test_binding_and_lineage_preserve_values(self):
        live=json.loads(Path('docs/data/france-debt-rate-live.json').read_text())
        before=copy.deepcopy(live)
        enriched=enrich(live)
        for k in ['observed','sensitivity','decision_delta','maturity_ladder','refinancing_twin','curve_history']:
            self.assertEqual(enriched[k],before[k],k)
        b=binding()
        self.assertFalse(b['territorial_imputation'])
        self.assertEqual(b['country_object_id'],'OJO_FRANCE_ORGANISM_V1#/identity')
        for c in enriched['claims']:
            for k in ['country_object_id','system_id','organ_id','metric_id','claim_id','source_id','observation_id','transformation_id','scenario_id','output_id']:
                self.assertIn(k,c)
            self.assertTrue(c['proof'])
            self.assertTrue(all(p.get('url','').startswith('https://') for p in c['proof']))

    def test_no_js_is_same_canonical_snapshot(self):
        text=Path('docs/france-debt-rate-risk-live-2026-10-02.html').read_text()
        raw=Path('docs/data/france-debt-rate-live.json').read_bytes()
        m=re.search(r'<script type="application/json" id="canonicalSnapshot" data-sha256="([a-f0-9]+)">(.*?)</script>',text,re.S)
        self.assertIsNotNone(m)
        self.assertEqual(m[1],hashlib.sha256(raw).hexdigest())
        self.assertEqual(json.loads(m[2]),json.loads(raw))
        pulse=text[text.index('id="reality-pulse"'):text.index('<section class="hero hero-dna"')]
        for placeholder in ['Lecture de l’état canonique','Chargement','Chargement du signal']:
            self.assertNotIn(placeholder,pulse)
        self.assertIn('4,903' if json.loads(raw)['observed']['tec10_pct']==4.903 else 'TEC10',pulse)
        self.assertIn('UNKNOWN',pulse)
        self.assertIn('JavaScript désactivé',text)

    def test_hydration_failures_and_monotonicity(self):
        subprocess.run(['node','scripts/test_france_beast_hydration.cjs'],check=True)

    def test_real_bus_adapter_deduplicates_without_second_loop(self):
        from publish_france_beast_impulse import publish
        live=json.loads(Path('docs/data/france-debt-rate-live.json').read_text())
        with tempfile.TemporaryDirectory() as tmp:
            bus=Path(tmp)/'bus';bus.mkdir()
            for name in ['INBOX','OUTBOX','EVENTS']:(bus/name).mkdir()
            (bus/'megabus.pid').write_text(str(os.getpid()))
            receipt=Path(tmp)/'pointer.json'
            self.assertEqual(publish(live,bus,receipt),'SUBMITTED_OBSERVATION_REFERENCE')
            self.assertEqual(publish(live,bus,receipt),'NO_EVENT_NO_IMPULSE')
            files=list((bus/'INBOX').glob('*.json'));self.assertEqual(len(files),1)
            event=json.loads(files[0].read_text())
            self.assertEqual(event['target'],'supra.megabus')
            self.assertEqual(event['payload']['requested_action'],'OBSERVE_ONLY')
            self.assertNotIn('tec10_pct',event['payload'])

    def test_governance_and_territorial_guard(self):
        evo=json.loads(Path('docs/data/france-debt-rate-evolution.json').read_text())
        self.assertFalse(evo['policy']['truth_mutation'])
        self.assertFalse(evo['policy']['semantic_claim_autopromotion'])
        self.assertFalse(evo['policy']['political_recommendation'])
        self.assertTrue(evo['policy']['rollback_required'])
        live=json.loads(Path('docs/data/france-debt-rate-live.json').read_text())
        self.assertTrue(live['policy']['national_signal_is_not_territorial_effect'])
        self.assertEqual(live['policy']['political_recommendation'],'NONE')
        france=json.loads(Path('docs/data/france-organism.json').read_text())
        self.assertNotIn('tec10_pct',json.dumps(france['topology']['regions']))

if __name__=='__main__':unittest.main()
