// Ephemeral browser computation thread. No service, tools, identity or server.
import {MODEL_ID,MODEL_REVISION,ENGINE_FINGERPRINT,LIB_URL,ORT_BASE,allowedAsset} from './model-cpu-fa631e07.mjs';
const nativeFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=(input,init={})=>{
  if(!allowedAsset(input,init))return Promise.reject(Error('CPU_LOCAL_ONLY_NETWORK_REFUSED'));
  return nativeFetch(input,{...init,credentials:'omit',referrerPolicy:'no-referrer'});
};
let model=null,tokenizer=null,busy=false;
const emit=(id,type,payload)=>self.postMessage({id,type,payload,engine_fingerprint:ENGINE_FINGERPRINT});
async function initialize(id){
  const tf=await import(LIB_URL);
  tf.env.allowLocalModels=false;tf.env.allowRemoteModels=true;
  // TF4.3.2's tokenizer metadata probe omits options.revision. Bind even
  // that probe to the same admitted immutable revision, never to main.
  tf.env.remoteHost='https://huggingface.co/';
  tf.env.remotePathTemplate='{model}/resolve/'+MODEL_REVISION+'/';
  tf.env.useBrowserCache=true;tf.env.useWasmCache=true;tf.env.cacheKey='helene-cpu-'+ENGINE_FINGERPRINT;
  tf.env.fetch=globalThis.fetch;
  tf.env.backends.onnx.wasm.numThreads=1;
  tf.env.backends.onnx.wasm.proxy=false;
  tf.env.backends.onnx.wasm.wasmPaths={mjs:ORT_BASE+'ort-wasm-simd-threaded.asyncify.mjs',wasm:ORT_BASE+'ort-wasm-simd-threaded.asyncify.wasm'};
  const progress_callback=p=>{if(p.status==='progress'&&Number.isFinite(p.progress))emit(id,'progress',{stage:'download',percent:Math.round(p.progress)});else if(p.status==='initiate')emit(id,'progress',{stage:'download'});};
  const options={revision:MODEL_REVISION,progress_callback};
  tokenizer=await tf.AutoTokenizer.from_pretrained(MODEL_ID,options);
  model=await tf.AutoModelForCausalLM.from_pretrained(MODEL_ID,{...options,device:'wasm',dtype:'q8'});
  return {backend:'wasm',threads:1,model:MODEL_ID,revision:MODEL_REVISION};
}
async function completion(id,request){
  if(!model||!tokenizer)throw Error('CPU_MODEL_NOT_INITIALIZED');
  if(!Array.isArray(request?.messages)||request.messages.length<2||request.messages.some(x=>!['system','user','assistant'].includes(x.role)||typeof x.content!=='string'))throw Error('CPU_MESSAGES_REJECTED');
  let messages=request.messages.map(x=>({role:x.role,content:x.content})),inputs;
  for(;;){
    inputs=tokenizer.apply_chat_template(messages,{tokenize:true,return_dict:true,add_generation_prompt:true});
    if(inputs.input_ids.dims.at(-1)<=1536)break;
    if(messages.length<=2)throw Error('CPU_INPUT_TOKEN_LIMIT');
    messages.splice(1,Math.min(2,messages.length-2));
  }
  const promptTokens=inputs.input_ids.dims.at(-1),limit=Math.min(128,Math.max(16,Number(request.max_tokens)||128));
  emit(id,'progress',{stage:'generation'});
  const output=await model.generate({...inputs,max_new_tokens:limit,do_sample:false,return_dict_in_generate:true});
  const tensor=output.sequences??output,sequence=tensor.tolist()[0],generated=sequence.slice(promptTokens),tokens=generated.map(Number);
  const configEOS=model.generation_config?.eos_token_id??model.config?.eos_token_id??tokenizer.eos_token_id;
  const eos=(Array.isArray(configEOS)?configEOS:[configEOS]).filter(x=>x!==undefined&&x!==null).map(Number);
  const ended=eos.includes(tokens.at(-1));
  const reply=tokenizer.decode(tokens,{skip_special_tokens:true}).trim();
  return {choices:[{finish_reason:ended?'stop':'length',message:{role:'assistant',content:reply}}],usage:{prompt_tokens:promptTokens,completion_tokens:tokens.length},backend:'wasm',engine_fingerprint:ENGINE_FINGERPRINT};
}
self.onmessage=async event=>{
  const {id,operation,request,engine_fingerprint}=event.data??{};
  if(typeof id!=='string'||engine_fingerprint!==ENGINE_FINGERPRINT)return;
  if(busy){emit(id,'error',{code:'CPU_WORKER_BUSY'});return;}
  busy=true;
  try{
    if(operation==='init')emit(id,'result',await initialize(id));
    else if(operation==='complete')emit(id,'result',await completion(id,request));
    else if(operation==='dispose'){if(model)await model.dispose();model=null;tokenizer=null;emit(id,'result',{disposed:true});}
    else throw Error('CPU_OPERATION_REJECTED');
  }catch(error){emit(id,'error',{code:'CPU_RUNTIME_ERROR',message:String(error.message||error).slice(0,1200)});}
  finally{busy=false;}
};
