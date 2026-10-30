import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {createDocumentVault, DOCUMENT_LIMITS, CANNONICO_SOURCE, reduceCannonicoText, classifyDocument} from '../document-vault.mjs';

const PHRASE = 'cuatro palabras privadas diferentes 123';
const OTHER_PHRASE = 'otras palabras privadas distintas 456';
const DB = 'ojo-jaime-documents-encrypted-v1';
function memoryLocks() {
  let tail = Promise.resolve();
  return {request(name, options, callback) {
    assert.equal(options.mode,'exclusive');
    const operation = tail.then(() => callback({name,mode:options.mode}));
    tail = operation.catch(() => {});
    return operation;
  }};
}
function environment() {
  const indexedDB = new IDBFactory(), locks = memoryLocks();
  return {indexedDB,locks,vault:createDocumentVault({indexedDB,locks})};
}
const textFile = (text, name = 'notas.txt') => new File([text],name,{type:'text/plain'});
const code = expected => error => error?.code === expected;
async function rawTransaction(indexedDB,names,mode,operation) {
  const db = await new Promise((resolve,reject) => { const request = indexedDB.open(DB,1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  return new Promise((resolve,reject) => {
    const tx = db.transaction(names,mode), output = {};
    tx.oncomplete = () => { db.close(); resolve(output); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    operation(tx,output);
  });
}
async function rawSnapshot(indexedDB) {
  return rawTransaction(indexedDB,['config','metadata','files'],'readonly',(tx,result) => {
    for (const store of ['config','metadata','files']) { const request = tx.objectStore(store).getAll(); request.onsuccess = () => { result[store] = request.result; }; }
  });
}
async function replaceRecord(indexedDB,store,id,change) {
  await rawTransaction(indexedDB,[store],'readwrite',tx => {
    const objectStore = tx.objectStore(store), request = objectStore.get(id);
    request.onsuccess = () => objectStore.put(change(request.result),id);
  });
}

test('CAnnoNico source fields and Spanish signals are used without claiming AI or losing admitted text', () => {
  const input = 'Nombre: Jaime\nFecha: 2026-10-30\nLugar: Montánchez\nLlamar al proveedor\nUna línea sin señal\n';
  const result = reduceCannonicoText(input);
  assert.equal(result.preserved_text,input);
  assert.equal(result.canonical_promotion,false);
  assert.equal(result.native_effect_status,'NOT_PROVEN');
  assert.equal(result.coverage.source_integrity,'NO_SOURCE_REFERENCE');
  assert.equal(result.reducer_source.sha256,CANNONICO_SOURCE.sha256);
  assert.ok(result.result.identity.includes('Nombre: Jaime'));
  assert.ok(result.result.next_action.includes('Llamar al proveedor'));
  assert.ok(result.unclassified_lines.some(line => line.text === 'Una línea sin señal'));
  assert.equal(classifyDocument('Contrato Tobias.pdf','application/pdf'),'juridico');
  assert.equal(classifyDocument('monteria.jpg','image/jpeg'),'caza');
  assert.equal(classifyDocument('tauromaquia.mp4','video/mp4'),'tauromaquia');
  assert.throws(() => reduceCannonicoText('x\n'.repeat(10001)),code('DOC_LIMIT'));
});

test('original bytes and all metadata are encrypted at rest, searchable after reopening, and not altered', async () => {
  const {vault,indexedDB} = environment();
  assert.deepEqual(await vault.unlock(PHRASE),{created:true,count:0});
  const original = 'Factura privada secreta\nLlamar a Tobías mañana.\n';
  const row = await vault.importFile(textFile(original,'factura-confidencial.txt'),{category:'negocios',tags:['Tobías','Montánchez']});
  assert.equal(row.hash,createHash('sha256').update(original).digest('hex'));
  assert.equal(row.category,'negocios');
  assert.equal(row.analysisStatus,'TEXT_ANALYZED');
  const stored = await rawSnapshot(indexedDB);
  assert.deepEqual(Object.keys(stored.metadata[0]).sort(),['ciphertext','id','iv','version']);
  assert.deepEqual(Object.keys(stored.files[0]).sort(),['ciphertext','id','iv','version']);
  const config = stored.config[0];
  assert.equal(config.iterations,600000); assert.equal(config.kdf,'PBKDF2-SHA256'); assert.equal(config.cipher,'AES-256-GCM');
  assert.equal(config.salt.byteLength,32); assert.equal(config.iv.byteLength,12);
  assert.equal(stored.files[0].ciphertext.byteLength,new TextEncoder().encode(original).byteLength + 16);
  for (const record of [...stored.metadata,...stored.files,config]) {
    const ciphertext = Buffer.from(record.ciphertext).toString('utf8');
    assert.ok(!ciphertext.includes(original)); assert.ok(!ciphertext.includes(row.name));
  }
  vault.lock(); assert.equal(vault.isUnlocked,false);
  await assert.rejects(vault.search(''),code('DOC_LOCKED'));
  assert.deepEqual(await vault.unlock(PHRASE),{created:false,count:1});
  assert.equal((await vault.search('tobias montanchez'))[0].id,row.id);
  assert.equal(await (await vault.retrieve(row.id)).text(),original);
  const detail = await vault.details(row.id);
  assert.equal(detail.text,original); assert.equal(detail.reduction.preserved_text,original);
  assert.equal(detail.reduction.source.sha256,row.hash);
  assert.equal(detail.reduction.coverage.source_integrity,'ORIGINAL_HASH_VERIFIED_BY_DOCUMENT_VAULT');
});

test('wrong phrase, KDF downgrade, metadata tampering and content tampering fail closed', async () => {
  const {vault,indexedDB} = environment();
  await vault.unlock(PHRASE);
  const row = await vault.importFile(textFile('texto secreto'));
  vault.lock(); await assert.rejects(vault.unlock(OTHER_PHRASE),code('DOC_AUTH')); assert.equal(vault.isUnlocked,false);
  await vault.unlock(PHRASE);
  const snapshot = await rawSnapshot(indexedDB);
  await replaceRecord(indexedDB,'metadata',row.id,value => { new Uint8Array(value.ciphertext)[0] ^= 1; return value; });
  await assert.rejects(vault.list(),code('DOC_AUTH'));
  await replaceRecord(indexedDB,'metadata',row.id,() => snapshot.metadata[0]);
  await replaceRecord(indexedDB,'files',row.id,value => { new Uint8Array(value.ciphertext)[0] ^= 1; return value; });
  await assert.rejects(vault.retrieve(row.id),code('DOC_AUTH'));
  vault.lock();
  await replaceRecord(indexedDB,'config','root',value => ({...value,iterations:1}));
  await assert.rejects(vault.unlock(PHRASE),code('DOC_FORMAT'));
});

test('record IDs and record kind are authenticated, and every encryption has a fresh nonce', async () => {
  const {vault,indexedDB} = environment(); await vault.unlock(PHRASE);
  const first = await vault.importFile(textFile('mismo original','uno.txt'));
  const second = await vault.importFile(textFile('mismo original','dos.txt'));
  const snapshot = await rawSnapshot(indexedDB);
  assert.notEqual(first.id,second.id);
  assert.notDeepEqual(snapshot.files[0].iv,snapshot.files[1].iv);
  assert.notDeepEqual(snapshot.files[0].ciphertext,snapshot.files[1].ciphertext);
  const foreign = snapshot.files.find(item => item.id === second.id);
  await replaceRecord(indexedDB,'files',first.id,() => ({...foreign,id:first.id}));
  await assert.rejects(vault.retrieve(first.id),code('DOC_AUTH'));
});

test('binary, invalid UTF-8 and large text remain retrievable originals without fabricated extraction', async () => {
  const {vault} = environment(); await vault.unlock(PHRASE);
  const input = new Uint8Array([0xff,0xfe,0,22,128,88]);
  const binary = await vault.importFile(new File([input],'secreto.bin',{type:'application/octet-stream'}));
  assert.equal(binary.analysisStatus,'ORIGINAL_ONLY');
  assert.deepEqual(new Uint8Array(await (await vault.retrieve(binary.id)).arrayBuffer()),input);
  assert.equal((await vault.details(binary.id)).text,null);
  const pdf = await vault.importFile(new File(['%PDF-1.7 ASCII'], 'contrato.pdf',{type:'application/pdf'}));
  assert.equal(pdf.analysisStatus,'ORIGINAL_ONLY');
  assert.deepEqual((await vault.details(pdf.id)).limitations,['NO_FORMAT_EXTRACTOR']);
  const large = await vault.importFile(textFile('a'.repeat(DOCUMENT_LIMITS.maxTextBytes + 1),'grande.txt'));
  assert.equal(large.analysisStatus,'ORIGINAL_ONLY');
  assert.equal((await vault.retrieve(large.id)).size,DOCUMENT_LIMITS.maxTextBytes + 1);
  const tooLarge = textFile(''); Object.defineProperty(tooLarge,'size',{value:DOCUMENT_LIMITS.maxFileBytes + 1});
  await assert.rejects(vault.importFile(tooLarge),code('DOC_FILE_TOO_LARGE'));
});

test('bounded search and line reduction report limits while preserving the complete original', async () => {
  const {vault} = environment(); await vault.unlock(PHRASE);
  const long = 'a'.repeat(DOCUMENT_LIMITS.maxSearchBytes) + '\nULTIMA-PALABRA-UNICAX';
  const item = await vault.importFile(textFile(long));
  assert.equal(item.analysisStatus,'TEXT_LIMITED');
  assert.equal((await vault.search('ULTIMA-PALABRA-UNICAX')).length,0);
  const detail = await vault.details(item.id);
  assert.equal(detail.text,long); assert.ok(detail.limitations.includes('SEARCH_FIRST_64_KIB'));
  const manyLines = Array.from({length:10001},(_,i) => `Llamar ${i}`).join('\n');
  const lines = await vault.importFile(textFile(manyLines,'lineas.txt'));
  const linesDetail = await vault.details(lines.id);
  assert.equal(linesDetail.text,manyLines);
  assert.equal(linesDetail.reduction.coverage.input_nonempty_lines,10000);
  assert.equal(linesDetail.reduction.extraction_status,'PARTIAL');
  assert.ok(linesDetail.limitations.includes('REDUCTION_FIRST_10000_LINES'));
});

test('manual categories, tags and display names change encrypted metadata without renaming original bytes', async () => {
  const {vault} = environment(); await vault.unlock(PHRASE);
  const item = await vault.importFile(textFile('original exacto','original.txt'));
  const changed = await vault.updateMetadata(item.id,{category:'tauromaquia',tags:['Pendiente'],nameDisplay:'Mi carpeta personal'});
  assert.equal(changed.name,'original.txt'); assert.equal(changed.nameDisplay,'Mi carpeta personal');
  assert.equal((await vault.search('carpeta pendiente tauromaquia')).length,1);
  assert.equal(await (await vault.retrieve(item.id)).text(),'original exacto');
  assert.equal((await vault.updateMetadata(item.id,{nameDisplay:null})).nameDisplay,null);
  await assert.rejects(vault.updateMetadata(item.id,{accessToken:'never persist'}),code('DOC_FORMAT'));
  await assert.rejects(vault.importFile(textFile('x'),{tags:Array(17).fill('x')}),code('DOC_FORMAT'));
  assert.equal((await vault.list()).length,1);
});

test('cooperative Web Locks serialize creation and writes across tabs without losing documents or edits', async () => {
  const {vault,indexedDB,locks} = environment();
  const other = createDocumentVault({indexedDB,locks});
  const started = await Promise.all([vault.unlock(PHRASE),other.unlock(PHRASE)]);
  assert.equal(started.filter(value => value.created).length,1);
  const [first] = await Promise.all([vault.importFile(textFile('a','a.txt')),other.importFile(textFile('b','b.txt'))]);
  assert.equal((await vault.list()).length,2); assert.equal((await other.list()).length,2);
  await Promise.all([vault.updateMetadata(first.id,{category:'caza'}),other.updateMetadata(first.id,{tags:['revisar']})]);
  const updated = (await vault.list()).find(value => value.id === first.id);
  assert.equal(updated.category,'caza'); assert.deepEqual(updated.tags,['revisar']);
  assert.equal(await other.deleteFile(first.id),true);
  assert.equal((await vault.list()).length,1);
  assert.equal(await vault.deleteFile(first.id),false);
});

test('locking during an in-flight import prevents persistence and clears the readable session', async () => {
  const {vault} = environment(); await vault.unlock(PHRASE);
  let release;
  const deferred = new Promise(resolve => { release = resolve; });
  const picked = textFile('secreto'); Object.defineProperty(picked,'arrayBuffer',{value:() => deferred});
  const pending = vault.importFile(picked); vault.lock();
  release(new TextEncoder().encode('secreto').buffer);
  await assert.rejects(pending,code('DOC_CANCELLED'));
  assert.deepEqual(await vault.unlock(PHRASE),{created:false,count:0});
});

test('missing Web Locks never silently permits an unsafe write', async () => {
  const indexedDB = new IDBFactory();
  const unsupported = createDocumentVault({indexedDB,locks:{}});
  await assert.rejects(unsupported.unlock(PHRASE),code('DOC_LOCKS_UNAVAILABLE'));
  const writer = createDocumentVault({indexedDB,locks:memoryLocks()}); await writer.unlock(PHRASE);
  await unsupported.unlock(PHRASE);
  assert.deepEqual(await unsupported.list(),[]);
  await assert.rejects(unsupported.importFile(textFile('x')),code('DOC_LOCKS_UNAVAILABLE'));
  assert.deepEqual(await writer.list(),[]);
});

test('encrypted backups merge atomically, accept a different destination phrase, and preserve user metadata', async () => {
  const source = environment(), destination = environment();
  await source.vault.unlock(PHRASE);
  const row = await source.vault.importFile(textFile('texto privado de reserva','privado-tobias.txt'),{category:'negocios',tags:['Exportar']});
  await source.vault.updateMetadata(row.id,{nameDisplay:'Mi documento privado'});
  const backup = await source.vault.exportBackup(), json = await backup.text();
  assert.ok(!json.includes('privado-tobias')); assert.ok(!json.includes('texto privado')); assert.ok(!json.includes('Exportar'));
  await destination.vault.unlock(OTHER_PHRASE);
  await destination.vault.importFile(textFile('ya existente','anterior.txt'));
  assert.deepEqual(await destination.vault.importBackup(backup,PHRASE),{imported:1,skipped:0});
  const imported = (await destination.vault.search('tobias'))[0];
  assert.equal(imported.nameDisplay,'Mi documento privado'); assert.deepEqual(imported.tags,['Exportar']);
  assert.equal(await (await destination.vault.retrieve(imported.id)).text(),'texto privado de reserva');
  assert.deepEqual(await destination.vault.importBackup(backup,PHRASE),{imported:0,skipped:1});
  assert.equal((await destination.vault.list()).length,2);
  await assert.rejects(destination.vault.importBackup(backup,OTHER_PHRASE),code('DOC_AUTH'));
  const tampered = JSON.parse(json);
  const cipher = Buffer.from(tampered.documents[0].content.ciphertext,'base64'); cipher[0] ^= 1;
  tampered.documents[0].content.ciphertext = cipher.toString('base64');
  await assert.rejects(destination.vault.importBackup(new Blob([JSON.stringify(tampered)]),PHRASE),code('DOC_AUTH'));
  assert.equal((await destination.vault.list()).length,2);
  const injected = JSON.parse(json); injected.header.password = 'never stored';
  await assert.rejects(destination.vault.importBackup(new Blob([JSON.stringify(injected)]),PHRASE),code('DOC_FORMAT'));
});

test('a whole foreign configuration is detected after unlock, and a short phrase never creates credentials', async () => {
  const first = environment(), second = environment();
  await assert.rejects(first.vault.unlock('short'),code('DOC_PHRASE'));
  await first.vault.unlock(PHRASE); await second.vault.unlock(PHRASE);
  const replacement = (await rawSnapshot(second.indexedDB)).config[0];
  await replaceRecord(first.indexedDB,'config','root',() => replacement);
  await assert.rejects(first.vault.list(),code('DOC_STALE'));
});

test('locking while a write is waiting for an IndexedDB connection prevents the later write', async () => {
  const factory = new IDBFactory();
  let opens = 0, holdAt = -1, resume, announce;
  const held = new Promise(resolve => { announce = resolve; });
  const indexedDB = {open(...args) {
    const real = factory.open(...args), number = ++opens;
    const proxy = {get result() { return real.result; },get transaction() { return real.transaction; }};
    for (const type of ['error','blocked','upgradeneeded']) real[`on${type}`] = event => proxy[`on${type}`]?.(event);
    real.onsuccess = event => {
      if (number === holdAt) { resume = () => proxy.onsuccess?.(event); announce(); }
      else proxy.onsuccess?.(event);
    };
    return proxy;
  }};
  const vault = createDocumentVault({indexedDB,locks:memoryLocks()});
  await vault.unlock(PHRASE);
  holdAt = opens + 2; // One index refresh, then the write connection.
  const pending = vault.importFile(textFile('no debe guardarse'));
  await held; vault.lock(); resume();
  await assert.rejects(pending,code('DOC_CANCELLED'));
  assert.deepEqual(await vault.unlock(PHRASE),{created:false,count:0});
});

test('a blocked opening that succeeds late closes its abandoned connection', async () => {
  let request, closed = 0;
  const indexedDB = {open() { request = {}; queueMicrotask(() => request.onblocked()); return request; }};
  const vault = createDocumentVault({indexedDB,locks:memoryLocks()});
  await assert.rejects(vault.unlock(PHRASE),code('DOC_BUSY'));
  request.result = {close() { closed++; }};
  request.onsuccess(); assert.equal(closed,1);
});

test('a transaction constructor error closes the opened database and normalizes the storage error', async () => {
  let closed = 0;
  const indexedDB = {open() {
    const request = {};
    queueMicrotask(() => { request.result = {objectStoreNames:{contains:() => true},transaction() { throw new Error('synthetic native failure'); },close() { closed++; }}; request.onsuccess(); });
    return request;
  }};
  const vault = createDocumentVault({indexedDB,locks:memoryLocks()});
  await assert.rejects(vault.unlock(PHRASE),code('DOC_STORAGE'));
  assert.equal(closed,1);
});
