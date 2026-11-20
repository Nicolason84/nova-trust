'use strict';
(()=>{
 const $=id=>document.getElementById(id), path=new URL('.',location.href).pathname;
 let activeFrame=null, blobURL=null, db, selected, badge;
 const signer=crypto.subtle.importKey('jwk',window.JaimeEditionSigner,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 let invitation=null;
 const m=location.hash.match(/^#activar=([a-f0-9]{16})\.([A-Z0-9]{24})$/);
 if(m){invitation={edition:m[1],code:m[2],expiry:Date.now()+15*60*1000};history.replaceState(null,'',location.pathname);}
 function takeActivation(id){const pick=invitation;if(!pick||pick.expiry<Date.now()||pick.edition!==id)return Promise.resolve(null);invitation=null;return Promise.resolve(pick.code)}

 const err=t=>$('status').textContent=t;
 const ready=()=>{$('open').disabled=!selected;$('choose').textContent=selected?'Cambiar de edición':'Elegir mi archivo';$('hint').textContent=selected?'Tu edición cifrada ya está disponible en este dispositivo.':'La primera vez, elige el archivo cifrado que recibiste. Se guarda en este navegador.';};
 async function kv(op,key,val){
  const conn=await db;return new Promise((resolve,reject)=>{
   const tx=conn.transaction('records',op==='get'?'readonly':'readwrite'),s=tx.objectStore('records');
   let request;if(op==='get')request=s.get(key);else if(op==='put')request=s.put(val,key);else request=s.delete(key);
   tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Transaction annulée'));
  });
 }
 function asHex(a){return Array.from(new Uint8Array(a),b=>b.toString(16).padStart(2,'0')).join('')}
 async function digest(bytes){return asHex(await crypto.subtle.digest('SHA-256',bytes))}
 async function verifyBlob(f){
  if(!f||f.size<10000||f.size>82*1024*1024)throw Error('Tamaño de edición no válido.');
  const bytes=new Uint8Array(await f.arrayBuffer()),tail=new TextDecoder().decode(bytes.subarray(Math.max(0,bytes.length-180)));
  const mark=tail.match(/\n<!--JAIME-FIRMA-v1:([A-Za-z0-9_-]{86})-->\n$/);
  if(!mark)throw Error('Este archivo no lleva la firma de la edición privada. Elige el HTML 1.1 firmado que recibiste.');
  const unsigned=bytes.subarray(0,bytes.length-mark[0].length);
  const prefix=new TextEncoder().encode('JAIME private edition v1\0'),message=new Uint8Array(prefix.length+unsigned.length);
  message.set(prefix);message.set(unsigned,prefix.length);
  const sig=Uint8Array.from(atob(mark[1].replace(/-/g,'+').replace(/_/g,'/')+'=='),c=>c.charCodeAt(0));
  if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},await signer,sig,message))throw Error('La firma de este archivo no es válida. Elige la edición original.');
  return {hash:await digest(bytes),blob:new Blob([bytes],{type:'text/html;charset=utf-8'})};
 }
 function closeFrame(){
  window.JaimeWebSync?.close();const old=activeFrame;activeFrame=null;if(old)old.remove();if(blobURL)URL.revokeObjectURL(blobURL);blobURL=null;$('stage').hidden=true;$('cover').hidden=false;ready();$('open').focus()
 }
 function show(record){
  closeFrame();blobURL=URL.createObjectURL(record.blob);const frame=document.createElement('iframe');frame.title='Mi espacio privado';frame.referrerPolicy='no-referrer';frame.allow='publickey-credentials-get; publickey-credentials-create; fullscreen';frame.allowFullscreen=true;
  activeFrame=frame;frame.src=blobURL;$('stage').replaceChildren(frame);$('stage').hidden=false;$('cover').hidden=true;
 }
 window.JaimePwaVault=Object.freeze({forFrame(caller){if(!activeFrame||caller!==activeFrame.contentWindow)throw Error('Marco no autorizado');return {deviceVault:badge,lock:closeFrame,takeActivation,transport:window.JaimeWebSync}}});
 async function openStored(){
  try{const previous=await kv('get','current');const record=await verifyBlob(previous.blob);if(record.hash!==previous.hash)throw Error('Archivo dañado.');show(record)}catch{err('Vuelve a elegir tu archivo cifrado para continuar.')}
 }
 $('choose').onclick=()=>$('file').click();$('open').onclick=openStored;
 $('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;
  try{err('Comprobando la edición…');const rec=await verifyBlob(f);await kv('put','current',rec);selected=true;ready();err('Edición lista.');if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});show(rec)}
  catch(e){err(e.message||'No se pudo abrir el archivo.')}finally{$('file').value=''}};
 db=new Promise((resolve,reject)=>{const r=indexedDB.open('jaime.private.app.'+path,1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 badge=window.JaimeBrowserCredentials(kv);
 (async()=>{try{const rec=await kv('get','current');selected=!!(rec?.blob&&rec?.hash);ready();if(selected)await openStored()}catch{err('Se necesita almacenamiento local del navegador para conservar esta edición.')}})();
 if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(()=>err('Sin instalación sin conexión. Vuelve a abrir esta página con HTTPS para guardar la aplicación.'));
})();
