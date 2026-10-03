/* Test-only fixtures; no production data writes or network I/O. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const page=fs.readFileSync('docs/france-debt-rate-risk-live-2026-10-02.html','utf8');
const script=page.match(/<script>([\s\S]*?)<\/script>/)[1];
const snapshot=JSON.parse(fs.readFileSync('docs/data/france-debt-rate-live.json','utf8'));
const identity=JSON.parse(fs.readFileSync('app/system_identity.json','utf8'));
const identityScript=fs.readFileSync('docs/assets/system-identity.js','utf8');
const evolution=JSON.parse(fs.readFileSync('docs/data/france-debt-rate-evolution.json','utf8'));
const node=()=>({textContent:'',innerHTML:'',dataset:{},classList:{add(){},remove(){},toggle(){}},style:{setProperty(){}},querySelector(){return node()},setAttribute(){},addEventListener(){},animate(){}});
const nodes=new Map(),document={getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},querySelectorAll(){return[]},body:node(),documentElement:node()};
const context=vm.createContext({document,window:{matchMedia(){return{matches:true}}},console,Date,Number,Math,String,Array,Object,JSON,setTimeout(){},Blob:class{},URL,ResizeObserver:class{},snapshot});
vm.runInContext(script.slice(0,script.lastIndexOf('\ninitBeast();')),context,{timeout:3000});
const evaluate=s=>vm.runInContext(s,context,{timeout:3000});
let checks=0;const check=(x,message)=>{assert(x,message);checks++};
check(evaluate('acceptCanonical(snapshot)'),'valid snapshot');
const original=JSON.stringify(snapshot);
for(const shape of Object.keys(snapshot.sensitivity.stress_shapes))for(const bps of [50,100,200]){
 evaluate(`shockShape=${JSON.stringify(shape)};bps=${bps};renderSim()`);
 for(const id of ['y1','y3','y5','cum5','execY5','beastY5'])check(shape==='parallel'?nodes.get(id).textContent.includes('Md€'):nodes.get(id).textContent==='UNKNOWN',shape+' '+bps+' '+id);
 const shocks=evaluate('selectedStressShocks()');
 for(const [tenor,value] of Object.entries(snapshot.sensitivity.stress_shapes[shape].tenor_shock_bps))check(shocks[tenor]===value*bps/100,'shape amplitude');
 if(shape!=='parallel')check(evaluate('buildBrief(state)').includes('UNKNOWN : montant budgétaire non dérivé'),'export semantics');
}
check(JSON.stringify(snapshot)===original,'no analytical mutation');
const now=Date.UTC(2026,9,3,10);context.now=now;
for(const [age,label] of [[0,'OK'],[12,'OK'],[12.01,'EN RETARD'],[35,'EN RETARD'],[35.01,'STALE'],[10080,'STALE']]){
 context.fixture={run_started_at:new Date(now-age*60000).toISOString(),status:'completed',conclusion:'success'};
 check(evaluate('computeRunnerState(fixture,now).label').startsWith(label),'runner boundary '+age);
}
for(const fixture of [{},{run_started_at:'invalid'},{run_started_at:new Date(now+120000).toISOString()}]){context.fixture=fixture;check(evaluate('computeRunnerState(fixture,now).label')==='UNKNOWN','unknown heartbeat');}
context.fixture={run_started_at:new Date(now).toISOString(),status:'in_progress'};check(evaluate('computeRunnerState(fixture,now).label')==='EN COURS','not a completed success');
context.fixture={run_started_at:new Date(now).toISOString(),status:'completed',conclusion:'failure'};check(evaluate('computeRunnerState(fixture,now).tone')==='bad','failed heartbeat');
check(/vertexShader:`[\s\S]*?uniform float uTension;/.test(page),'vertex uniform declaration');
for(const [file,hash] of Object.entries({'three.module.js':'c8211c69345d2e9949dc7a8ac969380497aa0600a5a8ac6a459c8cd02dd9cb8a','three.core.js':'eb077d2417f61d3e6d9264c317cabc4ea35769ed6b0ab533067292a550784c20'}))check(crypto.createHash('sha256').update(fs.readFileSync('docs/assets/vendor/three-0.180.0/'+file)).digest('hex')===hash,'unmodified pinned Three '+file);
async function identityCheck(rootURL,bodyURL,offline=false){
 const root={dataset:{identityUrl:rootURL,artMotion:'calm'},style:{setProperty(){}}};
 Object.defineProperty(root,'textContent',{set(){throw Error('ROOT CONTENT MUST NOT BE REPLACED');}});
 const events={},button={textContent:'',disabled:true,setAttribute(){},addEventListener(k,f){events[k]=f}};
 const requests=[],win={matchMedia(){return{matches:false,addEventListener(){}}}};
 const doc={documentElement:root,body:{dataset:{identityUrl:bodyURL}},baseURI:'https://fixture.invalid/nova-trust/page.html',hidden:false,addEventListener(){},querySelectorAll(selector){
   if(selector==='[data-art-motion]')return[root,button]; // Reproduce the root/button collision, not just a string check.
   if(selector==='button[data-art-motion]'||selector==='.artDNAControls button')return[button];
   return[];
 }};
 const c=vm.createContext({document:doc,window:win,location:{origin:'https://fixture.invalid'},URL,AbortController,console,setTimeout(){return 1},clearTimeout(){},fetch:async url=>{requests.push(url);if(offline)throw Error('TEST_ONLY_OFFLINE');return{ok:true,json:async()=>structuredClone(identity)}}});
 await vm.runInContext(identityScript,c,{timeout:3000});
 if(offline){check(root.dataset.identityState==='UNAVAILABLE','explicit identity failure');check(root.dataset.artMotion==='calm'&&button.disabled,'static failure mode');return;}
 check(root.dataset.identityState==='READY','ready identity');check(requests.length===1,'one fetch, no second pulse');
 check(requests[0]===new URL(rootURL||bodyURL||'system_identity.json',doc.baseURI).href,'canonical URL fallback');
 check(!button.disabled,'bound controls enabled');events.click();check(root.dataset.artMotion==='calm','pause');events.click();check(root.dataset.artMotion==='living','resume');
 const before=JSON.stringify(snapshot),p=win.SupraIdentity.project(snapshot,evolution);check(p.known,'canonical signal');check(p.pressure===snapshot.summary.warnings/snapshot.summary.monitored,'actual ratio');check(JSON.stringify(snapshot)===before,'projection read-only');
 const u=win.SupraIdentity.project(null,null);check(!u.known&&u.regime==='UNKNOWN','unknown is not healthy');
 check(win.SupraIdentity.project(snapshot,{...evolution,source_snapshot_id:'WRONG',dna:{signal:{curve_regime:'FORGED'}}}).regime!=='FORGED','reject mismatched evolution');
}
(async()=>{
 await identityCheck('system_identity.json',null);await identityCheck(null,'system_identity.json');await identityCheck(null,null);await identityCheck(null,null,true);
 assert.deepEqual(identity,JSON.parse(fs.readFileSync('docs/system_identity.json','utf8')));checks++;
 const manifest=JSON.parse(fs.readFileSync('docs/manifest.webmanifest','utf8'));
 for(const x of manifest.shortcuts){const u=new URL(x.url,'https://fixture.invalid/nova-trust/page.html');check(fs.existsSync('docs/'+u.pathname.split('/').pop()),'shortcut path');check(page.includes('id="'+u.hash.slice(1)+'"'),'shortcut anchor');}
 console.log('ART_DNA_PRISMS_RUNNER_SCENARIOS_IDENTITY_NON_REGRESSION_PASS',checks,'assertions');
})().catch(e=>{console.error(e);process.exitCode=1});
