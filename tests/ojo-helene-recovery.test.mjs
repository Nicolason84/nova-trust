import test from 'node:test';
import assert from 'node:assert/strict';
import {everydayUI} from '../docs/helene/everyday-ui.mjs';
import {makeAppointment,calendarFile,validateAppointments} from '../docs/helene/everyday.mjs';
import {privateVaultUI} from '../docs/helene/vault-ui.mjs';
import {VaultStore,createVault,addMemory,unlockVault,readMedia} from '../docs/helene/vendor/legad-vault.mjs';

// These small adapters drive the real form handlers and storage methods, without a browser
// or personal data. They model only the DOM and IndexedDB operations those handlers use.
function documentFixture(){
  const nodes=new Map(),handlers=new Map();
  function node(selector){
    if(!nodes.has(selector))nodes.set(selector,{value:'',textContent:'',innerHTML:'',open:false,hidden:false,disabled:false,handlers:new Map(),addEventListener(name,fn){this.handlers.set(name,fn)},reset(){},focus(){},showModal(){this.open=true},close(){this.open=false},replaceChildren(){this.innerHTML=''}});
    return nodes.get(selector);
  }
  const document={querySelector:node,body:{insertAdjacentHTML(){}},addEventListener(name,fn){handlers.set(name,fn)}};
  const click=async dataset=>handlers.get('click')({target:{closest:()=>({dataset,hasAttribute:()=>false})}});
  return {document,node,click,handlers};
}
async function editAppointment(previous,{zone,title='Titre corrigé',start,end}={}){
  process.env.TZ=zone;
  const dom=documentFixture(),oldDocument=globalThis.document;
  globalThis.document=dom.document;
  let state={agenda:[previous]};
  try{
    everydayUI({getState:()=>state,persist:async next=>{state=next},render(){},esc:String,icon:()=>'',download(){},toast(){}});
    await dom.click({appointment:previous.id});
    const shown={start:dom.node('#agenda-start').value,end:dom.node('#agenda-end').value};
    dom.node('#agenda-title').value=title;
    if(start!==undefined)dom.node('#agenda-start').value=start;
    if(end!==undefined)dom.node('#agenda-end').value=end;
    await dom.node('#agenda-form').handlers.get('submit')({preventDefault(){}});
    assert.equal(dom.node('#agenda-error').textContent,'');
    return {shown,saved:state.agenda[0]};
  }finally{globalThis.document=oldDocument}
}
const icsTimes=item=>calendarFile([item]).split('\r\n').filter(line=>/^(DTSTART|DTEND):/.test(line));
function initialAppointment(){process.env.TZ='Europe/Paris';return makeAppointment({id:'appointment-fixture',title:'Rendez-vous fictif',start:'2026-11-05T09:00',end:'2026-11-05T10:00'})}

test('agenda : modifier le titre après changement de fuseau conserve les instants et les dates ICS',async()=>{
  const oldZone=process.env.TZ;
  try{
    const before=initialAppointment(),{shown,saved}=await editAppointment(before,{zone:'America/New_York'});
    assert.deepEqual(shown,{start:'2026-11-05T03:00',end:'2026-11-05T04:00'});
    assert.equal(saved.title,'Titre corrigé');assert.equal(saved.id,before.id);
    assert.equal(saved.startUTC,before.startUTC);assert.equal(saved.endUTC,before.endUTC);
    assert.equal(saved.timeZone,'America/New_York');validateAppointments([saved]);
    assert.deepEqual(icsTimes(saved),icsTimes(before));
  }finally{if(oldZone===undefined)delete process.env.TZ;else process.env.TZ=oldZone}
});
test('agenda : une modification explicite des heures utilise le fuseau indiqué par le formulaire',async()=>{
  const oldZone=process.env.TZ;
  try{
    const before=initialAppointment(),{saved}=await editAppointment(before,{zone:'America/New_York',start:'2026-11-05T04:00',end:'2026-11-05T05:00'});
    assert.equal(saved.startUTC,'2026-11-05T09:00:00.000Z');assert.equal(saved.endUTC,'2026-11-05T10:00:00.000Z');validateAppointments([saved]);
  }finally{if(oldZone===undefined)delete process.env.TZ;else process.env.TZ=oldZone}
});
test('agenda : la seconde occurrence de l’heure d’hiver reste exacte après une édition de texte',async()=>{
  const oldZone=process.env.TZ;
  try{
    process.env.TZ='UTC';
    const before=makeAppointment({id:'repeated-hour-fixture',title:'Heure répétée fictive',start:'2026-11-01T06:30',end:'2026-11-01T07:30'});
    const {shown,saved}=await editAppointment(before,{zone:'America/New_York'});
    assert.deepEqual(shown,{start:'2026-11-01T01:30',end:'2026-11-01T02:30'});
    assert.equal(saved.startUTC,'2026-11-01T06:30:00.000Z');assert.equal(saved.endUTC,before.endUTC);
    assert.deepEqual(icsTimes(saved),icsTimes(before));validateAppointments([saved]);
  }finally{if(oldZone===undefined)delete process.env.TZ;else process.env.TZ=oldZone}
});

