export const MODEL_ID='Llama-3.2-1B-Instruct-q4f16_1-MLC';
export const CONSENT='helene.on-device.model-consent.v1';
export const LIB_URL='https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.87/lib/index.js';
export const MODEL_URL='https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/2a37b0a5ecb622d51ddc2fac74de0b95872affd7/';
export const WASM_URL='https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/146ed9cd4b4062e967b017fd2291f7106b50599f/web-llm-models/v0_2_87/base/Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm';
export const APP_CONFIG={model_list:[{model_id:MODEL_ID,model:MODEL_URL,model_lib:WASM_URL,overrides:{context_window_size:4096}}],cacheBackend:'indexeddb'};
let loaded=null,activeEngine=null;
const leases=new WeakMap();
export async function ownEngine(create,locks=globalThis.navigator?.locks){
  if(!locks?.request)throw Error('La propriété du moteur ne peut pas être protégée dans ce navigateur.');
  let unlock;const held=new Promise(resolve=>unlock=resolve);
  return new Promise((resolve,reject)=>{
    locks.request('helene.on-device.model-owner.v1',{mode:'exclusive',ifAvailable:true},async lock=>{
      if(!lock){reject(Error('L\u2019assistant est déjà chargé dans une autre fenêtre. Reviens à cette fenêtre ou mets-y l\u2019assistant en pause.'));return;}
      try{
        const engine=await create();let released=false;
        resolve({engine,release:async()=>{if(released)return;released=true;try{await engine.unload()}finally{unlock()}}});
        await held;
      }catch(error){reject(error);}
    }).catch(reject);
  });
}
export async function forgetModel(engine){
  const lease=engine&&leases.get(engine);if(!lease)return;
  leases.delete(engine);if(activeEngine===engine){loaded=null;activeEngine=null;}await lease.release();
}
const status=s=>{const e=globalThis.document?.getElementById('download');if(e)e.textContent=s};
export function allowedAsset(input,init={}){
  const u=new URL(input instanceof URL?input.href:typeof input==='string'?input:input.url),method=String(init.method||input?.method||'GET').toUpperCase();
  return method==='GET'&&!init.body&&!u.search&&!u.hash&&(u.href===LIB_URL||u.href===WASM_URL||u.href.startsWith(MODEL_URL)&&!u.pathname.split('/').includes('..'));
}
export async function loadModel(){
  if(loaded)return loaded;
  const consent=globalThis.document?.getElementById('local-consent');
  if(!consent?.checked&&localStorage.getItem(CONSENT)!==MODEL_ID)throw Error('Lis le premier téléchargement puis coche ton accord pour préparer l\u2019assistant sur ce téléphone.');
  if(!globalThis.isSecureContext||!navigator.gpu)throw Error('WebGPU n\u2019est pas disponible ici. Mets Chrome à jour puis réessaie. Aucun modèle téléchargé.');
  loaded=ownEngine(async()=>{
    const adapter=await navigator.gpu.requestAdapter({powerPreference:'low-power'});
    if(!adapter||!adapter.features.has('shader-f16'))throw Error('Ce Chrome ou ce pilote graphique ne fournit pas encore le calcul nécessaire. Aucun modèle téléchargé.');
    const persisted=await navigator.storage?.persist?.();
    const storage=document.getElementById('storage-status');
    if(storage)storage.textContent=persisted?'Stockage persistant accordé par Chrome. Une sauvegarde exportée reste recommandée.':'Chrome ne garantit pas le stockage persistant. Exporte régulièrement une sauvegarde et n\u2019efface pas ses données.';
    const nativeFetch=globalThis.fetch.bind(globalThis);
    globalThis.fetch=(input,init={})=>{
      if(!allowedAsset(input,init))return Promise.reject(Error('LOCAL_ONLY_NETWORK_REFUSED'));
      return nativeFetch(input,{...init,credentials:'omit',referrerPolicy:'no-referrer'});
    };
    status('Vérification du moteur sur ce téléphone…');
    const webllm=await import(LIB_URL);
    const cached=await webllm.hasModelInCache(MODEL_ID,APP_CONFIG);
    if(!cached){
      if(!consent?.checked)throw Error('Le modèle n\u2019est plus en cache. Coche le téléchargement Wi-Fi pour le restaurer. Ton historique est conservé.');
      const estimate=await navigator.storage?.estimate?.();
      if(estimate?.quota&&estimate.quota-(estimate.usage||0)<1100*1024*1024)throw Error('Chrome ne dispose pas d\u2019une marge de 1,1 Gio pour ce téléchargement. Aucune donnée supprimée.');
    }
    localStorage.setItem(CONSENT,MODEL_ID);
    const engine=await webllm.CreateMLCEngine(MODEL_ID,{appConfig:APP_CONFIG,logLevel:'ERROR',initProgressCallback:p=>status('Préparation sur ce téléphone : '+Math.round(p.progress*100)+' %. Garde cette page ouverte.')});
    status('Modèle chargé sur ce téléphone. Aucun message envoyé à un serveur d\u2019IA.');return engine;
  }).then(lease=>{leases.set(lease.engine,lease);activeEngine=lease.engine;return lease.engine}).catch(error=>{loaded=null;status('Assistant non chargé : '+error.message);throw error});
  return loaded;
}
