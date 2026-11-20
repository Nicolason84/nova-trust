'use strict';
// A passkey can wrap this browser's edition credential only if its authenticator returns a PRF.
// Both WebAuthn and the PRF run inside a user-verified ceremony on the hosted origin.
window.JaimeBrowserCredentials=function(kv) {
 const field='passkey.wrap.v1', enc=new TextEncoder(),dec=new TextDecoder();
 const bytes=n=>crypto.getRandomValues(new Uint8Array(n));
 const encode=a=>btoa(Array.from(new Uint8Array(a),n=>String.fromCharCode(n)).join(''));
 const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const aad=enc.encode('jaime/pwa/passkey-wrap/v1/'+location.origin+new URL('.',location.href).pathname);
 const key=raw=>crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
 function valid(s){try{const o=JSON.parse(s);return s.length<256&&o.version===1&&/^[0-9a-f]{16}$/i.test(o.editionId)&&/^[A-Z0-9]{24}$/.test(o.editionCode)}catch{return false}}
 async function available(){
  try{if(!window.isSecureContext||!window.PublicKeyCredential||!navigator.credentials?.get||!crypto.subtle)return false;
   if(typeof PublicKeyCredential.getClientCapabilities==='function'){const capabilities=await PublicKeyCredential.getClientCapabilities();if(capabilities['extension:prf']===false)return false}
   return !!await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  }catch{return false}
 }
 async function proof(record){
  const credential=await navigator.credentials.get({publicKey:{challenge:bytes(32),timeout:60000,userVerification:'required',allowCredentials:[{type:'public-key',id:decode(record.id)}],extensions:{prf:{eval:{first:decode(record.salt)}}}}});
  const v=credential?.getClientExtensionResults()?.prf?.results?.first;
  if(!v||encode(credential.rawId)!==record.id)throw Error('La llave de acceso no puede desbloquear este archivo.');return v
 }
 async function enroll(material){
  if(!valid(material)||!await available())return false;
  if(await kv('get',field))return false;
  const salt=bytes(32),cred=await navigator.credentials.create({publicKey:{
   challenge:bytes(32),rp:{name:'Jaime · Mi espacio'},user:{id:bytes(32),name:'mi-espacio',displayName:'Mi espacio personal'},
   pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
   authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'required',userVerification:'required'},
   attestation:'none',timeout:60000,extensions:{prf:{eval:{first:salt}}}
  }});
  if(!cred)return false;
  const result=cred.getClientExtensionResults().prf;if(!result?.enabled&&!result?.results?.first)return false;
  const rec={id:encode(cred.rawId),salt:encode(salt)},raw=result.results?.first||await proof(rec);
  const iv=bytes(12),ct=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},await key(raw),enc.encode(material));rec.iv=encode(iv);rec.ct=encode(ct);
  await kv('put',field,rec);return true
 }
 async function unlock(){const rec=await kv('get',field);if(!rec)return null;
  try{const k=await key(await proof(rec));const value=dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(rec.iv),additionalData:aad},k,decode(rec.ct)));return valid(value)?value:null}catch{return null}}
 return Object.freeze({available,isEnrolled:async()=>!!await kv('get',field),enroll,unlock,forget:async()=>{await kv('delete',field);return true}})
};
