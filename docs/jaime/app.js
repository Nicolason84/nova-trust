(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const KEY = 'ojo-jaime-space-v1';
  const MAX_FILE = 25 * 1024 * 1024;
  const MAX_FILES = 3;
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const date = () => new Date().toISOString();
  const makeIdea = (title = 'Mi primera conversación') => ({id: uid(), title, topicType: 'general', createdAt: date(), updatedAt: date(), draft: '', pending: [], messages: [], scenarios: []});
  let state, dbPromise, busy = false, additions = Promise.resolve();
  let nameAction = null, deleteTarget = null, calculations = null, renderVersion = 0, toastTimer, pendingLegacy = null;
  const objectUrls = new Set();
  const focusBefore = new Map();
  const el = (tag, cls, text) => {const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n;};
  const active = () => state.ideas.find(i => i.id === state.activeId) || state.ideas[0];
  const getIdea = (id) => state.ideas.find(i => i.id === id);
  const shortDate = (s) => {const d = new Date(s); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('es-ES', {day: 'numeric', month: 'short'}) : '';};
  const time = (s) => {const d = new Date(s); return Number.isFinite(d.getTime()) ? d.toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'}) : '';};
  const sizeLabel = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;

  function toast(text) {clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false; toastTimer = setTimeout(() => {$('toast').hidden = true;}, 5000);}
  function persist() {try {localStorage.setItem(KEY, JSON.stringify(state)); return true;} catch {document.dispatchEvent(new CustomEvent('jaime:technical',{detail:{signal:'STORAGE_FAILURE'}})); toast('No se ha podido guardar. Exporta una copia antes de cerrar.'); return false;}}
  function touch(idea) {idea.updatedAt = date(); return persist();}
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.version === 1 && Array.isArray(parsed.ideas) && parsed.ideas.length && parsed.ideas.every(i => typeof i.id === 'string' && Array.isArray(i.messages))) {
        state = parsed;
        state.preferences = {preferredName: typeof parsed.preferences?.preferredName === 'string' ? parsed.preferences.preferredName.slice(0,40) : '', faith: parsed.preferences?.faith === true, memoryText: typeof parsed.preferences?.memoryText === 'string' ? parsed.preferences.memoryText.slice(0,4000) : '', shareContext: parsed.preferences?.shareContext === true};
        let interrupted = false;
        state.ideas.forEach(i => {i.pending = Array.isArray(i.pending) ? i.pending : []; i.scenarios = Array.isArray(i.scenarios) ? i.scenarios : []; i.draft = typeof i.draft === 'string' ? i.draft : '';
          for (const message of i.messages.filter(m => m.role === 'user' && m.deliveryState === 'sending')) {
            message.deliveryState = 'uncertain'; interrupted = true;
            i.messages.filter(m => m.retryFor === message.id).forEach(m => {delete m.retryFor;});
            i.messages.push({id:uid(),role:'system',text:'La aplicación se cerró durante un envío. El mensaje puede haber sido recibido; su respuesta debe verificarse antes de reenviarlo. No se ha repetido el envío.',createdAt:date(),attachments:[]});
          }
        });
        if (!getIdea(state.activeId)) state.activeId = state.ideas[0].id;
        if (interrupted) persist();
        return;
      }
    } catch {setTimeout(() => toast('No se ha podido recuperar el espacio guardado. Comprueba tus copias antes de cerrar.'), 300);}
    const idea = makeIdea(); state = {version: 1, activeId: idea.id, ideas: [idea], preferences: {preferredName: '', faith: false, memoryText: '', shareContext: false}};
  }
  function openDialog(id) {focusBefore.set(id, document.activeElement); const d = $(id); if (!d.open) d.showModal();}
  function closeDialog(id) {$(id).close();}
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDialog(b.dataset.close)));
  document.querySelectorAll('dialog').forEach(d => {
    d.addEventListener('close', () => {const n = focusBefore.get(d.id); if (n?.isConnected) n.focus();});
    d.addEventListener('click', e => {if (e.target === d) {const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();}});
  });

  function database() {
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) return reject(new Error('Este navegador no permite guardar archivos.'));
      const req = indexedDB.open('ojo-jaime-files-v1', 1);
      req.onupgradeneeded = () => {if (!req.result.objectStoreNames.contains('files')) req.result.createObjectStore('files', {keyPath: 'id'});};
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error('No se ha podido abrir el almacenamiento de archivos.'));
    });
    return dbPromise;
  }
  async function fileOperation(mode, action) {const db = await database(); return new Promise((resolve, reject) => {const tx = db.transaction('files', mode); const req = action(tx.objectStore('files')); let result; req.onsuccess = () => {result = req.result;}; tx.oncomplete = () => resolve(result); tx.onerror = () => reject(new Error('No se ha podido guardar o recuperar el archivo.')); tx.onabort = tx.onerror;});}
  const saveBlob = (id, blob) => fileOperation('readwrite', s => s.put({id, blob}));
  const readBlob = async id => (await fileOperation('readonly', s => s.get(id)))?.blob;
  const removeBlob = id => fileOperation('readwrite', s => s.delete(id));
  function releaseUrls() {objectUrls.forEach(url => URL.revokeObjectURL(url)); objectUrls.clear();}
  function ownUrl(blob) {const url = URL.createObjectURL(blob); objectUrls.add(url); return url;}

  async function populateFile(card, file, version, pending = false) {
    const name = el('strong', '', file.name); card.append(name);
    const meta = el('span', 'file-meta', `${sizeLabel(file.size)} · ${file.missing ? 'Original no incluido en la copia' : file.analysisConfirmed ? 'Lectura confirmada por el asistente' : 'Guardado localmente · sin análisis confirmado'}`); card.append(meta);
    if (file.missing) return;
    try {
      const blob = await readBlob(file.id);
      if (version !== renderVersion || !card.isConnected) return;
      if (!blob) {meta.textContent = 'El original no está disponible en este dispositivo'; return;}
      const url = ownUrl(blob);
      if (file.type.startsWith('image/')) {const img = el('img'); img.src = url; img.alt = file.name; card.prepend(img);}
      else if (!pending && file.type.startsWith('video/')) {const video = el('video'); video.src = url; video.controls = true; video.preload = 'metadata'; video.playsInline = true; card.prepend(video);}
      else if (file.type.startsWith('audio/')) {const audio = el('audio'); audio.src = url; audio.controls = true; audio.preload = 'metadata'; card.append(audio);}
      if (!pending) {const a = el('a', '', 'Guardar el archivo original'); a.href = url; a.download = file.name; card.append(a);}
    } catch {meta.textContent = 'No se ha podido recuperar este archivo';}
  }
  function renderPending(version) {
    $('pendingFiles').replaceChildren();
    active().pending.forEach(file => {
      const card = el('div', 'pending-file'); $('pendingFiles').append(card); populateFile(card, file, version, true);
      const b = el('button', 'remove-file', '×'); b.type = 'button'; b.setAttribute('aria-label', `Quitar ${file.name}`);
      b.addEventListener('click', async () => {const idea = active(); idea.pending = idea.pending.filter(f => f.id !== file.id); touch(idea); try {await removeBlob(file.id);} catch {} render();}); card.append(b);
    });
  }
  function renderMessages(version) {
    const list = $('messageList'); list.replaceChildren();
    active().messages.forEach(message => {
      const article = el('article', `message ${message.role}`);
      const label = message.role === 'user' ? 'Tú' : message.role === 'assistant' ? 'ojO' : message.role === 'calculation' ? 'Cálculo guardado' : 'Estado del servicio';
      article.append(el('span', 'message-label', label)); article.append(el('p', 'message-text', message.role === 'system' && message.recoveredDelivery === true ? 'La respuesta de este envío se ha recuperado y verificado. No se ha vuelto a enviar tu pregunta.' : message.text || ''));
      if (message.attachments?.length) {const files = el('div', 'message-files'); article.append(files); message.attachments.forEach(f => {const card = el('div', 'file-card'); files.append(card); populateFile(card, f, version);});}
      if (message.sources?.length) {const sources = el('div', 'message-sources'); for (const source of message.sources) {try {const url = new URL(source.url); if (url.protocol !== 'https:' && url.protocol !== 'http:') continue; const a = el('a', '', source.title || url.hostname); a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; sources.append(a, el('br'));} catch {}} article.append(sources);}
      if (message.retryFor) {const retry = el('button', 'secondary retry', 'Reintentar análisis'); retry.disabled = busy; retry.addEventListener('click', () => deliver(active().id, message.retryFor)); article.append(retry);}
      if (message.role === 'user' && message.deliveryState === 'uncertain' && window.JaimeGateway?.recover) {
        if (message.deliveryRequestId) {
          const recover = el('button', 'secondary recover-response', 'Comprobar respuesta'); recover.type = 'button'; recover.disabled = busy;
          const ideaId = active().id; recover.addEventListener('click', () => recoverResponse(ideaId, message.id)); article.append(recover);
        } else article.append(el('p', 'file-meta', 'Este envío antiguo no conserva una referencia de recuperación. No se ha reenviado.'));
        if (message.recoveryNotice) article.append(el('p', 'file-meta', message.recoveryNotice));
      }
      const stamp = el('time', '', time(message.createdAt)); stamp.dateTime = message.createdAt; article.append(stamp); list.append(article);
    });
  }
  function render() {
    voice.contextChanged(active().id);
    releaseUrls(); renderVersion += 1; const version = renderVersion; const idea = active();
    $('renameTop').textContent = idea.title; $('topicModeLabel').textContent = idea.topicType === 'personal' ? 'TEMA PERSONAL' : idea.topicType === 'business' ? 'UNA IDEA O NEGOCIO' : 'CONVERSACIÓN LIBRE'; $('messageInput').value = idea.draft || ''; $('welcome').hidden = idea.messages.length > 0;
    renderMessages(version); renderPending(version); updateSend();
  }
  function updateSend() {$('sendButton').disabled = busy || voice.getSnapshot().isBusy || (!active().draft.trim() && !active().pending.length); $('sendButton').firstChild.textContent = busy ? 'Enviando ' : 'Enviar';}
  function scrollToEnd() {requestAnimationFrame(() => {$('conversation').scrollTop = $('conversation').scrollHeight;});}
  function addSystem(idea, text, retryFor, deliveryFor) {idea.messages.push({id: uid(), role: 'system', text, retryFor, deliveryFor, createdAt: date(), attachments: []}); touch(idea);}
  let connectionFailure = 'El análisis aún no está conectado. Tu mensaje y tus archivos están guardados en este dispositivo; todavía no los ha leído un asistente.';
  async function health() {
    let result;
    try {result = await window.JaimeGateway?.health?.();} catch {}
    const ready = result?.ok === true;
    $('connectionNotice').classList.toggle('connected', ready);
    $('statusButton').textContent = result?.label || (ready ? 'Asistente conectado' : 'Ideas guardadas · asistente pendiente de conexión');
    $('healthExplanation').textContent = result?.description || (ready ? 'Hay conexión con el asistente. Puedes enviar texto y material para las funciones que el servicio tenga disponibles. Cada pieza debe confirmar su lectura.' : 'La conexión con el asistente no está disponible. Puedes guardar ideas, adjuntar material y probar números. No se simulan respuestas de inteligencia artificial.');
    if (!ready) connectionFailure = result?.description || 'El análisis aún no está conectado. Tu mensaje y tus archivos están guardados en este dispositivo; todavía no los ha leído un asistente.';
    window.JaimeIdentityUI?.refresh?.();
    return ready;
  }
  async function deliver(ideaId, messageId) {
    if (busy) return; const idea = getIdea(ideaId); if (!idea) return; const at = idea.messages.findIndex(m => m.id === messageId); if (at < 0) return;
    if (idea.messages[at].deliveryState === 'uncertain') {toast('Este envío necesita una comprobación antes de repetirse. No se ha reenviado.'); return;}
    busy = true; updateSend();
    try {
      if (!window.JaimeGateway?.send || !(await health())) throw new Error(connectionFailure);
      const message = idea.messages[at]; const attachments = [];
      for (const file of message.attachments || []) {const blob = file.missing ? null : await readBlob(file.id); attachments.push({...file, blob: blob || null, missing: !blob});}
      const messages = idea.messages.slice(0, at + 1).filter(m => ['user', 'assistant'].includes(m.role)).map(m => ({id: m.id, role: m.role, text: m.text, attachments: (m.attachments || []).map(f => ({id: f.id, name: f.name, type: f.type, size: f.size})), createdAt: m.createdAt}));
      let personalContext;
      if (state.preferences.shareContext === true) {const pref = state.preferences; personalContext = {}; if (pref.preferredName) personalContext.preferredName = pref.preferredName; if (pref.faith === true) personalContext.faithRequested = true; if (pref.memoryText) personalContext.notes = pref.memoryText;}
      if (!message.deliveryRequestId) message.deliveryRequestId = globalThis.crypto.randomUUID();
      message.deliveryState = 'sending';
      if (!touch(idea)) throw new Error('No se ha enviado: no podemos guardar la referencia necesaria para recuperar la respuesta. Conserva o exporta tu texto y comprueba el almacenamiento de este navegador.');
      const response = await window.JaimeGateway.send({ideaId, messageId, requestId: message.deliveryRequestId, ...(personalContext ? {personalContext} : {}), topicType: idea.topicType || 'general', messages, attachments, scenario: idea.scenarios.at(-1) || null});
      if (!response || response.ok === false || typeof response.text !== 'string' || !response.text.trim()) throw Object.assign(new Error(response?.message || response?.error || 'El asistente no ha devuelto una respuesta válida. Tu contenido sigue guardado.'), {uncertain: true});
      if (!getIdea(ideaId)) return;
      message.deliveryState = 'confirmed';
      const analyzed = new Set(Array.isArray(response.attachmentsAnalyzed) ? response.attachmentsAnalyzed.filter(id => typeof id === 'string') : []);
      (message.attachments || []).forEach(file => {if (analyzed.has(file.id)) file.analysisConfirmed = true;});
      idea.messages.push({id: uid(), role: 'assistant', replyTo: messageId, requestId: message.deliveryRequestId, text: response.text, sources: Array.isArray(response.sources) ? response.sources : [], createdAt: date(), attachments: [], attachmentsAnalyzed: response.attachmentsAnalyzed || []});
      idea.messages.filter(m => m.retryFor === messageId).forEach(m => {delete m.retryFor;}); touch(idea);
    } catch (error) {if (getIdea(ideaId)) {
      const uncertain = error?.uncertain === true;
      idea.messages[at].deliveryState = uncertain ? 'uncertain' : 'not_confirmed';
      idea.messages.filter(m => m.retryFor === messageId).forEach(m => {delete m.retryFor;});
      const explanation = typeof error?.message === 'string' ? error.message : 'No se ha podido conectar. Tu contenido sigue guardado.';
      addSystem(idea, explanation + (uncertain ? ' Este envío necesita una comprobación antes de repetirse.' : ''), uncertain ? undefined : messageId, messageId);
    }}
    finally {busy = false; if (state.activeId === ideaId) {render(); scrollToEnd();} else updateSend(); health();}
  }
  async function recoverResponse(ideaId, messageId) {
    if (busy || !window.JaimeGateway?.recover) return;
    const idea = getIdea(ideaId), message = idea?.messages.find(m => m.id === messageId && m.role === 'user');
    if (!message || message.deliveryState !== 'uncertain' || !message.deliveryRequestId) return;
    busy = true; updateSend(); if (state.activeId === ideaId) render();
    try {
      const result = await window.JaimeGateway.recover({ideaId, messageId, requestId: message.deliveryRequestId, message: message.text});
      if (getIdea(ideaId) !== idea || !idea.messages.includes(message)) return;
      if (result?.confirmed === true && result.requestId === message.deliveryRequestId && typeof result.text === 'string' && result.text.trim()) {
        if (!idea.messages.some(m => m.role === 'assistant' && m.replyTo === messageId && m.requestId === message.deliveryRequestId)) {
          idea.messages.splice(idea.messages.indexOf(message) + 1, 0, {id: uid(), role: 'assistant', replyTo: messageId,
            requestId: message.deliveryRequestId, text: result.text, sources: [], createdAt: date(), attachments: [], recovered: true});
        }
        message.deliveryState = 'confirmed'; delete message.recoveryNotice;
        idea.messages.filter(m => m.retryFor === messageId).forEach(m => {delete m.retryFor;});
        idea.messages.filter(m => m.role === 'system' && m.deliveryFor === messageId).forEach(m => {m.recoveredDelivery = true;});
        toast('Respuesta recuperada del historial privado. No se ha vuelto a enviar tu pregunta.');
      } else message.recoveryNotice = result?.state === 'ACCEPTED'
        ? 'El servidor recibió este envío, pero todavía no hay una respuesta completa. Puedes comprobarlo más tarde.'
        : 'No se ha encontrado una respuesta completa verificable para este envío. No se ha reenviado tu pregunta.';
      touch(idea);
    } catch (error) {
      if (getIdea(ideaId) === idea) {message.recoveryNotice = error?.message || 'No se ha podido comprobar la respuesta. El envío sigue pendiente de verificar.'; touch(idea);}
    } finally {busy = false; if (state.activeId === ideaId) {render(); scrollToEnd();} else updateSend(); health();}
  }
  $('composerForm').addEventListener('submit', e => {
    e.preventDefault(); if (busy || voice.getSnapshot().isBusy) return; const idea = active(); const text = $('messageInput').value.trim(); if (!text && !idea.pending.length) return;
    const message = {id: uid(), role: 'user', text, createdAt: date(), attachments: [...idea.pending]};
    idea.messages.push(message); idea.pending = []; idea.draft = ''; if (idea.title === 'Mi primera conversación' || idea.title === 'Nuevo tema') idea.title = text ? text.slice(0, 55) : 'Una conversación con archivos'; touch(idea); render(); scrollToEnd(); deliver(idea.id, message.id);
  });
  $('messageInput').addEventListener('input', e => {active().draft = e.target.value; touch(active()); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(150, e.target.scrollHeight)}px`; updateSend();});
  document.querySelectorAll('[data-example]').forEach(b => b.addEventListener('click', () => {active().draft = b.dataset.example; touch(active()); $('messageInput').value = active().draft; updateSend(); $('messageInput').focus();}));
  $('homeButton').addEventListener('click', () => {document.dispatchEvent(new CustomEvent('jaime:navigate',{detail:{view:'chat'}})); $('messageInput').focus();});
  $('helpButton').addEventListener('click', () => openDialog('helpDialog'));
  $('statusButton').addEventListener('click', () => openDialog('helpDialog'));
  $('checkConnectionButton').addEventListener('click', async () => {const ok = await health(); toast(ok ? 'Conexión disponible.' : connectionFailure);});

  function renderIdeas() {
    const list = $('ideasList'); list.replaceChildren();
    [...state.ideas].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).forEach(idea => {
      const row = el('div', `idea-row ${idea.id === state.activeId ? 'active' : ''}`); const button = el('button', 'idea-open'); button.append(el('strong', '', idea.title), el('small', '', `${shortDate(idea.updatedAt)} · ${idea.messages.filter(m => m.role === 'user').length} mensajes tuyos`));
      button.addEventListener('click', () => {state.activeId = idea.id; persist(); closeDialog('ideasDialog'); render(); scrollToEnd();});
      const rename = el('button', 'idea-action', 'Nombre'); rename.setAttribute('aria-label', `Cambiar nombre de ${idea.title}`); rename.addEventListener('click', () => openName(idea.id));
      const remove = el('button', 'idea-action', 'Borrar'); remove.setAttribute('aria-label', `Eliminar ${idea.title}`); remove.addEventListener('click', () => {deleteTarget = idea.id; $('confirmText').textContent = `Se eliminarán «${idea.title}», su conversación y sus archivos locales. No se puede deshacer. Puedes exportar los textos antes.`; openDialog('confirmDialog');});
      row.append(button, rename, remove); list.append(row);
    });
  }
  $('ideasButton').addEventListener('click', () => {renderIdeas(); openDialog('ideasDialog');});
  function openName(id) {nameAction = id; $('nameTitle').textContent = id ? 'Nombre del tema' : 'Un nuevo tema'; $('ideaTitleInput').value = id ? getIdea(id).title : ''; $('topicTypeInput').value = id ? (getIdea(id).topicType || 'general') : 'general'; openDialog('nameDialog'); setTimeout(() => $('ideaTitleInput').focus(), 40);}
  $('newIdeaButton').addEventListener('click', () => openName(null));
  $('renameTop').addEventListener('click', () => openName(active().id));
  $('nameForm').addEventListener('submit', e => {e.preventDefault(); const title = $('ideaTitleInput').value.trim(); if (!title) return; if (nameAction) {const idea = getIdea(nameAction); if (idea) {idea.title = title; idea.topicType = $('topicTypeInput').value; touch(idea);}} else {const idea = makeIdea(title); idea.topicType = $('topicTypeInput').value; state.ideas.push(idea); state.activeId = idea.id; persist();} closeDialog('nameDialog'); if ($('ideasDialog').open) {renderIdeas();} render();});
  $('confirmDeleteButton').addEventListener('click', async () => {
    const idea = getIdea(deleteTarget); if (!idea) return; if (busy) {toast('Espera a que termine el envío antes de eliminar un tema.'); return;}
    if (voice.getSnapshot().contextId === idea.id) voice.cancel();
    const ids = new Set([...idea.pending, ...idea.messages.flatMap(m => m.attachments || [])].map(f => f.id));
    for (const id of ids) {try {await removeBlob(id);} catch {}}
    state.ideas = state.ideas.filter(i => i.id !== idea.id); if (!state.ideas.length) state.ideas.push(makeIdea()); if (state.activeId === idea.id) state.activeId = state.ideas[0].id; persist(); closeDialog('confirmDialog'); renderIdeas(); render(); toast('Tema eliminado de este dispositivo.');
  });

  $('attachButton').addEventListener('click', () => openDialog('attachDialog'));
  document.querySelectorAll('[data-attach]').forEach(b => b.addEventListener('click', () => {$('fileInput').accept = b.dataset.attach; closeDialog('attachDialog'); $('fileInput').click();}));
  function addFiles(files, ideaId = active().id) {additions = additions.catch(() => {}).then(() => doAddFiles(files, ideaId)); return additions;}
  async function doAddFiles(files, ideaId) {
    const savedIds = [], idea = getIdea(ideaId); if (!idea) return savedIds;
    for (const file of files) {
      if (getIdea(ideaId) !== idea) break;
      if (idea.pending.length >= MAX_FILES) {toast('Puedes preparar hasta 3 archivos por mensaje.'); break;}
      if (file.size > MAX_FILE) {toast(`${file.name}: supera el límite de 25 MB.`); continue;}
      if (!file.size) {toast(`${file.name}: el archivo está vacío.`); continue;}
      const metadata = {id: uid(), name: file.name || 'archivo', type: file.type || 'application/octet-stream', size: file.size};
      try {
        await saveBlob(metadata.id, file);
        if (getIdea(ideaId) !== idea) {await removeBlob(metadata.id); break;}
        const previousDate = idea.updatedAt;
        idea.pending.push(metadata); idea.updatedAt = date();
        if (!persist()) {
          idea.pending = idea.pending.filter(f => f.id !== metadata.id);
          idea.updatedAt = previousDate;
          try {await removeBlob(metadata.id);} catch {}
          continue;
        }
        savedIds.push(metadata.id);
      } catch (error) {toast(error.message || 'No se ha podido guardar el archivo.');}
    }
    if (state.activeId === ideaId) render();
    return savedIds;
  }
  $('fileInput').addEventListener('change', async e => {const files = [...e.target.files]; e.target.value = ''; await addFiles(files);});
  const voice = window.JaimeRecorder.create({
    maxBytes: MAX_FILE,
    onState(s) {
      $('recordButton').disabled = !s.canStart;
      $('recorderPanel').hidden = !s.isBusy && !s.permissionPending;
      $('stopRecording').hidden = s.state !== 'recording';
      $('cancelRecording').hidden = !s.isBusy;
      $('cancelRecording').disabled = !s.isBusy;
      const seconds = Math.floor(s.elapsedMs / 1000);
      $('recordingClock').textContent = s.state === 'requesting'
        ? 'Esperando permiso del micrófono…'
        : s.state === 'stopping' ? 'Preparando el audio…'
        : s.state === 'recording' ? `Grabando ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
        : s.permissionPending ? 'Responde al aviso de permiso del navegador.' : '';
      updateSend();
    },
    async onAudio(a) {
      const idea = getIdea(a.contextId); if (!idea) return;
      const savedIds = await addFiles([new File([a.blob], a.filename, {type: a.mimeType})], a.contextId);
      if (!getIdea(a.contextId)) return;
      if (!savedIds?.length) throw new Error('Audio storage failed');
      const where = state.activeId === a.contextId ? '' : ` en «${idea.title}»`;
      toast(a.interrupted
        ? `La grabación se interrumpió. Audio disponible guardado${where}. Escúchalo antes de enviarlo.`
        : `Audio guardado${where}. Escúchalo antes de enviarlo.`);
    },
    onError(e) {toast(e.message);}
  });
  $('recordButton').addEventListener('click', () => {
    if (!voice.getSnapshot().canStart) return;
    if (active().pending.length >= MAX_FILES) {toast('Ya tienes 3 archivos preparados.'); return;}
    voice.start({contextId: active().id});
  });
  $('stopRecording').addEventListener('click', () => voice.stop());
  $('cancelRecording').addEventListener('click', () => voice.cancel());

  function download(name, content, mime) {const url = URL.createObjectURL(new Blob([content], {type: mime})); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);}
  $('exportJsonButton').addEventListener('click', () => {const copy = JSON.parse(JSON.stringify(state)); copy.exportedAt = date(); copy.attachmentNotice = 'Los archivos binarios no se incluyen. Guarda los originales por separado.'; copy.ideas.forEach(i => {i.pending.forEach(f => {f.missing = true;}); i.messages.forEach(m => (m.attachments || []).forEach(f => {f.missing = true;}));}); download(`Jaime-ideas-${date().slice(0,10)}.json`, JSON.stringify(copy, null, 2), 'application/json'); toast('Copia preparada. No incluye los archivos originales.');});
  $('exportMarkdownButton').addEventListener('click', () => {const idea = active(); let text = `# ${idea.title}\n\nExportado: ${date()}\n\n`; idea.messages.forEach(m => {text += `## ${m.role === 'user' ? 'Jaime' : m.role === 'assistant' ? 'ojO' : 'Estado / cálculo'} · ${m.createdAt}\n\n${m.text}\n\n`; (m.attachments || []).forEach(f => {text += `Archivo: ${f.name} (${sizeLabel(f.size)}). Original no incluido.\n\n`;});}); text += '\n## Escenarios guardados\n\n```json\n' + JSON.stringify(idea.scenarios, null, 2) + '\n```\n'; download(`Jaime-conversacion-${date().slice(0,10)}.md`, text, 'text/markdown;charset=utf-8');});
  $('importJsonButton').addEventListener('click', () => $('importInput').click());
  $('importInput').addEventListener('change', async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('La copia supera 5 MB.');
      const copy = JSON.parse(await file.text());
      if (copy?.source === 'JAIME_APP_LOCAL_EXPORT') {openLegacyReview({notes: window.JaimeLegacy.proofs(copy)}); return;}
      if (copy?.account_status === 'created_local') {openLegacyReview({profile: window.JaimeLegacy.profile(copy)}); return;}
      if (copy?.version !== 1 || !Array.isArray(copy.ideas) || !copy.ideas.length || copy.ideas.length > 100) throw new Error('No es una copia compatible de ojO · Jaime.');
      const imported = copy.ideas.map(raw => {
        if (!raw || typeof raw.title !== 'string' || !Array.isArray(raw.messages) || raw.messages.length > 2000) throw new Error('La copia contiene un tema no válido.');
        const idea = makeIdea(raw.title.slice(0,90)); idea.topicType = ['general','personal','business'].includes(raw.topicType) ? raw.topicType : 'general'; idea.draft = typeof raw.draft === 'string' ? raw.draft.slice(0,12000) : ''; idea.scenarios = Array.isArray(raw.scenarios) ? raw.scenarios.slice(0,100) : [];
        idea.messages = raw.messages.map(m => {if (!m || !['user','assistant','system','calculation'].includes(m.role) || typeof m.text !== 'string' || m.text.length > 100000) throw new Error('La copia contiene un mensaje no válido.'); return {id: uid(), role: m.role, text: m.text, createdAt: Number.isFinite(Date.parse(m.createdAt)) ? m.createdAt : date(), sources: Array.isArray(m.sources) ? m.sources.slice(0,50).filter(x => x && typeof x.url === 'string').map(x => ({url:x.url, title:String(x.title || '').slice(0,240)})) : [], attachments: Array.isArray(m.attachments) ? m.attachments.slice(0,3).map(f => ({id: uid(), name: String(f.name || 'archivo').slice(0,240), type: String(f.type || ''), size: Number.isFinite(f.size) && f.size >= 0 ? f.size : 0, missing: true})) : []};});
        return idea;
      });
      state.ideas.push(...imported); state.activeId = imported[0].id; persist(); renderIdeas(); render(); toast(`${imported.length} temas recuperados. Los originales de los archivos no están incluidos.`);
    } catch (error) {toast(error.message || 'No se pudo leer la copia.');}
  });

  function refreshProfile() {
    const name = state.preferences.preferredName || 'Jaime';
    $('appProfileName').textContent = name;
    $('welcomeName').textContent = name;
    $('preferredName').value = state.preferences.preferredName;
  }
  function openLegacyReview(data) {
    pendingLegacy = data;
    const entries = data.notes?.entries || [];
    $('legacySummary').textContent = `${data.profile ? 'Un perfil local' : 'Sin perfil'} · ${entries.length} notas o acciones de la app anterior.`;
    const preview = $('legacyPreview'); preview.replaceChildren();
    if (data.profile) {const card = el('section','legacy-entry'); card.append(el('strong','','Nombre que quieres recuperar'),el('p','',data.profile.name || 'Sin nombre')); preview.append(card);}
    for (const item of entries) {const card = el('section','legacy-entry'); card.append(el('strong','',item.kind),el('p','',item.text)); if (item.createdAt) card.append(el('small','',shortDate(item.createdAt))); preview.append(card);}
    $('confirmLegacyButton').disabled = !data.profile && !entries.length;
    openDialog('legacyDialog');
  }
  $('recoverLegacyButton').addEventListener('click', () => {
    const found = window.JaimeLegacy.stored(localStorage);
    if (found.profile || found.notes?.entries.length) openLegacyReview(found);
    else {toast('Selecciona una copia JSON de tu app anterior. Si cambiaste de dirección web, sus datos no aparecen automáticamente aquí.'); $('importInput').click();}
  });
  $('confirmLegacyButton').addEventListener('click', () => {
    if (!pendingLegacy) return;
    const previous = JSON.stringify(state);
    const seen = new Set(Array.isArray(state.legacyImported) ? state.legacyImported : []);
    const entries = (pendingLegacy.notes?.entries || []).filter(item => {if (seen.has(item.key)) return false; seen.add(item.key); return true;});
    if (pendingLegacy.profile) state.preferences.preferredName = pendingLegacy.profile.name;
    if (entries.length) {
      const topic = makeIdea('Notas de mi app anterior');
      topic.messages.push({id:uid(),role:'system',createdAt:date(),text:'Notas recuperadas de la app Jaime anterior. No se han enviado ni analizado. Su contenido y fechas proceden de la copia importada.',attachments:[]});
      for (const item of entries) {
        topic.messages.push({id:uid(),role:'user',createdAt:item.createdAt || date(),text:`${item.kind}\n${item.text}${item.createdAt ? '' : '\n[La nota original no incluía una fecha válida.]'}`,attachments:[],legacySource:item.source});
        seen.add(item.key);
      }
      state.ideas.push(topic); state.activeId = topic.id;
    }
    state.legacyImported = [...seen];
    if (!persist()) {state = JSON.parse(previous); return;}
    if (pendingLegacy.profile) {try {window.JaimeLegacy.saveProfile(localStorage, state.preferences.preferredName);} catch {toast('El nombre se ha recuperado en tus preferencias, pero no se pudo actualizar el acceso.');}}
    pendingLegacy = null; closeDialog('legacyDialog'); refreshProfile(); renderIdeas(); render();
    toast(entries.length ? `${entries.length} notas recuperadas. Los originales se conservan.` : 'Recuperación terminada. No se han creado notas duplicadas.');
  });
  $('installGuideButton').addEventListener('click', () => {$('installGuide').hidden = !$('installGuide').hidden;});

  const fields = [
    ['price','Precio de venta por unidad (€)'],['purchase','Coste de compra por unidad (€)'],['transport','Transporte a tu cargo por unidad (€)'],['variableOther','Otros costes por unidad (€)'],['commissionRate','Comisión pagada sobre la venta (%)'],['fixed','Costes fijos del periodo (€)'],['units','Unidades u operaciones del periodo']
  ];
  function createScenarioForms() {
    const wrap = $('scenarioForms'); wrap.replaceChildren();
    ['A','B'].forEach((which, index) => {const section = el('section','scenario-form'); section.append(el('h3','',index ? 'B · Otra posibilidad' : 'A · Punto de partida')); fields.forEach(([key, label]) => {const field = el('div','field'); field.dataset.field = key; const name = `${which}-${key}`; const lbl = el('label','',label); lbl.htmlFor = name; const input = el('input'); input.id = name; input.inputMode = key === 'units' ? 'numeric' : 'decimal'; input.autocomplete = 'off'; input.placeholder = 'Por confirmar'; input.maxLength = 30; input.addEventListener('input', () => {calculations = null; $('saveScenarioButton').disabled = true; saveCalculatorDraft();}); field.append(lbl,input); section.append(field);}); wrap.append(section);});
  }
  function updateModel() {const commission = $('businessMode').value === 'commission'; ['A','B'].forEach(which => {$(which+'-purchase').closest('.field').hidden = commission; document.querySelector(`label[for="${which}-price"]`).textContent = commission ? 'Venta comisionable por operación (€)' : 'Precio de venta por unidad (€)'; document.querySelector(`label[for="${which}-commissionRate"]`).textContent = commission ? 'Comisión que recibes (%)' : 'Comisión pagada sobre la venta (%)';}); calculations = null; $('saveScenarioButton').disabled = true; $('calculationResults').replaceChildren();}
  function saveCalculatorDraft() {active().calculator = {mode: $('businessMode').value, A: scenarioInput('A'), B: scenarioInput('B')}; touch(active());}
  function restoreCalculator() {const saved = active().calculator; $('businessMode').value = saved?.mode === 'commission' ? 'commission' : 'resale'; for (const which of ['A','B']) fields.forEach(([key]) => {$(which+'-'+key).value = typeof saved?.[which]?.[key] === 'string' ? saved[which][key] : '';}); updateModel();}
  function scenarioInput(which) {const input = {mode: $('businessMode').value}; fields.forEach(([key]) => {input[key] = $(which+'-'+key).value.trim();}); return input;}
  function money(cents) {if (cents === null || cents === undefined) return 'Por confirmar'; return window.JaimeEconomics?.formatCents ? window.JaimeEconomics.formatCents(cents) : (cents / 100).toLocaleString('es-ES',{style:'currency',currency:'EUR'});}
  function renderResults() {
    const root = $('calculationResults'); root.replaceChildren(); const values = {};
    for (const which of ['A','B']) {
      const input = scenarioInput(which); const hasData = fields.some(([key]) => input[key] !== ''); if (which === 'B' && !hasData) continue;
      const card = el('section','result-card'); card.append(el('h3','',`Escenario ${which}`)); root.append(card);
      try {
        if (!window.JaimeEconomics?.calculate) throw new Error('El cálculo no está disponible en esta versión.');
        const result = window.JaimeEconomics.calculate(input); values[which] = {input,result};
        if (result.status !== 'complete') {card.append(el('p','result-warning','Falta confirmar: '+result.missing.join(', ')+'. Los campos vacíos no se consideran cero.')); continue;}
        const grid = el('div','result-grid'); [['Contribución por unidad',money(result.perUnitCents)],['Resultado del periodo',money(result.resultCents)],['Ingreso por unidad',money(result.revenueCents)],['Unidades para cubrir costes',result.breakEvenUnits === null ? 'No se alcanza' : String(result.breakEvenUnits)]].forEach(([label,value]) => {const box = el('div','',label); box.append(el('strong','',value)); grid.append(box);}); card.append(grid);
        card.append(el('p','result-formula',typeof result.formula === 'string' ? result.formula : JSON.stringify(result.formula)));
        if (result.breakEvenReason) card.append(el('p','result-warning',result.breakEvenReason));
        (result.warnings || []).forEach(w => card.append(el('p','result-warning',String(w))));
      } catch (error) {card.append(el('p','result-warning',error.message || 'Revisa los valores.'));}
    }
    if (values.A?.result.status === 'complete' && values.B?.result.status === 'complete') {const difference = values.B.result.resultCents - values.A.result.resultCents; root.append(el('div','comparison', Number.isSafeInteger(difference) ? `B frente a A: ${money(difference)} de diferencia en el resultado del periodo.` : 'La diferencia supera el límite de cálculo exacto. Reduce la escala para comparar.'));}
    calculations = values; $('saveScenarioButton').disabled = values.A?.result.status !== 'complete';
  }
  function renderSavedScenarios() {const wrap = $('savedScenarios'); wrap.replaceChildren(); if (!active().scenarios.length) return; wrap.append(el('h3','','Guardado en este tema')); active().scenarios.slice(-5).reverse().forEach(s => {const n = el('div','saved-scenario'); n.append(el('strong','',`${shortDate(s.createdAt)} · ${s.mode === 'commission' ? 'Comisión' : 'Venta propia'}`)); for (const which of ['A','B']) if (s.values?.[which]?.result?.status === 'complete') n.append(el('div','',`${which}: ${money(s.values[which].result.resultCents)} de resultado del periodo`)); wrap.append(n);});}
  $('numbersButton').addEventListener('click', () => {restoreCalculator(); renderSavedScenarios(); openDialog('numbersDialog');});
  $('businessMode').addEventListener('change', () => {updateModel(); saveCalculatorDraft();});
  $('calculateButton').addEventListener('click', renderResults);
  $('loadExampleButton').addEventListener('click', () => {$('businessMode').value = 'resale'; updateModel(); const base = {price:'14',purchase:'9',transport:'1,20',variableOther:'0',commissionRate:'5',fixed:'310',units:'100'}; for (const which of ['A','B']) fields.forEach(([key]) => {$(which+'-'+key).value = which === 'B' && key === 'price' ? '12' : base[key];}); saveCalculatorDraft(); renderResults(); toast('Ejemplo hipotético cargado. No son tus precios ni una oferta.');});
  $('saveScenarioButton').addEventListener('click', () => {
    if (!calculations || calculations.A?.result.status !== 'complete') return; const idea = active(); const saved = {id:uid(),createdAt:date(),mode:$('businessMode').value,values:calculations}; idea.scenarios.push(saved);
    const summary = ['Hipótesis guardada. Importes sin IVA; incluye como coste el IVA no recuperable. No es una previsión de ingresos.']; for (const which of ['A','B']) if (calculations[which]?.result.status === 'complete') {const r = calculations[which].result; summary.push(`${which}: contribución ${money(r.perUnitCents)} por unidad; resultado del periodo ${money(r.resultCents)}; equilibrio ${r.breakEvenUnits === null ? 'no alcanzable con estos datos' : r.breakEvenUnits+' unidades'}.`);}
    idea.messages.push({id:uid(),role:'calculation',createdAt:date(),text:summary.join('\n'),attachments:[]}); touch(idea); renderSavedScenarios(); render(); $('saveScenarioButton').disabled = true; calculations = null; toast('Hipótesis guardada en este tema.');
  });

  $('preferencesForm').addEventListener('submit', event => {event.preventDefault(); state.preferences = {preferredName: $('preferredName').value.trim().slice(0,40), faith: $('faithPreference').checked, memoryText: $('personalMemory').value.slice(0,4000), shareContext: $('shareContextPreference').checked}; if (persist()) {try {window.JaimeLegacy.saveProfile(localStorage, state.preferences.preferredName);} catch {} refreshProfile(); document.dispatchEvent(new CustomEvent('jaime:preferences')); toast('Preferencias guardadas en este dispositivo.');}});
  window.addEventListener('online', health); window.addEventListener('offline', () => {health(); toast('Sin conexión. Tus borradores permanecen en este dispositivo.');});
  window.addEventListener('pagehide', () => {persist();});
  window.JaimeApp = Object.freeze({
    name: () => state.preferences.preferredName || 'Jaime',
    faithEnabled: () => state.preferences.faith === true,
    notify: toast,
    openDialog,
    startTopic(input) {
      const idea = makeIdea(String(input?.title || 'Un nuevo tema').slice(0,90));
      idea.topicType = ['personal','business'].includes(input?.topicType) ? input.topicType : 'general';
      idea.draft = String(input?.draft || '').slice(0,12000);
      if (typeof input?.communicationId === 'string') idea.communicationId = input.communicationId.slice(0,160);
      const previousActive = state.activeId;
      state.ideas.push(idea); state.activeId = idea.id;
      if (!persist()) {state.ideas = state.ideas.filter(i => i !== idea); state.activeId = previousActive; return false;}
      document.dispatchEvent(new CustomEvent('jaime:navigate',{detail:{view:'chat'}}));
      render(); scrollToEnd(); toast('Tema preparado. Puedes escribir antes de enviar.'); return true;
    }
  });
  document.addEventListener('jaime:viewchange', event => {if (event.detail?.view !== 'chat') voice.interrupt('view-changed');});
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('./sw.js').catch(() => {});
  load(); let entryProfile = null; try {entryProfile = window.JaimeLegacy.loadProfile(localStorage);} catch {} if (entryProfile) state.preferences.preferredName = entryProfile.name; refreshProfile(); $('faithPreference').checked = state.preferences.faith; $('personalMemory').value = state.preferences.memoryText; $('shareContextPreference').checked = state.preferences.shareContext; createScenarioForms(); updateModel(); render(); health();
})();
