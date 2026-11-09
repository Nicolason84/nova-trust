// Synthetic protocol tests ONLY. Real inference is the separate phone check.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LocalChatClient,KEY,contextFor,reserveConversation,digest} from './public/local-chat-client-cpu-5ce3d95c1118.mjs';
import {allowedAsset,MODEL_URL,ORT_BASE,LIB_URL,ownEngine,workerEngine,loadModel,ENGINE_FINGERPRINT,ENGINE_DESCRIPTOR,MODEL_ID,MODEL_REVISION,MODEL_BYTES,MODEL_SHA256,OPERATION_TIMEOUT_MS,CONSENT,CONSENT_VALUE,HISTORICAL_MODELS} from './public/model-cpu-r4-timeouts.mjs';
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}};
const locks=()=>{const entries=new Map();return {async request(k,o,f){let e=entries.get(k);if(!e){e={count:0,tail:Promise.resolve()};entries.set(k,e)}if(o.ifAvailable&&e.count)return f(null);const previous=e.tail;let release;e.tail=new Promise(r=>release=r);e.count++;await previous;try{return await f({name:k})}finally{e.count--;release();}}}};
function setup({storage=store(),mutex=locks(),reply=()=>({choices:[{finish_reason:'stop',message:{content:'SYNTHETIC_REPLY_FOR_PROTOCOL_TEST_ONLY'}}]})}={}){
  const calls=[],engine={chat:{completions:{async create(q){calls.push(q);return reply(q)}}},async unload(){},interruptGenerate(){}};
  return {storage,calls,client:new LocalChatClient({storage,locks:mutex,loader:async()=>engine,autoOpen:false}),mutex,engine};
}
test('reopen preserves all history and reuses earlier messages in actual completion input',async()=>{
  const a=setup();await a.client.connect();await a.client.send('TEST_SYNTHETIC_01');
  const before=a.storage.getItem(KEY),b=setup({storage:a.storage});await b.client.connect();
  assert.equal(b.client.rows.length,1);assert.equal(a.storage.getItem(KEY),before);
  await b.client.send('TEST_SYNTHETIC_02');
  assert.ok(b.calls[0].messages.some(r=>r.content==='TEST_SYNTHETIC_01'));
  assert.ok(b.calls[0].messages.some(r=>r.role==='assistant'&&r.content.includes('SYNTHETIC_REPLY')));
  assert.equal(b.client.rows.length,2);
});
test('provider error retains question, produces no assistant row and performs no retry',async()=>{
  const x=setup({reply:()=>{throw Error('INJECTED_MODEL_ERROR')}});await x.client.connect();
  await assert.rejects(x.client.send('QUESTION_TO_PRESERVE'),/INJECTED_MODEL_ERROR/);
  const d=JSON.parse(x.storage.getItem(KEY)).data;
  assert.equal(d.rows.length,0);assert.equal(d.attempts[0].message,'QUESTION_TO_PRESERVE');assert.equal(d.pending,null);assert.equal(x.calls.length,1);
});
test('incomplete output is never admitted as a complete assistant reply',async()=>{
  const x=setup({reply:()=>({choices:[{finish_reason:'length',message:{content:'INCOMPLETE_SYNTHETIC_OUTPUT'}}]})});await x.client.connect();
  await assert.rejects(x.client.send('TEST'),/incomplète/);assert.equal(x.client.rows.length,0);
});
test('corrupt historical bytes are preserved without reset or inference',async()=>{
  const x=setup();x.storage.setItem(KEY,'{"data":"CORRUPT"}');const before=x.storage.getItem(KEY);
  await assert.rejects(x.client.connect(),/intégrité/);assert.equal(x.storage.getItem(KEY),before);assert.equal(x.calls.length,0);
});
test('quota failure before generation does not call model or replace prior record',async()=>{
  const x=setup();await x.client.connect();await x.client.send('ORIGINAL');const before=x.storage.getItem(KEY),n=x.calls.length;
  x.storage.setItem=()=>{throw Error('INJECTED_QUOTA')};await assert.rejects(x.client.send('NEW'),/INJECTED_QUOTA/);
  assert.equal(x.storage.getItem(KEY),before);assert.equal(x.calls.length,n);
});
test('two windows cannot overwrite an in-flight request or invoke a second completion',async()=>{
  let release;const barrier=new Promise(r=>release=r),s=store(),mutex=locks();
  const a=setup({storage:s,mutex,reply:async()=>{await barrier;return {choices:[{finish_reason:'stop',message:{content:'SYNTHETIC_REPLY'}}]}}});
  const b=setup({storage:s,mutex});await a.client.connect();await b.client.connect();
  const running=a.client.send('WINDOW_A');while(a.calls.length===0)await new Promise(r=>setTimeout(r,1));
  await assert.rejects(b.client.send('WINDOW_B'),/autre fenêtre/);assert.equal(b.calls.length,0);release();await running;
  await b.client.history();assert.equal(b.client.rows.length,1);assert.equal(b.client.rows[0].user_message,'WINDOW_A');
});
test('closing an in-flight page preserves its question and never automatically repeats inference',async()=>{
  let release;const x=setup({reply:()=>new Promise(r=>release=r)});await x.client.connect();const running=x.client.send('INTERRUPTED_QUESTION');
  while(x.calls.length===0)await new Promise(r=>setTimeout(r,1));x.client.dispose();release({choices:[{finish_reason:'stop',message:{content:'LATE_SYNTHETIC_REPLY'}}]});
  await assert.rejects(running,/fermée/);
  const y=setup({storage:x.storage});await y.client.connect();const d=JSON.parse(y.storage.getItem(KEY)).data;
  assert.equal(d.rows.length,0);assert.equal(d.attempts[0].message,'INTERRUPTED_QUESTION');assert.equal(d.attempts[0].state,'INTERRUPTED');assert.equal(y.calls.length,0);
});
test('model context is bounded while full original history remains untouched',()=>{
  const rows=Array.from({length:10},(_,i)=>({user_message:'QUESTION_'+i,reply:'ANSWER_'+i}));const before=JSON.stringify(rows),m=contextFor(rows,'CURRENT');
  assert.equal(m.length,8);assert.equal(m[1].content,'QUESTION_7');assert.equal(m.at(-1).content,'CURRENT');assert.equal(JSON.stringify(rows),before);
});
test('network boundary permits pinned public assets only, rejects prompt bodies, queries and other origins',()=>{
  for(const u of [LIB_URL,(ORT_BASE+'ort-wasm-simd-threaded.asyncify.wasm'),MODEL_URL+'tokenizer.json',MODEL_URL+'onnx/model_quantized.onnx'])assert.equal(allowedAsset(u),true);
  for(const [u,o] of [[MODEL_URL+'tokenizer.json',{method:'POST',body:'PRIVATE'}],[MODEL_URL+'tokenizer.json?message=PRIVATE',{}],['https://example.com/PRIVATE',{}],[MODEL_URL.replace('huggingface.co','huggingface.co.evil.test')+'tokenizer.json',{}],[(ORT_BASE+'ort-wasm-simd-threaded.asyncify.wasm'),{body:'PRIVATE'}]])assert.equal(allowedAsset(u,o),false);
});
test('no native session or expiring authentication is fabricated for local UI',async()=>{
  const x=setup();await x.client.connect();assert.equal(x.client.state.local_device_only,true);assert.equal(x.client.state.native_actions,false);assert.equal(x.client.state.lease,undefined);assert.equal(x.client.state.authenticated,undefined);
});
test('phone qualification cannot obtain the personal conversation while a reply is in flight',async()=>{
  let release;const x=setup({reply:()=>new Promise(r=>release=r)});await x.client.connect();const running=x.client.send('PERSONAL_SYNTHETIC');
  while(x.calls.length===0)await new Promise(r=>setTimeout(r,1));let invoked=false;
  await assert.rejects(reserveConversation(()=>{invoked=true},x.mutex),/personnelle est en cours/);assert.equal(invoked,false);
  release({choices:[{finish_reason:'stop',message:{content:'SYNTHETIC_REPLY'}}]});await running;
});
test('one model allocation only across pages, and ownership releases only after GPU unload',async()=>{
  const mutex=locks();let created=0,unloadDone;const unloading=new Promise(r=>unloadDone=r);
  const a=await ownEngine(async()=>{created++;return {unload:()=>unloading}},mutex);
  await assert.rejects(ownEngine(async()=>{created++;return {}},mutex),/autre fenêtre/);assert.equal(created,1);
  const release=a.release();await assert.rejects(ownEngine(async()=>{created++;return {}},mutex),/autre fenêtre/);assert.equal(created,1);
  unloadDone();await release;await new Promise(r=>setTimeout(r,0));
  const b=await ownEngine(async()=>{created++;return {async unload(){}}},mutex);assert.equal(created,2);await b.release();
});
test('background releases model and foreground reopens the same history without authentication',async()=>{
  const x=setup();await x.client.connect();await x.client.send('PRESERVED_ON_BACKGROUND');const before=x.storage.getItem(KEY);
  await x.client.background();assert.equal(x.client.engine,null);assert.equal(x.client.state.session_active,false);assert.equal(x.storage.getItem(KEY),before);
  await x.client.foreground();assert.equal(x.client.state.session_active,true);assert.equal(x.client.rows[0].user_message,'PRESERVED_ON_BACKGROUND');assert.equal(x.storage.getItem(KEY),before);assert.equal(x.calls.length,1);
});
test('an unconfirmed GPU unload keeps other pages blocked until the owning page is closed',async()=>{
  const mutex=locks();let invoked=false;
  const a=await ownEngine(async()=>({async unload(){throw Error('INJECTED_GPU_UNLOAD_FAILURE')}}),mutex);
  await assert.rejects(a.release(),/INJECTED_GPU_UNLOAD_FAILURE/);
  await assert.rejects(ownEngine(async()=>{invoked=true;return {}},mutex),/autre fenêtre/);assert.equal(invoked,false);
});

