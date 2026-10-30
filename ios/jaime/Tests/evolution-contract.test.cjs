'use strict';
// Compatibility checks against the existing shared client, never a second client.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dist = [path.resolve(__dirname, '../../app/dist'), path.resolve(__dirname, '../../../docs/jaime')]
  .find(p => fs.existsSync(path.join(p, 'ojo-evolution.js')));
assert.ok(dist, 'Shared Jaime client must exist in the same checkout');
const source = fs.readFileSync(path.join(dist, 'ojo-evolution.js'));
const provenance = JSON.parse(fs.readFileSync(path.join(dist, 'EVOLUTION_PROVENANCE.json'), 'utf8'));
const shared = require(path.join(dist, 'ojo-evolution.js'));
const key = 'nova:ojo:evolution:v1:jaime:personal';
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {getItem:k => values.has(k) ? values.get(k) : null, setItem:(k,v) => values.set(k,v), removeItem:k => values.delete(k)};
}
function client(store = storage()) {
  return shared.create({appId:'jaime', scope:'personal', storage:store, clock:() => '2026-10-30T04:40:00Z'});
}

test('iOS consumes the byte-identical shared client recorded by its existing provenance', () => {
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'), provenance.client_sha256);
  assert.equal(shared.VERSION, provenance.version);
  assert.equal(shared.METHOD_SHA, provenance.method_source_sha256);
});

test('a new client store starts without observation, preference or contribution permission', () => {
  const e = client();
  assert.deepEqual(e.consent(), {memory:false, observations:false, suggestions:false, technicalSharing:false});
  e.observe('CHAT_UNAVAILABLE');
  assert.equal(e.status().observationCount, 0);
  assert.throws(() => e.exportTechnical(), /TECHNICAL_SHARING_CONSENT_REQUIRED/);
  assert.equal(e.status().ownerConnection, 'CANDIDATE_NOT_CONNECTED');
  assert.equal(e.status().secondLoop, false);
});

test('technical export keeps the owner v1 contract and contains no private text or device fields', () => {
  const e = client();
  e.setConsent({observations:true, technicalSharing:true});
  assert.throws(() => e.observe('CHAT_UNAVAILABLE', 'private note'), /OBSERVATION_ENUM_REQUIRED/);
  assert.throws(() => e.observe('private note'), /OBSERVATION_ENUM_REQUIRED/);
  e.observe('CHAT_UNAVAILABLE');
  const out = e.exportTechnical();
  assert.deepEqual(Object.keys(out).sort(), ['schema','component','component_version','method','method_source_sha256','issue_codes','requested_action','privacy','contains_personal_data','automatic_promotion'].sort());
  assert.equal(out.schema, 'OJO_TECHNICAL_METHOD_CANDIDATE_V1');
  assert.equal(out.requested_action, 'QUALIFY_ONLY');
  assert.equal(out.automatic_promotion, false);
  assert.deepEqual(out.issue_codes, ['CHAT_UNAVAILABLE']);
  assert.equal(out.privacy, 'TECHNICAL_ENUMS_ONLY');
  assert.equal(out.contains_personal_data, false);
});

test('accepting a proposal never becomes execution or promotion in the iOS integration', () => {
  const e = client();
  e.setConsent({observations:true, suggestions:true});
  e.observe('CHAT_UNAVAILABLE');
  const suggestion = e.suggest()[0];
  const accepted = e.decide(suggestion.id, 'accept');
  assert.equal(accepted.status, 'APPROVED_NOT_EXECUTED');
  assert.equal(accepted.executed, false);
  assert.equal(accepted.requiresNativeValidation, true);
  assert.equal(e.status().automaticPromotion, false);
});

test('revocation clears observations; forgetting evolution preserves unrelated private records', () => {
  const store = storage({'existing-private-notebook':'untouched'}), e = client(store);
  e.setConsent({observations:true, technicalSharing:true}); e.observe('STORAGE_FAILURE');
  e.setConsent({observations:false, technicalSharing:false});
  assert.equal(e.status().observationCount, 0);
  assert.deepEqual(e.status().health, {});
  assert.throws(() => e.exportTechnical(), /TECHNICAL_SHARING_CONSENT_REQUIRED/);
  e.forget();
  assert.equal(store.getItem('existing-private-notebook'), 'untouched');
});

test('corrupt evolution state fails closed and is retained until explicit forget', () => {
  const raw = '{corrupt', store = storage({[key]:raw}), e = client(store);
  assert.equal(e.status().storage, 'CORRUPT_REQUIRES_FORGET');
  assert.equal(e.consent().technicalSharing, false);
  assert.throws(() => e.setConsent({technicalSharing:true}), /FORGET_CORRUPT_STATE_FIRST/);
  assert.equal(store.getItem(key), raw);
  e.forget(); assert.equal(store.getItem(key), null);
});
