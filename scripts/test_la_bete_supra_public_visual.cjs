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