test('historical Llama and Qwen2.5 tags remain byte-exact while new responses carry Qwen3 provenance',async()=>{
 for(const legacyModel of ['Llama-3.2-1B-Instruct-q4f16_1-MLC','onnx-community/Qwen2.5-0.5B-Instruct']){
 const x=setup();const row={turn:1,request_id:crypto.randomUUID(),user_message:'HISTORICAL_SYNTHETIC',reply:'HISTORICAL_REPLY',model:legacyModel,provider_response_complete:true};
 const data={schema:'HELENE_ON_DEVICE_CONVERSATION_V1',revision:1,rows:[row],attempts:[],pending:null};
 const raw=JSON.stringify({data,sha256:await digest(JSON.stringify(data))});x.storage.setItem(KEY,raw);
 await x.client.connect();assert.equal(x.storage.getItem(KEY),raw);assert.deepEqual(x.client.rows[0],row);
 await x.client.send('NEW_CPU_TURN');assert.deepEqual(x.client.rows[0],row);assert.equal(x.client.rows[1].model,MODEL_ID);assert.equal(x.client.rows[1].engine_fingerprint,ENGINE_FINGERPRINT);
 }
});
test('CPU dispose failure still terminates the owned thread and releases exclusive ownership',async()=>{
 let terminated=0;
 class SyntheticWorker{terminate(){terminated++}postMessage(m){queueMicrotask(()=>this.onmessage({data:{id:m.id,engine_fingerprint:ENGINE_FINGERPRINT,type:m.operation==='dispose'?'error':'result',payload:m.operation==='dispose'?{message:'INJECTED_DISPOSE_ERROR'}:{backend:'wasm'}}}))}}
 const mutex=locks(),a=await ownEngine(async()=>{const e=workerEngine({WorkerClass:SyntheticWorker});await e.ready;return e},mutex);
 await a.release();assert.equal(terminated,1);await new Promise(r=>setTimeout(r,0));
 const b=await ownEngine(async()=>({async unload(){}}),mutex);await b.release();
});

