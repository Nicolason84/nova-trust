'use strict';
window.JaimeGoogle=(()=>{
  const enc=new TextEncoder(),dec=new TextDecoder();
  const APP='https://nicolason84.github.io/nova-trust/jaime/espacio/', AUD=new URL(APP).origin;
  const PENDING='jaime.google.flow.v1', b64url=/^[A-Za-z0-9_-]+$/;
  const to64=a=>{let s='';const v=new Uint8Array(a);for(let i=0;i<v.length;i+=8192)s+=String.fromCharCode(...v.subarray(i,i+8192));return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');};
  const from64=s=>{if(typeof s!=='string'||!s.length||!b64url.test(s))throw Error('Respuesta de cuenta no válida.');return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));};
  const hash=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
  const random=()=>to64(crypto.getRandomValues(new Uint8Array(32)));
  const cfg=()=>window.JaimeGoogleConfig;
  const usable=()=>{const c=cfg();return !!(location.origin===AUD&&[new URL(APP).pathname,new URL(APP).pathname+'index.html'].includes(location.pathname)&&c?.verified===true&&c.v===1&&c.returnUrl===APP&&/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(c.endpoint)&&typeof c.publicSpki==='string'&&c.publicSpki.length>300);};
  const status=s=>{const n=document.getElementById('accountStatus');if(n)n.textContent=s;};
  let handlers,dbPromise,active=null,view=null,opening=false,viewVersion=0,lockTimer;
  function db(){if(!dbPromise)dbPromise=new Promise((ok,no)=>{const req=indexedDB.open('jaime.google.personal.v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('records');req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);});return dbPromise;}
  async function kv(op,name,value){
    const handle=await db();return new Promise((ok,no)=>{const tx=handle.transaction('records',op==='get'?'readonly':'readwrite'),s=tx.objectStore('records');
      const r=op==='get'?s.get(name):op==='put'?s.put(value,name):s.delete(name);tx.oncomplete=()=>ok(r.result);tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error||Error('Operación cancelada.'));});
  }
  async function cas(name,stamp,next) {
    const handle=await db();return new Promise((ok,no)=>{const tx=handle.transaction('records','readwrite'),s=tx.objectStore('records'),r=s.get(name);
      r.onsuccess=()=>{if((r.result?.stamp||null)!==stamp){tx.abort();return;}s.put(next,name);};tx.oncomplete=()=>ok();tx.onabort=()=>no(Error('El espacio cambió en otra ventana. Vuelve a abrirlo antes de guardar.'));tx.onerror=()=>no(tx.error);});
  }
  async function start(saveDraft, chooseAccount=false){
    if(opening)return;if(!usable())throw Error('El acceso con Google aún no está disponible.');
    opening=true;
    try{
      const state=random(),pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},false,['encrypt','decrypt']);
      const exported=await crypto.subtle.exportKey('spki',pair.publicKey),keyHash=await hash(exported);
      const prev=sessionStorage.getItem(PENDING);if(prev)await kv('delete','flow.'+prev);
      await kv('put','flow.'+state,{key:pair.privateKey,keyHash,limit:Date.now()+600000});sessionStorage.setItem(PENDING,state);
      const u=new URL(cfg().endpoint);u.searchParams.set('state',state);u.searchParams.set('key',to64(exported));u.searchParams.set('keyHash',keyHash);
      if(saveDraft?.snapshot)u.hash='save='+to64(enc.encode(JSON.stringify(saveDraft)));
      // Let the deployment initiate Google sign-in in this tab. An extra chooser
      // can send a signed-in iPhone to a different Apps Script account path.
      if(chooseAccount && !saveDraft?.snapshot){
        const chooser=new URL('https://accounts.google.com/AccountChooser');
        chooser.searchParams.set('continue',u.href);
        location.assign(chooser.href);
      }else{
        location.assign(u.href);
      }
    }catch(e){opening=false;status('No se pudo iniciar Google. Vuelve a intentarlo.');throw e;}
  }
  async function consume(fragment){
    const parts=fragment.slice('#cuenta='.length).split('.'),state=sessionStorage.getItem(PENDING);
    if(parts.length!==4||!state||state!==parts[0]||fragment.length>30500)throw Error('Abre JAIME en Safari o en tu navegador habitual y vuelve a entrar con Google en esa misma pestaña.');
    const req=await kv('get','flow.'+state);sessionStorage.removeItem(PENDING);await kv('delete','flow.'+state);
    if(!req||req.limit<Date.now())throw Error('La conexión ha caducado.');
    const secret=await crypto.subtle.decrypt({name:'RSA-OAEP'},req.key,from64(parts[1]));
    const aes=await crypto.subtle.importKey('raw',secret,'AES-GCM',false,['decrypt']);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(parts[2]),additionalData:enc.encode(state)},aes,from64(parts[3]));
    const reply=JSON.parse(dec.decode(plain));
    if(reply.v!==1||typeof reply.assertion!=='string'||typeof reply.bootstrap!=='string')throw Error('Respuesta no válida.');
    const pk=await crypto.subtle.importKey('spki',from64(cfg().publicSpki.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pk,from64(reply.signature),enc.encode(reply.assertion)))throw Error('Firma de acceso no válida.');
    const a=JSON.parse(dec.decode(from64(reply.assertion))),now=Date.now()/1000,s=reply.snapshot;
    if(a.v!==1||a.iss!=='jaime-google-session-v1'||a.aud!==AUD||a.state!==state||a.keyHash!==req.keyHash||
      !Number.isSafeInteger(a.exp)||!Number.isSafeInteger(a.iat)||a.exp<now||a.iat>now+30||a.exp-a.iat!==120||
      !/^[0-9a-f]{64}$/.test(a.accountId)||!Number.isSafeInteger(a.revision)||a.revision<0||reply.revision!==a.revision||
      a.bootstrapHash!==await hash(enc.encode(reply.bootstrap))||
      a.snapshotHash!==await hash(enc.encode(s?JSON.stringify([s.v,s.accountId,s.alg,s.iv,s.ct]):'')))throw Error('La respuesta de Google no corresponde a esta sesión.');
    const b=JSON.parse(dec.decode(from64(reply.bootstrap)));
    if(b.v!==1||!/^[-A-Za-z0-9_]{43}$/.test(b.seed)||(s&&s.accountId!==a.accountId))throw Error('Espacio de cuenta no válido.');
    return {m:{v:1,id:a.accountId,seed:b.seed},remote:s,revision:a.revision,grant:b.edition};
  }
  async function editionMemoryKey(m){
    const root=await crypto.subtle.importKey('raw',from64(m.seed),'HKDF',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:enc.encode('JAIME Google v1'),info:enc.encode('memoria del expediente/'+m.id)},root,{name:'HMAC',hash:'SHA-256',length:256},false,['sign']);
  }
  async function dataKey(m){
    const root=await crypto.subtle.importKey('raw',from64(m.seed),'HKDF',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:enc.encode('JAIME Google v1'),info:enc.encode('datos/'+m.id)},root,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function seal(s,data){
    const bytes=enc.encode(JSON.stringify(data));if(bytes.length>1850000)throw Error('El espacio supera el límite de esta edición.');
    const iv=crypto.getRandomValues(new Uint8Array(12)),ct=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('JAIME/cuenta/'+s.m.id)},s.key,bytes);
    return {v:1,accountId:s.m.id,alg:'A256GCM',iv:to64(iv),ct:to64(ct)};
  }
  async function unseal(s,box){
    if(!box||box.v!==1||box.accountId!==s.m.id||box.alg!=='A256GCM'||typeof box.ct!=='string'||box.ct.length>2600000)throw Error('La copia pertenece a otra cuenta o no es válida.');
    const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(box.iv),additionalData:enc.encode('JAIME/cuenta/'+s.m.id)},s.key,from64(box.ct));return JSON.parse(dec.decode(bytes));
  }
  async function persist(s,box,revision,dirty){
    if(active!==s)throw Error('La cuenta está cerrada.');const updated={box,revision,dirty,stamp:random()};await cas(s.name,s.record?.stamp||null,updated);s.record=updated;
  }
  async function refreshDevice(){
    const b=document.getElementById('googleDevice');if(!b)return;b.hidden=true;
    const id=await kv('get','last.device');if(!/^[0-9a-f]{64}$/.test(id||'')||!window.JaimeGoogleDevice)return;
    const dev=window.JaimeGoogleDevice(kv,id);if(!dev||!await dev.isEnrolled())return;
    b.hidden=false;b.onclick=async()=>{try{const raw=await dev.unlock();if(!raw)throw Error();const m=JSON.parse(raw);
      if(m.id!==id||m.v!==1||!/^[-\w]{43}$/.test(m.seed))throw Error();await enter({m},false);
    }catch{status('El teléfono no ha confirmado el acceso. Puedes continuar con Google.');}};
  }
  async function leave(logout){
    clearTimeout(lockTimer);if(view)await view.close();view=null;const prior=active;active=null;++viewVersion;
    if(logout&&prior){await window.JaimeGoogleDevice(kv,prior.m.id)?.forget();await kv('delete','last.device');}
    document.getElementById('accountPane')?.replaceChildren();handlers?.leaveAccount?.();await refreshDevice();
  }
  async function enter({m,remote,revision,grant},online){
    if(active)await leave(false);const key=await dataKey(m),name='state.'+m.id;
    if(online){const last=await kv('get','last.device');if(last&&last!==m.id)await kv('delete','last.device');}
    const s={m,key,name,record:await kv('get',name)};active=s;const epoch=++viewVersion;
    const ensure=()=>{if(active!==s||epoch!==viewVersion)throw Error('La cuenta está cerrada.');};
    let conflict=false;
    if(online&&remote){await unseal(s,remote);if(!s.record?.dirty||s.record?.box.ct===remote.ct)await persist(s,remote,revision,false);else conflict=revision!==s.record.revision;}
    // Only this verified account's record ever reaches the view.
    const dev=window.JaimeGoogleDevice(kv,m.id),canEnroll=await dev.available();
    handlers.enterAccount(m.id,grant||null,grant?await editionMemoryKey(m):null);const mount=document.getElementById('accountPane');
    const canOpen=grant && typeof window.JaimeCanOpenAssignedEdition==='function' && await window.JaimeCanOpenAssignedEdition(grant);
    view=await window.JaimeAccountView.open({mount,openEdition:canOpen?()=>window.JaimeOpenAssignedEdition(grant,m.id):null,load:async()=>{ensure();return s.record?.box?unseal(s,s.record.box):null;},
      save:async val=>{ensure();await persist(s,await seal(s,val),s.record?.revision||0,true);},
      lock:()=>leave(false),logout:()=>leave(true),enableDevice:canEnroll?async()=>{ensure();
        if(await dev.isEnrolled()||await dev.enroll(JSON.stringify(m))){await kv('put','last.device',m.id);return 'Acceso con el dispositivo activado.';}throw Error('Este dispositivo no ha activado la llave de acceso.');}:null,
      onSync:async()=>{ensure();if(!s.record?.box||!s.record.dirty){await start();return;}
        if(conflict)throw Error('Hay cambios en dos dispositivos. Guarda una copia de cada uno antes de elegir.');
        if(s.record.box.ct.length>7360)throw Error('Esta copia supera el espacio para notas de Google. Guarda la copia cifrada completa en tus Archivos.');
        await start({snapshot:s.record.box,revision:s.record.revision});},
      downloadBackup:async()=>{ensure();if(!s.record?.box)throw Error('Aún no hay cambios que guardar.');
        const file=new Blob([JSON.stringify(s.record.box)],{type:'application/json'}),u=URL.createObjectURL(file),a=document.createElement('a');a.href=u;a.download='Mi_espacio_cifrado_'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);},
      restoreBackup:async f=>{ensure();if(!f||f.size>2600500)throw Error('Copia no válida.');const b=JSON.parse(await f.text()),state=await unseal(s,b);
        if(!state||!Array.isArray(state.projects)||!Array.isArray(state.notes)||!Array.isArray(state.chat)||!Array.isArray(state.documents))throw Error('Estado no válido.');
        await persist(s,b,s.record?.revision||0,true);}
    });
    if(conflict)status('Hay versiones distintas. Tu copia local se ha conservado.');
  }
  async function init(h){
    handlers=h;const fragment=location.hash,callback=fragment.startsWith('#cuenta=');
    if(callback)history.replaceState(null,'',location.pathname);
    const b=document.getElementById('googleAccount');if(b)b.hidden=!usable();
    if(!usable())return;
    try{if(callback)await enter(await consume(fragment),true);else await refreshDevice();}catch(e){if(active)await leave(false);status(e.message||'Vuelve a entrar con Google.');}
  }
  async function repeatedReturn(){
    const fragment=location.hash;
    if(!fragment.startsWith('#cuenta='))return;
    history.replaceState(null,'',location.pathname);
    if(!handlers||!usable())return;
    try{const reply=await consume(fragment);await enter(reply,true);}
    catch(_){status('Vuelve a entrar con Google desde esta aplicación.');}
  }
  window.addEventListener('hashchange',repeatedReturn);
  window.addEventListener('pageshow',e=>{if(e.persisted){opening=false;repeatedReturn();}});
  document.addEventListener('visibilitychange',()=>{clearTimeout(lockTimer);if(document.hidden&&active)lockTimer=setTimeout(()=>leave(false).catch(()=>{}),60000);});
  return Object.freeze({start,init,available:usable});
})();
