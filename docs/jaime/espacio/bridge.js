'use strict';
(() => {
  const PUBLIC_ORIGIN = 'https://nicolason84.github.io';
  const channel = 'jaime.web.mac.1';
  const encoder = new TextEncoder();
  const text = value => encoder.encode(value);
  const to64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const random = n => to64(crypto.getRandomValues(new Uint8Array(n)));
  const hex = value => Array.from(new Uint8Array(value), b => b.toString(16).padStart(2, '0')).join('');
  const sha = value => crypto.subtle.digest('SHA-256', value);
  const error = message => new Error(message);
  const token = /^[a-zA-Z0-9_-]{43}$/;
  let session = null;

  function exactBase(base) {
    const u = new URL(base), host = u.hostname;
    const ip = host.split('.').map(Number);
    const privateIP = /^\d+\.\d+\.\d+\.\d+$/.test(host) && (ip[0] === 10 || ip[0] === 127 ||
      (ip[0] === 192 && ip[1] === 168) || (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31));
    const localName = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+local$/.test(host);
    if (u.protocol !== 'https:' || u.port !== '45731' || u.username || u.password || u.search ||
        u.hash || u.pathname !== '/' || (!privateIP && !localName && host !== 'localhost') ||
        (base !== u.origin && base !== u.origin + '/')) throw error('Usa la dirección HTTPS local del Mac, con el puerto 45731.');
    return u.origin;
  }
  function fingerprint(value) {
    const fp = String(value || '').replace(/[\s:]/g, '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(fp)) throw error('Copia la huella SHA-256 que muestra el Mac.');
    return fp;
  }
  function bytes(value, limit) {
    if (typeof value !== 'string' || value.length > limit || !/^[A-Za-z0-9_-]+$/.test(value)) throw error('Clave no válida.');
    return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  }
  function part(data, start, end) {
    if (start + 2 > end) throw error('Certificado no válido.');
    const tag = data[start]; let pos = start + 1, size = data[pos++];
    if (size >= 128) {
      const count = size & 127;
      if (!count || count > 4 || pos + count > end) throw error('Certificado no válido.');
      size = 0; for (let i=0; i<count; i++) size = size * 256 + data[pos++];
    }
    if (pos + size > end) throw error('Certificado incompleto.');
    return {tag, start, pos, end:pos + size};
  }
  function certPublicKey(der) {
    const outer = part(der, 0, der.length), tbs = part(der, outer.pos, outer.end);
    if (outer.tag !== 48 || tbs.tag !== 48 || outer.end !== der.length) throw error('Certificado no válido.');
    let field = part(der, tbs.pos, tbs.end);
    if (field.tag === 160) field = part(der, field.end, tbs.end);
    for (let i=0; i<5; i++) field = part(der, field.end, tbs.end);
    if (field.tag !== 48) throw error('Falta la clave certificada.');
    return der.slice(field.start, field.end);
  }
  async function checkKey(s, info) {
    if (info?.v !== 1) throw error('El Mac no ofrece la versión prevista del enlace.');
    const der = bytes(info.cert, 16000), key = bytes(info.spki, 2000), sig = bytes(info.sig, 1500);
    if (hex(await sha(der)) !== s.fp) throw error('La huella del Mac no coincide. Comprueba el certificado en el Mac.');
    const signer = await crypto.subtle.importKey('spki',certPublicKey(der),{name:'RSA-PSS',hash:'SHA-256'},false,['verify']);
    const prefix = text('jaime-bridge-key-v1\x00'), signed = new Uint8Array(prefix.length + key.length);
    signed.set(prefix); signed.set(key,prefix.length);
    if (!await crypto.subtle.verify({name:'RSA-PSS',saltLength:32},signer,sig,signed)) throw error('El Mac no ha acreditado la clave de esta sesión.');
    return crypto.subtle.importKey('spki',key,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
  }
  function close(message) {
    const s = session; session = null;
    if (!s) return;
    clearInterval(s.timer);
    const problem = error(message || 'Enlace cerrado. Autoriza el Mac de nuevo para sincronizar.');
    s.reject?.(problem);
    for (const item of s.pending.values()) { clearTimeout(item.timer); item.reject(problem); }
    s.pending.clear();
    try { s.popup.close(); } catch (_) {}
  }
  async function receive(event) {
    const s = session, d = event.data;
    if (!s || event.origin !== s.base || event.source !== s.popup || !d || d.channel !== channel ||
        d.nonce !== s.nonce || Date.now() >= s.until) return;
    if (d.type === 'ready' && !s.key) { s.popup.postMessage({channel,nonce:s.nonce,type:'hello'},s.base); return; }
    if (d.type === 'closed') { close(); return; }
    if (d.type === 'approved' && !s.key && !s.verifying) {
      s.verifying = true;
      try {
        const key = await checkKey(s,d.info);
        if (session !== s || Date.now() >= s.until || s.popup.closed) return;
        s.key = key; s.until = Date.now() + 5*60*1000;
        s.resolve(true); s.resolve = null; s.reject = null;
      } catch (e) { if (session === s) close(e.message); }
    } else if (d.type === 'result' && s.key && typeof d.requestId === 'string') {
      const item = s.pending.get(d.requestId);
      if (!item || !Number.isInteger(d.status) || d.status < 100 || d.status > 599 ||
          !d.body || typeof d.body !== 'object' || Array.isArray(d.body)) return;
      s.pending.delete(d.requestId); clearTimeout(item.timer); item.resolve({status:d.status,body:d.body});
    }
  }
  function pair(base, fp) {
    try {
      if (location.origin !== PUBLIC_ORIGIN || !window.isSecureContext || !navigator.userActivation?.isActive)
        throw error('Pulsa «Autorizar este Mac» desde el lector HTTPS.');
      base = exactBase(base); fp = fingerprint(fp); close();
      const nonce = random(24);
      const popup = window.open(base + '/identidad/v1/puente#' + nonce, '_blank', 'popup,width=460,height=570');
      if (!popup) throw error('Permite abrir la ventana local y vuelve a pulsar Autorizar.');
      return new Promise((resolve,reject) => {
        const s = {base,fp,popup,nonce,until:Date.now()+120000,resolve,reject,pending:new Map(),vault:null};
        session = s;
        s.timer = setInterval(() => { if (session === s && (Date.now() >= s.until || popup.closed)) close(); },400);
      });
    } catch (e) { return Promise.reject(e); }
  }
  async function request(q) {
    const s = session;
    if (!s?.key || !q || s.until <= Date.now() || s.popup.closed || exactBase(q.base) !== s.base ||
        fingerprint(q.fp) !== s.fp) throw error('Autoriza este Mac en la app web antes de sincronizar.');
    if (!/^[a-f0-9]{32}$/.test(q.id) || !token.test(q.token) || (s.vault && s.vault !== q.id) ||
        !['GET','POST','PUT','DISPLAY'].includes(q.method)) throw error('Solicitud de sincronización no válida.');
    s.vault = q.id;
    let body = '', match = '', invitation = '';
    const path = '/identidad/v1/vaults/' + q.id + (q.method === 'DISPLAY' ? '/display-grants' : '');
    const method = q.method === 'DISPLAY' ? 'POST' : q.method;
    if (method === 'POST') body = '{}';
    if (q.method === 'POST') {
      if (!token.test(q.enrollmentCode)) throw error('Invitación de registro no válida.');
      invitation = q.enrollmentCode;
    }
    if (q.method === 'PUT') {
      const e = q.envelope;
      if (!Number.isSafeInteger(q.revision) || q.revision < 0 || q.revision > 999999999999999 ||
          e?.v !== 1 || e.alg !== 'A256GCM' || typeof e.iv !== 'string' || !/^[\w-]{16}$/.test(e.iv) ||
          typeof e.ct !== 'string' || e.ct.length > 8388500 || !/^[\w-]+$/.test(e.ct)) throw error('Copia cifrada no válida.');
      match = '"' + q.revision + '"';
      body = JSON.stringify({envelope:{v:1,alg:'A256GCM',iv:e.iv,ct:e.ct}});
    }
    const digest = hex(await sha(text(body)));
    const context = to64(await sha(text(['jaime-web-sync-1',method,path,match,digest].join('\n'))));
    const auth = text(JSON.stringify([Math.floor(Date.now()/1000)+40,random(16),context,q.token,invitation]));
    const sealed = to64(await crypto.subtle.encrypt({name:'RSA-OAEP',label:text('jaime-bridge-authorization-v1')},s.key,auth));
    auth.fill(0);
    if (session !== s || s.popup.closed || Date.now() >= s.until) throw error('Ha caducado el enlace con el Mac.');
    const requestId = random(16);
    return new Promise((resolve,reject) => {
      const timer = setTimeout(() => { s.pending.delete(requestId); reject(error('El Mac no ha confirmado la operación. Comprueba la revisión antes de repetirla.')); },15000);
      s.pending.set(requestId,{resolve,reject,timer});
      s.popup.postMessage({channel,nonce:s.nonce,type:'request',requestId,verb:q.method,id:q.id,match,body,sealed},s.base);
    });
  }
  window.addEventListener('message',receive);
  window.addEventListener('pagehide',() => close());
  window.JaimeWebSync = Object.freeze({kind:'web-local',pair,request,close});
})();
