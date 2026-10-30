'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const legacy = require('../../docs/jaime/legacy.js');
function storage(values = {}) {return {getItem:k => values[k] ?? null, setItem:(k,v) => {values[k] = v;}, values};}
test('recovers only the old local profile name, without promoting it to authenticated account', () => {
  const p = legacy.profile({account_status:'created_local',name:' Jaime ',email:'private@example.test',token:'never-copy',ts:'2026-06-01T12:00:00Z'});
  assert.equal(p.name,'Jaime'); assert.equal(p.createdAt,'2026-06-01T12:00:00Z');
  assert.equal(p.email,undefined); assert.equal(p.token,undefined); assert.equal(p.authenticated,undefined);
});
test('preserves old notes and profile when saving the independent Jaime profile', () => {
  const s = storage({nova_client_account_local:'original',jaime_local_proofs:'original-notes'});
  const p = legacy.saveProfile(s,' Jaime ');
  assert.equal(p.account_status,'created_local'); assert.equal(legacy.loadProfile(s).name,'Jaime');
  assert.equal(s.values.nova_client_account_local,'original'); assert.equal(s.values.jaime_local_proofs,'original-notes');
});
test('reports failed storage instead of claiming profile was saved', () => {
  assert.throws(() => legacy.saveProfile({setItem(){throw new Error('quota');}},'Jaime'),/quota/);
});
test('imports actual legacy export with safe plain text and original dates', () => {
  const p = legacy.proofs({source:'JAIME_APP_LOCAL_EXPORT',proofs:[{type:'Idea',note:'<img src=x onerror=alert(1)>',createdAt:'2026-06-06T10:00:00Z'}],actions:[{type:'message',label:'Llamar al proveedor',createdAt:'invalid'}]});
  assert.equal(p.entries.length,2); assert.equal(p.entries[0].text,'<img src=x onerror=alert(1)>'); assert.equal(p.entries[0].createdAt,'2026-06-06T10:00:00Z'); assert.equal(p.entries[1].createdAt,null);
  assert.equal(p.entries[0].key,legacy.proofs({source:'JAIME_APP_LOCAL_EXPORT',proofs:[{type:'Idea',note:'<img src=x onerror=alert(1)>',createdAt:'2026-06-06T10:00:00Z'}],actions:[]}).entries[0].key);
});
test('does not silently truncate or accept unrelated exports', () => {
  assert.throws(() => legacy.proofs({source:'OTHER',proofs:[],actions:[]}));
  assert.throws(() => legacy.proofs({source:'JAIME_APP_LOCAL_EXPORT',proofs:[{note:'x'.repeat(12001)}],actions:[]}),/12 000/);
  assert.throws(() => legacy.proofs({source:'JAIME_APP_LOCAL_EXPORT',proofs:Array(101).fill({note:'x'}),actions:[]}));
});
test('bad stored legacy data is non-destructive and surfaced', () => {
  const s = storage({nova_client_account_local:'{oops',jaime_local_proofs:'{oops'});
  const r = legacy.stored(s);
  assert.equal(r.profile,null); assert.equal(r.notes,null); assert.equal(r.unreadable,true);
  assert.equal(s.values.nova_client_account_local,'{oops');
});
