import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../docs/helene/sw.js',import.meta.url),'utf8');
const base='https://example.invalid/nova-trust/helene/';
function worker({online=true,networkText='new release',cachedText='old release'}={}){
 const events={},puts=[],deleted=[],added=[],calls=[];let skipped=false,claimed=false;
 const cache={addAll:async list=>added.push(...list),put:async(key,response)=>puts.push({key,text:await response.text()}),match:async()=>cachedText===null?undefined:new Response(cachedText)};
 const context={URL,Request,Response,Promise,caches:{open:async()=>cache,keys:async()=>['unrelated-app','ojo-helene-static-old'],delete:async name=>deleted.push(name)},fetch:async(request,options)=>{calls.push(options);if(!online)throw Error('Offline fixture');return new Response(networkText)},self:{registration:{scope:base},clients:{claim:async()=>{claimed=true}},skipWaiting:async()=>{skipped=true},addEventListener:(name,fn)=>events[name]=fn}};
 vm.runInNewContext(source,context);
 async function lifecycle(name){const waits=[];events[name]({waitUntil:p=>waits.push(p)});await Promise.all(waits)}
 async function request(path='',method='GET'){
  const waits=[];let response;
  events.fetch({request:new Request(new URL(path,base),{method}),waitUntil:p=>waits.push(p),respondWith:p=>response=p});
  const value=await response;await Promise.all(waits);return value;
 }
 return {request,lifecycle,puts,deleted,added,calls,skipped:()=>skipped,claimed:()=>claimed};
}
test('mise à jour : en ligne, la nouvelle réponse passe avant une ancienne page en cache',async()=>{
 const w=worker(),response=await w.request();assert.equal(await response.text(),'new release');assert.equal(w.calls[0].cache,'no-store');assert.equal(w.puts[0].text,'new release');
});
test('hors ligne : une page préservée reste accessible ; un premier accès manquant reste explicite',async()=>{
 assert.equal(await (await worker({online:false}).request()).text(),'old release');
 const response=await worker({online:false,cachedText:null}).request();assert.equal(response.status,503);assert.match(await response.text(),/éléments enregistrés sont conservés/);
});
test('activation : la nouvelle version prend les requêtes, seuls les caches statiques ojO sont retirés',async()=>{
 const w=worker();await w.lifecycle('install');await w.lifecycle('activate');assert.equal(w.skipped(),true);assert.equal(w.claimed(),true);assert.deepEqual(w.deleted,['ojo-helene-static-old']);assert.ok(w.added.some(r=>r.url.endsWith('/ouvrir.html')));assert.ok(w.added.every(r=>r.cache==='reload'));
 assert.equal(source.includes('indexedDB.'),false);
});
test('les fichiers étrangers au périmètre et les écritures ne sont pas interceptés',async()=>{
 const w=worker();assert.equal(await w.request('https://another.invalid/app'),undefined);assert.equal(await w.request('private-record-not-an-asset'),undefined);assert.equal(await w.request('','POST'),undefined);
});
test('le lien direct utilise des noms de ressources que le cache de la première version ne capture pas',async()=>{
 const html=await readFile(new URL('../docs/helene/ouvrir.html',import.meta.url),'utf8');
 assert.match(html,/src="assets\/app-[A-Z0-9]+\.js"/);assert.match(html,/href="assets\/style-[a-f0-9]+\.css"/);assert.match(html,/Version 30\.10\.1/);assert.equal(html.includes('src="app.mjs"'),false);assert.equal(html.includes('href="styles.css"'),false);
 const app=await readFile(new URL('../docs/helene/app.mjs',import.meta.url),'utf8');
 const asset=html.match(/src="(assets\/app-[A-Z0-9]+\.js)"/)[1];
 const bundle=await readFile(new URL('../docs/helene/'+asset,import.meta.url),'utf8');
 assert.match(app,/VERSION 30\.10\.1/);assert.match(bundle,/VERSION 30\.10\.1/);
 assert.equal([html,app,bundle].some(text=>text.includes('28.10.2')),false);
 assert.ok(source.includes(asset),'The worker must cache the bundle selected by the page.');
});
