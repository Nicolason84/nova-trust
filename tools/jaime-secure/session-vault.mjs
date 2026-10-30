/* Local session envelope only. Message encryption is exclusively Matrix/Rust.
 * WebCrypto AES-256-GCM + PBKDF2-SHA256; no plaintext token in browser storage.
 */
const VERSION = 1;
const ITERATIONS = 600000;
const LABEL = new TextEncoder().encode('ojo.jaime.matrix.session.v1');
const DB = 'ojo-jaime-secure-session-v1';
const STORE = 'envelopes';
const MAX_CIPHERTEXT_BYTES = 65536;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal:true});
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
function unb64(value, min, max) {
  if (typeof value !== 'string' || value.length > Math.ceil(max / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('VAULT_FORMAT');
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  if (bytes.length < min || bytes.length > max) throw new Error('VAULT_FORMAT');
  return bytes;
}
export function validatePhrase(phrase) {
  if (typeof phrase !== 'string' || phrase.trim().length < 14 || phrase.length > 512) throw new Error('VAULT_PHRASE');
  return phrase;
}
export function safeHomeserver(value) {
  if (typeof value !== 'string' || value.length > 2048 || value.includes('?') || value.includes('#')) throw new Error('HOMESERVER_URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('HOMESERVER_URL');
  return url.href.replace(/\/$/, '');
}
function payload(input) {
  if (!input || typeof input !== 'object') throw new Error('VAULT_PAYLOAD');
  const homeserverUrl = safeHomeserver(input.homeserverUrl);
  const valid = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
  if (!valid(input.userId, 255) || !/^@[^:]+:.+/.test(input.userId) || !valid(input.deviceId, 255) || !valid(input.accessToken, 8192)) throw new Error('VAULT_PAYLOAD');
  return {homeserverUrl,userId:input.userId,deviceId:input.deviceId,accessToken:input.accessToken};
}
async function keyFor(phrase, salt) {
  validatePhrase(phrase);
  if (!globalThis.crypto?.subtle) throw new Error('VAULT_UNSUPPORTED');
  const raw = encoder.encode(phrase);
  let material;
  try {material = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey']);}
  finally {raw.fill(0);}
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'}, material, {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
}
export async function sealSession(session, phrase) {
  const data = payload(session);
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(phrase, salt);
  const clear = encoder.encode(JSON.stringify(data));
  if (clear.byteLength > MAX_CIPHERTEXT_BYTES - 16) {clear.fill(0); throw new Error('VAULT_PAYLOAD');}
  let ciphertext;
  try {ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:LABEL,tagLength:128}, key, clear);}
  finally {clear.fill(0);}
  return Object.freeze({version:VERSION,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),ciphertext:b64(ciphertext)});
}
export async function openSession(envelope, phrase) {
  if (!envelope || envelope.version !== VERSION || envelope.kdf !== 'PBKDF2-SHA256' || envelope.iterations !== ITERATIONS || envelope.cipher !== 'AES-256-GCM') throw new Error('VAULT_FORMAT');
  const salt = unb64(envelope.salt,32,32), iv = unb64(envelope.iv,12,12), ciphertext = unb64(envelope.ciphertext,32,MAX_CIPHERTEXT_BYTES);
  const key = await keyFor(phrase,salt);
  let clear;
  try {clear = new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:LABEL,tagLength:128},key,ciphertext));}
  catch {throw new Error('VAULT_LOCKED');}
  try {return payload(JSON.parse(decoder.decode(clear)));}
  finally {clear.fill(0);}
}
function database() {
  return new Promise((resolve,reject) => {
    if (!globalThis.indexedDB) {reject(new Error('VAULT_UNSUPPORTED')); return;}
    let abandoned = false;
    const request = indexedDB.open(DB,1);
    request.onupgradeneeded = () => {if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);};
    request.onsuccess = () => {
      if (abandoned) {request.result.close(); return;}
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => {abandoned = true; reject(new Error('VAULT_STORAGE'));};
    request.onblocked = () => {abandoned = true; reject(new Error('VAULT_BUSY'));};
  });
}
async function transaction(mode, operation) {
  const db = await database();
  return new Promise((resolve,reject) => {
    let result;
    let tx;
    try {tx = db.transaction(STORE,mode);}
    catch {db.close(); reject(new Error('VAULT_STORAGE')); return;}
    tx.oncomplete = () => {db.close(); resolve(result);};
    tx.onabort = tx.onerror = () => {db.close(); reject(new Error('VAULT_STORAGE'));};
    try {const request = operation(tx.objectStore(STORE)); request.onsuccess = () => {result = request.result;};}
    catch {tx.abort();}
  });
}
export const readVault = () => transaction('readonly', store => store.get('active'));
export async function persistSession(session, phrase) {
  // The persistence API only accepts a session to seal itself. It cannot be
  // tricked into storing an arbitrary caller-supplied object as an "envelope".
  const envelope = await sealSession(session,phrase);
  // add() is atomic and rejects an existing key, including a second-tab race.
  return transaction('readwrite', store => store.add(envelope,'active'));
}
export const removeVault = () => transaction('readwrite', store => store.delete('active'));
