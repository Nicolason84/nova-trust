/* FOUNDATION: durable local snapshots, guarded commands and reversible restore. */
(function(root){
  'use strict';
  const KEY='KRIMI_COMMERCE_A_V1', PREV=KEY+'_PREVIOUS';
  const SDK=root.KrimiCommerceSDK;
  let rawAtLoad=null;
  const parse=raw=>{const s=JSON.parse(raw);SDK.validate(s);return s;};
  // Compare the complete persisted JSON value, ignoring object key order only.
  // Array order, journal entries and all state fields remain significant.
  const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
    ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  const sameState=(left,right)=>canonical(left)===canonical(right);
  async function locked(fn){
    if(root.navigator?.locks?.request)return root.navigator.locks.request(KEY,fn);
    // Commands contain no external side effects. Revision CAS detects stale screens.
    return fn();
  }
  async function sha(text){
    if(!root.crypto?.subtle)throw Error('La vérification de sauvegarde nécessite un navigateur récent ou l’application Android.');
    const bytes=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  }
  root.KrimiCommerceStore={
    load(){const raw=root.localStorage.getItem(KEY);rawAtLoad=raw;return raw===null?SDK.empty():parse(raw);},
    raw(){return root.localStorage.getItem(KEY);},
    previous(){const raw=root.localStorage.getItem(PREV);return raw?parse(raw):null;},
    async command(state,type,payload,commandId){return locked(()=>{
      const current=root.localStorage.getItem(KEY);
      if(current!==rawAtLoad)throw Error('Le dossier a changé dans un autre écran. Recharge avant de continuer.');
      const existing=current===null?null:parse(current);
      if(existing&&existing.revision!==state.revision)throw Error('Cette version du dossier n’est plus courante.');
      const next=SDK.execute(state,type,payload,commandId), raw=JSON.stringify(next);
      SDK.validate(next);
      // An already consumed command has no storage or committed-event effect.
      if(sameState(next,state))return existing||next;
      if(current!==null)root.localStorage.setItem(PREV,current);
      root.localStorage.setItem(KEY,raw);
      if(root.localStorage.getItem(KEY)!==raw)throw Error('La conservation n’a pas pu être vérifiée. Recharge le dossier.');
      rawAtLoad=raw;
      root.dispatchEvent(new CustomEvent('krimi:commerce:committed',{detail:{type,revision:next.revision}}));
      return next;
    });},
    async backup(state){
      SDK.validate(state);const payload=JSON.stringify(state);
      return JSON.stringify({schema:'KRIMI_BACKUP_A_V1',exportedAt:new Date().toISOString(),sha256:await sha(payload),payload},null,2);
    },
    async inspect(text){
      if(text.length>5500000)throw Error('Sauvegarde trop volumineuse pour cette version.');
      const b=JSON.parse(text);
      if(b.schema!=='KRIMI_BACKUP_A_V1'||typeof b.payload!=='string')throw Error('Format inconnu. Utilise une sauvegarde Commerce A ; les anciens dossiers restent dans leur application.');
      if(b.sha256!==await sha(b.payload))throw Error('La sauvegarde est altérée ou incomplète.');
      return parse(b.payload);
    },
    async restore(next){return locked(()=>{
      SDK.validate(next);const current=root.localStorage.getItem(KEY);
      if(current!==rawAtLoad)throw Error('Le dossier a changé. Recharge avant la restauration.');
      const existing=current===null?null:parse(current);
      // Reconcile the stop before equality or any snapshot write.
      if(existing&&existing.paused&&!next.paused)next=SDK.execute(next,'SET_PAUSED',{paused:true});
      SDK.validate(next);
      if(existing&&sameState(existing,next))return existing;
      // Keep the entire former state, including original forecast and journal.
      if(current!==null)root.localStorage.setItem(PREV,current);
      const raw=JSON.stringify(next);root.localStorage.setItem(KEY,raw);rawAtLoad=raw;return parse(raw);
    });},
    keys:{current:KEY,previous:PREV}
  };
})(globalThis);
