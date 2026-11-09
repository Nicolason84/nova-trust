/* Application files only. This worker never opens or removes personal databases. */
const CACHE='ojo-helene-static-82f9431b0ab5007a';
const ASSETS=["index.html","ouvrir.html","assets/app-EX2F5PGX.js","assets/style-618e9397d2201311.css","vendor/ojo-evolution.js","icon.svg","icon-192.png","icon-512.png","manifest.webmanifest","assets/app-82F9431B0AB5007A.js","conversation-locale/index.html","conversation-locale/chat.css","conversation-locale/model-cpu-r4-timeouts.mjs","conversation-locale/cpu-worker-r4-timeouts.mjs","conversation-locale/local-chat-client-cpu-5ce3d95c1118.mjs","conversation-locale/chat-ui-cpu-f339ea99f34d.mjs","conversation-locale/phone-check-cpu-ce9ff82c5a50.mjs"];
const urls=ASSETS.map(path=>new URL(path,self.registration.scope).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(urls.map(url=>new Request(url,{cache:'reload'})));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await self.clients.claim();
 const keys=await caches.keys();
 await Promise.all(keys.filter(key=>key.startsWith('ojo-helene-static-')&&key!==CACHE).map(key=>caches.delete(key)));
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url),root=new URL(self.registration.scope);
 if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return;
 let target=new URL(url.pathname,root).href;
 if(url.pathname===root.pathname)target=new URL('index.html',root).href;
 if(!urls.includes(target))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const response=await fetch(event.request,{cache:'no-store'});
   if(response.ok)event.waitUntil(cache.put(target,response.clone()));
   return response;
  }catch(error){
   const saved=await cache.match(target);
   if(saved)return saved;
   return new Response('Une connexion est nécessaire pour ouvrir cette version une première fois. Tes éléments enregistrés sont conservés.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }
 })());
});