test('Qwen3 metadata fingerprint binds consent, revision, assets and CPU policy',async()=>{
 assert.equal(ENGINE_FINGERPRINT,await digest(JSON.stringify(ENGINE_DESCRIPTOR)));
 assert.equal(CONSENT_VALUE,ENGINE_FINGERPRINT);
 assert.equal(MODEL_ID,'onnx-community/Qwen3-0.6B-ONNX');
 assert.equal(MODEL_REVISION,'558750086ed49d78cb701ed6fa85af33fd16453f');
 assert.equal(MODEL_BYTES,617687575);
 assert.equal(MODEL_SHA256,'ccf8734e59fdf7475b2dc0c117005e267a3a08342c1d951e0a79f0bce57bf62a');
 assert.equal(ENGINE_DESCRIPTOR.backend,'wasm');assert.equal(ENGINE_DESCRIPTOR.dtype,'q8');assert.equal(ENGINE_DESCRIPTOR.threads,1);assert.equal(ENGINE_DESCRIPTOR.enable_thinking,false);
 assert.equal(ENGINE_DESCRIPTOR.input_token_limit,1536);assert.equal(ENGINE_DESCRIPTOR.max_new_tokens,128);assert.equal(ENGINE_DESCRIPTOR.do_sample,false);
 assert.ok(LIB_URL.includes('@'+ENGINE_DESCRIPTOR.transformers_js+'/'));
 assert.ok(ORT_BASE.includes('@'+ENGINE_DESCRIPTOR.onnxruntime_web+'/'));
 assert.equal(MODEL_URL,'https://huggingface.co/'+MODEL_ID+'/resolve/'+MODEL_REVISION+'/');
 assert.deepEqual(HISTORICAL_MODELS,['Llama-3.2-1B-Instruct-q4f16_1-MLC','onnx-community/Qwen2.5-0.5B-Instruct',MODEL_ID]);
 assert.equal(allowedAsset(MODEL_URL.replace(MODEL_REVISION,'main')+'tokenizer.json'),false);
});
test('Qwen3 hard thinking switch is on the template and CI expects this exact engine',async()=>{
 const worker=await readFile(new URL('./public/cpu-worker-r4-timeouts.mjs',import.meta.url),'utf8');
 assert.match(worker,/tokenizer\.apply_chat_template\(messages,\{[^}]*enable_thinking:false\}/);
 assert.match(worker,/device:ENGINE_DESCRIPTOR\.backend,dtype:ENGINE_DESCRIPTOR\.dtype/);
 const ci=await readFile(new URL('./ci-qualify-cpu.cjs',import.meta.url),'utf8');
 assert.ok(ci.includes("r.engine_fingerprint==='"+ENGINE_FINGERPRINT+"'"));
 assert.ok(ci.includes("r.model==='"+MODEL_ID+"'"));
});
test('cached consent for Qwen2.5 cannot authorize a Qwen3 model allocation',async()=>{
 const priorDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),priorStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const storage=store(),oldConsent='fa631e0762d75ac6a0d873b2073ced3ad1f5ded1b009835cbce2c2b0146503ec';storage.setItem(CONSENT,oldConsent);
 try{
  Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:()=>({checked:false})}});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
  await assert.rejects(loadModel(),/coche ton accord/);
  assert.equal(storage.getItem(CONSENT),oldConsent);
 }finally{
  if(priorDocument)Object.defineProperty(globalThis,'document',priorDocument);else delete globalThis.document;
  if(priorStorage)Object.defineProperty(globalThis,'localStorage',priorStorage);else delete globalThis.localStorage;
 }
});

