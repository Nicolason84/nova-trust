'use strict';
const cachePrefix='jaime.app-shell.'+new URL(self.registration.scope).pathname+'.';
const cacheName=cachePrefix+'dossier-20261120-r1';
const relative=["./","./index.html","./app.css","./app.webmanifest","./credentials.js","./portable.js","./google-config.js","./espacio.css","./espacio.js","./google-device.js","./google-account.js","./loader.js","./bridge.js","./icon-192.png","./icon-512.png","./edition.js","./dossier.js","./dossier.css"];
const files=new Set(relative.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',ev=>ev.waitUntil((async()=>{const cache=await caches.open(cacheName);await cache.addAll(relative.map(p=>new Request(new URL(p,self.registration.scope),{cache:'reload'})));await self.skipWaiting()})()));
self.addEventListener('activate',ev=>ev.waitUntil((async()=>{for(const n of await caches.keys())if(n.startsWith(cachePrefix)&&n!==cacheName)await caches.delete(n);await self.clients.claim()})()));
self.addEventListener('fetch',ev=>{
 const request=ev.request;
 if(request.method!=='GET')return;
 // Chromium can include the private invitation fragment in navigation events.
 // Only the canonical public asset may be looked up, fetched or cached.
 const address=new URL(request.url);
 address.hash='';
 const scope=new URL(self.registration.scope);
 if(address.origin!==scope.origin)return;
 if(['?inicio=gmail','?inicio=google','?dossier=1'].includes(address.search)&&address.pathname===scope.pathname)address.search='';
 if(['?v=13','?v=14'].includes(address.search)&&/\.(?:js|css)$/.test(address.pathname))address.search='';
 if(!files.has(address.href))return;
 ev.respondWith((async()=>{
   const cache=await caches.open(cacheName);
   const cached=await cache.match(address.href);
   return cached||fetch(address.href,{credentials:'omit',referrerPolicy:'no-referrer'});
 })());
});
