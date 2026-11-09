// Local browser client for the existing Hélène UI. No native admission,
// remote account, connector, tool or server authority is represented here.
import {loadModel,forgetModel,MODEL_ID,HISTORICAL_MODELS,ENGINE_FINGERPRINT} from './model-cpu-fa631e07.mjs';
export const KEY='helene.on-device.conversation.v1';
export async function reserveConversation(action,locks=globalThis.navigator?.locks){
  if(!locks?.request)throw Error('La réservation de cette conversation est indisponible.');
  return locks.request(KEY,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock)throw Error('Une conversation personnelle est en cours. Termine-la avant le contrôle technique.');
    return action();
  });
}
const encoder=new TextEncoder();
const bytes=s=>encoder.encode(s).length;
const uuid=/^[0-9a-f-]{36}$/;
export const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const empty=()=>({schema:'HELENE_ON_DEVICE_CONVERSATION_V1',revision:0,rows:[],attempts:[],pending:null});
export function contextFor(rows,message){
  const history=[];let size=0;
  for(const r of rows.slice(-3).reverse()){
    const n=bytes(r.user_message)+bytes(r.reply);if(size+n>6000)break;
    history.unshift({role:'user',content:r.user_message},{role:'assistant',content:r.reply});size+=n;
  }
  return [{role:'system',content:'Tu es ojO, un assistant personnel bienveillant. Réponds en français, simplement et précisément. Tiens compte des messages précédents. N\u2019invente pas de faits personnels, de souvenirs, d\u2019accès à Internet ou d\u2019actions effectuées. Tu ne peux ni accéder aux autres données du téléphone ni agir à la place de la personne. Si tu ne sais pas, dis-le. Ne donne pas de diagnostic médical.'},...history,{role:'user',content:message}];
}
export class LocalChatClient{
  constructor({onChange=()=>{},storage=globalThis.localStorage,locks=globalThis.navigator?.locks,loader=loadModel,now=Date.now,id=()=>crypto.randomUUID(),key=KEY,autoOpen=!!globalThis.document}={}){
    this.onChange=onChange;this.storage=storage;this.locks=locks;this.loader=loader;this.now=now;this.id=id;
    this.state=null;this.rows=[];this.attempts=[];this.pending=null;this.busy=false;this.closed=false;this.engine=null;this.record=null;this.key=key;
    this.draftKey=key+'.draft.v1';this.draftBase=storage?.getItem(this.draftKey)??null;
    if(!storage||!locks?.request)throw Error('Ce navigateur ne permet pas encore de protéger les écritures simultanées. Ouvre cette page dans Chrome à jour.');
    if(autoOpen&&storage.getItem(key)!==null)queueMicrotask(async()=>{try{await this.history();await this.connect()}catch(error){const el=globalThis.document?.getElementById('error');if(el)el.textContent=error.message}});
  }
  emit(){this.onChange({state:this.state,rows:[...this.rows],attempts:[...this.attempts],pending:this.pending,busy:this.busy})}
  ensure(){if(this.closed)throw Error('Cette fenêtre a été fermée. Rouvre ta conversation.');}
  async draftRecord(){
    const raw=this.storage.getItem(this.draftKey);if(raw===null)return {raw,data:{schema:'HELENE_LOCAL_DRAFT_V1',text:''}};
    let envelope;try{envelope=JSON.parse(raw)}catch{throw Error('Le brouillon enregistré est illisible. Il est conservé sans remplacement.');}
    const d=envelope.data;
    if(!d||d.schema!=='HELENE_LOCAL_DRAFT_V1'||typeof d.text!=='string'||d.text.length>1200||bytes(d.text)>4800||d.text.includes('\0')||await digest(JSON.stringify(d))!==envelope.sha256)throw Error('Le brouillon enregistré n’est pas vérifié. Il est conservé sans remplacement.');
    return {raw,data:d};
  }
  async loadDraft(){
    return this.locks.request(this.draftKey,{mode:'exclusive'},async()=>{const {raw,data}=await this.draftRecord();this.draftBase=raw;return data.text;});
  }
  async writeDraft(text,expected=null){
    if(typeof text!=='string'||text.length>1200||bytes(text)>4800||text.includes('\0'))throw Error('Ce brouillon dépasse la limite du champ. Garde une copie de ton texte.');
    // Separate from the history receipt: drafting never changes an in-flight
    // request's revision and never starts or repeats a completion.
    return this.locks.request(this.draftKey,{mode:'exclusive'},async()=>{
      const {raw,data}=await this.draftRecord();
      if(expected!==null&&data.text!==expected)return false;
      if(raw!==this.draftBase&&data.text!==text)throw Error('Un autre onglet a changé le brouillon. Ton texte reste dans le champ ; aucun brouillon enregistré n’a été écrasé.');
      const next={schema:'HELENE_LOCAL_DRAFT_V1',text,at:new Date(this.now()).toISOString()};
      const envelope={data:next,sha256:await digest(JSON.stringify(next))},saved=JSON.stringify(envelope);
      this.storage.setItem(this.draftKey,saved);
      if(this.storage.getItem(this.draftKey)!==saved)throw Error('L’enregistrement du brouillon n’a pas été confirmé. Garde une copie de ton texte.');
      this.draftBase=saved;return true;
    });
  }
  saveDraft(text){return this.writeDraft(text);}
  clearDraftIfMatches(text){return this.writeDraft('',text);}
  async read(){
    const raw=this.storage.getItem(this.key);if(raw===null)return empty();
    let envelope;try{envelope=JSON.parse(raw)}catch{throw Error('Historique illisible : il est conservé sans modification. Exporte une copie depuis les options.');}
    const d=envelope.data;
    if(!d||d.schema!=='HELENE_ON_DEVICE_CONVERSATION_V1'||!Number.isSafeInteger(d.revision)||d.revision<0||!Array.isArray(d.rows)||!Array.isArray(d.attempts)||await digest(JSON.stringify(d))!==envelope.sha256)throw Error('L\u2019intégrité de l\u2019historique n\u2019est pas vérifiée. Aucun remplacement effectué.');
    let turn=0;const seen=new Set();
    for(const r of d.rows){if(r.turn!==++turn||!uuid.test(r.request_id)||seen.has(r.request_id)||typeof r.user_message!=='string'||typeof r.reply!=='string'||!r.reply.trim()||!HISTORICAL_MODELS.includes(r.model))throw Error('Historique incohérent : aucune donnée remplacée.');seen.add(r.request_id);}
    return d;
  }
  async save(d){
    const envelope={data:d,sha256:await digest(JSON.stringify(d))},raw=JSON.stringify(envelope);
    if(bytes(raw)>1024*1024)throw Error('Cette conversation atteint sa limite locale. Exporte-la avant de poursuivre. Aucun message effacé.');
    this.storage.setItem(this.key,raw);
    if(this.storage.getItem(this.key)!==raw)throw Error('L\u2019enregistrement local n\u2019a pas été confirmé. Garde ton texte et exporte une copie.');
  }
  async lock(fn){
    this.ensure();return this.locks.request(this.key,{mode:'exclusive',ifAvailable:true},async lock=>{
      if(!lock)throw Error('Une autre fenêtre utilise cette conversation. Termine sa demande puis actualise.');
      this.ensure();return fn();
    });
  }
  accept(d,active=!!this.engine){
    this.record=d;this.rows=[...d.rows];this.attempts=d.attempts.filter(a=>a&&typeof a.message==='string'&&['FAILED','INTERRUPTED'].includes(a.state)).map(a=>({...a}));this.pending=null;
    this.state={session_active:active,next_turn:d.rows.length+1,local_device_only:true,native_actions:false};this.emit();
  }
  async history(){
    return this.lock(async()=>{const d=await this.read();this.accept(d);return [...this.rows]});
  }
  async connect(){
    if(this.busy)throw Error('Une demande est déjà en cours.');this.busy=true;this.emit();
    try{
      await this.lock(async()=>{
        const d=await this.read();
        if(d.pending){
          // A terminated page releases the Web Lock. Preserve its question,
          // never repeat inference automatically and never invent a reply.
          d.attempts.push({...d.pending,state:'INTERRUPTED'});d.pending=null;d.revision++;await this.save(d);
        }
        this.accept(d,false);
      });
      this.engine=await this.loader();if(this.closed){if(this.loader===loadModel)await forgetModel(this.engine);else await this.engine.unload();this.ensure();}
      await this.lock(async()=>this.accept(await this.read(),true));return [...this.rows];
    }finally{this.busy=false;if(this.releaseWhenIdle&&!this.closed&&this.engine)await this.control('close');this.emit();}
  }
  async send(message){
    if(this.busy)throw Error('Une demande est déjà en cours.');
    if(!this.engine||!this.state?.session_active)throw Error('Ouvre ou reprends ta conversation avant d\u2019écrire.');
    if(typeof message!=='string'||!message.trim()||message.length>1200||bytes(message)>2400||message.includes('\0'))throw Error('Écris un message de 1 à 1 200 caractères (2 400 octets maximum). Ton texte reste dans le champ.');
    this.busy=true;this.emit();
    try{return await this.lock(async()=>{
      const d=await this.read();if(d.pending)throw Error('La demande précédente doit d\u2019abord être vérifiée. Actualise la conversation.');
      const pending={request_id:this.id(),message:message.trim(),turn:d.rows.length+1,at:new Date(this.now()).toISOString()};
      if(!uuid.test(pending.request_id))throw Error('Le navigateur ne peut pas identifier ce message.');
      d.pending=pending;d.revision++;await this.save(d);this.pending=pending;this.emit();
      try{
        const result=await this.engine.chat.completions.create({messages:contextFor(d.rows,pending.message),max_tokens:384,temperature:0.4,stream:false});
        this.ensure();const choice=result?.choices?.[0],reply=choice?.message?.content;
        if(choice?.finish_reason!=='stop'||typeof reply!=='string'||!reply.trim())throw Error('La réponse du modèle est incomplète. Ton message a été conservé.');
        // Check the stored lineage immediately before committing the reply.
        const current=await this.read();if(current.revision!==d.revision||current.pending?.request_id!==pending.request_id)throw Error('La conversation a changé. Aucune réponse ne sera écrasée.');
        const row={turn:pending.turn,request_id:pending.request_id,user_message:pending.message,reply:reply.trim(),model:MODEL_ID,engine_fingerprint:ENGINE_FINGERPRINT,provider_backend:result.backend,usage:result.usage,at:new Date(this.now()).toISOString(),provider_response_complete:true};
        current.rows.push(row);current.pending=null;current.revision++;await this.save(current);this.accept(current,true);return row;
      }catch(error){
        if(!this.closed){const current=await this.read();if(current.pending?.request_id===pending.request_id){current.attempts.push({...pending,state:'FAILED',reason:'MODEL_OR_STORAGE_NOT_CONFIRMED'});current.pending=null;current.revision++;await this.save(current);this.accept(current,true);}}
        throw error;
      }
    })}finally{this.busy=false;this.pending=null;if(this.releaseWhenIdle&&!this.closed&&this.engine)await this.control('close');this.emit();}
  }
  async background(){this.releaseWhenIdle=true;if(!this.busy&&this.engine)await this.control('close');}
  async foreground(){this.releaseWhenIdle=false;if(this.state&&!this.busy&&!this.engine)return this.connect();}
  async control(operation){
    if(this.busy)throw Error('Patiente jusqu\u2019à la fin de la demande.');
    if(operation==='resume')return this.connect();
    if(operation!=='close')throw Error('Cette opération n\u2019est pas disponible.');
    if(this.engine){if(this.loader===loadModel)await forgetModel(this.engine);else await this.engine.unload();}this.engine=null;if(this.record)this.accept(this.record,false);return this.state;
  }
  dispose(){this.closed=true;this.engine?.interruptGenerate?.();if(this.engine){if(this.loader===loadModel)forgetModel(this.engine).catch(()=>{});else this.engine.unload().catch(()=>{});}this.engine=null;}
}