class MemoryTransactions{
  constructor(){this.data={vaults:new Map(),settings:new Map()};this.reverseCursor=false}
  transaction(names,mode='readonly'){
    const db=this,data=Object.fromEntries(Object.entries(this.data).map(([key,value])=>[key,new Map(value)]));
    let pending=0,aborted=false,finished=false;
    const done=()=>{if(pending||aborted||finished)return;queueMicrotask(()=>{if(pending||aborted||finished)return;finished=true;if(mode==='readwrite')db.data=data;tx.oncomplete?.()})};
    const tx={oncomplete:null,onabort:null,error:null,abort(){aborted=true;queueMicrotask(()=>tx.onabort?.())},objectStore(name){
      return {
        get(key){pending++;const request={};queueMicrotask(()=>{request.result=structuredClone(data[name].get(key));request.onsuccess?.();pending--;done()});return request},
        put(value,key){data[name].set(key,structuredClone(value))},
        openCursor(){pending++;const request={},entries=[...data[name]];if(db.reverseCursor)entries.reverse();let index=0;
          const step=()=>queueMicrotask(()=>{const entry=entries[index++];request.result=entry?{key:entry[0],value:structuredClone(entry[1]),continue:step}:null;request.onsuccess?.();if(!entry){pending--;done()}});step();return request}
      };
    }};
    queueMicrotask(done);return tx;
  }
}

test('coffre : retrouver une version archivée rétablit ses originaux et préserve les versions déplacées malgré un nouvel ordre de liste',async()=>{
  const pass='Coffre fictif de régression uniquement 2026',bytes=new Uint8Array([0,1,7,128,255]);
  const fresh=await createVault(pass,{name:'Coffre fictif'}),v0=fresh.vault;
  const first=await addMemory(v0,fresh.key,{title:'Première note',note:'Texte fictif',collection:'document',ownerConsent:true},[]),v1=first.vault;
  const second=await addMemory(v1,fresh.key,{title:'Original à retrouver',note:'Autre texte fictif',collection:'document',ownerConsent:true},[new File([bytes],'original-fictif.bin',{type:'application/octet-stream'})]),v2=second.vault;
  const db=new MemoryTransactions(),originalDB=VaultStore.prototype.db,dom=documentFixture();
  const oldDocument=globalThis.document,oldWindow=globalThis.window,oldLocation=globalThis.location;
  VaultStore.prototype.db=async()=>db;globalThis.document=dom.document;globalThis.window={addEventListener(){}};globalThis.location={hash:'#coffre'};
  try{
    const storage=new VaultStore('test');await storage.save(v2,null);await storage.restore(v0);
    const archive=(await storage.preserved()).find(record=>record.vault.revision===v2.revision);assert.ok(archive);
    const messages=[],ui=privateVaultUI({render(){},esc:String,icon:()=>'',download(){},toast:text=>messages.push(text)});
    await new Promise(resolve=>setImmediate(resolve));
    const listButton={dataset:{},hasAttribute:name=>name==='data-vault-preserved'};
    await dom.handlers.get('click')({target:{closest:()=>listButton}});
    assert.ok(dom.node('#vault-preserved-list').innerHTML.includes('data-vault-prior="'+archive.storageKey+'"'));
    // Another completed restoration changes the list after the button was displayed.
    await storage.restore(v1);db.reverseCursor=true;
    await dom.click({vaultPrior:archive.storageKey});
    assert.equal(messages.at(-1),'Coffre retrouvé. Utilise sa phrase pour l’ouvrir.');
    const active=await storage.active();assert.deepEqual(active,v2);
    const opened=await unlockVault(active,pass,{full:true});assert.equal(opened.items.length,2);
    const recovered=await readMedia(active,opened.key,second.item.id,second.item.attachments[0].id);
    assert.deepEqual(new Uint8Array(await recovered.arrayBuffer()),bytes);
    const preserved=await storage.preserved();assert.ok(preserved.some(record=>record.vault.revision===v0.revision));assert.ok(preserved.some(record=>record.vault.revision===v1.revision));
    assert.match(ui.page(),/Ouvrir mon coffre/);assert.equal(ui.page().includes('Original à retrouver'),false);
  }finally{VaultStore.prototype.db=originalDB;globalThis.document=oldDocument;globalThis.window=oldWindow;globalThis.location=oldLocation}
});
