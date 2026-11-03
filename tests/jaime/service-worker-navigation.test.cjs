'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const evidence = path.join(__dirname, 'service-worker-navigation-evidence');
const candidate = fs.readFileSync(path.join(__dirname, '../../docs/jaime/sw.js'), 'utf8');
const preimage = fs.readFileSync(path.join(evidence, 'sw.preimage.js'), 'utf8');
const fixture = JSON.parse(fs.readFileSync(path.join(evidence, 'owner-authority-predicate.fixture.json'), 'utf8'));
const digest = source => crypto.createHash('sha256').update(source).digest('hex');
let {entry, rejection} = fixture;
// When both repositories are available, also verify the current owner source.
// The portable fixture records only reviewed technical code and its provenance.
if (process.env.JAIME_OWNER_SOURCE) {
  const lines = fs.readFileSync(process.env.JAIME_OWNER_SOURCE, 'utf8').split('\n');
  entry = lines.find(line => line.includes("const entry=req.method==='GET'"))?.trim();
  rejection = lines.find(line => line.includes("return deny(403,'JAIME_BROWSER_AUTHORITY_REJECTED')"))?.trim();
}
assert.equal(digest(`${entry}\n${rejection}`), fixture.predicate_sha256, 'Review any change to the owner authority guard');
const condition = rejection.replace(/^if\(/, '').replace(/\)return deny\(403,'JAIME_BROWSER_AUTHORITY_REJECTED'\);$/, '');
const rejectAuthority = new Function('req', 'c', 'count', `${entry}\nreturn (${condition});`);
const count = (req, name) => req.rawHeaders.reduce((n, value, index) => n + (index % 2 === 0 && value.toLowerCase() === name ? 1 : 0), 0);
function rejected({method = 'GET', site = 'cross-site', mode = 'navigate', destination = 'document', origin} = {}) {
  const headers = {'sec-fetch-site': site, 'sec-fetch-mode': mode, 'sec-fetch-dest': destination};
  if (origin !== undefined) headers.origin = origin;
  return !!rejectAuthority({method, headers, rawHeaders: Object.entries(headers).flat()}, {publicOrigin: 'https://jaime.nova-era.fr'}, count);
}

const privateScopes = ['https://jaime.nova-era.fr/ojo/jaime/', 'https://tony.nova-era.fr/ojo/jaime-owner-test/'];
const publicScope = 'https://nicolason84.github.io/nova-trust/jaime/';
function worker({scope = publicScope, source = candidate, network, cached, oldCaches = []} = {}) {
  const handlers = {}, calls = [], writes = [], installed = [], reads = [], deleted = [], opened = [];
  const cache = {addAll: async urls => installed.push(...urls), put: async (key, value) => writes.push([key, value])};
  vm.runInNewContext(source, {
    self: {registration: {scope}, location: {origin: new URL(scope).origin}, addEventListener: (kind, fn) => {handlers[kind] = fn;}},
    URL, Response, Set, Promise,
    caches: {
      open: async name => {opened.push(name); return cache;},
      match: async key => {reads.push(key); return cached;},
      keys: async () => oldCaches,
      delete: async name => {deleted.push(name); return true;},
    },
    fetch: async request => {calls.push(request); if (network) return network(request); throw new Error('offline fixture');},
  });
  async function request(relative, options = {}) {
    const input = {url: new URL(relative, scope).href, method: 'GET', mode: 'navigate', destination: 'document', ...options};
    let responsePromise, handled = false;
    const pending = [];
    handlers.fetch({request: input, respondWith: value => {handled = true; responsePromise = value;}, waitUntil: value => pending.push(value)});
    const response = await responsePromise;
    await Promise.all(pending);
    return {handled, response, input};
  }
  async function lifecycle(kind) {
    const pending = [];
    handlers[kind]({waitUntil: value => pending.push(value)});
    await Promise.all(pending);
  }
  return {request, lifecycle, calls, writes, installed, reads, deleted, opened};
}

test('reviewed owner guard rejects the real WPT passthrough tuple and permits a native document entry', () => {
  // These tuples were observed in the public Chromium WPT. This is a source
  // predicate test, not a claim that the historical Cloudflare headers were captured.
  assert.equal(rejected(), false);
  assert.equal(rejected({destination: 'empty'}), true);
  assert.equal(rejected({site: 'same-site', destination: 'empty'}), true);
  assert.equal(rejected({site: 'none', destination: 'empty'}), false);
  assert.equal(rejected({site: 'same-origin', destination: 'empty'}), false);
  assert.equal(rejected({mode: 'cors', destination: 'empty'}), true);
});

