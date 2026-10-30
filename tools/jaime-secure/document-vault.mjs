/* Local files only. No network calls, HTML execution, OCR, model, or disk scan.
 * CAnnoNico 1.1 reduction adapted from the captured source identified below.
 */
export const DOCUMENT_LIMITS = Object.freeze({
  maxFileBytes: 25 * 1024 * 1024, maxTextBytes: 2 * 1024 * 1024,
  maxTextLines: 10000, maxSearchBytes: 64 * 1024, maxDocuments: 1000,
  maxIndexBytes: 32 * 1024 * 1024, maxBackupBytes: 100 * 1024 * 1024,
});
export const CANNONICO_SOURCE = Object.freeze({
  version: '1.1', adaptation: 'ojo-es-1',
  file: 'source-reuse-20261030/cannonico_inputs.js',
  sha256: '7957e5fe608bd8d881e4a1b1c2fde1b7f126e6b2f96aca80ff8aed4ce7a08676',
});
const DB_NAME = 'ojo-jaime-documents-encrypted-v1';
const LOCK_NAME = `${DB_NAME}:write`;
const STORES = ['config', 'metadata', 'files'];
const ITERATIONS = 600000;
const MAX_METADATA_BYTES = 192 * 1024;
const MAX_CONFIG_BYTES = 1024;
const HEADER_SCHEMA = 'OJO_DOCUMENT_VAULT_V1';
const BACKUP_SCHEMA = 'OJO_DOCUMENT_BACKUP_V1';
const ID = /^[a-f0-9]{32}$/;
const HASH = /^[a-f0-9]{64}$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true});
const forbiddenControl = /[\u0000-\u001f\u007f]/;
const TEXT_EXTENSIONS = new Set('txt md markdown csv tsv json jsonl xml html htm svg log ini yaml yml toml js mjs cjs ts css py sql sh c cpp h rs java rb tex rst srt vtt ics eml'.split(' '));
const BINARY_EXTENSIONS = new Set('pdf doc docx xls xlsx ppt pptx odt ods odp zip rar 7z gz tar jpg jpeg png gif webp heic heif avif mp3 m4a wav ogg flac mp4 mov webm avi exe dll wasm'.split(' '));
const FIELDS = ['identity','date','place','people','facts','proofs','timeline','risk','decision','next_action'];

export class DocumentVaultError extends Error {
  constructor(code) { super(code); this.name = 'DocumentVaultError'; this.code = code; }
}
const fail = code => { throw new DocumentVaultError(code); };
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function keys(value, allowed) {
  if (!plain(value) || Object.keys(value).length !== allowed.length || Object.keys(value).some(key => !allowed.includes(key))) fail('DOC_FORMAT');
}
function string(value, max, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > max || forbiddenControl.test(value)) fail('DOC_FORMAT');
  return value;
}
function validatePhrase(phrase) {
  if (typeof phrase !== 'string' || phrase.trim().length < 14 || phrase.length > 512) fail('DOC_PHRASE');
}
function bytes(value, min, max) {
  let result;
  if (value instanceof ArrayBuffer) result = new Uint8Array(value);
  else if (ArrayBuffer.isView(value)) result = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  else fail('DOC_FORMAT');
  if (result.byteLength < min || result.byteLength > max) fail('DOC_FORMAT');
  return result;
}
function b64(value) {
  const source = new Uint8Array(value.buffer ?? value, value.byteOffset ?? 0, value.byteLength);
  let result = '';
  for (let start = 0; start < source.length; start += 4096) result += String.fromCharCode(...source.subarray(start, start + 4096));
  return btoa(result);
}
function unb64(value, min, max) {
  if (typeof value !== 'string' || value.length > Math.ceil(max / 3) * 4 || value.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) fail('DOC_FORMAT');
  let raw;
  try { raw = atob(value); } catch { fail('DOC_FORMAT'); }
  if (raw.length < min || raw.length > max) fail('DOC_FORMAT');
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}
const hex = value => Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('');
function decodeJson(value) {
  try { return JSON.parse(decoder.decode(value)); } catch { fail('DOC_FORMAT'); }
}
const fold = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const extension = name => name.includes('.') ? fold(name.split('.').pop()) : '';
function boundedPrefix(text, max) {
  const encoded = encoder.encode(text);
  if (encoded.length <= max) return {text, truncated: false};
  let end = max;
  while (end > 0 && (encoded[end] & 0xc0) === 0x80) end--;
  return {text: decoder.decode(encoded.subarray(0, end)), truncated: true};
}

