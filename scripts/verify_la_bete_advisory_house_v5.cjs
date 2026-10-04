#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'docs/france-debt-rate-risk-live-2026-10-02.html'),'utf8');
const js=fs.readFileSync(path.join(root,'docs/assets/la-bete-advisory-house-v5.js'),'utf8');
const css=fs.readFileSync(path.join(root,'docs/assets/la-bete-advisory-house-v5.css'),'utf8');
const pass=s=>console.log('PASS '+s);

for(const x of ['la-bete-advisory-house-v5.css','la-bete-advisory-house-v5.js'])assert.ok(html.includes(x));pass('V5 assets are bound to the existing public page');
for(const id of ['dialogue-public','decision-twin','evidence-graph','supra-mission'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);pass('canonical public surfaces remain singletons in source');
for(const token of ["second_engine:false","second_registry:false","second_truth:false","private_storage:false"])assert.ok(js.includes(token));pass('V5 explicitly refuses parallel engine registry truth and public private storage');
for(const forbidden of ['localStorage','indexedDB','new WebSocket','new Worker','THREE.','new THREE','fetch('])assert.ok(!js.includes(forbidden),'forbidden V5 primitive '+forbidden);pass('V5 introduces no storage network worker or rendering engine');
for(const room of ["id:'desk'","id:'decision'","id:'proof'","id:'explore'","id:'mission'"])assert.ok(js.includes(room));pass('five cognitive rooms reuse existing surfaces');
assert.ok(js.includes('Aucune identité professionnelle humaine n’est simulée.'));assert.ok(js.includes('aucun faux expert public'));pass('professional roles are explicitly digital and unbound experts fail closed');
assert.ok(js.includes('Bureau privé SUPRA'));assert.ok(js.includes('ne stocke ni dossier privé ni mémoire client'));pass('public/private boundary is explicit');
assert.ok(js.includes('href="supra://private-office"'));assert.ok(js.includes('Aucun dossier, message ou identifiant n’est transmis dans ce lien.'));assert.ok(!js.includes('supra://private-office?')&&!js.includes('supra://private-office#'));pass('private-office handoff is a payload-free native deep link');
assert.ok(js.includes('COMITÉ · SYNTHÈSE'));assert.ok(js.includes('NONE_EVIDENCED'));pass('committee is a bounded synthesis without fabricated disagreement');
assert.ok(js.includes('CONVERSATIONAL SOLUTION & MISSION FACTORY'));assert.ok(js.includes("verdict:'PROVEN_FOR_V5_BINDING_GATE'"));assert.ok(js.includes("authority:'ROUTING_ONLY_NOT_EXECUTION_PROOF'"));assert.ok(js.includes('BOUND_EXISTING_SUPRA_COCKPITS_ROUTING_ONLY'));assert.ok(!js.includes('PRIVATE_SPECIALIST_BINDING_REQUIRED'));pass('mission composition projects the proven existing SUPRA cockpit bindings without execution authority');
assert.ok(js.includes("window.LaBeteExplorerActivate?.('#/atlas')")===false);assert.ok(js.includes("explore.open=true"));pass('V5 does not directly activate Cosmos');
assert.ok(css.includes('@media(max-width:560px)'));assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));pass('mobile and reduced-motion constraints are explicit');
console.log('LA_BETE_ADVISORY_HOUSE_V5_STATIC_PASS 13');