test('draft survives a fresh client without changing confirmed history or invoking a model',async()=>{
 const a=setup();await a.client.connect();await a.client.send('CONFIRMED_HISTORY');
 const history=a.storage.getItem(KEY);await a.client.saveDraft('Mon brouillon à reprendre.');
 assert.equal(a.storage.getItem(KEY),history);
 const b=setup({storage:a.storage});assert.equal(await b.client.loadDraft(),'Mon brouillon à reprendre.');
 assert.equal(b.calls.length,0);assert.equal(b.storage.getItem(KEY),history);
});

test('draft can persist during a completion without altering its pending lineage',async()=>{
 let release;const a=setup({reply:()=>new Promise(r=>release=r)});await a.client.connect();
 const running=a.client.send('IN_FLIGHT_QUESTION');while(a.calls.length===0)await new Promise(r=>setTimeout(r,1));
 const history=a.storage.getItem(KEY);await a.client.saveDraft('Un autre texte, encore non envoyé.');
 assert.equal(a.storage.getItem(KEY),history);assert.equal(await a.client.loadDraft(),'Un autre texte, encore non envoyé.');
 release({choices:[{finish_reason:'stop',message:{content:'SYNTHETIC_REPLY'}}]});await running;
 assert.equal(await a.client.clearDraftIfMatches('IN_FLIGHT_QUESTION'),false);
 assert.equal(await a.client.loadDraft(),'Un autre texte, encore non envoyé.');
});