// The ten fields, original-line accounting and preserved text follow the actual
// CAnnoNico 1.1 reducer. Spanish expressions are added, without promoting a
// keyword match into a fact, legal conclusion or AI analysis.
export function reduceCannonicoText(text) {
  if (typeof text !== 'string' || encoder.encode(text).byteLength > DOCUMENT_LIMITS.maxTextBytes) fail('DOC_LIMIT');
  const originalLines = text.split('\n');
  if (originalLines.length > DOCUMENT_LIMITS.maxTextLines) fail('DOC_LIMIT');
  const result = Object.fromEntries(FIELDS.map(field => [field, []]));
  const patterns = {
    identity: /\b(né|née|nom|prénom|identité|identity|personne|nombre|apellido|identidad|nacido|nacida)\b/,
    date: /\b(20[0-9]{2}|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|date|heure|fecha|hora|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/,
    place: /\b(lieu|adresse|rue|ville|creil|nogent|oise|place|lugar|direccion|dirección|calle|ciudad|montanchez|montánchez)\b/,
    people: /\b(témoin|temoin|présent|présente|personne|père|mère|enfant|police|hôpital|hopital|avocat|testigo|persona|padre|madre|hijo|hija|policia|policía|hospital|abogado|abogada|proveedor|cliente)\b/,
    facts: /\b(fait|déroulé|arrivé|passé|événement|event|hecho|ocurrio|ocurrió|suceso|sucedio|sucedió)\b/,
    proofs: /\b(preuve|photo|vidéo|video|pdf|scan|certificat|itt|plainte|pv|hash|prueba|foto|certificado|documento|factura|contrato|denuncia)\b/,
    timeline: /\b(timeline|chronologie|avant|pendant|après|ensuite|cronologia|cronología|antes|durante|despues|después|luego)\b/,
    risk: /\b(risque|danger|urgent|stress|menace|violence|agression|riesgo|peligro|urgente|estres|estrés|amenaza|violencia|agresion|agresión)\b/,
    decision: /\b(décision|decision|choisir|valider|refuser|bloquer|decisión|elegir|validar|rechazar|bloquear|acuerdo)\b/,
    next_action: /\b(action|next|prochaine|faire|go|reduce|clarify|protect|accion|acción|proxima|próxima|hacer|llamar|enviar|revisar|negociar)\b/,
  };
  const lines = originalLines.map(line => line.trim()).filter(Boolean);
  for (const line of lines) for (const field of FIELDS) if (patterns[field].test(line.toLowerCase())) result[field].push(line);
  const classified = new Set(Object.values(result).flat());
  const unclassified = originalLines.map((line, index) => ({line_number: index + 1, text: line})).filter(row => row.text.trim() && !classified.has(row.text.trim()));
  const signals = FIELDS.filter(field => result[field].length).map(field => ({field, count: result[field].length, items: result[field].slice(0, 3)}));
  return {
    schema: 'CANNONICO_REDUCTION_V1', canon: 'CAnnoNico', source: null, reducer_source: CANNONICO_SOURCE,
    preserved_text: text, unclassified_lines: unclassified, result, signals,
    extraction_status: 'TEXT_RECEIVED', extraction_losses: [],
    coverage: {input_nonempty_lines: lines.length, classified_lines: lines.length - unclassified.length,
      unclassified_lines: unclassified.length, blank_lines: originalLines.filter(line => !line.trim()).length,
      structured_parsing: false, source_integrity: 'NO_SOURCE_REFERENCE',
      normalization: 'La clasificación recorta los espacios; preserved_text conserva el texto admitido.'},
    canonical_promotion: false, native_effect_status: 'NOT_PROVEN', relief: 'NOT_MEASURED',
    next_action: signals.length ? 'Revisar las señales y elegir una próxima acción.' : 'Revisar el original y añadir contexto.',
  };
}

export function classifyDocument(name, type = '') {
  const value = fold(name), ext = extension(name);
  if (/\b(caza|caceria|cinegetic|monteria|perdiz|jabal[ií])/.test(value)) return 'caza';
  if (/\b(toro|toros|tauromaquia|taurino|corrida)/.test(value)) return 'tauromaquia';
  if (/\b(contrat|abogad|juridic|denuncia|juzgado|sentencia|legal)/.test(value)) return 'juridico';
  if (/\b(factura|presupuesto|banco|impuesto|cuenta|nomina|iva)/.test(value)) return 'finanzas';
  if (/\b(medic|salud|receta|analisis|hospital)/.test(value)) return 'salud';
  if (/\b(oracion|iglesia|biblia|parroquia|cristo)/.test(value)) return 'fe';
  if (/\b(hotel|viaje|turismo|reserva|ruta)/.test(value)) return 'viajes';
  if (/\b(cliente|proveedor|negocio|export|producto|venta|tobias)/.test(value)) return 'negocios';
  if (type.startsWith('image/') || ['jpg','jpeg','png','heic','heif','gif','webp','avif','svg'].includes(ext)) return 'fotos';
  if (type.startsWith('audio/') || ['mp3','m4a','wav','ogg','flac'].includes(ext)) return 'audio';
  if (type.startsWith('video/') || ['mp4','mov','webm','avi'].includes(ext)) return 'video';
  return TEXT_EXTENSIONS.has(ext) || ['pdf','doc','docx','xls','xlsx','ppt','pptx','odt','ods'].includes(ext) ? 'documentos' : 'otros';
}
function analyze(bytesValue, name, type) {
  const limitations = [];
  if (bytesValue.byteLength > DOCUMENT_LIMITS.maxTextBytes) return {text: null, reduction: null, indexText: '', status: 'ORIGINAL_ONLY', limitations: ['TEXT_OVER_2_MIB']};
  const ext = extension(name);
  if (BINARY_EXTENSIONS.has(ext) || (/^(image|audio|video)\//.test(type) && type !== 'image/svg+xml')) return {text: null, reduction: null, indexText: '', status: 'ORIGINAL_ONLY', limitations: ['NO_FORMAT_EXTRACTOR']};
  let text;
  try { text = decoder.decode(bytesValue); } catch { return {text: null, reduction: null, indexText: '', status: 'ORIGINAL_ONLY', limitations: ['NOT_VALID_UTF8']}; }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) return {text: null, reduction: null, indexText: '', status: 'ORIGINAL_ONLY', limitations: ['BINARY_CONTENT']};
  const lines = text.split('\n');
  const reductionText = lines.length > DOCUMENT_LIMITS.maxTextLines ? lines.slice(0, DOCUMENT_LIMITS.maxTextLines).join('\n') : text;
  if (lines.length > DOCUMENT_LIMITS.maxTextLines) limitations.push('REDUCTION_FIRST_10000_LINES');
  const prefix = boundedPrefix(text, DOCUMENT_LIMITS.maxSearchBytes);
  if (prefix.truncated) limitations.push('SEARCH_FIRST_64_KIB');
  const reduction = reduceCannonicoText(reductionText);
  if (lines.length > DOCUMENT_LIMITS.maxTextLines) { reduction.extraction_status = 'PARTIAL'; reduction.extraction_losses = [{code: 'REDUCTION_FIRST_10000_LINES'}]; }
  return {text, reduction, indexText: prefix.text, status: limitations.length ? 'TEXT_LIMITED' : 'TEXT_ANALYZED', limitations};
}
function tags(value) {
  if (!Array.isArray(value) || value.length > 16) fail('DOC_FORMAT');
  return [...new Set(value.map(tag => string(tag, 48).trim()))];
}
function category(value) { return string(value, 64).trim(); }
function displayName(value) { return value === null ? null : string(value, 512).trim(); }
function metadata(value) {
  keys(value, ['id','name','nameDisplay','type','size','category','tags','hash','analysisStatus','addedAt','indexText','limitations']);
  if (!ID.test(value.id) || !HASH.test(value.hash) || !Number.isSafeInteger(value.size) || value.size < 0 || value.size > DOCUMENT_LIMITS.maxFileBytes) fail('DOC_FORMAT');
  string(value.name, 512); displayName(value.nameDisplay); string(value.type, 255);
  if (!/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(value.type)) fail('DOC_FORMAT');
  category(value.category); tags(value.tags);
  if (!['TEXT_ANALYZED','TEXT_LIMITED','ORIGINAL_ONLY'].includes(value.analysisStatus) || typeof value.addedAt !== 'string' || value.addedAt.length > 40 || !Number.isFinite(Date.parse(value.addedAt))) fail('DOC_FORMAT');
  if (typeof value.indexText !== 'string' || encoder.encode(value.indexText).byteLength > DOCUMENT_LIMITS.maxSearchBytes || !Array.isArray(value.limitations) || value.limitations.length > 8 || value.limitations.some(item => typeof item !== 'string' || !/^[A-Z0-9_]{1,64}$/.test(item))) fail('DOC_FORMAT');
  return value;
}
function publicMetadata(value) {
  return {id:value.id, name:value.name, nameDisplay:value.nameDisplay, type:value.type, size:value.size,
    category:value.category, tags:[...value.tags], hash:value.hash, analysisStatus:value.analysisStatus, addedAt:value.addedAt};
}
function record(value, max) {
  keys(value, ['id','version','iv','ciphertext']);
  if (!ID.test(value.id) || value.version !== 1) fail('DOC_FORMAT');
  bytes(value.iv,12,12); bytes(value.ciphertext,16,max);
  return value;
}
function header(value) {
  keys(value, ['schema','version','vaultId','kdf','iterations','cipher','salt','iv','ciphertext']);
  if (value.schema !== HEADER_SCHEMA || value.version !== 1 || !ID.test(value.vaultId) || value.kdf !== 'PBKDF2-SHA256' || value.iterations !== ITERATIONS || value.cipher !== 'AES-256-GCM') fail('DOC_FORMAT');
  bytes(value.salt,32,32); bytes(value.iv,12,12); bytes(value.ciphertext,16,MAX_CONFIG_BYTES);
  return value;
}
function packHeader(value) {
  header(value);
  return {...value, salt:b64(value.salt), iv:b64(value.iv), ciphertext:b64(value.ciphertext)};
}
function unpackHeader(value) {
  keys(value,['schema','version','vaultId','kdf','iterations','cipher','salt','iv','ciphertext']);
  return header({...value,salt:unb64(value.salt,32,32),iv:unb64(value.iv,12,12),ciphertext:unb64(value.ciphertext,16,MAX_CONFIG_BYTES)});
}
function packRecord(value, max) { record(value,max); return {id:value.id,version:1,iv:b64(value.iv),ciphertext:b64(value.ciphertext)}; }
function unpackRecord(value, max) {
  keys(value,['id','version','iv','ciphertext']);
  return record({id:value.id,version:value.version,iv:unb64(value.iv,12,12),ciphertext:unb64(value.ciphertext,16,max)},max);
}

export function createDocumentVault(options = {}) {
  const cryptoProvider = options.crypto ?? globalThis.crypto;
  const idb = options.indexedDB ?? globalThis.indexedDB;
  const locks = options.locks ?? globalThis.navigator?.locks;
  let activeKey = null, activeHeader = null, epoch = 0, index = new Map();
  const transactions = new Set();
  const checkCrypto = () => { if (!cryptoProvider?.subtle || !cryptoProvider?.getRandomValues) fail('DOC_UNSUPPORTED'); };
  const randomId = () => hex(cryptoProvider.getRandomValues(new Uint8Array(16)));
  const checkEpoch = stamp => { if (stamp !== epoch) fail('DOC_CANCELLED'); };
  const session = () => { if (!activeKey || !activeHeader) fail('DOC_LOCKED'); return {key:activeKey, header:activeHeader, stamp:epoch}; };
  const ensureSession = state => { checkEpoch(state.stamp); if (!activeKey) fail('DOC_LOCKED'); };
  const aad = (vaultId, kind, id = '') => encoder.encode(`ojo.jaime.documents.v1|${vaultId}|${kind}|${id}`);
  async function derive(phrase, salt) {
    validatePhrase(phrase); checkCrypto();
    const clear = encoder.encode(phrase);
    let material;
    try { material = await cryptoProvider.subtle.importKey('raw',clear,'PBKDF2',false,['deriveKey']); }
    finally { clear.fill(0); }
    return cryptoProvider.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',iterations:ITERATIONS,salt},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function encrypt(clear, key, associatedData) {
    const iv = cryptoProvider.getRandomValues(new Uint8Array(12));
    const ciphertext = await cryptoProvider.subtle.encrypt({name:'AES-GCM',iv,additionalData:associatedData,tagLength:128},key,clear);
    return {iv,ciphertext};
  }
  async function decrypt(value, key, associatedData) {
    try { return new Uint8Array(await cryptoProvider.subtle.decrypt({name:'AES-GCM',iv:value.iv,additionalData:associatedData,tagLength:128},key,value.ciphertext)); }
    catch { fail('DOC_AUTH'); }
  }
  async function verifyHeader(value, key) {
    header(value);
    const clear = await decrypt(value,key,aad(value.vaultId,'header'));
    try {
      const decoded = decodeJson(clear);
      keys(decoded,['marker','vaultId']);
      if (decoded.marker !== HEADER_SCHEMA || decoded.vaultId !== value.vaultId) fail('DOC_AUTH');
    } finally { clear.fill(0); }
  }
  async function encryptMetadata(value, state) {
    metadata(value);
    const clear = encoder.encode(JSON.stringify(value));
    if (clear.byteLength + 16 > MAX_METADATA_BYTES) { clear.fill(0); fail('DOC_LIMIT'); }
    try { return {id:value.id,version:1,...await encrypt(clear,state.key,aad(state.header.vaultId,'metadata',value.id))}; }
    finally { clear.fill(0); }
  }
  async function decryptMetadata(value, state) {
    record(value,MAX_METADATA_BYTES);
    const clear = await decrypt(value,state.key,aad(state.header.vaultId,'metadata',value.id));
    try {
      const result = metadata(decodeJson(clear));
      if (result.id !== value.id) fail('DOC_AUTH');
      return result;
    } finally { clear.fill(0); }
  }
  const currentHeader = (stored,state) => {
    header(stored);
    if (JSON.stringify(packHeader(stored)) !== JSON.stringify(packHeader(state.header))) fail('DOC_STALE');
  };
  async function exclusive(callback) {
    if (!locks?.request) fail('DOC_LOCKS_UNAVAILABLE');
    return locks.request(LOCK_NAME,{mode:'exclusive'},callback);
  }
  function openDatabase() {
    return new Promise((resolve,reject) => {
      if (!idb?.open) { reject(new DocumentVaultError('DOC_UNSUPPORTED')); return; }
      let request, abandoned = false;
      const rejectOnce = code => { if (!abandoned) { abandoned = true; reject(new DocumentVaultError(code)); } };
      try { request = idb.open(DB_NAME,1); } catch { rejectOnce('DOC_STORAGE'); return; }
      request.onupgradeneeded = () => {
        try { for (const name of STORES) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name); }
        catch { try { request.transaction.abort(); } catch {} rejectOnce('DOC_STORAGE'); }
      };
      request.onblocked = () => rejectOnce('DOC_BUSY');
      request.onerror = () => rejectOnce('DOC_STORAGE');
      request.onsuccess = () => {
        const db = request.result;
        if (abandoned) { db.close(); return; }
        if (STORES.some(name => !db.objectStoreNames.contains(name))) { db.close(); rejectOnce('DOC_STORAGE'); return; }
        db.onversionchange = () => db.close();
        resolve(db);
      };
    });
  }
  async function transact(names, mode, operation, stamp) {
    const db = await openDatabase();
    if (stamp !== undefined && stamp !== epoch) { db.close(); fail('DOC_CANCELLED'); }
    return new Promise((resolve,reject) => {
      let tx, finished = false;
      const state = {value: undefined};
      const finish = error => {
        if (finished) return;
        finished = true; if (tx) transactions.delete(tx); db.close();
        if (error) reject(new DocumentVaultError(error)); else resolve(state.value);
      };
      try {
        tx = db.transaction(names,mode); transactions.add(tx);
        tx.oncomplete = () => finish();
        tx.onabort = () => finish(stamp !== undefined && stamp !== epoch ? 'DOC_CANCELLED' : 'DOC_STORAGE');
        tx.onerror = () => {};
        operation(tx,state);
      } catch { try { tx?.abort(); } catch {} finish('DOC_STORAGE'); }
    });
  }
  const capture = (request, callback) => { request.onsuccess = () => callback(request.result); };
  const readMetadata = () => transact(STORES,'readonly',(tx,state) => {
    const output = {header:null,rows:[],contentCount:0}; state.value = output;
    capture(tx.objectStore('config').get('root'),value => { output.header = value ?? null; });
    capture(tx.objectStore('metadata').getAll(),value => { output.rows = value; });
    capture(tx.objectStore('files').count(),value => { output.contentCount = value; });
  });
  const readBundle = id => transact(STORES,'readonly',(tx,state) => {
    const output = {}; state.value = output;
    capture(tx.objectStore('config').get('root'),value => { output.header = value; });
    capture(tx.objectStore('metadata').get(id),value => { output.metadata = value; });
    capture(tx.objectStore('files').get(id),value => { output.content = value; });
  });
  function validateRows(snapshot) {
    if (!Array.isArray(snapshot.rows) || snapshot.rows.length > DOCUMENT_LIMITS.maxDocuments || snapshot.contentCount !== snapshot.rows.length) fail('DOC_FORMAT');
    let size = 0;
    const seen = new Set();
    for (const row of snapshot.rows) {
      record(row,MAX_METADATA_BYTES);
      if (seen.has(row.id)) fail('DOC_FORMAT'); seen.add(row.id);
      size += row.ciphertext.byteLength;
    }
    if (size > DOCUMENT_LIMITS.maxIndexBytes) fail('DOC_LIMIT');
    return size;
  }
  async function decodedIndex(snapshot,state) {
    currentHeader(snapshot.header,state); validateRows(snapshot);
    const next = new Map();
    for (const row of snapshot.rows) { const value = await decryptMetadata(row,state); checkEpoch(state.stamp); next.set(value.id,value); }
    return next;
  }
  async function refresh(state) {
    const snapshot = await readMetadata();
    const next = await decodedIndex(snapshot,state);
    ensureSession(state); index = next;
    return snapshot;
  }
  const writeRecords = (records,state) => transact(['metadata','files'],'readwrite',tx => {
    for (const item of records) {
      tx.objectStore('metadata').add(item.metadata,item.metadata.id);
      tx.objectStore('files').add(item.content,item.content.id);
    }
  },state.stamp);
  async function buildRecord(clear,name,type,options,state,addedAt = new Date().toISOString()) {
    string(name,512);
    const id = randomId();
    const hash = hex(await cryptoProvider.subtle.digest('SHA-256',clear));
    const analysis = analyze(clear,name,type);
    const value = metadata({id,name,nameDisplay:null,type,size:clear.byteLength,
      category:options.category === undefined ? classifyDocument(name,type) : category(options.category),
      tags:options.tags === undefined ? [] : tags(options.tags),hash,analysisStatus:analysis.status,addedAt,
      indexText:analysis.indexText,limitations:analysis.limitations});
    const meta = await encryptMetadata(value,state);
    const content = {id,version:1,...await encrypt(clear,state.key,aad(state.header.vaultId,'content',id))};
    return {metadata:meta,content,value};
  }
  async function original(id,state) {
    if (typeof id !== 'string' || !ID.test(id)) fail('DOC_FORMAT');
    const bundle = await readBundle(id);
    ensureSession(state); currentHeader(bundle.header,state);
    if (!bundle.metadata || !bundle.content) fail('DOC_NOT_FOUND');
    record(bundle.content,DOCUMENT_LIMITS.maxFileBytes + 16);
    if (bundle.content.id !== id || bundle.metadata.id !== id) fail('DOC_AUTH');
    const value = await decryptMetadata(bundle.metadata,state);
    const clear = await decrypt(bundle.content,state.key,aad(state.header.vaultId,'content',id));
    try {
      if (clear.byteLength !== value.size || hex(await cryptoProvider.subtle.digest('SHA-256',clear)) !== value.hash) fail('DOC_AUTH');
      ensureSession(state);
      return {value,clear};
    } catch (error) { clear.fill(0); throw error; }
  }
  function lock() {
    epoch++;
    activeKey = null; activeHeader = null;
    for (const value of index.values()) value.indexText = '';
    index.clear(); index = new Map();
    for (const tx of transactions) try { tx.abort(); } catch {}
  }
  async function unlock(phrase) {
    validatePhrase(phrase); checkCrypto(); lock();
    const stamp = epoch;
    let snapshot = await readMetadata(), created = false, key;
    checkEpoch(stamp);
    if (!snapshot.header) {
      await exclusive(async () => {
        snapshot = await readMetadata(); checkEpoch(stamp);
        if (snapshot.header) return;
        if (snapshot.rows.length || snapshot.contentCount) fail('DOC_FORMAT');
        const salt = cryptoProvider.getRandomValues(new Uint8Array(32)), vaultId = randomId();
        key = await derive(phrase,salt); checkEpoch(stamp);
        const clear = encoder.encode(JSON.stringify({marker:HEADER_SCHEMA,vaultId}));
        let encrypted;
        try { encrypted = await encrypt(clear,key,aad(vaultId,'header')); } finally { clear.fill(0); }
        checkEpoch(stamp);
        const configuration = {schema:HEADER_SCHEMA,version:1,vaultId,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-256-GCM',salt,...encrypted};
        await transact(['config'],'readwrite',tx => tx.objectStore('config').add(configuration,'root'),stamp);
        snapshot.header = configuration; created = true;
      });
    }
    header(snapshot.header);
    key ??= await derive(phrase,snapshot.header.salt);
    checkEpoch(stamp); await verifyHeader(snapshot.header,key); checkEpoch(stamp);
    const state = {key,header:snapshot.header,stamp};
    const next = await decodedIndex(snapshot,state); checkEpoch(stamp);
    activeKey = key; activeHeader = snapshot.header; index = next;
    return {created,count:index.size};
  }
  async function importFile(file, fileOptions = {}) {
    const state = session();
    if (!plain(fileOptions) || Object.keys(fileOptions).some(key => !['category','tags'].includes(key))) fail('DOC_FORMAT');
    if (!(file instanceof Blob) || typeof file.name !== 'string' || !Number.isSafeInteger(file.size)) fail('DOC_FORMAT');
    if (file.size > DOCUMENT_LIMITS.maxFileBytes) fail('DOC_FILE_TOO_LARGE');
    const name = string(file.name,512);
    const type = typeof file.type === 'string' && /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(file.type) && file.type.length <= 255 ? file.type : 'application/octet-stream';
    const clear = new Uint8Array(await file.arrayBuffer());
    try {
      if (clear.byteLength !== file.size || clear.byteLength > DOCUMENT_LIMITS.maxFileBytes) fail('DOC_FILE_TOO_LARGE');
      ensureSession(state);
      const item = await buildRecord(clear,name,type,fileOptions,state);
      ensureSession(state);
      return await exclusive(async () => {
        ensureSession(state);
        const snapshot = await refresh(state);
        if (snapshot.rows.length >= DOCUMENT_LIMITS.maxDocuments || validateRows(snapshot) + item.metadata.ciphertext.byteLength > DOCUMENT_LIMITS.maxIndexBytes) fail('DOC_LIMIT');
        ensureSession(state); await writeRecords([item],state); ensureSession(state);
        index.set(item.value.id,item.value);
        return publicMetadata(item.value);
      });
    } finally { clear.fill(0); }
  }
  async function search(query = '') {
    const state = session();
    if (typeof query !== 'string' || query.length > 512) fail('DOC_FORMAT');
    await refresh(state);
    const terms = fold(query).trim().split(/\s+/).filter(Boolean);
    return [...index.values()].filter(value => {
      const haystack = fold([value.name,value.nameDisplay ?? '',value.category,...value.tags,value.indexText].join('\n'));
      return terms.every(term => haystack.includes(term));
    }).sort((a,b) => b.addedAt.localeCompare(a.addedAt) || a.name.localeCompare(b.name,'es')).map(publicMetadata);
  }
  async function retrieve(id) {
    const state = session(), item = await original(id,state);
    try { ensureSession(state); return new Blob([item.clear],{type:item.value.type}); }
    finally { item.clear.fill(0); }
  }
  async function details(id) {
    const state = session(), item = await original(id,state);
    try {
      const analysis = analyze(item.clear,item.value.name,item.value.type); ensureSession(state);
      if (analysis.reduction) {
        analysis.reduction.source = {name:item.value.name,bytes:item.value.size,sha256:item.value.hash};
        analysis.reduction.coverage.source_integrity = 'ORIGINAL_HASH_VERIFIED_BY_DOCUMENT_VAULT';
      }
      return {document:publicMetadata(item.value),text:analysis.text,reduction:analysis.reduction,limitations:analysis.limitations};
    } finally { item.clear.fill(0); }
  }
  async function updateMetadata(id,patch) {
    const state = session();
    if (typeof id !== 'string' || !ID.test(id) || !plain(patch) || Object.keys(patch).some(key => !['category','tags','nameDisplay'].includes(key))) fail('DOC_FORMAT');
    return exclusive(async () => {
      await refresh(state);
      const previous = index.get(id); if (!previous) fail('DOC_NOT_FOUND');
      const value = {...previous};
      if ('category' in patch) value.category = category(patch.category);
      if ('tags' in patch) value.tags = tags(patch.tags);
      if ('nameDisplay' in patch) value.nameDisplay = displayName(patch.nameDisplay);
      const encrypted = await encryptMetadata(value,state); ensureSession(state);
      const snapshot = await readMetadata(); currentHeader(snapshot.header,state);
      const previousBytes = snapshot.rows.find(row => row.id === id)?.ciphertext.byteLength;
      if (previousBytes === undefined) fail('DOC_NOT_FOUND');
      if (validateRows(snapshot) - previousBytes + encrypted.ciphertext.byteLength > DOCUMENT_LIMITS.maxIndexBytes) fail('DOC_LIMIT');
      ensureSession(state);
      await transact(['metadata'],'readwrite',tx => tx.objectStore('metadata').put(encrypted,id),state.stamp);
      ensureSession(state); index.set(id,value); return publicMetadata(value);
    });
  }
  async function deleteFile(id) {
    const state = session();
    if (typeof id !== 'string' || !ID.test(id)) fail('DOC_FORMAT');
    return exclusive(async () => {
      await refresh(state); const existed = index.has(id); ensureSession(state);
      await transact(['metadata','files'],'readwrite',tx => { tx.objectStore('metadata').delete(id); tx.objectStore('files').delete(id); },state.stamp);
      ensureSession(state); index.delete(id); return existed;
    });
  }
  async function exportBackup() {
    const state = session();
    return exclusive(async () => {
      const snapshot = await refresh(state);
      let estimated = 4096;
      for (const row of snapshot.rows) estimated += Math.ceil((index.get(row.id).size + 16) / 3) * 4 + Math.ceil(row.ciphertext.byteLength / 3) * 4 + 1024;
      if (estimated > DOCUMENT_LIMITS.maxBackupBytes) fail('DOC_LIMIT');
      const contents = await transact(['files'],'readonly',(tx,result) => capture(tx.objectStore('files').getAll(),value => { result.value = value; }));
      ensureSession(state);
      const byId = new Map(contents.map(value => [value.id,record(value,DOCUMENT_LIMITS.maxFileBytes + 16)]));
      if (byId.size !== snapshot.rows.length) fail('DOC_FORMAT');
      const documents = snapshot.rows.map(value => {
        const content = byId.get(value.id); if (!content) fail('DOC_FORMAT');
        if (content.ciphertext.byteLength !== index.get(value.id).size + 16) fail('DOC_FORMAT');
        return {metadata:packRecord(value,MAX_METADATA_BYTES),content:packRecord(content,DOCUMENT_LIMITS.maxFileBytes + 16)};
      });
      const json = JSON.stringify({schema:BACKUP_SCHEMA,header:packHeader(snapshot.header),documents});
      if (encoder.encode(json).byteLength > DOCUMENT_LIMITS.maxBackupBytes) fail('DOC_LIMIT');
      ensureSession(state); return new Blob([json],{type:'application/json'});
    });
  }
  async function importBackup(file, backupPhrase) {
    const state = session(); validatePhrase(backupPhrase);
    if (!(file instanceof Blob) || file.size > DOCUMENT_LIMITS.maxBackupBytes) fail('DOC_LIMIT');
    const text = await file.text(); ensureSession(state);
    if (encoder.encode(text).byteLength > DOCUMENT_LIMITS.maxBackupBytes) fail('DOC_LIMIT');
    let parsed;
    try { parsed = JSON.parse(text); } catch { fail('DOC_FORMAT'); }
    keys(parsed,['schema','header','documents']);
    if (parsed.schema !== BACKUP_SCHEMA || !Array.isArray(parsed.documents) || parsed.documents.length > DOCUMENT_LIMITS.maxDocuments) fail('DOC_FORMAT');
    const sourceHeader = unpackHeader(parsed.header);
    let sourceKey = await derive(backupPhrase,sourceHeader.salt);
    try {
      await verifyHeader(sourceHeader,sourceKey); ensureSession(state);
      const sourceState = {key:sourceKey,header:sourceHeader,stamp:state.stamp};
      const seen = new Set(), pending = [];
      let indexBytes = 0;
      for (const document of parsed.documents) {
        keys(document,['metadata','content']);
        const meta = unpackRecord(document.metadata,MAX_METADATA_BYTES);
        const content = unpackRecord(document.content,DOCUMENT_LIMITS.maxFileBytes + 16);
        if (meta.id !== content.id || seen.has(meta.id)) fail('DOC_FORMAT'); seen.add(meta.id);
        indexBytes += meta.ciphertext.byteLength; if (indexBytes > DOCUMENT_LIMITS.maxIndexBytes) fail('DOC_LIMIT');
        const value = await decryptMetadata(meta,sourceState);
        const clear = await decrypt(content,sourceKey,aad(sourceHeader.vaultId,'content',content.id));
        try {
          if (clear.byteLength !== value.size || hex(await cryptoProvider.subtle.digest('SHA-256',clear)) !== value.hash) fail('DOC_AUTH');
          ensureSession(state);
          const item = await buildRecord(clear,value.name,value.type,{category:value.category,tags:value.tags},state,value.addedAt);
          if (value.nameDisplay !== null) { item.value.nameDisplay = value.nameDisplay; item.metadata = await encryptMetadata(item.value,state); }
          pending.push(item);
        } finally { clear.fill(0); }
      }
      return await exclusive(async () => {
        const snapshot = await refresh(state);
        const fingerprint = value => JSON.stringify([value.hash,value.name,value.nameDisplay,value.type,value.category,value.tags,value.addedAt]);
        const existing = new Set([...index.values()].map(fingerprint));
        const additions = pending.filter(item => { const identity = fingerprint(item.value); if (existing.has(identity)) return false; existing.add(identity); return true; });
        if (snapshot.rows.length + additions.length > DOCUMENT_LIMITS.maxDocuments || validateRows(snapshot) + additions.reduce((sum,item) => sum + item.metadata.ciphertext.byteLength,0) > DOCUMENT_LIMITS.maxIndexBytes) fail('DOC_LIMIT');
        ensureSession(state); if (additions.length) await writeRecords(additions,state); ensureSession(state);
        for (const item of additions) index.set(item.value.id,item.value);
        return {imported:additions.length,skipped:pending.length - additions.length};
      });
    } finally { sourceKey = null; }
  }
  return Object.freeze({get isUnlocked() { return !!activeKey; },unlock,lock,importFile,search,list:() => search(''),retrieve,details,updateMetadata,deleteFile,exportBackup,importBackup});
}
