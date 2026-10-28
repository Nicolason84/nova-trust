'use strict';
const CACHE='deivid-page-20261028-project-studio-v2';
const BASE=new URL('./',self.location.href);
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.png','./pwa.js','./deivid-led-rules.js','./deivid-led.js','./deivid-led.css','./deivid-quote.js','./deivid-quote.css','./deivid-shell.css','./deivid-inputs.js','./deivid-inputs.css','./deivid-studio.js','./deivid-studio.css','./deivid-growth.js','./deivid-growth.css'].map(x=>new URL(x,BASE).href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('deivid-page-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
 const rel=url.pathname.slice(BASE.pathname.length);
 if(!(rel===''||['index.html','manifest.webmanifest','icon.png','pwa.js','deivid-led-rules.js','deivid-led.js','deivid-led.css','deivid-quote.js','deivid-quote.css','deivid-shell.css','deivid-inputs.js','deivid-inputs.css','deivid-studio.js','deivid-studio.css','deivid-growth.js','deivid-growth.css'].includes(rel)||/^r3_visual\/assets\/[a-z0-9-]+\/page-[0-9]+\.jpg$/.test(rel)))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(request,copy)));}return response;}).catch(async()=>await caches.match(request)||await caches.match(new URL('./',BASE).href)||await caches.match(new URL('index.html',BASE).href)));return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(request,copy)));}return response;})));
});