test('interrupted attempts are exposed after restart and manual draft recovery performs no replay',async()=>{
 let release;const a=setup({reply:()=>new Promise(r=>release=r)});await a.client.connect();
 const running=a.client.send('RECOVER_THIS_QUESTION');while(a.calls.length===0)await new Promise(r=>setTimeout(r,1));
 const priorID=JSON.parse(a.storage.getItem(KEY)).data.pending.request_id;a.client.dispose();
 release({choices:[{finish_reason:'stop',message:{content:'LATE_SYNTHETIC_REPLY'}}]});await assert.rejects(running,/fermée/);
 const b=setup({storage:a.storage});await b.client.connect();
 assert.equal(b.client.attempts.length,1);assert.equal(b.client.attempts[0].state,'INTERRUPTED');
 assert.equal(b.client.attempts[0].message,'RECOVER_THIS_QUESTION');assert.equal(b.calls.length,0);
 await b.client.saveDraft(b.client.attempts[0].message);assert.equal(b.calls.length,0);
 assert.equal(await b.client.loadDraft(),'RECOVER_THIS_QUESTION');
 await b.client.send(await b.client.loadDraft());assert.equal(b.calls.length,1);
 assert.notEqual(b.client.rows[0].request_id,priorID);assert.equal(b.client.attempts[0].request_id,priorID);
});

test('draft from another tab is not overwritten by a stale client',async()=>{
 const storage=store(),mutex=locks(),a=setup({storage,mutex}),b=setup({storage,mutex});
 await a.client.saveDraft('DRAFT_FROM_FIRST_TAB');const before=storage.getItem(a.client.draftKey);
 await assert.rejects(b.client.saveDraft('STALE_SECOND_TAB'),/autre onglet/);
 assert.equal(storage.getItem(a.client.draftKey),before);assert.equal(b.calls.length,0);
 assert.equal(await b.client.loadDraft(),'DRAFT_FROM_FIRST_TAB');
 await b.client.saveDraft('EXPLICITLY_CONTINUED_DRAFT');assert.equal(await b.client.loadDraft(),'EXPLICITLY_CONTINUED_DRAFT');
});

test('draft clears only the submitted text and preserves later edits',async()=>{
 const a=setup();await a.client.saveDraft('SUBMITTED');await a.client.saveDraft('NEW_EDIT');
 assert.equal(await a.client.clearDraftIfMatches('SUBMITTED'),false);assert.equal(await a.client.loadDraft(),'NEW_EDIT');
 assert.equal(await a.client.clearDraftIfMatches('NEW_EDIT'),true);assert.equal(await a.client.loadDraft(),'');
 assert.equal(a.storage.getItem(KEY),null);assert.equal(a.calls.length,0);
});

test('corrupt draft bytes are retained and cannot replace confirmed history',async()=>{
 const a=setup();await a.client.connect();await a.client.send('ORIGINAL');const history=a.storage.getItem(KEY);
 a.storage.setItem(a.client.draftKey,'{"corrupt":true}');const before=a.storage.getItem(a.client.draftKey);
 await assert.rejects(a.client.loadDraft(),/brouillon/);await assert.rejects(a.client.saveDraft('REPLACEMENT'),/brouillon/);
 assert.equal(a.storage.getItem(a.client.draftKey),before);assert.equal(a.storage.getItem(KEY),history);assert.equal(a.calls.length,1);
});

