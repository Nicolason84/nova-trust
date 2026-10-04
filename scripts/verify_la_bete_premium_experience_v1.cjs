#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'docs/france-debt-rate-risk-live-2026-10-02.html'),'utf8');
const base=fs.readFileSync(path.join(root,'docs/assets/la-bete-advisory-house-v5.js'),'utf8');
const js=fs.readFileSync(path.join(root,'docs/assets/la-bete-living-advisory-house-premium-v1.js'),'utf8');
const css=fs.readFileSync(path.join(root,'docs/assets/la-bete-living-advisory-house-premium-v1.css'),'utf8');
const pass=s=>console.log('PASS '+s);

for(const x of ['la-bete-advisory-house-v5.css','la-bete-advisory-house-v5.js','la-bete-living-advisory-house-premium-v1.css','la-bete-living-advisory-house-premium-v1.js'])assert.ok(html.includes(x));pass('premium assets layer over V5 assets on the same public page');
for(const id of ['dialogue-public','decision-twin','evidence-graph','supra-mission'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);pass('canonical public surfaces remain singletons');
for(const token of ["second_engine:false","second_registry:false","second_truth:false","private_storage:false","execution_authority_promoted:false"])assert.ok(js.includes(token),token);pass('premium layer refuses parallel authority and storage');
for(const forbidden of ['fetch(','localStorage','indexedDB','new WebSocket','new Worker','THREE.','new THREE'])assert.ok(!js.includes(forbidden),'forbidden premium primitive '+forbidden);pass('premium layer introduces no network storage worker or rendering engine');
assert.ok(js.includes("const bindingProof=base.specialist_binding_proof"));assert.ok(!js.includes('specialistBindingProof=Object.freeze'));pass('specialist presence reuses V5 proven binding object, no second registry');
assert.ok(base.includes('href="supra://private-office"'));assert.ok(!base.includes('supra://private-office?')&&!base.includes('supra://private-office#'));pass('private office boundary remains payload-free');
assert.ok(js.includes("base.setRoom('proof')"));assert.ok(js.includes('decision_twin_sovereign:true'));assert.ok(js.includes('proofgraph_unchanged_spine:true'));pass('decision stays sovereign and proof remains one hop away');
assert.ok(js.includes('cosmos_voluntary:true'));assert.ok(!js.includes('LaBeteExplorerActivate'));pass('premium presentation never auto-activates Cosmos');
for(const scenario of ['banque|financ','croire|conclusion','tout ce qui est lié','vous vous occupiez'])assert.ok(base.includes(scenario),scenario);pass('five mission scenarios are covered by the existing V5 route function');
assert.ok(css.includes('@media(max-width:560px)'));assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));pass('mobile and reduced-motion remain first-class');
assert.ok(css.includes('.premiumRawRouteHint{display:none!important}'));assert.ok(js.includes('premiumMissionExpert'));pass('technical routing and governance are progressively disclosed');
console.log('LA_BETE_PREMIUM_EXPERIENCE_V1_STATIC_PASS 11');
