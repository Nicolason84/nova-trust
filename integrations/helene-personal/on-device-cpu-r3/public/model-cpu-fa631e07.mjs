export const MODEL_ID='onnx-community/Qwen2.5-0.5B-Instruct';
export const MODEL_REVISION='516c8d04add8a80c5228f32102b57953b8d421a9';
export const ENGINE_FINGERPRINT='fa631e0762d75ac6a0d873b2073ced3ad1f5ded1b009835cbce2c2b0146503ec';
export const CONSENT='helene.on-device.cpu-consent.v1';
export const CONSENT_VALUE=ENGINE_FINGERPRINT;
export const HISTORICAL_MODELS=['Llama-3.2-1B-Instruct-q4f16_1-MLC',MODEL_ID];
export const LIB_URL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.web.js';
export const ORT_BASE='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/';
export const MODEL_URL='https://huggingface.co/'+MODEL_ID+'/resolve/'+MODEL_REVISION+'/';
export const MODEL_BYTES=512096557;
export function allowedAsset(input,init={}){
 const u=new URL(input instanceof URL?input.href:typeof input==='string'?input:input.url);
 const method=String(init.method||input?.method||'GET').toUpperCase();
 return ['GET','HEAD'].includes(method)&&!init.body&&!u.search&&!u.hash&&(u.href===LIB_URL||u.href===ORT_BASE+'ort-wasm-simd-threaded.asyncify.mjs'||u.href===ORT_BASE+'ort-wasm-simd-threaded.asyncify.wasm'||u.href.startsWith(MODEL_URL)&&!u.pathname.split('/').includes('..'));
}
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
        resolve({engine,release:async()=>{if(released)return;released=true;await engine.unload();unlock();}});
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
function workerEngine(){
 const worker=new Worker(new URL('./cpu-worker-fa631e07.mjs',import.meta.url),{type:'module',name:'helene-local-cpu'});
 const pending=new Map();let dead=false;
 const failAll=error=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(error)}pending.clear()};
 const terminate=()=>{if(dead)return;dead=true;worker.terminate();failAll(Error('Le calcul local a été interrompu. Ton message reste conservé.'))};
 worker.onerror=event=>{terminate();status('Erreur du moteur CPU : '+event.message)};
 worker.onmessage=event=>{
  const m=event.data;if(m?.engine_fingerprint!==ENGINE_FINGERPRINT)return;
  const p=pending.get(m.id);if(!p)return;
  if(m.type==='progress'){status(m.payload.stage==='generation'?'Réponse en cours sur le processeur du téléphone…':m.payload.percent!==undefined?'Téléchargement du modèle CPU : '+m.payload.percent+' %. Garde cette page ouverte.':'Préparation du modèle CPU…');return;}
  clearTimeout(p.timer);pending.delete(m.id);
  if(m.type==='result')p.resolve(m.payload);else p.reject(Error(m.payload?.message||m.payload?.code||'CPU_RUNTIME_ERROR'));
 };
 function call(operation,request){
  if(dead)return Promise.reject(Error('Le moteur local est arrêté. Reprends ta conversation.'));
  return new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timer=setTimeout(()=>{terminate();reject(Error('Le calcul CPU dépasse cinq minutes. Ton texte est conservé ; aucune réponse n’est inventée.'))},300000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,operation,request,engine_fingerprint:ENGINE_FINGERPRINT})});
 }
 const ready=call('init').catch(error=>{terminate();throw error});
 return {ready,chat:{completions:{create:request=>call('complete',request)}},async unload(){if(dead)return;await call('dispose');terminate()},interruptGenerate:terminate};
}
export async function loadModel(){
 if(loaded)return loaded;
 const consent=globalThis.document?.getElementById('local-consent');
 if(!consent?.checked&&localStorage.getItem(CONSENT)!==CONSENT_VALUE)throw Error('Cette correction utilise un autre modèle CPU : coche ton accord pour son téléchargement en Wi-Fi (environ 512 Mo).');
 if(!globalThis.isSecureContext||!globalThis.WebAssembly||!globalThis.Worker)throw Error('Ce navigateur ne fournit pas WebAssembly et les calculs locaux nécessaires. Aucun modèle téléchargé.');
 loaded=ownEngine(async()=>{
  const persisted=await navigator.storage?.persist?.();
  const el=document.getElementById('storage-status');if(el)el.textContent=persisted?'Stockage persistant accordé par Chrome. Conserve aussi un export de tes conversations.':'Chrome ne garantit pas le stockage persistant. Conserve régulièrement un export ; n’efface pas les données du navigateur.';
  const estimate=await navigator.storage?.estimate?.();
  const cached=await globalThis.caches?.match(MODEL_URL+'onnx/model_quantized.onnx',{cacheName:'helene-cpu-'+ENGINE_FINGERPRINT});
  if(!cached&&estimate?.quota&&estimate.quota-(estimate.usage||0)<1024**3)throw Error('Chrome ne dispose pas d’une marge de 1 Gio. Aucune donnée supprimée.');
  if(!cached&&!consent?.checked)throw Error('Le modèle CPU n’est plus en cache. Coche le téléchargement Wi-Fi pour le restaurer ; ton historique est conservé.');
  localStorage.setItem(CONSENT,CONSENT_VALUE);
  status('Préparation du moteur CPU, sans WebGPU…');
  const engine=workerEngine();await engine.ready;
  status('Modèle CPU chargé. Les messages sont traités sur ce téléphone.');return engine;
 }).then(lease=>{leases.set(lease.engine,lease);activeEngine=lease.engine;return lease.engine}).catch(error=>{loaded=null;status('Assistant CPU non chargé : '+error.message);throw error});
 return loaded;
}