test('draft quota failure preserves its prior text and all confirmed history',async()=>{
 const a=setup();await a.client.connect();await a.client.send('ORIGINAL');await a.client.saveDraft('SAVED_DRAFT');
 const history=a.storage.getItem(KEY),draft=a.storage.getItem(a.client.draftKey);a.storage.setItem=()=>{throw Error('DRAFT_QUOTA')};
 await assert.rejects(a.client.saveDraft('UNSAVED_EDIT'),/DRAFT_QUOTA/);
 assert.equal(a.storage.getItem(a.client.draftKey),draft);assert.equal(a.storage.getItem(KEY),history);
});

function timedSyntheticEngine(){
 let clock=0,next=0;const timers=new Map(),scheduled=[],statuses=[],instances=[];
 const setTimer=(callback,delay)=>{const id=++next;timers.set(id,{callback,at:clock+delay});scheduled.push(delay);return id};
 const clearTimer=id=>timers.delete(id);
 const advance=milliseconds=>{clock+=milliseconds;for(const [id,timer] of [...timers]){if(timer.at<=clock){timers.delete(id);timer.callback();}}};
 class SyntheticWorker{
  constructor(url){this.url=url;this.requests=[];this.terminated=0;instances.push(this)}
  postMessage(request){this.requests.push(request)}
  terminate(){this.terminated++}
  respond(operation,payload={backend:'wasm'}){const request=this.requests.findLast(r=>r.operation===operation);assert.ok(request);this.onmessage({data:{id:request.id,engine_fingerprint:ENGINE_FINGERPRINT,type:'result',payload}})}
 }
 const engine=workerEngine({WorkerClass:SyntheticWorker,setTimer,clearTimer,onStatus:s=>statuses.push(s)});
 return {engine,worker:instances[0],timers,scheduled,statuses,advance};
}

test('R4 initialization allows twenty minutes and reports download timeout without loading a model',async()=>{
 assert.deepEqual(OPERATION_TIMEOUT_MS,{init:1200000,complete:300000,dispose:30000});
 const t=timedSyntheticEngine(),failure=assert.rejects(t.engine.ready,/téléchargement.*vingt minutes/);
 assert.ok(t.worker.url.pathname.endsWith('/cpu-worker-r4-timeouts.mjs'));
 assert.deepEqual(t.scheduled,[1200000]);t.advance(300000);assert.equal(t.worker.terminated,0);assert.equal(t.timers.size,1);
 t.advance(899999);assert.equal(t.worker.terminated,0);t.advance(1);await failure;
 assert.equal(t.worker.terminated,1);assert.equal(t.timers.size,0);
});

test('R4 completion retains five minutes and reports preserved text on timeout',async()=>{
 const t=timedSyntheticEngine();t.worker.respond('init');await t.engine.ready;
 const completion=t.engine.chat.completions.create({messages:[{role:'user',content:'SYNTHETIC_ONLY'}]});
 const failure=assert.rejects(completion,/réponse.*cinq minutes.*texte est conservé/);
 assert.deepEqual(t.scheduled,[1200000,300000]);t.advance(299999);assert.equal(t.worker.terminated,0);
 t.advance(1);await failure;assert.equal(t.worker.terminated,1);assert.equal(t.timers.size,0);
});

test('R4 dispose allows thirty seconds then terminates the thread with an explicit closure message',async()=>{
 const t=timedSyntheticEngine();t.worker.respond('init');await t.engine.ready;
 const closing=t.engine.unload();assert.deepEqual(t.scheduled,[1200000,30000]);
 t.advance(29999);assert.equal(t.worker.terminated,0);t.advance(1);await closing;
 assert.equal(t.worker.terminated,1);assert.equal(t.timers.size,0);
 assert.ok(t.statuses.some(s=>/fermeture.*trente secondes.*thread est arrêté/.test(s)));
});
