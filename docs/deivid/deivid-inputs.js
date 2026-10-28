/* Deivid inputs: local project workspace, not the native CAnnoNico memory.
 * SOURCE -> MINIMAL_INPUT: preserve bytes, provenance and explicit uncertainty.
 * Microphone and browser speech recognition start only on a user click.
 */
(function (root) {
  'use strict';
  const DB_NAME = 'DEIVID_PROJECT_WORKSPACE_V1', DB_VERSION = 1;
  const SCHEMA = 'DEIVID_LOCAL_PROJECT_V1', EXPORT_SCHEMA = 'DEIVID_PROJECT_EXPORT_V1';
  const MiB = 1024 * 1024, MAX_FILE = 50 * MiB, MAX_EXPORT_MEDIA = 20 * MiB, MAX_IMPORT = 32 * MiB;
  const uid = () => root.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const now = () => new Date().toISOString();
  const copy = x => JSON.parse(JSON.stringify(x));
  const text = (s, max = 500) => String(s == null ? '' : s).normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);
  function safeJSON(value) {
    const raw = JSON.stringify(value);
    if (!raw || raw.length > 3 * MiB) throw Error('El proyecto supera el tamaño de metadatos admitido.');
    return JSON.parse(raw, (key, val) => { if (['__proto__', 'prototype', 'constructor'].includes(key)) throw Error('La copia contiene una propiedad no admitida.'); return val; });
  }
  function merge(a, b) {
    const out = { ...a };
    for (const [key, value] of Object.entries(b || {})) out[key] = value && typeof value === 'object' && !Array.isArray(value) ? merge(a?.[key] || {}, value) : value;
    return out;
  }
  function fresh(values = {}) {
    return { schema: SCHEMA, id: uid(), name: 'Nuevo proyecto', client: '', createdAt: now(), updatedAt: now(), revision: 0, room: { length: '', width: '', height: '', confirmed: false, style: 'moderno' }, inputs: [], selectedReferences: [], ...values };
  }
  function validateProject(candidate) {
    const p = safeJSON(candidate);
    if (p.schema !== SCHEMA || typeof p.id !== 'string' || !p.id || !Array.isArray(p.inputs) || p.inputs.length > 500 || !Array.isArray(p.selectedReferences)) throw Error('La copia no contiene un proyecto Deivid válido.');
    p.id = text(p.id, 160); p.name = text(p.name, 240); p.client = text(p.client, 240);
    p.room = merge(fresh().room, p.room && typeof p.room === 'object' && !Array.isArray(p.room) ? p.room : {});
    for (const k of ['length', 'width', 'height']) p.room[k] = text(p.room[k], 24);
    p.room.style = text(p.room.style, 100); p.room.confirmed = p.room.confirmed === true;
    p.revision = Number.isSafeInteger(p.revision) && p.revision >= 0 ? p.revision : 0;
    const ids = new Set();
    p.inputs = p.inputs.map(i => {
      if (!i || typeof i.id !== 'string' || ids.has(i.id)) throw Error('La copia contiene una entrada no válida o repetida.');
      ids.add(i.id);
      if (i.sha256 != null && !/^[a-f0-9]{64}$/.test(i.sha256)) throw Error('La huella de una entrada no es válida.');
      return { ...i, id: text(i.id, 160), name: text(i.name, 500), kind: text(i.kind, 64), mimeType: text(i.mimeType || i.type, 200), type: text(i.mimeType || i.type, 200), transcript: text(i.transcript, 50000) };
    });
    return p;
  }
  async function sha256(blob) {
    if (!root.crypto?.subtle) throw Error('Abre la aplicación en HTTPS para conservar la huella de los originales.');
    const bytes = new Uint8Array(await root.crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  function request(req) { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
  function createStore() {
    let db = null, current = fresh(), queue = Promise.resolve(), initialized = false, status = { durable: false, message: 'Preparando el proyecto…' };
    const pendingPatches = [];
    const projects = new Map([[current.id, current]]), memoryBlobs = new Map(), listeners = new Set();
    const notify = () => { for (const fn of listeners) { try { fn(copy(current), copy(status)); } catch (e) { console.warn('Project subscriber:', e.message); } } };
    const fail = e => { status = { durable: false, message: e?.name === 'QuotaExceededError' ? 'El almacenamiento está lleno. Exporta el proyecto antes de cerrar.' : 'No se ha podido conservar esta última versión. Exporta el proyecto antes de cerrar.', detail: text(e?.message || e) }; notify(); };
    function transactionWrite(snapshot, blobs, expectedRevision, active) {
      if (!db) return Promise.reject(Error('Almacenamiento local no disponible.'));
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['projects', 'originals', 'meta'], 'readwrite');
        let reason = null;
        const req = tx.objectStore('projects').get(snapshot.id);
        req.onsuccess = () => {
          const existing = req.result;
          if (existing && existing.revision !== expectedRevision) { reason = Error('El proyecto cambió en otra pestaña. Conserva esta versión mediante Exportar.'); tx.abort(); return; }
          tx.objectStore('projects').put(snapshot);
          for (const record of blobs || []) tx.objectStore('originals').put(record);
          if (active) tx.objectStore('meta').put({ key: 'active', value: snapshot.id });
        };
        tx.oncomplete = () => resolve(true);
        tx.onerror = tx.onabort = () => reject(reason || tx.error || Error('No se pudo guardar el proyecto.'));
      });
    }
    function enqueue(snapshot, blobs = [], expectedRevision = snapshot.revision - 1, active = true) {
      const job = queue.then(() => transactionWrite(snapshot, blobs, expectedRevision, active));
      queue = job.then(() => { status = { durable: true, message: 'Proyecto guardado en este navegador.' }; notify(); return true; }, e => { fail(e); return false; });
      return queue;
    }
    const ready = (async () => {
      try {
        if (!root.indexedDB) throw Error('IndexedDB no disponible.');
        db = await new Promise((resolve, reject) => {
          const req = root.indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = () => { for (const [name, keyPath] of [['projects', 'id'], ['originals', 'id'], ['meta', 'key']]) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath }); };
          req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); req.onblocked = () => reject(Error('Cierra otra pestaña de esta aplicación para abrir el proyecto.'));
        });
        db.onversionchange = () => { db.close(); db = null; fail(Error('Recarga para abrir la versión actual del almacén local.')); };
        const tx = db.transaction(['projects', 'meta'], 'readonly');
        const [saved, active] = await Promise.all([request(tx.objectStore('projects').getAll()), request(tx.objectStore('meta').get('active'))]);
        if (saved.length) {
          projects.clear();
          for (const item of saved) { try { const p = validateProject(item); projects.set(p.id, p); } catch (_) { /* Keep unreadable records untouched in IndexedDB. */ } }
          if (projects.size) current = projects.get(active?.value) || Array.from(projects.values())[0];
          else { current = fresh(); projects.set(current.id, current); }
          status = { durable: true, message: 'Proyecto recuperado en este navegador.' };
        } else { current.revision = 1; await transactionWrite(copy(current), [], 0, true); status = { durable: true, message: 'Proyecto guardado en este navegador.' }; }
      } catch (e) { fail(e); }
      initialized = true;
      for (const patch of pendingPatches.splice(0)) updateProject(patch);
      notify(); return copy(current);
    })();
    function updateProject(patch) {
      const change = safeJSON(patch), prior = current.revision;
      delete change.id; delete change.schema; delete change.revision; delete change.createdAt;
      if (!initialized) { pendingPatches.push(copy(change)); return copy(current); }
      const room = change.room ? merge(current.room, change.room) : current.room;
      if (change.room && ['length', 'width', 'height'].some(k => k in change.room && String(change.room[k]) !== current.room[k]) && !('confirmed' in change.room)) room.confirmed = false;
      current = validateProject({ ...current, ...change, room, updatedAt: now(), revision: prior + 1 });
      projects.set(current.id, current); enqueue(copy(current), [], prior); notify(); return copy(current);
    }
    function listProjects() { return Array.from(projects.values()).map(p => ({ id: p.id, name: p.name, client: p.client, updatedAt: p.updatedAt, inputCount: p.inputs.length })); }
    async function selectProject(id) {
      await ready; await queue;
      if (!projects.has(id)) throw Error('No se encuentra este proyecto.');
      current = projects.get(id); enqueue(copy(current), [], current.revision, true); notify(); return copy(current);
    }
    async function newProject(values = {}) {
      await ready; current = validateProject(fresh({ name: text(values.name || 'Nuevo proyecto', 240), client: text(values.client, 240), revision: 1 }));
      projects.set(current.id, current); await enqueue(copy(current), [], 0); notify(); return copy(current);
    }
    function contract(input, project, options = {}) {
      return { schema: 'SUPRA_UNIVERSAL_CANNONICO_INPUTS_V1', stage: 'SOURCE_TO_MINIMAL_INPUT', native_result_claimed: false,
        INTENT: text(options.intent || 'Preparar el proyecto del cliente', 2000), CONTEXT: { projectId: project.id, client: project.client, note: text(options.context, 4000) },
        INPUT: { sourceId: input.id, filename: input.name, mimeType: input.mimeType, sha256: input.sha256, transcript: input.transcript },
        CONSTRAINTS: [text(options.constraints || 'Conservar el original. Separar las hipótesis de los hechos. Revisar medidas y compatibilidades antes de confirmar.', 4000)],
        EXPECTED: text(options.expected || 'Propuesta revisable con sus fuentes y datos pendientes.', 4000) };
    }
    async function addInput(file, options = {}) {
      await ready;
      if (!(file instanceof Blob) || !file.size) throw Error('Elige un archivo que contenga datos.');
      if (file.size > MAX_FILE) throw Error('El límite por archivo es 50 MB. Divide el vídeo o conserva un fragmento más corto.');
      const projectId = current.id, digest = await sha256(file), p = projects.get(projectId), id = uid();
      if (p.inputs.length >= 500) throw Error('Este proyecto admite hasta 500 entradas.');
      const mime = text(file.type || 'application/octet-stream', 200), transcript = text(options.transcript, 50000);
      const item = { id, kind: text(options.kind || mime.split('/')[0] || 'file', 64), name: text(file.name || 'Entrada-' + id, 500), mimeType: mime, type: mime, size: file.size, createdAt: now(), lastModified: file.lastModified || null, sha256: digest, transcript,
        transcription: { status: text(options.transcriptionStatus || (transcript ? 'provided_unreviewed' : 'not_transcribed'), 80), method: text(options.transcriptMethod || (transcript ? 'user_provided' : 'none'), 120), reviewed: false, error: text(options.transcriptionError, 160) },
        provenance: { producer: text(options.producer || 'user', 120), channel: text(options.sourceChannel || 'file_import', 120), sourceTimestamp: now(), nativeAdmission: false },
        confidence: { source: 'original_bytes_preserved', transcript: transcript ? 'unreviewed' : 'not_available', facts: 'user_declared_not_independently_verified' },
        source: { originalPreserved: true, storage: db ? 'indexeddb' : 'memory_only', audioOriginalPreserved: mime.startsWith('audio/'), missing: false } };
      item.cannonico = contract(item, p, options);
      const record = { id, projectId, blob: file, sha256: digest, name: item.name, mimeType: mime };
      memoryBlobs.set(id, record);
      const next = validateProject({ ...p, inputs: [...p.inputs, item], updatedAt: now(), revision: p.revision + 1 });
      projects.set(projectId, next); if (current.id === projectId) current = next;
      const stored = await enqueue(copy(next), [record], p.revision, current.id === projectId);
      if (!stored) { item.source.storage = 'memory_only'; const target = projects.get(projectId).inputs.find(x => x.id === id); if (target) target.source.storage = 'memory_only'; }
      notify(); return copy(projects.get(projectId).inputs.find(x => x.id === id));
    }
    async function getBlob(id) {
      await ready;
      if (memoryBlobs.has(id)) return memoryBlobs.get(id).blob;
      if (!db) return null;
      try { const record = await request(db.transaction('originals', 'readonly').objectStore('originals').get(id)); return record?.blob || null; } catch (_) { return null; }
    }
    function patchInput(id, patch) {
      const i = current.inputs.findIndex(x => x.id === id); if (i < 0) throw Error('La entrada no pertenece al proyecto activo.');
      const change = safeJSON(patch), original = current.inputs[i];
      for (const k of ['id', 'name', 'size', 'sha256', 'mimeType', 'type', 'source', 'createdAt', 'provenance']) delete change[k];
      const next = { ...original, ...change };
      if ('transcript' in change) { next.transcript = text(change.transcript, 50000); next.transcription = { ...original.transcription, ...change.transcription, method: 'user_edited', status: change.transcription?.reviewed ? 'reviewed_by_user' : 'provided_unreviewed' }; next.confidence = { ...original.confidence, transcript: change.transcription?.reviewed ? 'reviewed_by_user' : 'unreviewed' }; }
      next.cannonico = { ...original.cannonico, INPUT: { ...original.cannonico?.INPUT, transcript: next.transcript }, native_result_claimed: false };
      const inputs = current.inputs.slice(); inputs[i] = next; updateProject({ inputs }); return copy(next);
    }
    async function base64(blob) { const data = new Uint8Array(await blob.arrayBuffer()); let binary = ''; for (let i = 0; i < data.length; i += 32768) binary += String.fromCharCode(...data.subarray(i, i + 32768)); return btoa(binary); }
    async function exportProject(options = {}) {
      await ready; await queue;
      const project = copy(current), media = [], omittedMediaIds = [], warnings = []; let used = 0;
      for (const item of project.inputs) {
        const blob = options.includeMedia ? await getBlob(item.id) : null;
        if (!blob || used + blob.size > MAX_EXPORT_MEDIA) { omittedMediaIds.push(item.id); continue; }
        used += blob.size; media.push({ inputId: item.id, sha256: item.sha256, name: item.name, mimeType: item.mimeType, size: blob.size, dataBase64: await base64(blob) });
      }
      if (omittedMediaIds.length) warnings.push(omittedMediaIds.length + ' original(es) no incluidos. Conserva esos archivos por separado; esta copia mantiene sus referencias y huellas.');
      return { schema: EXPORT_SCHEMA, version: 1, createdAt: now(), native_result_claimed: false, project, media, omittedMediaIds, warnings, mediaBytes: used, mediaLimitBytes: MAX_EXPORT_MEDIA };
    }
    async function importProject(payload) {
      await ready;
      if (!payload || payload.schema !== EXPORT_SCHEMA || payload.version !== 1 || !Array.isArray(payload.media) || payload.media.length > 500) throw Error('No es una copia de proyecto Deivid compatible.');
      const old = validateProject(payload.project), importedId = uid(), map = new Map(), records = []; let bytes = 0;
      for (const item of old.inputs) map.set(item.id, uid());
      const seen = new Set();
      for (const media of payload.media) {
        if (!map.has(media.inputId) || seen.has(media.inputId) || typeof media.dataBase64 !== 'string' || media.dataBase64.length > MAX_EXPORT_MEDIA * 1.4) throw Error('Los originales de la copia no son válidos.');
        seen.add(media.inputId); const bin = atob(media.dataBase64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        bytes += arr.length; if (bytes > MAX_EXPORT_MEDIA) throw Error('La copia supera 20 MB de originales.');
        const source = old.inputs.find(x => x.id === media.inputId), blob = new Blob([arr], { type: source.mimeType });
        const hash = await sha256(blob);
        if (hash !== source.sha256 || (media.sha256 && hash !== media.sha256) || blob.size !== source.size) throw Error('La huella o el tamaño de ' + source.name + ' no coincide. No se ha importado la copia.');
        records.push({ id: map.get(media.inputId), projectId: importedId, blob, sha256: hash, name: source.name, mimeType: source.mimeType });
      }
      const p = validateProject({ ...old, id: importedId, name: text(old.name + ' · copia', 240), revision: 1, importedFromProject: old.id, updatedAt: now(),
        inputs: old.inputs.map(i => ({ ...i, id: map.get(i.id), importedSourceId: i.id, provenance: { ...i.provenance, importedAt: now(), nativeAdmission: false }, confidence: { ...i.confidence, source: seen.has(i.id) ? 'original_bytes_verified_on_import' : 'reference_only_original_missing' }, source: { ...i.source, originalPreserved: seen.has(i.id), missing: !seen.has(i.id), storage: seen.has(i.id) ? (db ? 'indexeddb' : 'memory_only') : 'not_in_copy' }, cannonico: { ...i.cannonico, native_result_claimed: false, CONTEXT: { ...i.cannonico?.CONTEXT, projectId: importedId }, INPUT: { ...i.cannonico?.INPUT, sourceId: map.get(i.id) } } })) });
      // Preserve input references used by the studio or promo, without rewriting source text.
      function remap(v, key) { if (Array.isArray(v)) return v.map(x => remap(x, key)); if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remap(x, k)])); return typeof v === 'string' && /(?:input|media|photo|image|source).*id|^selectedInputs$/i.test(key || '') && map.has(v) ? map.get(v) : v; }
      for (const key of ['studio', 'promo', 'selectedInputIds', 'selectedMediaIds']) if (p[key]) p[key] = remap(p[key], key);
      for (const record of records) memoryBlobs.set(record.id, record);
      projects.set(p.id, p); current = p; await enqueue(copy(p), records, 0); notify(); return copy(current);
    }
    return Object.freeze({ ready, getProject: () => copy(current), updateProject, subscribe(fn) { listeners.add(fn); fn(copy(current), copy(status)); return () => listeners.delete(fn); }, addInput, getBlob, patchInput, listProjects, selectProject, newProject, exportProject, importProject, getStatus: () => copy(status), flush: () => queue, limits: { maxFileBytes: MAX_FILE, exportMediaBytes: MAX_EXPORT_MEDIA, maxImportBytes: MAX_IMPORT } });
  }
  const store = root.DeividProjectStore || createStore(); root.DeividProjectStore = store;
  function mount(container, options = {}) {
    if (!container) throw Error('Falta el espacio de entradas.');
    if (container.__deividInputs) return container.__deividInputs;
    const s = options.store || store, el = (tag, cls, content) => { const n = document.createElement(tag); if (cls) n.className = cls; if (content != null) n.textContent = content; return n; };
    const button = (label, fn, cls = 'btn secondary') => { const b = el('button', cls, label); b.type = 'button'; b.addEventListener('click', fn); return b; };
    let recording = null, stream = null, timer = null, recognition = null, recordingSpeech = null, dictationUsed = false, importing = false;
    const previewURLs = new Set();
    container.classList.add('deivid-inputs'); container.textContent = '';
    const message = el('p', 'di-status'); message.setAttribute('role', 'status');
    let dialogMessage = null;
    const show = value => { message.textContent = value; if (dialogMessage) dialogMessage.textContent = value; options.notify?.(value); };
    const run = fn => async () => { try { await fn(); } catch (e) { show(e.message || 'No se ha podido completar esta acción.'); } };
    const head = el('section', 'card di-project'), selector = el('select'), projectName = el('input'), clientName = el('input'), status = el('p', 'subtle');
    function labeled(label, control) { const w = el('div', 'di-field'), id = 'di-' + uid(); control.id = id; const l = el('label', null, label); l.htmlFor = id; w.append(l, control); return w; }
    selector.setAttribute('aria-label', 'Proyecto activo'); projectName.maxLength = clientName.maxLength = 240;
    selector.addEventListener('change', run(() => s.selectProject(selector.value)));
    projectName.addEventListener('change', () => s.updateProject({ name: projectName.value || 'Nuevo proyecto' })); clientName.addEventListener('change', () => s.updateProject({ client: clientName.value }));
    head.append(el('div', 'eyebrow', 'Proyecto del cliente'), labeled('Proyecto activo', selector));
    const meta = el('div', 'di-grid'); meta.append(labeled('Nombre del proyecto', projectName), labeled('Cliente', clientName)); head.append(meta);
    const actions = el('div', 'di-actions'); actions.append(button('Añadir entrada', () => open(), 'btn'), button('Nuevo proyecto', run(async () => { await s.newProject(); projectName.focus(); }))); head.append(actions, status);
    const list = el('div', 'di-sources'), backup = el('details', 'card di-backup');
    backup.append(el('summary', null, 'Conservar o recuperar el proyecto'), el('p', 'subtle', 'Esta copia conserva las fuentes, la estancia, la selección del catálogo y las propuestas guardadas en el proyecto. El presupuesto tiene su propia copia editable en Presupuesto; el radar global queda separado. La copia con originales incluye hasta 20 MB en total. El resto conserva referencias y huellas: guarda esos archivos por separado. El navegador puede borrar datos; conserva una copia fuera de la aplicación.'));
    function download(blob, name) { const url = URL.createObjectURL(blob), a = el('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
    async function exportCopy(includeMedia) { const payload = await s.exportProject({ includeMedia }); download(new Blob([JSON.stringify(payload)], { type: 'application/json' }), 'Deivid_proyecto_' + new Date().toISOString().slice(0, 10) + (includeMedia ? '_con_originales' : '_metadatos') + '.json'); show(payload.warnings.join(' ') || 'Copia preparada con todos los originales.'); }
    const importer = el('input'); importer.type = 'file'; importer.accept = '.json,application/json'; importer.hidden = true;
    importer.addEventListener('change', async () => { const file = importer.files?.[0]; importer.value = ''; if (!file || importing) return; importing = true; try { if (file.size > MAX_IMPORT) throw Error('La copia JSON supera 32 MB. Usa una exportación de esta aplicación.'); await s.importProject(JSON.parse(await file.text())); show('Copia recuperada como un proyecto nuevo. El proyecto anterior se conserva.'); } catch (e) { show(e.message); } finally { importing = false; } });
    const backActions = el('div', 'di-actions'); backActions.append(button('Exportar con originales', run(() => exportCopy(true))), button('Solo metadatos', run(() => exportCopy(false))), button('Recuperar proyecto', () => importer.click())); backup.append(backActions, importer);
    const contractNote = el('p', 'subtle di-scope', 'Las medidas y compatibilidades se confirman antes de usarlas. El proyecto y sus originales permanecen en este dispositivo. Exporta una copia para conservarlos.');
    container.append(head, message, list, backup, contractNote);
    const dialog = el('dialog', 'di-dialog'); dialog.setAttribute('aria-labelledby', 'di-dialog-title');
    const dialogHead = el('div', 'di-dialog-head'); const title = el('h2', null, 'Añadir al proyecto'); title.id = 'di-dialog-title'; dialogHead.append(title, button('Cerrar', close, 'text-button'));
    dialogMessage = el('p', 'di-status'); dialogMessage.setAttribute('role', 'status');
    dialog.append(dialogHead, el('p', 'subtle', 'Fotos, vídeos, audio o notas. Los archivos importados se conservan en este navegador. La dictación tiene su propio aviso.'), dialogMessage);
    const capture = el('div', 'di-capture');
    function filePicker(label, accept, kind, captureValue) {
      const input = el('input'); input.type = 'file'; input.accept = accept; input.hidden = true; input.multiple = !captureValue; if (captureValue) input.setAttribute('capture', captureValue);
      input.dataset.kind = kind; input.addEventListener('change', async () => { const files = Array.from(input.files || []); input.value = ''; for (const file of files) { try { await s.addInput(file, { kind: kind === 'file' ? file.type.split('/')[0] || 'file' : kind, sourceChannel: captureValue ? 'camera_capture' : 'file_import' }); show('Original conservado: ' + file.name + '. Añade una descripción o transcripción si la necesitas.'); } catch (e) { show(e.message); break; } } });
      capture.append(button(label, () => input.click(), 'di-capture-button'), input);
    }
    filePicker('Hacer foto', 'image/*', 'photo', 'environment'); filePicker('Grabar vídeo', 'video/*', 'video', 'environment'); filePicker('Elegir archivos', '*/*', 'file');
    dialog.append(capture, el('p', 'subtle', 'Hasta 50 MB por archivo. En audio o vídeo importado puedes añadir una transcripción; no se genera automáticamente en este navegador.'));
    const speechType = root.SpeechRecognition || root.webkitSpeechRecognition;
    const audioPanel = el('section', 'di-audio'), recordingStatus = el('p', 'di-record-status'); recordingStatus.setAttribute('role', 'status');
    const transcribeRecording = el('input'); transcribeRecording.type = 'checkbox'; transcribeRecording.disabled = !speechType;
    const transcribeLabel = el('label', 'di-check'); transcribeLabel.append(transcribeRecording, document.createTextNode('Transcribir mientras grabo'));
    const recordSpeechHint = el('p', 'subtle', speechType ? 'Al activar esta opción, Grabar audio también inicia la dictación. Puede utilizar el servicio de voz del navegador. El texto se conserva sin revisar junto al audio.' : 'Transcripción de voz no disponible aquí. El audio se conserva y puedes escribir o pegar su transcripción.');
    const recordSpeechPreview = el('p', 'di-live-transcript'); recordSpeechPreview.setAttribute('aria-live', 'polite');
    const recordButton = button('Grabar audio', run(startRecording)), stopButton = button('Detener y conservar', stopRecording); stopButton.disabled = true;
    audioPanel.append(el('h3', null, 'Nota de voz'), el('p', 'subtle', 'Graba hasta 3 minutos. El archivo original se conserva. La transcripción se puede revisar o completar después.'), transcribeLabel, recordSpeechHint, recordButton, stopButton, recordingStatus, recordSpeechPreview); dialog.append(audioPanel);
    const textArea = el('textarea'); textArea.rows = 5; textArea.maxLength = 50000; textArea.placeholder = 'Describe la estancia, pega una transcripción o añade un enlace…';
    const intent = el('input'); intent.placeholder = 'Ej.: iluminar la cocina y preparar el presupuesto'; intent.maxLength = 2000;
    const textSection = el('section', 'di-text'); textSection.append(el('h3', null, 'Texto, enlace o dictado'), labeled('Qué quieres conseguir (opcional)', intent), labeled('Contenido', textArea));
    const dictationStatus = el('p', 'subtle');
    const dictateButton = button('Dictar', startDictation), stopDictationButton = button('Detener dictado', stopDictation); stopDictationButton.disabled = true;
    if (!speechType) { dictateButton.disabled = true; dictationStatus.textContent = 'Dictado no disponible aquí. Puedes escribir, pegar una transcripción o grabar el audio.'; }
    else dictationStatus.textContent = 'La dictación puede usar el servicio de voz del navegador. Empieza solo al tocar Dictar. Conserva texto; Grabar audio conserva también la voz.';
    const textActions = el('div', 'di-actions'); textActions.append(dictateButton, stopDictationButton, button('Conservar texto', run(async () => {
      stopDictation(); const value = textArea.value.trim(); if (!value) throw Error('Escribe o dicta primero el contenido.');
      let isURL = false; try { const u = new URL(value); isURL = ['http:', 'https:'].includes(u.protocol) && !/\s/.test(value); } catch (_) { /* ordinary note */ }
      const kind = isURL ? 'url' : dictationUsed ? 'dictation' : 'text';
      await s.addInput(new File([value], (isURL ? 'Enlace' : dictationUsed ? 'Dictado' : 'Nota') + '-' + new Date().toISOString().slice(0, 10) + '.txt', { type: 'text/plain' }), { kind, transcript: value, transcriptMethod: dictationUsed ? 'browser_speech_recognition' : 'user_provided', sourceChannel: dictationUsed ? 'browser_dictation' : isURL ? 'url_reference_not_fetched' : 'typed_note', intent: intent.value });
      textArea.value = ''; dictationUsed = false; show(isURL ? 'Enlace conservado como referencia. Su contenido no se ha descargado.' : 'Texto conservado. Revisa las medidas y afirmaciones antes de confirmarlas.');
    }), 'btn'));
    textSection.append(textActions, dictationStatus); dialog.append(textSection); document.body.append(dialog);
    async function startRecording() {
      if (recording || stream) return; stopDictation();
      if (!root.MediaRecorder || !navigator.mediaDevices?.getUserMedia) throw Error('La grabación no está disponible aquí. Añade un audio desde Archivos.');
      recordButton.disabled = true; recordingStatus.textContent = 'Esperando permiso del micrófono…';
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!dialog.open) { stream.getTracks().forEach(t => t.stop()); stream = null; recordButton.disabled = false; return; }
        const preferred = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(t => root.MediaRecorder.isTypeSupported?.(t));
        const chunks = []; recording = new root.MediaRecorder(stream, preferred ? { mimeType: preferred } : {}); const recorder = recording, started = Date.now();
        const speech = recordingSpeech = beginRecordingSpeech(); transcribeRecording.disabled = true;
        recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
        recorder.onerror = () => { show('No se pudo completar la grabación. Conserva el audio desde Archivos.'); stopRecording(); };
        recorder.onstop = async () => {
          const mime = recorder.mimeType || chunks[0]?.type || 'audio/webm'; const blob = new Blob(chunks, { type: mime });
          try {
            await finishRecordingSpeech(speech);
            if (blob.size) await s.addInput(new File([blob], 'Audio-' + new Date().toISOString().replace(/[:.]/g, '-') + (mime.includes('mp4') ? '.m4a' : mime.includes('ogg') ? '.ogg' : '.webm'), { type: mime }), { kind: 'audio', sourceChannel: 'microphone_recording', transcript: speech.text, transcriptMethod: speech.requested ? 'browser_speech_recognition' : 'none', transcriptionStatus: speech.text ? (speech.error ? 'partial_unreviewed' : 'recognized_unreviewed') : speech.requested ? 'unavailable' : 'not_transcribed', transcriptionError: speech.error });
            recordingStatus.textContent = !blob.size ? 'No se han recibido datos de audio.' : speech.text ? 'Audio y transcripción conservados juntos. Revisa el texto con el original.' : speech.requested ? 'Audio conservado. No se obtuvo transcripción; puedes añadirla a mano.' : 'Audio conservado. La transcripción está pendiente.';
          } catch (e) { show(e.message); } finally { recordButton.disabled = false; transcribeRecording.disabled = !speechType; recordingSpeech = null; }
        };
        recorder.start(1000); stopButton.disabled = false;
        timer = setInterval(() => { const seconds = Math.floor((Date.now() - started) / 1000); recordingStatus.textContent = 'Grabando · ' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); if (seconds >= 180) stopRecording(); }, 500);
      } catch (e) { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; recording = null; if (recordingSpeech) finishRecordingSpeech(recordingSpeech); recordingSpeech = null; recordButton.disabled = false; transcribeRecording.disabled = !speechType; recordingStatus.textContent = 'Micrófono no disponible. Puedes importar el audio.'; throw e; }
    }
    function beginRecordingSpeech() {
      const session = { requested: !!transcribeRecording.checked, engine: null, text: '', error: '', ended: false, finishing: null, done: null };
      recordSpeechPreview.textContent = '';
      if (!session.requested || !speechType) return session;
      try {
        const engine = session.engine = new speechType(); engine.lang = 'es-ES'; engine.continuous = true; engine.interimResults = true;
        engine.onresult = event => { const parts = []; for (let i = 0; i < event.results.length; i++) parts.push(event.results[i][0].transcript); session.text = text(parts.join(' '), 50000); recordSpeechPreview.textContent = session.text || 'Escuchando para transcribir…'; };
        engine.onerror = event => { session.error = text(event.error || 'recognition_error', 120); recordSpeechPreview.textContent = 'Transcripción interrumpida; el audio sigue grabándose. ' + session.text; };
        engine.onend = () => { session.ended = true; session.done?.(); };
        engine.start(); recordSpeechPreview.textContent = 'Transcripción en curso. Revisa después el texto.';
      } catch (e) { session.error = text(e.message || 'recognition_unavailable', 120); session.ended = true; recordSpeechPreview.textContent = 'No se pudo iniciar la transcripción. El audio se conserva igualmente.'; }
      return session;
    }
    function finishRecordingSpeech(session) {
      if (!session || !session.engine || session.ended) return Promise.resolve();
      if (session.finishing) return session.finishing;
      session.finishing = new Promise(resolve => { let done = false; session.done = () => { if (done) return; done = true; clearTimeout(timeout); session.engine.onresult = null; resolve(); }; const timeout = setTimeout(() => { session.error ||= 'final_result_timeout'; try { session.engine.abort(); } catch (_) { /* Stopped. */ } session.done(); }, 1500); try { session.engine.stop(); } catch (_) { session.done(); } });
      return session.finishing;
    }
    function stopRecording() { clearInterval(timer); timer = null; if (recording && recording.state !== 'inactive') recording.stop(); recording = null; stream?.getTracks().forEach(t => t.stop()); stream = null; stopButton.disabled = true; if (recordingSpeech) finishRecordingSpeech(recordingSpeech); }
    function startDictation() {
      if (!speechType || recognition) return; if (recording) { show('Detén la grabación antes de dictar.'); return; }
      const baseline = textArea.value.trim(); let finalText = '';
      try {
        recognition = new speechType(); const engine = recognition; engine.lang = 'es-ES'; engine.continuous = true; engine.interimResults = true;
        engine.onresult = event => { let interim = ''; for (let i = event.resultIndex; i < event.results.length; i++) { if (event.results[i].isFinal) finalText += event.results[i][0].transcript + ' '; else interim += event.results[i][0].transcript; } textArea.value = [baseline, finalText + interim].filter(Boolean).join('\n').slice(0, 50000); dictationUsed = true; };
        engine.onerror = event => { dictationStatus.textContent = 'El dictado no está disponible (' + text(event.error, 80) + '). Conserva o edita el texto recibido.'; };
        engine.onend = () => { recognition = null; dictateButton.disabled = !speechType; stopDictationButton.disabled = true; };
        engine.start(); dictateButton.disabled = true; stopDictationButton.disabled = false; dictationStatus.textContent = 'Escuchando. Revisa la transcripción antes de conservarla.';
      } catch (_) { recognition = null; dictateButton.disabled = false; stopDictationButton.disabled = true; dictationStatus.textContent = 'No se ha podido iniciar el dictado. Escribe o pega el texto.'; }
    }
    function stopDictation() { if (recognition) { const engine = recognition; recognition = null; engine.onresult = null; try { engine.stop(); } catch (_) { /* Already stopped. */ } dictateButton.disabled = !speechType; stopDictationButton.disabled = true; } }
    function close() { stopRecording(); stopDictation(); dialog.close(); }
    dialog.addEventListener('cancel', () => { stopRecording(); stopDictation(); });
    function open() { if (!dialog.open) dialog.showModal(); }
    function revokePreviews() { for (const url of previewURLs) URL.revokeObjectURL(url); previewURLs.clear(); }
    async function preview(item, target) {
      const blob = await s.getBlob(item.id); if (!blob) { show('Este original no está en la copia. Vuelve a añadir el archivo.'); return; }
      target.textContent = ''; const url = URL.createObjectURL(blob); previewURLs.add(url);
      if (/^(image|audio|video)\//.test(item.mimeType)) {
        const tag = item.mimeType.startsWith('image/') ? 'img' : item.mimeType.startsWith('audio/') ? 'audio' : 'video'; const node = el(tag, 'di-preview'); node.src = url; if (tag === 'img') node.alt = item.name; else { node.controls = true; node.preload = 'metadata'; } target.append(node);
      }
      const a = el('a', 'text-button', 'Guardar original'); a.href = url; a.download = item.name; target.append(a);
    }
    let rendered = '';
    function render(p, st) {
      const active = document.activeElement;
      const optionsKey = s.listProjects().map(x => x.id + x.name + x.client).join('|');
      if (selector.dataset.optionsKey !== optionsKey) { selector.textContent = ''; for (const item of s.listProjects()) { const o = el('option', null, item.name + (item.client ? ' · ' + item.client : '')); o.value = item.id; selector.append(o); } selector.dataset.optionsKey = optionsKey; }
      selector.value = p.id; if (active !== projectName) projectName.value = p.name; if (active !== clientName) clientName.value = p.client;
      status.textContent = st?.message || s.getStatus().message; status.classList.toggle('di-warning', !(st || s.getStatus()).durable);
      const serial = p.id + JSON.stringify(p.inputs); if (serial === rendered) return; rendered = serial; revokePreviews(); list.textContent = '';
      list.append(el('h3', null, p.inputs.length ? 'Fuentes del proyecto · ' + p.inputs.length : 'Empieza con una foto o una nota.'));
      if (!p.inputs.length) { list.append(el('p', 'subtle', 'Usa Añadir entrada o el botón +. Las medidas extraídas de un texto se revisan antes de pasar al plano.')); return; }
      for (const item of p.inputs.slice().reverse()) {
        const card = el('article', 'card di-source'), heading = el('div', 'di-source-head'), info = el('div'); info.append(el('strong', null, item.name), el('small', 'subtle', item.mimeType + ' · ' + (item.size / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' KB'));
        const target = el('div'); heading.append(info, button('Ver original', run(() => preview(item, target)), 'text-button')); card.append(heading, target);
        if (item.source?.missing) card.append(el('p', 'di-warning', 'La copia conserva la referencia; falta el archivo original.'));
        const details = el('details', 'di-transcript'); details.append(el('summary', null, item.transcript ? 'Texto y transcripción' : 'Añadir descripción o transcripción'));
        const area = el('textarea'); area.value = item.transcript || ''; area.maxLength = 50000; area.rows = 4; area.setAttribute('aria-label', 'Transcripción de ' + item.name);
        const reviewed = el('input'); reviewed.type = 'checkbox'; reviewed.checked = !!item.transcription?.reviewed; const lab = el('label', 'di-check'); lab.append(reviewed, document.createTextNode('He revisado este texto con la fuente.'));
        details.append(area, lab, button('Guardar texto', run(() => { s.patchInput(item.id, { transcript: area.value, transcription: { reviewed: reviewed.checked } }); show('Texto conservado. El original permanece intacto.'); }), 'btn secondary small'));
        const facts = el('details', 'di-evidence'); facts.append(el('summary', null, 'Origen y verificación'), el('p', 'subtle', 'Fuente: ' + (item.provenance?.channel || 'importación') + '. Texto: ' + (item.transcription?.reviewed ? 'revisado por ti' : item.transcript ? 'pendiente de revisión' : 'sin transcribir') + '. Las afirmaciones no están verificadas de forma independiente.'), el('code', 'di-hash', 'SHA-256 · ' + (item.sha256 || 'no disponible')));
        card.append(details, facts); list.append(card);
      }
    }
    const unsub = s.subscribe(render); s.ready.then(() => render(s.getProject(), s.getStatus()));
    const api = { open, close, store: s, destroy() { stopRecording(); stopDictation(); revokePreviews(); unsub(); dialog.remove(); } }; container.__deividInputs = api; return api;
  }
  root.DeividInputs = Object.freeze({ version: 1, mount, createStore, schemas: { project: SCHEMA, export: EXPORT_SCHEMA } });
})(typeof window !== 'undefined' ? window : globalThis);
