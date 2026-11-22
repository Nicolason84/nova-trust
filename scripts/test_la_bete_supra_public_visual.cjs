'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const docs=path.resolve(__dirname,'../docs');
const payloadPath=path.join(docs,'data/la-bete-supra-public-proof-v1.json');
const jsPath=path.join(docs,'assets/la-bete-advisory-house-v5.js');
const cssPath=path.join(docs,'assets/la-bete-advisory-house-v5.css');
const read=file=>fs.readFileSync(file,'utf8');
const source=read(jsPath),css=read(cssPath),json=read(payloadPath);
const payload=JSON.parse(json);
test('public projection is a dated agent-only snapshot',()=>{
 assert.equal(payload.schema,'LA_BETE_SUPRA_PUBLIC_VISUAL_PROOF_V1');
 assert.equal(payload.scope,'AGENT_RECEIVER_ONLY');
 assert.equal(payload.snapshot_only,true);
 assert.ok(Number.isFinite(Date.parse(payload.observed_at)));
});
test('agent receipt does not promote the native product',()=>{
 assert.equal(payload.agent.la_bete_to_supra,'ROUND_TRIP_CONFIRMED');
 assert.equal(payload.agent.supra_to_la_bete,'RECEIVER_VALIDATED_APPLIED_AS_CONSTRAINT');
 assert.equal(payload.product.native_app_consumption,false);
 assert.equal(payload.accounts.cross_account_synchronization_verified,false);
});
test('no private transfer, auto-promotion or external action',()=>{
 assert.deepEqual(payload.policy,{private_transfer:false,automatic_promotion:false,external_action:false});
 assert.doesNotMatch(json,/\/Users\/|\/Volumes\/|@gmail|@hotmail|sk-proj|Bearer|api_key/i);
});
test('the existing visual UI remains valid JavaScript',()=>{
 assert.doesNotThrow(()=>new vm.Script(source,{filename:jsPath}));
 assert.match(source,/LA_BETE_SUPRA_PUBLIC_VISUAL_PROOF_V1/);
 assert.match(source,/houseCaseBar.*after\(supraEvidence\)/s);
 assert.match(source,/PROOF_CONTRACT_INVALID/);
 assert.match(source,/PUBLIC_PROOF_NOT_AVAILABLE/);
});
test('the widget loads only a same-page reduced public snapshot',()=>{
 assert.match(source,/new URL\('data\/la-bete-supra-public-proof-v1\.json',document\.baseURI\)/);
 assert.match(source,/fetch\(proofSourceUrl\.href,\{cache:'no-store',credentials:'omit'\}\)/);
 assert.match(source,/Instantané du/);
 assert.match(source,/Consommation native et échanges intercomptes non prouvés/);
 assert.match(source,/supraEvidence\.dataset\.proof='unverified'/);
});
test('the proof UI remains readable at mobile widths',()=>{
 assert.match(css,/\.houseSupraProof/);
 assert.match(css,/@media\(max-width:560px\)/);
});


const uiPatchStart=source.indexOf('// LA_BETE_SUPRA_PUBLIC_VISUAL_PROOF_V1');
const uiPatchEnd=source.indexOf('if(intro){const archive',uiPatchStart);
const uiPatch=source.slice(uiPatchStart,uiPatchEnd);

async function runProofUi(proof,{status=200}={}){
  assert.ok(uiPatchStart>=0&&uiPatchEnd>uiPatchStart,'the existing UI patch must be present');
  const fields=new Map(),requests=[];
  let inserted=false;
  const panel={dataset:{},setAttribute(){},innerHTML:''};
  const house={querySelector(selector){
    if(selector==='.houseCaseBar')return {after(el){inserted=(el===panel);}};
    if(selector.startsWith('#')){
      const id=selector.slice(1);
      if(!fields.has(id))fields.set(id,{textContent:''});
      return fields.get(id);
    }
    return null;
  }};
  const document={
    baseURI:'https://example.test/docs/france-debt-rate-risk-live-2026-10-02.html',
    createElement:()=>panel
  };
  const fetch=async (url,options)=>{
    requests.push({url,options});
    return {ok:status>=200&&status<300,json:async()=>proof};
  };
  const FixedDate=class extends Date{
    static now(){return Date.parse('2026-11-22T03:30:00Z');}
  };
  vm.runInNewContext(uiPatch,{house,document,fetch,Date:FixedDate,URL,Intl,Error,Number});
  await new Promise(resolve=>setImmediate(resolve));
  return {panel,fields,requests,inserted};
}

test('the public status widget accepts a valid dated agent receipt',async()=>{
  const r=await runProofUi(payload);
  assert.equal(r.inserted,true);
  assert.equal(r.panel.dataset.proof,'dated-agent-evidence');
  assert.match(r.fields.get('houseSupraProofState').textContent,/Aller-retour confirmé/);
  assert.match(r.fields.get('houseSupraProofLimits').textContent,/non prouvés/);
  assert.match(r.fields.get('houseSupraProofDate').textContent,/Instantané du/);
  assert.equal(r.requests.length,1);
  assert.equal(r.requests[0].options.credentials,'omit');
  assert.equal(r.requests[0].options.cache,'no-store');
  assert.equal(r.requests[0].url,'https://example.test/docs/data/la-bete-supra-public-proof-v1.json');
});

test('a missing public receipt fails closed',async()=>{
  const r=await runProofUi(payload,{status:404});
  assert.equal(r.panel.dataset.proof,'unverified');
  assert.match(r.fields.get('houseSupraProofState').textContent,/indisponible/);
});

test('a receipt attempting private transfer fails closed',async()=>{
  const bad={...payload,policy:{...payload.policy,private_transfer:true}};
  const r=await runProofUi(bad);
  assert.equal(r.panel.dataset.proof,'unverified');
});

test('a receipt falsely claiming native UI consumption fails closed',async()=>{
  const bad={...payload,product:{native_app_consumption:true}};
  const r=await runProofUi(bad);
  assert.equal(r.panel.dataset.proof,'unverified');
});
