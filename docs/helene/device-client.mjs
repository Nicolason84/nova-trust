import {emptyState,exportState,importState,MAX_JSON} from './core.mjs';

const DATABASE='ojo-helene-device-v1';
const conflict=()=>Error('Cet espace a changé dans un autre onglet. Ferme ton brouillon ou garde ses mots, puis actualise ton espace.');
function request(r){return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function completed(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||Error('Enregistrement interrompu.'));tx.onerror=()=>{}})}
export class WorkspaceClient{
  constructor(){this.revision=0;this.etag=null;this.savedAt=null;this.session={displayName:'Sur cet appareil'};this.opening=null}
  async db(){
    if(!globalThis.indexedDB)throw Error('Ce navigateur ne permet pas de garder tes éléments. Ouvre ce lien dans Chrome sur ton téléphone.');
    if(!this.opening)this.opening=new Promise((resolve,reject)=>{
      const r=indexedDB.open(DATABASE,1);
      r.onupgradeneeded=()=>{r.result.createObjectStore('current');r.result.createObjectStore('history',{keyPath:'revision'})};
      r.onerror=()=>reject(Error('Le stockage de ce navigateur est indisponible. Ouvre ce lien dans Chrome, hors navigation privée.'));
      r.onblocked=()=>reject(Error('Ferme les autres onglets ojO puis rouvre ce lien.'));
      r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();this.opening=null};resolve(r.result)};
    });
    return this.opening;
  }
  async load(){
    const db=await this.db(),tx=db.transaction('current','readonly'),done=completed(tx);
    const record=await request(tx.objectStore('current').get('space'));await done;
    const state=record?await importState(record.exportText):emptyState();
    this.revision=record?.revision||0;this.etag=record?.etag||null;this.savedAt=record?.saved_at||null;
    return state;
  }
  async save(state){
    const exportText=await exportState(state);
    if(new TextEncoder().encode(exportText).length>MAX_JSON)throw Error('Ton espace dépasse 20 Mo. Fais un export et retire un fichier avant de réessayer.');
    const db=await this.db(),tx=db.transaction(['current','history'],'readwrite'),done=completed(tx);
    let cause=null,record=null;
    const current=tx.objectStore('current'),history=tx.objectStore('history'),read=current.get('space');
    read.onsuccess=()=>{
      if((read.result?.etag||null)!==this.etag){cause=conflict();tx.abort();return}
      record={revision:(read.result?.revision||0)+1,etag:crypto.randomUUID(),saved_at:new Date().toISOString(),exportText};
      current.put(record,'space');history.put(record);
      const keys=history.getAllKeys();keys.onsuccess=()=>{for(const key of keys.result.slice(0,-5))history.delete(key)};
    };
    try{await done}catch(e){throw cause||(e.name==='QuotaExceededError'?Error('Le stockage de cet appareil est plein. Tes éléments précédents sont conservés. Fais un export avant de libérer de la place.'):e)}
    this.revision=record.revision;this.etag=record.etag;this.savedAt=record.saved_at;
  }
  async history(){
    const db=await this.db(),tx=db.transaction('history','readonly'),done=completed(tx);
    const records=await request(tx.objectStore('history').getAll());await done;
    return records.reverse().map(({revision,saved_at})=>({revision,saved_at}));
  }
  async version(revision){
    const db=await this.db(),tx=db.transaction('history','readonly'),done=completed(tx);
    const record=await request(tx.objectStore('history').get(revision));await done;
    if(!record)throw Error('Cette sauvegarde ne se trouve plus sur cet appareil.');
    return importState(record.exportText);
  }
  async erase(){
    const db=await this.db(),tx=db.transaction(['current','history'],'readwrite'),done=completed(tx);
    let cause=null;const current=tx.objectStore('current'),r=current.get('space');
    r.onsuccess=()=>{if((r.result?.etag||null)!==this.etag){cause=conflict();tx.abort();return}current.clear();tx.objectStore('history').clear()};
    try{await done}catch(e){throw cause||e}
    this.revision=0;this.etag=null;this.savedAt=null;
  }
}
