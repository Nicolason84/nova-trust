'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dist = [path.join(__dirname, '../dist'), path.join(__dirname, '../../docs/jaime')]
  .find(candidate => fs.existsSync(path.join(candidate, 'sw.js')));
assert.ok(dist, 'Jaime public assets are required');
const scope = 'https://example.test/nova-trust/jaime/';

function worker({network, cached} = {}) {
  const handlers = {}, writes = [], installed = [];
  const cache = {addAll: async urls => installed.push(...urls), put: async (key, value) => writes.push([key, value])};
  vm.runInNewContext(fs.readFileSync(path.join(dist, 'sw.js'), 'utf8'), {
    self: {registration: {scope}, location: {origin: 'https://example.test'}, addEventListener: (type, fn) => {handlers[type] = fn;}},
    URL, Response, Set, Promise,
    caches: {open: async () => cache, match: async () => cached, keys: async () => [], delete: async () => true},
    fetch: network || (async () => {throw new Error('offline');})
  });
  async function request(url, method = 'GET') {
    let result, handled = false; const pending = [];
    handlers.fetch({request: {url, method}, respondWith: promise => {handled = true; result = promise;}, waitUntil: promise => pending.push(promise)});
    const response = await result; await Promise.all(pending);
    return {handled, response};
  }
  return {handlers, request, writes, installed};
}

test('iPhone shell precaches only existing public local assets, including installation', async () => {
  const w = worker(); let pending;
  w.handlers.install({waitUntil: value => {pending = value;}}); await pending;
  for (const url of w.installed) {
    assert.ok(url.startsWith(scope));
    const relative = url.slice(scope.length);
    assert.ok(fs.statSync(path.join(dist, relative)).isFile(), relative);
    assert.ok(!/\.mp3$|^api\/|token|upload/.test(relative));
  }
  for (const file of ['instalar.html', 'instalar.css', 'instalar.js', 'ios-compat.css', 'apple-touch-icon.png']) {
    assert.ok(w.installed.includes(scope + file));
  }
});

test('private, API, external, query and write requests never enter the shell cache', async () => {
  const w = worker();
  for (const [url, method] of [
    [scope+'api/messages','GET'], [scope+'private-document.pdf','GET'],
    ['https://matrix.example.test/_matrix/client/v3/sync','GET'],
    [scope+'index.html?token=private','GET'], [scope+'instalar.html','POST'],
    [scope+'audio/taurino/episodio-01.mp3','GET']
  ]) assert.equal((await w.request(url, method)).handled, false, url);
  assert.equal(w.writes.length, 0);
});

test('installation page is available from the existing public cache after network failure', async () => {
  const cached = new Response('<h1>Instalar</h1>');
  const {handled, response} = await worker({cached}).request(scope+'instalar.html');
  assert.equal(handled, true); assert.equal(response, cached);
});

test('missing offline assets return an honest connection error', async () => {
  const {response} = await worker().request(scope+'instalar.html');
  assert.equal(response.status, 503);
  assert.match(await response.text(), /Sin conexión/);
});

test('only successful same-origin unredirected responses update the shell cache', async () => {
  const good = {ok:true, type:'basic', redirected:false, url:scope+'instalar.html', clone:()=>'public-copy'};
  const w = worker({network:async () => good});
  await w.request(scope+'instalar.html');
  assert.deepEqual(w.writes, [[scope+'instalar.html','public-copy']]);
  for (const response of [{...good,redirected:true},{...good,ok:false},{...good,url:'https://other.example/private'},{...good,type:'opaque'}]) {
    const rejected = worker({network:async () => response}); await rejected.request(scope+'instalar.html');
    assert.equal(rejected.writes.length, 0);
  }
});
