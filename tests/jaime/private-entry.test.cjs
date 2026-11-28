'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assets = path.resolve(__dirname, '../../docs/jaime');
const Legacy = require(path.join(assets, 'legacy.js'));
const PRIVATE = 'https://jaime.nova-era.fr/ojo/jaime/';
const read = name => fs.readFileSync(path.join(assets, name), 'utf8');

function entry({existing = false, privateOrigin = false, broken = false, pathname} = {}) {
  const values = {
    jaime_local_proofs: JSON.stringify([{note:'SYNTHETIC_LOCAL_NOTE'}]),
    'matrix-session-fixture':'SYNTHETIC_NOT_A_REAL_SESSION'
  };
  if (existing) values[Legacy.PROFILE_KEY] = JSON.stringify({version:1, name:'Jaime', account_status:'created_local'});
  const before = JSON.stringify(values);
  const controls = Object.fromEntries(['entryForm','entryName','privateAccessChoice','oldProfileBox','oldProfileText','useOldProfile','entryError'].map(id => [id, {
    value:'Jaime', hidden:true, handlers:{},
    addEventListener(name, fn) {this.handlers[name] = fn;}, focus() {}
  }]));
  let writes = 0;
  const replaced = [], assigned = [];
  const storage = {
    getItem(key) {if (broken) throw Error('unavailable'); return values[key] || null;},
    setItem(key, value) {if (broken) throw Error('unavailable'); values[key] = value; writes++;}
  };
  const location = {
    origin:privateOrigin ? 'https://jaime.nova-era.fr' : 'https://nicolason84.github.io',
    pathname:pathname || (privateOrigin ? '/ojo/jaime/start.html' : '/nova-trust/jaime/start.html'),
    replace:value => replaced.push(value), assign:value => assigned.push(value)
  };
  vm.runInNewContext(read('start.js'), {
    document:{getElementById:id => controls[id]},
    window:{localStorage:storage, JaimeLegacy:Legacy, location, isSecureContext:false},
    navigator:{}
  });
  return {values, before, controls, replaced, assigned, writes:() => writes};
}

test('new and returning public users can choose the private app without any automatic navigation or storage mutation', () => {
  for (const existing of [false, true]) for (const pathname of ['/nova-trust/jaime/start.html','/nova-trust/jaime/']) {
    const f = entry({existing, pathname});
    assert.equal(f.controls.privateAccessChoice.hidden, false);
    assert.deepEqual(f.replaced, []); assert.deepEqual(f.assigned, []);
    assert.equal(f.writes(), 0); assert.equal(JSON.stringify(f.values), f.before);
  }
});

test('the existing private profile redirect is preserved; an unrelated public path is not treated as Jaime delivery', () => {
  for (const options of [{existing:true, privateOrigin:true}, {existing:true, pathname:'/another/start.html'}]) {
    const f = entry(options);
    assert.deepEqual(f.replaced, ['./index.html']); assert.equal(f.controls.privateAccessChoice.hidden, true);
  }
});

test('explicit local entry preserves notes and unrelated storage', () => {
  const f = entry({existing:true});
  f.controls.entryName.value = 'Mi nombre local';
  f.controls.entryForm.handlers.submit({preventDefault() {}});
  assert.deepEqual(f.assigned, ['./index.html']); assert.equal(f.writes(), 1);
  assert.equal(f.values.jaime_local_proofs, JSON.stringify([{note:'SYNTHETIC_LOCAL_NOTE'}]));
  assert.equal(f.values['matrix-session-fixture'], 'SYNTHETIC_NOT_A_REAL_SESSION');
});

test('storage failure leaves the private choice usable and never claims the local profile was saved', () => {
  const f = entry({broken:true});
  f.controls.entryForm.handlers.submit({preventDefault() {}});
  assert.equal(f.controls.privateAccessChoice.hidden, false);
  assert.equal(f.controls.entryError.hidden, false); assert.equal(f.writes(), 0);
  assert.deepEqual(f.assigned, []);
});

test('all private entry links use one fixed HTTPS URL, no payload, no referrer and no opener', () => {
  for (const name of ['start.html','index.html','instalar.html']) {
    const html = read(name);
    const links = [...html.matchAll(/<a\b[^>]*href="https:\/\/jaime\.nova-era\.fr[^"]*"[^>]*>/g)];
    assert.equal(links.length, 1, name);
    assert.ok(links[0][0].includes('href="' + PRIVATE + '"'));
    assert.match(links[0][0], /target="_blank"/);
    assert.match(links[0][0], /rel="noopener noreferrer"/);
    assert.ok(!html.includes(PRIVATE + '?')); assert.ok(!html.includes(PRIVATE + '#'));
  }
  assert.match(read('instalar.html'), /id="install-url"[^>]*value="https:\/\/jaime\.nova-era\.fr\/ojo\/jaime\/"/);
  assert.match(read('index.html'), /id="installGuide"[^>]*>En iPhone, abre primero tu asistente privado/);
});

function installer({standalone = false, privateOrigin = false, clipboard = true} = {}) {
  const ids = ['install-steps','instructions-link','open-link','install-link-card','installed-card','device-note','copy-link','install-url','copy-status'];
  const nodes = Object.fromEntries(ids.map(id => [id, {
    hidden:['installed-card','device-note','copy-link'].includes(id),
    value:id === 'install-url' ? PRIVATE : '', textContent:'', handlers:{},
    addEventListener(name, fn) {this.handlers[name] = fn;},
    focus() {this.focused = true;}, select() {this.selected = true;}, setSelectionRange() {}
  }]));
  const copied = [];
  vm.runInNewContext(read('instalar.js'), {
    document:{getElementById:id => nodes[id]},
    window:{matchMedia:() => ({matches:standalone}), isSecureContext:true,
      location:{origin:privateOrigin ? 'https://jaime.nova-era.fr' : 'https://nicolason84.github.io',
        pathname:privateOrigin ? '/ojo/jaime/instalar.html' : '/nova-trust/jaime/instalar.html'}},
    navigator:{userAgent:'iPhone', standalone,
      ...(clipboard ? {clipboard:{writeText:async value => {copied.push(value);}}} : {})}
  });
  return {nodes, copied};
}

test('an old public home-screen icon keeps private installation instructions visible', () => {
  const f = installer({standalone:true});
  assert.equal(f.nodes['install-steps'].hidden, false);
  assert.equal(f.nodes['install-link-card'].hidden, false);
  assert.equal(f.nodes['installed-card'].hidden, true);
  assert.match(f.nodes['device-note'].textContent, /libreta local/);
});

test('private standalone presentation retains its existing app-mode behavior', () => {
  const f = installer({standalone:true, privateOrigin:true});
  assert.equal(f.nodes['install-steps'].hidden, true);
  assert.equal(f.nodes['installed-card'].hidden, false);
});

test('copying the install link is explicit and copies only the fixed private destination', async () => {
  const f = installer();
  assert.deepEqual(f.copied, []);
  await f.nodes['copy-link'].handlers.click();
  assert.deepEqual(f.copied, [PRIVATE]);
  assert.equal(f.nodes['copy-link'].disabled, false);
});

test('clipboard failure leaves the correct URL selected for manual copying', async () => {
  const f = installer({clipboard:false});
  await f.nodes['copy-link'].handlers.click();
  assert.deepEqual(f.copied, []);
  assert.equal(f.nodes['install-url'].selected, true);
  assert.equal(f.nodes['install-url'].value, PRIVATE);
  assert.match(f.nodes['copy-status'].textContent, /Mantén pulsado/);
});
