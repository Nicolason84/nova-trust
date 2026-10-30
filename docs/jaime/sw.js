'use strict';
const CACHE = 'ojo-jaime-shell-20261030-r2';
const FILES = ['index.html','start.html','app.css','app.js','start.js','core.js','economics.js','gateway.js','legacy.js','recorder.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
const urls = new Set(FILES.map(f => new URL(f, self.registration.scope).href));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...urls]))));
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
