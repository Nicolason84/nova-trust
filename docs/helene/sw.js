/* Only the static app is cached. Personal elements remain in IndexedDB. */
const CACHE='ojo-helene-static-d0f6c37a852ad64a';
const ASSETS=["index.html", "styles.css", "app.mjs", "core.mjs", "device-client.mjs", "vendor/voice-capture.mjs", "icon.svg", "icon-192.png", "icon-512.png", "manifest.webmanifest"];
const urls=ASSETS.map(path=>new URL(path,self.registration.scope).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ojo-helene-static-')&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url),root=new URL(self.registration.scope);
 if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return;
 let target=new URL(url.pathname,root).href;
 if(url.pathname===root.pathname)target=new URL('index.html',root).href;
 if(!urls.includes(target))return;
 event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(target))||fetch(event.request)));
});
