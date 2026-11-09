// Synthetic protocol tests ONLY. Real inference is the separate phone check.
import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalChatClient,KEY,contextFor,reserveConversation,digest} from './public/local-chat-client-cpu-7cc4d38b.mjs';
import {allowedAsset,MODEL_URL,ORT_BASE,LIB_URL,ownEngine,workerEngine,ENGINE_FINGERPRINT} from './public/model-cpu-7cc4d38b.mjs';
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}};
const locks=()=>{let held=false;return {async request(k,o,f){if(held)return f(null);held=true;try{return await f({name:k})}finally{held=false}}}};
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

test('historical Llama records remain readable byte-exact while new responses carry CPU provenance',async()=>{
 const x=setup();const row={turn:1,request_id:crypto.randomUUID(),user_message:'HISTORICAL_SYNTHETIC',reply:'HISTORICAL_REPLY',model:'Llama-3.2-1B-Instruct-q4f16_1-MLC',provider_response_complete:true};
 const data={schema:'HELENE_ON_DEVICE_CONVERSATION_V1',revision:1,rows:[row],attempts:[],pending:null};
 const raw=JSON.stringify({data,sha256:await digest(JSON.stringify(data))});x.storage.setItem(KEY,raw);
 await x.client.connect();assert.equal(x.storage.getItem(KEY),raw);assert.deepEqual(x.client.rows[0],row);
 await x.client.send('NEW_CPU_TURN');assert.deepEqual(x.client.rows[0],row);assert.equal(x.client.rows[1].model,'onnx-community/LFM2.5-350M-ONNX');assert.match(x.client.rows[1].engine_fingerprint,/^[a-f0-9]{64}$/);
});
test('CPU dispose failure still terminates the owned thread and releases exclusive ownership',async()=>{
 let terminated=0;
 class SyntheticWorker{terminate(){terminated++}postMessage(m){queueMicrotask(()=>this.onmessage({data:{id:m.id,engine_fingerprint:ENGINE_FINGERPRINT,type:m.operation==='dispose'?'error':'result',payload:m.operation==='dispose'?{message:'INJECTED_DISPOSE_ERROR'}:{backend:'wasm'}}}))}}
 const mutex=locks(),a=await ownEngine(async()=>{const e=workerEngine({WorkerClass:SyntheticWorker});await e.ready;return e},mutex);
 await a.release();assert.equal(terminated,1);await new Promise(r=>setTimeout(r,0));
 const b=await ownEngine(async()=>({async unload(){}}),mutex);await b.release();
});
