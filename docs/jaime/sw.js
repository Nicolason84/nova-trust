'use strict';
const CACHE = 'ojo-jaime-shell-20261030-r8-private-entry-p0';
const FILES = ['instalar.html','instalar.css','instalar.js','ios-compat.css','apple-touch-icon.png','index.html','start.html','mensajes.html','universos.html','app.css','redesign.css','workspace.css','universos.css','secure-messaging.css','secure-page.css','communications.js','workspace.js','ojo-evolution.js','evolution-ui.js','app.js','start.js','core.js','economics.js','gateway.js','legacy.js','recorder.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','secure/universos.js','taurino.html','taurino.css','secure/taurino.js','data/taurino-content.json','data/taurino-feed.json'];
// The large Matrix client and content-pinned WASM are cached only after use.
// This list never includes API requests, messages, tokens, uploads or user files.
const LAZY = ['secure/messenger.js','secure/pkg/matrix-crypto-18.9.0-e6fc166a85fc6aef.wasm'];
const initial = FILES.map(f => new URL(f, self.registration.scope).href);
const urls = new Set([...FILES,...LAZY].map(f => new URL(f, self.registration.scope).href));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(initial))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ojo-jaime-shell-') && k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const u = new URL(request.url);
  if (u.origin !== self.location.origin || u.search || u.hash) return;
  const entry = u.href === self.registration.scope ? new URL('index.html', self.registration.scope).href : u.href;
  if (!urls.has(entry)) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === 'basic' && !response.redirected && new URL(response.url).origin === u.origin) {
      const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(entry, copy)));
    }
    return response;
  }).catch(async () => (await caches.match(entry)) || new Response('Sin conexión. Abre esta página una vez con Internet.', {status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})));
});
