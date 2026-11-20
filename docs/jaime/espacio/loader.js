'use strict';
(() => {
 const $=id=>document.getElementById(id), path=new URL('.',location.href).pathname;
 const signer=crypto.subtle.importKey('jwk',window.JaimeEditionSigner,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 let activeFrame=null, activeRecord=null, blobURL=null, pendingPortable=null, selected=false, busy=false, invitation=null, badge;
 let accountSession=null, assignedFrame=null;
 const validAccount=id=>typeof id==='string'&&/^[0-9a-f]{64}$/.test(id);
 const validAccountKey=key=>typeof CryptoKey!=='undefined'&&key instanceof CryptoKey&&key.type==='secret'&&key.extractable===false&&
  key.algorithm.name==='HMAC'&&key.algorithm.hash?.name==='SHA-256'&&key.usages.includes('sign');
 const validGrant=g=>g&&Object.keys(g).sort().join(',')==='code,id,sha256,v'&&g.v===1&&
  typeof g.id==='string'&&/^[0-9a-f]{16}$/.test(g.id)&&typeof g.sha256==='string'&&/^[0-9a-f]{64}$/.test(g.sha256)&&
  typeof g.code==='string'&&/^[A-Z0-9]{24}$/.test(g.code);
 const invite=location.hash.match(/^#activar=([a-f0-9]{16})\.([A-Z0-9]{24})$/);
 if(invite) invitation={edition:invite[1],code:invite[2],expiry:Date.now()+15*60*1000};
 if(location.hash.startsWith('#activar=')) history.replaceState(null,'',location.pathname+location.search);
 const hasInvitation=()=>!!invitation && Date.now()<invitation.expiry;
 const say=message=>{$('status').textContent=message;};
 
 let db;
 try {
  db=new Promise((resolve,reject)=>{
   const r=indexedDB.open('jaime.private.app.'+path,1);
   r.onupgradeneeded=()=>r.result.createObjectStore('records');
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
 } catch(e) { db=Promise.reject(e); }
 async function kv(op,key,val) {
  const conn=await db;return new Promise((resolve,reject)=>{
   const tx=conn.transaction('records',op==='get'?'readonly':'readwrite'),s=tx.objectStore('records');let q;
   if(op==='get')q=s.get(key);else if(op==='put')q=s.put(val,key);else q=s.delete(key);
   tx.oncomplete=()=>resolve(q.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('No se guardó el cambio.'));
  });
 }
 badge=window.JaimeBrowserCredentials(kv);
 function ready(){
  const activation=hasInvitation();
  $('noInvite').hidden=!activation;$('noInvite').disabled=busy;
  $('open').hidden=!selected;$('open').disabled=busy;$('choose').disabled=busy;
  $('open').textContent=activation?'Abrir con mi invitación':'Abrir edición guardada';
  $('choose').textContent=activation?(selected?'Elegir el archivo de mi invitación':'Elegir y abrir con mi invitación'):(selected?'Elegir otro archivo':'Elegir mi archivo');
  $('choose').classList.toggle('other',selected);
  $('hint').textContent=activation?'Tu invitación está preparada en esta pestaña. Elige la edición privada que la acompaña.':
   selected?'Ya hay una edición guardada en este navegador. También puedes abrir otra edición o recuperar una copia .jaime.':
   'Busca el archivo de la edición en Archivos o Descargas. Para recuperar tus datos, elige tu copia .jaime y ten a mano su frase.';
  $('cover').querySelector('section').setAttribute('aria-busy',String(busy));
 }
 function editionIdentity(unsigned){
  const start=new TextDecoder().decode(unsigned.subarray(0,65536));
  const tag=start.match(/<script\b[^>]*\bid=["']enc["'][^>]*>\s*\{\s*"id"\s*:\s*"([a-f0-9]{16})"/i);
  const head=start.split(/<\/head>/i,1)[0].slice(0,tag?.index);
  return {edition:tag?.[1]||null,partitioned:head.includes('<meta name="jaime-partition" content="1">')};
 }
 async function verifyBlob(f){
  if(!f||f.size<10000||f.size>82*1024*1024)throw Error('Elige la edición HTML firmada o una copia completa .jaime.');
  const bytes=new Uint8Array(await f.arrayBuffer()),tail=new TextDecoder().decode(bytes.subarray(Math.max(0,bytes.length-180)));
  const mark=tail.match(/\n<!--JAIME-FIRMA-v1:([A-Za-z0-9_-]{86})-->\n$/);
  if(!mark)throw Error('Este archivo no contiene una edición firmada. Elige el HTML privado o una copia completa .jaime.');
  const unsigned=bytes.subarray(0,bytes.length-mark[0].length);
  const prefix=new TextEncoder().encode('JAIME private edition v1\0'),message=new Uint8Array(prefix.length+unsigned.length);
  message.set(prefix);message.set(unsigned,prefix.length);
  const sig=Uint8Array.from(atob(mark[1].replace(/-/g,'+').replace(/_/g,'/')+'=='),c=>c.charCodeAt(0));
  if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},await signer,sig,message))throw Error('La firma de este archivo no es válida. Elige la edición original.');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  return {hash,blob:new Blob([bytes],{type:'text/html;charset=utf-8'}),buffer:bytes.buffer,...editionIdentity(unsigned)};
 }
 function closeFrame(focus=true){
  window.JaimeWebSync?.close();activeFrame?.remove();activeFrame=null;activeRecord=null;pendingPortable=null;assignedFrame=null;
  if(blobURL)URL.revokeObjectURL(blobURL);blobURL=null;$('stage').hidden=true;
  $('cover').hidden=!!accountSession;$('accountPane').hidden=!accountSession;ready();
  if(focus)(accountSession?$('accountPane'):(selected?$('open'):$('choose'))).focus();
 }
 function show(record,contents=null,activate=false,note='',assignment=null){
  closeFrame(false);activeRecord={hash:record.hash,blob:record.blob,edition:record.edition};pendingPortable=contents;
  assignedFrame=assignment;
  $('change').textContent=assignment?'← Volver a mi cuenta':'← Cambiar archivo';
  const frame=document.createElement('iframe');activeFrame=frame;frame.title='Mi espacio privado';frame.referrerPolicy='no-referrer';
  frame.allow='publickey-credentials-get; publickey-credentials-create; fullscreen';frame.allowFullscreen=true;
  if(activate)frame.addEventListener('load',()=>{
   if(frame!==activeFrame)return;
   if(!assignedFrame&&(!hasInvitation()||invitation.edition!==record.edition))return;
   frame.contentDocument?.getElementById('activationUnlock')?.click();
  },{once:true});
  blobURL=URL.createObjectURL(record.blob);frame.src=blobURL;$('frameHost').replaceChildren(frame);$('stageNote').textContent=note;
  $('cover').hidden=true;$('accountPane').hidden=true;$('stage').hidden=false;
 }
 window.JaimePwaVault=Object.freeze({forFrame(caller){
  const check=()=>{if(!activeFrame||caller!==activeFrame.contentWindow)throw Error('Marco no autorizado.');};
  check();const record=activeRecord;
  const assignment=assignedFrame;
  const deviceVault=assignment?window.JaimeBrowserCredentials((op,k,v)=>kv(op,'assigned.'+assignment.id+'.'+k,v),
   {context:'assigned.'+assignment.id}):badge;
  const api={deviceVault,lock:()=>{check();closeFrame();},transport:window.JaimeWebSync,portable:{
   pending:()=>{check();return !!pendingPortable;},
   take:()=>{check();const contents=pendingPortable;pendingPortable=null;return contents;},
   save:async contents=>{check();return window.JaimePortable.save(record.blob,contents);}
  }};
  if(assignment){
   api.accountNamespace=assignment.id;
   Object.defineProperty(api,'accountKey',{enumerable:true,get(){
    check();
    if(assignment!==assignedFrame||assignment.id!==accountSession?.id)throw Error('La cuenta está cerrada.');
    return accountSession.key;
   }});
   if(assignment.code)api.takeActivation=async id=>{
    check();if(assignment!==assignedFrame||assignment.id!==accountSession?.id||!assignment.code||id!==record.edition)return null;
    const code=assignment.code;assignment.code=null;return code;
   };
  }else if(!pendingPortable&&hasInvitation()&&record.edition===invitation.edition){
   api.takeActivation=async id=>{
    check();if(!hasInvitation()||id!==record.edition||id!==invitation.edition)return null;
    const code=invitation.code;invitation=null;return code;
   };
  }
  return api;
 }});
 async function verifiedStored(){
  const previous=await kv('get','current');
  const file=previous?.blob||(previous?.bytes instanceof ArrayBuffer?new Blob([previous.bytes],{type:'text/html;charset=utf-8'}):null);
  if(!file)throw Error('Elige tu archivo privado para continuar.');
  const record=await verifyBlob(file);
  if(record.hash!==previous.hash)throw Error('Vuelve a elegir el archivo privado original.');
  return record;
 }
 function matchingGrant(session,grant){
  return session&&validGrant(grant)&&session.grant&&['id','sha256','code'].every(k=>grant[k]===session.grant[k]);
 }
 async function assignedRecord(session,grant){
  if(!matchingGrant(session,grant))return null;
  const record=await verifiedStored();
  return accountSession===session&&record.partitioned&&record.hash===session.grant.sha256&&record.edition===session.grant.id?record:null;
 }
 window.JaimeCanOpenAssignedEdition=async grant=>{
  try{return !!await assignedRecord(accountSession,grant);}catch{return false;}
 };
 window.JaimeOpenAssignedEdition=async(grant,id)=>{
  const session=accountSession;
  if(!session||session.id!==id)throw Error('Esta edición no está asignada a la cuenta abierta.');
  const record=await assignedRecord(session,grant);
  if(!record||accountSession!==session)throw Error('Esta edición firmada debe estar guardada en este navegador.');
  show(record,null,true,'',{id:session.id,code:session.grant.code});
 };
 async function useStored(userGesture){
  const record=await verifiedStored();
  if(accountSession)throw Error('Vuelve al inicio para abrir otro archivo.');
  if(hasInvitation()&&record.edition!==invitation.edition)throw Error('Esta invitación corresponde a otra edición. Elige el archivo que la acompaña.');
  show(record,null,userGesture&&hasInvitation());
 }
 async function chosen(file,activate){
  if(/\.json$/i.test(file.name||''))throw Error('Elige primero la edición HTML. El kit y la copia JSON se recuperan dentro de la edición abierta.');
  const incoming=await window.JaimePortable.unpack(file);
  const record=await verifyBlob(incoming.edition);
  if(incoming.contents&&(!record.edition||incoming.contents.kit.edition!==record.edition))
   throw Error('La identidad de esta copia no corresponde a la edición firmada. Se conserva la edición anterior.');
  if(!incoming.contents&&activate&&hasInvitation()&&record.edition!==invitation.edition)
   throw Error('Esta invitación corresponde a otra edición. Elige el archivo que la acompaña.');
  if(accountSession)throw Error('Vuelve al inicio para elegir otro archivo.');
  let note='';
  try {
   await kv('put','current',{hash:record.hash,bytes:record.buffer});selected=true;
   if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  } catch (_) {note='Sólo para esta sesión. Conserva el archivo original.';}
  if(accountSession)return;
  if(incoming.contents)invitation=null;
  show(record,incoming.contents,!incoming.contents&&activate&&hasInvitation(),note);
 }
 async function run(work){
  if(busy)return;busy=true;ready();say('Comprobando la firma…');
  try {await work();say('');}catch(e){say(e.message||'No se pudo abrir el archivo.');}
  finally{busy=false;ready();}
 }
 $('change').onclick=()=>{if(!assignedFrame)$('compat').open=true;closeFrame();say('');};
 $('choose').onclick=()=>{$('file').click();};
 $('noInvite').onclick=()=>{invitation=null;ready();if(selected)run(()=>useStored(false));else $('choose').focus();};
 $('open').onclick=()=>{run(()=>useStored(true));};
 $('file').onchange=()=>{const f=$('file').files[0];$('file').value='';if(f)run(()=>chosen(f,true));};
 (async()=>{
  try {
   const rec=await kv('get','current');selected=!!(rec?.hash&&(rec.blob||rec.bytes instanceof ArrayBuffer));ready();
   
  }catch(_){ready();say('Puedes abrir tu archivo para esta sesión aunque el navegador no pueda conservarlo.');}
 })();
 const enterAccount=(id,grant=null,key=null)=>{
  if(!validAccount(id))throw Error('Identidad de cuenta no válida.');
  const usableKey=validAccountKey(key);
  accountSession={id,grant:usableKey&&validGrant(grant)?{...grant}:null,key:usableKey?key:null};
  invitation=null;
  closeFrame(false);
  $('compat').open=false;
  $('cover').hidden=true;
  $('accountPane').hidden=false;
 };
 const leaveAccount=()=>{
  accountSession=null;closeFrame(false);
  $('accountPane').replaceChildren();
  $('accountPane').hidden=true;
  $('cover').hidden=false;
  $('stage').hidden=true;
  $('compat').open=false;
  ($('googleAccount').hidden?$('compat').querySelector('summary'):$('googleAccount')).focus();
 };
 function accountUnavailable(){
  $('googleAccount').hidden=true;
  $('switchGoogle').hidden=true;
  $('googleDevice').hidden=true;
  $('accountStatus').textContent='El acceso con Google no está disponible ahora.';
 }
 if(typeof window.JaimeGoogle?.init==='function'){
  try{
   $('switchGoogle').hidden=!window.JaimeGoogle.available();
   $('accountStatus').textContent=window.JaimeGoogle.available()?
    'Continúa con tu Gmail en esta misma pestaña.':'El acceso con Google no está disponible ahora.';
   Promise.resolve(window.JaimeGoogle.init({enterAccount,leaveAccount})).catch(accountUnavailable);
   $('googleAccount').addEventListener('click',async()=>{
    try{await window.JaimeGoogle.start();}catch{
     $('accountStatus').textContent='No se pudo iniciar la conexión. Puedes volver a intentarlo.';
    }
   });
   $('switchGoogle').addEventListener('click',async()=>{
    try{await window.JaimeGoogle.start(null,true);}catch{
     $('accountStatus').textContent='No se pudo abrir el selector de cuentas.';
    }
   });
  }catch(_){accountUnavailable();}
 }else accountUnavailable();
 ready();
 if(invite)$('compat').open=true;
 if(invite)setTimeout(()=>{if(!hasInvitation()){invitation=null;ready();}},15*60*1000+1);
 if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(()=>{});
})();