test('baseline intercepts private navigation; candidate preserves the browser request for both private scopes', async () => {
  for (const scope of privateScopes) {
    const baseline = worker({scope, source: preimage, cached: new Response('baseline shell')});
    assert.equal((await baseline.request('start.html')).handled, true);
    assert.equal(baseline.calls.length, 1);
    for (const file of ['', 'start.html', 'index.html', 'instalar.html', 'mensajes.html', 'universos.html', 'taurino.html']) {
      const fixed = worker({scope, cached: new Response('cached private shell')});
      assert.equal((await fixed.request(file)).handled, false, scope + file);
      assert.equal(fixed.calls.length, 0);
      assert.equal(fixed.reads.length, 0);
      assert.equal(fixed.writes.length, 0);
    }
  }
});

test('cross-site iframe and POST remain browser-native and rejected by the unchanged authority guard', async () => {
  assert.equal(rejected({destination: 'iframe'}), true);
  assert.equal(rejected({method: 'POST'}), true);
  assert.equal(rejected({origin: 'https://foreign.example'}), true);
  for (const scope of privateScopes) {
    const fixed = worker({scope});
    assert.equal((await fixed.request('start.html', {destination: 'iframe'})).handled, false);
    assert.equal((await fixed.request('start.html', {method: 'POST'})).handled, false);
    assert.equal(fixed.calls.length, 0);
  }
});

test('private navigation does not fall back to a cached document while authentication or network is unavailable', async () => {
  for (const scope of privateScopes) {
    const fixed = worker({scope, cached: new Response('old authenticated shell')});
    const result = await fixed.request('index.html');
    assert.equal(result.handled, false);
    assert.equal(result.response, undefined);
    assert.equal(fixed.reads.length, 0);
  }
});

test('public offline document navigation keeps the existing cache fallback including the root alias', async () => {
  for (const file of ['', 'start.html', 'index.html', 'instalar.html']) {
    const cached = new Response('public offline shell');
    const fixed = worker({cached});
    const result = await fixed.request(file);
    assert.equal(result.handled, true);
    assert.equal(result.response, cached);
    assert.deepEqual(fixed.reads, [new URL(file || 'index.html', publicScope).href]);
  }
});

test('public cache misses retain the honest offline response', async () => {
  const result = await worker().request('instalar.html');
  assert.equal(result.handled, true);
  assert.equal(result.response.status, 503);
  assert.match(await result.response.text(), /Sin conexión/);
});

test('private static assets still use the existing successful response cache rules', async () => {
  const scope = privateScopes[0];
  const good = {ok: true, type: 'basic', redirected: false, url: scope + 'app.css', clone: () => 'static copy'};
  const fixed = worker({scope, network: async () => good});
  assert.equal((await fixed.request('app.css', {mode: 'no-cors', destination: 'style'})).handled, true);
  assert.deepEqual(fixed.writes, [[scope + 'app.css', 'static copy']]);
  for (const response of [{...good, redirected: true}, {...good, ok: false}, {...good, type: 'opaque'}, {...good, url: 'https://foreign.example/app.css'}]) {
    const refused = worker({scope, network: async () => response});
    await refused.request('app.css', {mode: 'no-cors', destination: 'style'});
    assert.equal(refused.writes.length, 0);
  }
});

test('API, unknown, external, query, hash and write requests do not enter the shell transport or cache', async () => {
  for (const scope of [publicScope, ...privateScopes]) {
    const fixed = worker({scope});
    for (const [file, options] of [
      ['v1/ojo/personal/session', {mode: 'cors', destination: '', method: 'POST'}],
      ['v1/ojo/personal/status', {mode: 'cors', destination: ''}],
      ['private-document.pdf', {mode: 'cors', destination: ''}],
      ['https://foreign.example/app.css', {mode: 'no-cors', destination: 'style'}],
      ['index.html?resume=example', {mode: 'same-origin', destination: ''}],
      ['index.html#fragment', {mode: 'same-origin', destination: ''}],
      ['start.html', {method: 'POST'}],
    ]) assert.equal((await fixed.request(file, options)).handled, false, scope + file);
    assert.equal(fixed.calls.length, 0);
    assert.equal(fixed.reads.length, 0);
    assert.equal(fixed.writes.length, 0);
  }
});

test('precache assets stay identical and worker activation remains unforced', async () => {
  for (const scope of [publicScope, ...privateScopes]) {
    const oldWorker = worker({scope, source: preimage});
    const newWorker = worker({scope});
    await oldWorker.lifecycle('install');
    await newWorker.lifecycle('install');
    assert.deepEqual(newWorker.installed, oldWorker.installed);
    assert.notEqual(newWorker.opened[0], oldWorker.opened[0]);
    assert.match(newWorker.opened[0], /^ojo-jaime-shell-/);
  }
  // The fixture exposes no skipWaiting() or clients.claim(); either call would
  // throw during the executed lifecycle. No automatic client takeover is added.
  const active = worker({oldCaches: ['ojo-jaime-shell-20261030-r10-recovery-p0', 'unrelated-app-cache']});
  await active.lifecycle('activate');
  assert.deepEqual(active.deleted, ['ojo-jaime-shell-20261030-r10-recovery-p0']);
});
