(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JaimeLegacy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const PROFILE_KEY = 'ojo-jaime-profile-v1';
  const OLD_PROFILE_KEY = 'nova_client_account_local';
  function text(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
  function timestamp(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null; }
  function parse(value) { return typeof value === 'string' ? JSON.parse(value) : value; }
  function profile(value) {
    const v = parse(value);
    if (!v || v.account_status !== 'created_local' || typeof v.name !== 'string') throw new Error('No es un perfil de la aplicación anterior.');
    return {name: text(v.name, 40), createdAt: timestamp(v.ts), source: OLD_PROFILE_KEY};
  }
  function proofs(value) {
    const v = parse(value);
    if (!v || v.source !== 'JAIME_APP_LOCAL_EXPORT' || !Array.isArray(v.proofs) || !Array.isArray(v.actions)) throw new Error('No es una copia de la aplicación Jaime anterior.');
    if (v.proofs.length > 100 || v.actions.length > 100) throw new Error('La copia contiene demasiadas notas.');
    const entries = [];
    for (const group of ['proofs', 'actions']) for (const row of v[group]) {
      if (!row || typeof row !== 'object') throw new Error('Hay una nota no válida en la copia.');
      const rawBody = group === 'proofs' ? row.note : row.label;
      if (typeof rawBody === 'string' && rawBody.length > 12000) throw new Error('Una nota supera 12 000 caracteres. Divídela antes de recuperarla.');
      const body = text(rawBody, 12000);
      const kind = text(row.type, 120) || (group === 'proofs' ? 'Nota' : 'Acción');
      const createdAt = timestamp(row.createdAt);
      if (!body && !text(row.type, 120)) throw new Error('Hay una nota vacía en la copia.');
      entries.push({key: JSON.stringify([group, kind, body, createdAt]), text: body, kind, createdAt, source: group === 'proofs' ? 'JAIME_APP_LOCAL_PROOF' : 'JAIME_APP_LOCAL_ACTION'});
    }
    return {source: 'JAIME_APP_LOCAL_EXPORT', entries};
  }
  function stored(storage) {
    const found = {profile: null, notes: null, unreadable: false};
    try {const raw = storage.getItem(OLD_PROFILE_KEY); if (raw) found.profile = profile(raw);} catch {found.unreadable = true;}
    try {
      const p = storage.getItem('jaime_local_proofs'), a = storage.getItem('jaime_local_actions');
      if (p || a) found.notes = proofs({source:'JAIME_APP_LOCAL_EXPORT', proofs: p ? JSON.parse(p) : [], actions: a ? JSON.parse(a) : []});
    } catch {found.unreadable = true;}
    return found;
  }
  function saveProfile(storage, name) {
    const record = {version: 1, name: text(name, 40), account_status: 'created_local', updatedAt: new Date().toISOString()};
    storage.setItem(PROFILE_KEY, JSON.stringify(record));
    return record;
  }
  function loadProfile(storage) {
    try {const p = JSON.parse(storage.getItem(PROFILE_KEY)); return p?.version === 1 && p.account_status === 'created_local' && typeof p.name === 'string' ? {...p, name: text(p.name,40)} : null;} catch {return null;}
  }
  return Object.freeze({PROFILE_KEY, OLD_PROFILE_KEY, profile, proofs, stored, saveProfile, loadProfile});
});
