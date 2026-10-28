/* Deivid product evolution. Deterministic local suggestions and project drafts.
 * No model impersonation, network request, scheduler or installation action.
 * Native conversation delivery can be recorded only by the validated chat owner.
 */
(function (root) {
  'use strict';
  const SCHEMA = 'DEIVID_EVOLUTION_V1', EXPORT_SCHEMA = 'DEIVID_REQUESTS_EXPORT_V1', LIMIT = 100;
  const TYPES = { question: 'Pregunta', improvement: 'Mejora', module: 'Nuevo módulo', bug: 'Problema de funcionamiento' };
  const STATES = { LOCAL_DRAFT: 'Borrador local', PREPARED_FOR_CHAT: 'Preparado para el chat', AWAITING_CONVERSATION_RECEIPT: 'Recepción en conversación por confirmar', CONVERSATION_CLOSED: 'Chat finalizado sin respuesta completada', SHARED_IN_CONVERSATION: 'Compartido en conversación', IMPORTED_DRAFT: 'Copia importada · por revisar' };
  const CLOSED_STATES = new Set(['failed', 'rejected', 'expired', 'blocked', 'resource_blocked', 'backend_blocked', 'unavailable']);
  const MODULES = Object.freeze([
    { id: 'led', title: 'Componentes LED', view: 'led', description: 'Comprueba parejas de mando y controlador documentadas y los datos pendientes de la instalación.' },
    { id: 'quote', title: 'Presupuesto PDF', view: 'quote', description: 'Prepara líneas, revisa importes y genera un PDF para compartirlo cuando decidas.' },
    { id: 'inputs', title: 'Fotos, vídeos, audio y notas', view: 'project', description: 'Conserva originales. La grabación puede incluir dictado si tu navegador lo permite; revisa siempre el texto.' },
    { id: 'studio', title: 'Estudio de la estancia en 3D', view: 'studio', description: 'Representa una estancia a partir de medidas que puedes revisar y confirmar. No mide automáticamente una foto.' },
    { id: 'html', title: 'Dossier cliente e instalador', view: 'studio', description: 'Exporta documentos HTML con la selección y las fuentes que elijas incluir.' },
    { id: 'radar', title: 'Radar de empresas', view: 'growth', section: 'radar', description: 'Consulta fichas públicas y lleva tu seguimiento. Buscar usa la red; los resultados necesitan cualificación.' },
    { id: 'promos', title: 'Promociones en imagen y vídeo', view: 'growth', section: 'promo', description: 'Combina una imagen y tu texto para exportar PNG, HTML o un vídeo animado sin audio.' }
  ]);
  const IDEAS = Object.freeze([
    { id: 'photo3d', title: 'Reconstrucción 3D desde fotos', problem: 'Me gustaría reconstruir una estancia desde fotos y revisar sus medidas antes de preparar la propuesta.', benefit: 'Reducir el tiempo de preparación del proyecto.', description: 'Propuesta no instalada. El estudio actual utiliza medidas introducidas o confirmadas por ti.' },
    { id: 'file_transcription', title: 'Transcripción de archivos de audio', problem: 'Me gustaría transcribir archivos de audio importados conservando el original y señalando las dudas.', benefit: 'Recuperar las necesidades del cliente sin copiar a mano todo el audio.', description: 'Propuesta no instalada. El dictado durante una grabación depende del navegador; los archivos importados no se transcriben automáticamente.' },
    { id: 'supplier_order', title: 'Preparación de pedidos al proveedor', problem: 'Me gustaría preparar un pedido para el proveedor a partir de un presupuesto revisado.', benefit: 'Evitar volver a escribir referencias y cantidades.', description: 'Propuesta no instalada. Actualmente no se envían pedidos a proveedores.' }
  ]);
  const now = () => new Date().toISOString(), uid = () => root.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const clone = x => JSON.parse(JSON.stringify(x));
  const text = (s, max = 1000) => String(s == null ? '' : s).normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);
  const refOf = item => text(typeof item === 'string' ? item : item?.reference, 100);
  const moduleById = id => MODULES.find(m => m.id === id);
  function normalizeRequest(raw, projectId, forceImport = false) {
    if (!raw || typeof raw.id !== 'string' || !TYPES[raw.type] || typeof raw.problem !== 'string' || !raw.problem.trim()) throw Error('La copia contiene una solicitud no válida.');
    const imported = forceImport || raw.projectId !== projectId, type = raw.type;
    const context = raw.context && typeof raw.context === 'object' ? raw.context : {};
    const pending = !imported && typeof raw.conversationPending?.request_id === 'string' && raw.conversationPending.request_id.trim() ? { request_id: text(raw.conversationPending.request_id, 160), conversation_id: text(raw.conversationPending.conversation_id, 160), revision: Number(raw.conversationPending.revision) || 1, at: text(raw.conversationPending.at, 80), state: 'AWAITING_VALIDATED_RECEIPT' } : null;
    const delivery = !imported && raw.conversationDelivery?.validatedNative === true && typeof raw.conversationDelivery.request_id === 'string' && raw.conversationDelivery.request_id.trim() ? {
      request_id: text(raw.conversationDelivery.request_id, 160), validatedNative: true, observedAt: text(raw.conversationDelivery.observedAt, 80), revision: Number(raw.conversationDelivery.revision) || 1,
      conversation_id: text(raw.conversationDelivery.conversation_id, 160), scope: 'CONVERSATION_ONLY', developmentAccepted: false, installed: false
    } : null;
    const closure = !imported && raw.conversationClosure?.validatedNative === true && typeof raw.conversationClosure.request_id === 'string' && CLOSED_STATES.has(raw.conversationClosure.state) ? { request_id: text(raw.conversationClosure.request_id, 160), conversation_id: text(raw.conversationClosure.conversation_id, 160), state: raw.conversationClosure.state, at: text(raw.conversationClosure.at, 80), revision: Number(raw.conversationClosure.revision) || 1, notAdmitted: raw.conversationClosure.notAdmitted === true, validatedNative: true } : null;
    const revision = Number.isSafeInteger(raw.revision) && raw.revision > 0 ? raw.revision : 1;
    const prepared = !imported && raw.prepared && typeof raw.prepared.message === 'string' ? { message: text(raw.prepared.message, 1000), contextNotes: Array.isArray(raw.prepared.contextNotes) ? raw.prepared.contextNotes.slice(0, 4).map(x => text(x, 320)) : [], at: text(raw.prepared.at, 80), revision: Number(raw.prepared.revision) || revision } : null;
    let status = imported ? 'IMPORTED_DRAFT' : STATES[raw.status] ? raw.status : 'LOCAL_DRAFT';
    if (status === 'SHARED_IN_CONVERSATION' && (!delivery || delivery.revision !== revision)) status = 'LOCAL_DRAFT';
    if (status === 'AWAITING_CONVERSATION_RECEIPT' && (!pending || pending.revision !== revision)) status = 'LOCAL_DRAFT';
    if (status === 'CONVERSATION_CLOSED' && (!closure || closure.revision !== revision)) status = 'LOCAL_DRAFT';
    if (status === 'PREPARED_FOR_CHAT' && !prepared) status = 'LOCAL_DRAFT';
    return {
      id: imported ? uid() : text(raw.id, 160), projectId, schema: 'DEIVID_PRODUCT_REQUEST_V1', type, moduleId: text(raw.moduleId, 100), title: text(raw.title || TYPES[type], 120), problem: text(raw.problem, 700), benefit: text(raw.benefit, 400),
      createdAt: text(raw.createdAt || now(), 80), updatedAt: text(raw.updatedAt || now(), 80), revision, status,
      origin: raw.origin === 'local_rule_suggestion' ? 'local_rule_suggestion' : 'user', ruleId: text(raw.ruleId, 100),
      context: imported ? { includeRoom: false, includeSelection: false, includeQuote: false, inputIds: [] } : { includeRoom: context.includeRoom === true, includeSelection: context.includeSelection === true, includeQuote: context.includeQuote === true, inputIds: Array.isArray(context.inputIds) ? context.inputIds.slice(0, 4).map(x => text(x, 160)) : [] },
      prepared, conversationPending: pending, conversationDelivery: delivery, conversationClosure: closure, developmentAccepted: false, installed: false,
      ...(imported ? { importedFrom: { requestId: text(raw.id, 160), projectId: text(raw.projectId, 160), previousStatus: text(raw.status, 100), previousConversationRequestId: text(raw.conversationDelivery?.request_id || raw.importedFrom?.previousConversationRequestId, 160), previousPendingRequestId: text(raw.conversationPending?.request_id || raw.importedFrom?.previousPendingRequestId, 160), previousClosedRequestId: text(raw.conversationClosure?.request_id || raw.importedFrom?.previousClosedRequestId, 160), verification: 'NOT_REVERIFIED' } } : raw.importedFrom ? { importedFrom: clone(raw.importedFrom) } : {})
    };
  }
  function readEvolution(project) {
    const raw = project.evolution;
    if (!raw) return { requests: [], normalized: false, corrupt: false };
    if (raw.schema !== SCHEMA || raw.version !== 1 || !Array.isArray(raw.requests) || raw.requests.length > LIMIT) return { requests: [], corrupt: true, error: 'La copia anterior de solicitudes no se puede leer. Se conserva intacta; expórtala antes de continuar en otro proyecto.' };
    try { const requests = raw.requests.map(r => normalizeRequest(r, project.id)); if (new Set(requests.map(r => r.id)).size !== requests.length) throw Error('Solicitudes duplicadas.'); return { requests, normalized: JSON.stringify(requests) !== JSON.stringify(raw.requests), corrupt: false }; }
    catch (e) { return { requests: [], corrupt: true, error: e.message }; }
  }
  function moduleContext() {
    return { source: 'LOCAL_IMPLEMENTATION_REGISTRY', suggestionMethod: 'EXPLICIT_LOCAL_RULES', freeForDeivid: true, available: MODULES.map(m => ({ id: m.id, name: m.title, description: m.description })), proposalsNotInstalled: IDEAS.map(m => ({ id: m.id, name: m.title, description: m.description })), limits: ['Una solicitud compartida en conversación no confirma desarrollo ni instalación.', 'Una sugerencia local no es una respuesta generada por un modelo.', 'Las medidas, compatibilidades e importes se revisan antes de confirmar una propuesta.'] };
  }
  function rules(project, quote) {
    const inputs = project.inputs || [], selection = project.selectedReferences || [], room = project.room || {}, out = [];
    const push = (id, title, basis, moduleId, problem, type = 'question', benefit = '') => out.push({ id, title, basis, moduleId, problem, type, benefit, origin: 'local_rule_suggestion' });
    if (!inputs.length) push('no_sources', 'Empieza por una foto o una nota', 'Este proyecto todavía no tiene fuentes guardadas.', 'inputs', '¿Qué información conviene recoger para preparar este proyecto?');
    const missing = ['length', 'width', 'height'].filter(k => !(Number(String(room[k] || '').replace(',', '.')) > 0));
    if (missing.length || room.confirmed !== true) push('room_pending', 'Revisa las medidas de la estancia', missing.length ? 'Faltan ' + missing.length + ' dimensiones. No se deducen medidas de una imagen.' : 'Hay dimensiones anotadas, pero todavía no están confirmadas.', 'studio', 'Quiero revisar las medidas de esta estancia antes de cerrar el plano.');
    if (inputs.length && !selection.length) push('selection_empty', 'Prepara una selección del catálogo', 'Hay fuentes guardadas y aún no has elegido referencias para este proyecto.', 'studio', '¿Cómo puedo preparar una primera selección del catálogo para este proyecto?');
    const pendingAudio = inputs.filter(i => /^(audio|video)\//.test(i.mimeType || i.type || '') && !String(i.transcript || '').trim());
    if (pendingAudio.length) push('media_transcript_pending', 'Completa el texto de tus audios', pendingAudio.length + ' archivo(s) de audio o vídeo no tienen transcripción. Puedes escribirla o pegarla en Entradas.', 'inputs', 'Me ayudaría poder transcribir los archivos de audio importados y revisar el texto con su original.', 'module', 'Aprovechar las necesidades del cliente sin copiarlas a mano.');
    if (selection.length && quote && !quote.lines?.length) push('selection_without_quote', 'Prepara el presupuesto de la selección', 'Hay ' + selection.length + ' referencia(s) seleccionadas y el presupuesto de este proyecto está vacío.', 'quote', 'Quiero pasar de la selección de referencias a un presupuesto revisable.');
    if (quote?.lines?.length) {
      const incomplete = quote.lines.filter(l => !l.unit?.trim() || !String(l.quantity || '').trim() || !String(l.salePrice || '').trim() || !String(l.discount || '').trim() || !String(l.vat || '').trim() || !l.priceConfirmed).length;
      if (incomplete || !quote.conditionsConfirmed) push('quote_pending', 'Revisa el presupuesto antes del PDF', (incomplete ? incomplete + ' línea(s) tienen datos o precios por confirmar. ' : '') + (!quote.conditionsConfirmed ? 'Las condiciones aún no están confirmadas.' : ''), 'quote', 'Quiero identificar qué datos faltan por confirmar antes de compartir este presupuesto.');
      else push('quote_ready_for_pdf', 'Revisa y prepara tu PDF', 'Las líneas y condiciones aparecen marcadas por ti. Puedes revisar el documento en Presupuesto.', 'quote', 'Quiero revisar el PDF y la forma de compartirlo con el cliente.');
    }
    if (inputs.some(i => (i.mimeType || i.type || '').startsWith('image/')) && !project.promo?.imageInputId && !project.promo?.imageReference) push('photo_without_promo', 'Prepara una imagen para presentar tu trabajo', 'Tienes una imagen en el proyecto y todavía no hay una imagen de promoción seleccionada.', 'promos', '¿Cómo puedo preparar una promoción con una imagen y un mensaje de este proyecto?');
    return out.slice(0, 5);
  }
  function mount(container, options = {}) {
    if (!container) throw Error('Falta el espacio de mejoras.');
    if (container.__deividEvolution) return container.__deividEvolution;
    const store = options.store || root.DeividProjectStore; if (!store) throw Error('Abre primero el espacio de proyectos.');
    const el = (tag, cls, content) => { const n = document.createElement(tag); if (cls) n.className = cls; if (content != null) n.textContent = content; return n; };
    const button = (label, fn, cls = 'btn secondary small') => { const b = el('button', cls, label); b.type = 'button'; b.onclick = fn; return b; };
    let activeProjectId = '', projectEpoch = 0, requests = [], corrupt = false, editingId = '', formOrigin = 'user', formRule = '', currentStatus = null, unsubscribe, destroyed = false;
    const owners = new Map();
    container.classList.add('deivid-evolution'); container.textContent = '';
    const intro = el('section', 'de-intro'); intro.append(el('span', 'pill green', 'Gratis para Deivid'), el('h2', null, 'Tu aplicación puede mejorar contigo.'), el('p', null, 'Usa las herramientas disponibles, explica qué te falta y prepara una solicitud para el chat. No se instala ni se envía nada desde esta pantalla.'));
    const scope = el('p', 'subtle de-project-label'), storage = el('p', 'subtle'), message = el('p', 'de-message'); message.setAttribute('role', 'status');
    const say = s => { message.textContent = s; options.notify?.(s); };
    const run = fn => async () => { try { await fn(); } catch (e) { say(e.message || 'No se ha podido completar esta acción.'); } };
    const modulesWrap = el('section', 'de-section'); modulesWrap.append(el('div', 'eyebrow', 'Disponibles en esta aplicación'), el('h3', null, 'Herramientas que ya puedes abrir'));
    const moduleGrid = el('div', 'de-module-grid');
    function openModule(id) { const m = moduleById(id); if (!m) return; options.onView?.(m.view); if (m.section) root.DeividWorkspaces?.growth?.show?.(m.section); }
    for (const m of MODULES) { const c = el('article', 'card de-module'); c.append(el('h4', null, m.title), el('p', 'subtle', m.description), button('Abrir herramienta', () => openModule(m.id))); moduleGrid.append(c); }
    modulesWrap.append(moduleGrid);
    const suggestions = el('section', 'de-section'), suggestionList = el('div', 'de-suggestions'); suggestions.append(el('div', 'eyebrow', 'Reglas locales · este proyecto'), el('h3', null, 'Próximos pasos que puedes revisar'), el('p', 'subtle', 'Estas sugerencias se calculan con reglas locales a partir de los datos guardados. No son respuestas de un modelo ni una revisión técnica.'), button('Actualizar sugerencias', () => refresh()), suggestionList);
    const form = el('form', 'card de-form'); form.append(el('h3', null, 'Cuéntanos qué necesitas'));
    const fields = {};
    function field(label, key, tag = 'input', choices) { const w = el('div', 'de-field'), id = 'de-' + uid(), input = el(tag); input.id = id; const lab = el('label', null, label); lab.htmlFor = id; if (choices) for (const [v, t] of choices) { const o = el('option', null, t); o.value = v; input.append(o); } input.maxLength = key === 'problem' ? 700 : key === 'benefit' ? 400 : 120; if (tag === 'textarea') input.rows = 4; fields[key] = input; w.append(lab, input); form.append(w); return input; }
    field('Tipo de solicitud', 'type', 'select', Object.entries(TYPES));
    field('Herramienta o tema', 'moduleId', 'select', [['', 'General'], ...MODULES.map(m => [m.id, m.title]), ...IDEAS.map(m => [m.id, m.title + ' · propuesta'])]);
    field('Título breve', 'title'); field('¿Qué problema quieres resolver?', 'problem', 'textarea').required = true; field('¿Qué te facilitaría el trabajo?', 'benefit', 'textarea');
    const contextBox = el('fieldset', 'de-context'), legend = el('legend', null, 'Contexto que quieres preparar para el chat'); contextBox.append(legend, el('p', 'subtle', 'Selecciona solo lo necesario. Se prepara un resumen de texto; los archivos originales no se adjuntan.'));
    const checks = {};
    for (const [key, label] of [['includeRoom', 'Dimensiones y estado de la estancia'], ['includeSelection', 'Referencias seleccionadas'], ['includeQuote', 'Resumen del presupuesto de este proyecto']]) { const lab = el('label', 'de-check'), input = el('input'); input.type = 'checkbox'; checks[key] = input; lab.append(input, document.createTextNode(label)); contextBox.append(lab); }
    const sourceChecks = el('div', 'de-context-sources'); contextBox.append(sourceChecks); form.append(contextBox);
    const formError = el('p', 'error'), formActions = el('div', 'de-actions'), saveButton = button('Guardar solicitud', null, 'btn'); saveButton.type = 'submit';
    formActions.append(saveButton, button('Nueva solicitud', () => resetForm())); form.append(formError, formActions);
    form.addEventListener('submit', async event => { event.preventDefault(); formError.textContent = ''; try {
      const p = store.getProject(); if (p.id !== activeProjectId) throw Error('El proyecto ha cambiado. Revisa la solicitud antes de guardarla.');
      const problem = fields.problem.value.trim(); if (!problem) throw Error('Explica primero el problema que quieres resolver.');
      const selectedInputs = Array.from(sourceChecks.querySelectorAll('input:checked')).map(i => i.value); if (selectedInputs.length > 4) throw Error('Selecciona como máximo cuatro fuentes para este resumen.');
      const existing = editingId ? requests.find(r => r.id === editingId) : null;
      const next = normalizeRequest({ ...(existing || {}), id: existing?.id || uid(), projectId: p.id, type: fields.type.value, moduleId: fields.moduleId.value, title: fields.title.value.trim() || TYPES[fields.type.value], problem, benefit: fields.benefit.value.trim(), origin: formOrigin, ruleId: formRule, createdAt: existing?.createdAt || now(), updatedAt: now(), revision: existing ? existing.revision + 1 : 1, status: 'LOCAL_DRAFT', context: { includeRoom: checks.includeRoom.checked, includeSelection: checks.includeSelection.checked, includeQuote: checks.includeQuote.checked, inputIds: selectedInputs } }, p.id);
      const nextList = existing ? requests.map(r => r.id === existing.id ? next : r) : [next, ...requests]; await saveRequests(nextList); resetForm(); say(store.getStatus?.().durable ? 'Solicitud guardada en este proyecto. Puedes prepararla para el chat cuando decidas.' : 'Solicitud en esta sesión. Exporta una copia antes de cerrar.');
    } catch (e) { formError.textContent = e.message; } });
    const requestSection = el('section', 'de-section'), requestList = el('div', 'de-requests'); requestSection.append(el('h3', null, 'Tus solicitudes en este proyecto'), requestList);
    const ideas = el('details', 'card de-ideas'); ideas.append(el('summary', null, 'Funciones que puedes proponer · todavía no instaladas'));
    for (const idea of IDEAS) { const c = el('article', 'de-idea'); c.append(el('h4', null, idea.title), el('p', 'subtle', idea.description), button('Preparar esta solicitud', () => fillForm({ type: 'module', moduleId: idea.id, title: idea.title, problem: idea.problem, benefit: idea.benefit, origin: 'user' }))); ideas.append(c); }
    const backup = el('details', 'card de-backup'); backup.append(el('summary', null, 'Copiar o recuperar las solicitudes'), el('p', 'subtle', 'Esta copia contiene textos y referencias de seguimiento, sin adjuntar los archivos originales. Al importarla se crean nuevos borradores; no prueba que ojO los haya recibido ni vuelve a enviarlos.'));
    const importer = el('input'); importer.type = 'file'; importer.accept = '.json,application/json'; importer.hidden = true;
    importer.addEventListener('change', async () => { const file = importer.files?.[0], token = activeProjectId; importer.value = ''; if (!file) return; try { if (file.size > 1024 * 1024) throw Error('La copia supera 1 MB.'); const payload = JSON.parse(await file.text()); if (payload.schema !== EXPORT_SCHEMA || payload.version !== 1 || !Array.isArray(payload.requests) || payload.requests.length > LIMIT) throw Error('No es una copia de solicitudes compatible.'); if (store.getProject().id !== token) throw Error('El proyecto cambió durante la lectura. Importa la copia en el proyecto que quieras conservarla.'); const imported = payload.requests.map(r => normalizeRequest(r, token, true)); await saveRequests([...imported, ...requests]); say(imported.length + ' borrador(es) importado(s). Las constancias anteriores necesitan revisión y no se ha enviado nada.'); } catch (e) { say(e.message); } });
    const backupActions = el('div', 'de-actions'); backupActions.append(button('Exportar solicitudes JSON', () => exportJSON()), button('Importar como borradores', () => importer.click())); backup.append(backupActions, importer);
    container.append(intro, scope, storage, message, suggestions, form, requestSection, modulesWrap, ideas, backup);
    function quoteFor(project) { const q = root.DeividWorkspaces?.quote; if (!q?.getDraft || q.projectId !== project.id) return null; try { return q.getDraft(); } catch (_) { return null; } }
    function contextNotes(request, project) {
      const notes = [], c = request.context || {}, room = project.room || {};
      if (c.includeRoom) notes.push(text('Estancia: largo ' + (room.length || 'por confirmar') + ' m; ancho ' + (room.width || 'por confirmar') + ' m; alto ' + (room.height || 'por confirmar') + ' m. Medidas ' + (room.confirmed ? 'confirmadas por el usuario' : 'NO confirmadas') + '. Estilo seleccionado: ' + (room.style || 'sin definir') + '.', 320));
      if (c.includeSelection) notes.push(text('Referencias elegidas por el usuario: ' + ((project.selectedReferences || []).map(x => refOf(x) + (x?.quantity ? ' × ' + text(x.quantity, 20) : '')).join(', ') || 'ninguna') + '. La selección no demuestra compatibilidad.', 320));
      const chosen = (project.inputs || []).filter(i => (c.inputIds || []).includes(i.id));
      if (chosen.length) notes.push(text('Fuentes elegidas (se comparte solo este texto): ' + chosen.map(i => text(i.name, 70) + (i.transcript ? ' — ' + text(i.transcript, 120) + ' [texto ' + (i.transcription?.reviewed ? 'revisado por el usuario' : 'sin certificar') + ']' : ' [sin transcripción]')).join('; '), 320));
      if (c.includeQuote) { const q = quoteFor(project); notes.push(text(q ? 'Presupuesto ' + text(q.number, 60) + ': ' + (q.lines?.length || 0) + ' línea(s). Referencias: ' + (q.lines || []).slice(0, 10).map(l => text(l.reference, 50)).join(', ') + '. Condiciones ' + (q.conditionsConfirmed ? 'marcadas por el usuario' : 'pendientes') + '. No se incluyen costes ni márgenes internos.' : 'El presupuesto de este proyecto no está disponible para preparar su resumen.', 320)); }
      return notes.slice(0, 4);
    }
    async function saveRequests(next) {
      if (corrupt) throw Error('La copia anterior se conserva intacta. Expórtala y utiliza otro proyecto para nuevas solicitudes.');
      if (next.length > LIMIT) throw Error('Este proyecto admite hasta 100 solicitudes. Exporta una copia y organiza la lista.');
      const p = store.getProject(); if (p.id !== activeProjectId) throw Error('El proyecto cambió. Vuelve a abrir sus solicitudes.');
      const normalized = next.map(r => normalizeRequest(r, p.id));
      store.updateProject({ evolution: { ...(p.evolution || {}), schema: SCHEMA, version: 1, requests: normalized, updatedAt: now(), nativeDevelopmentClaimed: false } });
      await store.flush?.(); return normalized;
    }
    function resetForm() { editingId = ''; formOrigin = 'user'; formRule = ''; fields.type.value = 'question'; fields.moduleId.value = ''; fields.title.value = ''; fields.problem.value = ''; fields.benefit.value = ''; for (const c of Object.values(checks)) c.checked = false; for (const c of sourceChecks.querySelectorAll('input')) c.checked = false; saveButton.textContent = 'Guardar solicitud'; formError.textContent = ''; }
    function fillForm(value) { resetForm(); if (value.id) editingId = value.id; formOrigin = value.origin || 'user'; formRule = value.ruleId || ''; for (const k of Object.keys(fields)) fields[k].value = value[k] || (k === 'type' ? 'question' : ''); for (const k of Object.keys(checks)) checks[k].checked = value.context?.[k] === true; for (const c of sourceChecks.querySelectorAll('input')) c.checked = (value.context?.inputIds || []).includes(c.value); saveButton.textContent = editingId ? 'Guardar cambios' : 'Guardar solicitud'; form.scrollIntoView({ behavior: 'smooth', block: 'start' }); fields.problem.focus(); }
    async function prepareRequest(id) {
      await ready; const p = store.getProject(), r = requests.find(r => r.id === id); if (!r || r.projectId !== p.id) throw Error('La solicitud no pertenece al proyecto activo.');
      if (typeof options.onPrepareChat !== 'function') { say('No hay una conexión con el editor del chat en esta página. La solicitud sigue guardada y puedes exportarla.'); return { prepared: false, reason: 'CHAT_EDITOR_UNAVAILABLE' }; }
      const notes = contextNotes(r, p), fullMessage = '[' + TYPES[r.type] + '] ' + r.title + '\nProblema: ' + r.problem + (r.benefit ? '\nMe ayudaría: ' + r.benefit : '') + '\nQuiero revisar esta propuesta. Compartirla no confirma su desarrollo ni instalación.';
      const messageText = fullMessage.length > 950 ? text(fullMessage, 890) + '\n[Texto resumido; revisa antes de enviar.]' : fullMessage;
      const prepared = { message: messageText, contextNotes: notes, at: now(), revision: r.revision };
      await options.onPrepareChat({ requestId: id, message: prepared.message, contextNotes: clone(notes) });
      if (store.getProject().id !== p.id) return { prepared: false, reason: 'PROJECT_CHANGED' };
      if (requests.find(x => x.id === id)?.revision !== r.revision) return { prepared: false, reason: 'REQUEST_CHANGED' };
      const status = r.conversationDelivery?.revision === r.revision ? 'SHARED_IN_CONVERSATION' : r.conversationPending?.revision === r.revision ? 'AWAITING_CONVERSATION_RECEIPT' : 'PREPARED_FOR_CHAT';
      await saveRequests(requests.map(x => x.id === id ? { ...x, status, prepared, updatedAt: now() } : x));
      if (store.getProject().id !== p.id) return { prepared: false, reason: 'PROJECT_CHANGED' };
      const currentRequest = requests.find(x => x.id === id);
      if (!currentRequest?.conversationPending && currentRequest?.status !== 'SHARED_IN_CONVERSATION') say('Texto preparado para el chat. Revisa el mensaje y el contexto; todavía no se ha enviado.');
      return { prepared: true, requestId: id, message: prepared.message, contextNotes: clone(notes) };
    }
    async function prefillRequest(value = {}) {
      await ready;
      fillForm({ type: TYPES[value.type] ? value.type : 'improvement', moduleId: [...MODULES, ...IDEAS].some(m => m.id === value.moduleId) ? value.moduleId : '', title: text(value.title, 120), problem: text(value.problem, 700), benefit: text(value.benefit, 400), origin: 'user' });
      say('Idea preparada en el formulario. Revísala y guarda la solicitud si quieres conservarla. No se ha enviado nada.');
      return { prefilled: true, saved: false, sent: false };
    }
    async function recordConversationPending(localRequestId, binding) {
      await ready;
      if (typeof binding?.request_id !== 'string' || !binding.request_id.trim() || binding.request_id.length > 160) return { recorded: false, reason: 'CONVERSATION_REQUEST_ID_REQUIRED' };
      const p = store.getProject(), owner = owners.get(localRequestId);
      if (owner && owner !== p.id) return { recorded: false, reason: 'PROJECT_CHANGED', projectId: owner };
      const request = requests.find(r => r.id === localRequestId); if (!request?.prepared) return { recorded: false, reason: 'PREPARED_REQUEST_NOT_FOUND' };
      if (request.conversationDelivery?.request_id === binding.request_id) return { recorded: true, state: request.status, alreadyDelivered: true };
      const pending = { request_id: binding.request_id, conversation_id: text(binding.conversation_id, 160), revision: request.prepared.revision, at: now(), state: 'AWAITING_VALIDATED_RECEIPT' };
      const status = pending.revision === request.revision ? 'AWAITING_CONVERSATION_RECEIPT' : 'LOCAL_DRAFT';
      await saveRequests(requests.map(r => r.id === localRequestId ? { ...r, conversationPending: pending, status, updatedAt: now() } : r));
      return { recorded: true, state: status, receptionConfirmed: false, developmentAccepted: false, installed: false };
    }
    async function recordConversationDelivery(localRequestId, transportReceipt) {
      await ready;
      if (transportReceipt?.validatedNative !== true || typeof transportReceipt.request_id !== 'string' || !transportReceipt.request_id.trim() || transportReceipt.request_id.length > 160) return { recorded: false, reason: 'VALIDATED_CONVERSATION_RECEIPT_REQUIRED' };
      const owner = owners.get(localRequestId), p = store.getProject();
      if (owner && owner !== p.id) return { recorded: false, reason: 'PROJECT_CHANGED', projectId: owner };
      const request = requests.find(r => r.id === localRequestId); if (!request || !request.prepared) return { recorded: false, reason: 'PREPARED_REQUEST_NOT_FOUND' };
      if (!request.conversationPending && request.conversationDelivery) return request.conversationDelivery.request_id === transportReceipt.request_id ? { recorded: true, state: request.status, alreadyRecorded: true, developmentAccepted: false, installed: false } : { recorded: false, reason: 'CONVERSATION_BINDING_REQUIRED' };
      if (!request.conversationPending && request.conversationClosure) return { recorded: false, reason: 'TERMINAL_CONVERSATION_ALREADY_RECORDED' };
      if (request.conversationPending && request.conversationPending.request_id !== transportReceipt.request_id) return { recorded: false, reason: 'CONVERSATION_BINDING_MISMATCH' };
      if (request.conversationPending?.conversation_id && transportReceipt.conversation_id && request.conversationPending.conversation_id !== transportReceipt.conversation_id) return { recorded: false, reason: 'CONVERSATION_BINDING_MISMATCH' };
      const delivery = { request_id: text(transportReceipt.request_id, 160), validatedNative: true, observedAt: now(), conversation_id: text(transportReceipt.conversation_id || request.conversationPending?.conversation_id, 160), revision: request.conversationPending?.revision || request.prepared.revision, scope: 'CONVERSATION_ONLY', developmentAccepted: false, installed: false };
      await saveRequests(requests.map(r => r.id === localRequestId ? { ...r, status: r.revision === delivery.revision ? 'SHARED_IN_CONVERSATION' : 'LOCAL_DRAFT', conversationPending: null, conversationDelivery: delivery, updatedAt: now() } : r));
      return { recorded: true, state: request.revision === delivery.revision ? 'SHARED_IN_CONVERSATION' : 'LOCAL_DRAFT', developmentAccepted: false, installed: false };
    }
    async function recordConversationClosed(localRequestId, receipt) {
      await ready;
      if (receipt?.validatedNative !== true || typeof receipt.request_id !== 'string' || !receipt.request_id.trim() || receipt.request_id.length > 160 || !CLOSED_STATES.has(receipt.state)) return { recorded: false, reason: 'VALIDATED_TERMINAL_RECEIPT_REQUIRED' };
      const p = store.getProject(), owner = owners.get(localRequestId);
      if (owner && owner !== p.id) return { recorded: false, reason: 'PROJECT_CHANGED', projectId: owner };
      const request = requests.find(r => r.id === localRequestId);
      if (!request?.conversationPending || request.conversationPending.request_id !== receipt.request_id || (request.conversationPending.conversation_id && receipt.conversation_id && request.conversationPending.conversation_id !== receipt.conversation_id)) return { recorded: false, reason: 'CONVERSATION_BINDING_MISMATCH' };
      const closure = { request_id: receipt.request_id, conversation_id: text(receipt.conversation_id || request.conversationPending.conversation_id, 160), state: receipt.state, at: now(), revision: request.conversationPending.revision, notAdmitted: receipt.notAdmitted === true, validatedNative: true };
      const status = closure.revision === request.revision ? 'CONVERSATION_CLOSED' : 'LOCAL_DRAFT';
      await saveRequests(requests.map(r => r.id === localRequestId ? { ...r, status, conversationPending: null, conversationClosure: closure, updatedAt: now() } : r));
      return { recorded: true, state: status, developmentAccepted: false, installed: false };
    }
    function exportJSON() {
      const p = store.getProject(), payload = corrupt ? { schema: 'DEIVID_EVOLUTION_UNREADABLE_COPY', projectId: p.id, evolution: p.evolution } : { schema: EXPORT_SCHEMA, version: 1, exportedAt: now(), projectId: p.id, verification: 'LOCAL_COPY_NOT_A_REMOTE_RECEIPT', requests: requests.map(r => ({ ...clone(r), conversationDelivery: r.conversationDelivery ? { ...r.conversationDelivery, validatedNative: false, verification: 'HISTORICAL_LOCAL_COPY' } : null, conversationClosure: r.conversationClosure ? { ...r.conversationClosure, validatedNative: false, verification: 'HISTORICAL_LOCAL_COPY' } : null })), developmentAccepted: false, installed: false };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })), a = el('a'); a.href = url; a.download = 'Deivid_solicitudes_' + new Date().toISOString().slice(0, 10) + '.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    function renderSuggestions(p) {
      suggestionList.textContent = ''; const items = rules(p, quoteFor(p));
      if (!items.length) { suggestionList.append(el('p', 'subtle', 'No hay una sugerencia automática pendiente con estas reglas. Puedes describir una nueva necesidad.')); return; }
      for (const item of items) { const card = el('article', 'card de-suggestion'); card.append(el('span', 'de-rule', 'Regla local'), el('h4', null, item.title), el('p', 'subtle', item.basis)); const actions = el('div', 'de-actions'); actions.append(button('Abrir herramienta', () => openModule(item.moduleId)), button('Preparar una pregunta', () => fillForm({ ...item, title: item.title, ruleId: item.id }))); card.append(actions); suggestionList.append(card); }
    }
    function renderRequests() {
      requestList.textContent = ''; if (corrupt) { requestList.append(el('p', 'de-warning', 'Las solicitudes anteriores se conservan sin modificar. Puedes exportar su copia desde abajo.')); return; }
      if (!requests.length) { requestList.append(el('p', 'subtle', 'Todavía no has guardado solicitudes en este proyecto.')); return; }
      for (const r of requests) {
        const card = el('article', 'card de-request'), header = el('div', 'de-request-head'); header.append(el('span', 'pill', STATES[r.status]), el('span', 'small subtle', TYPES[r.type])); card.append(header, el('h4', null, r.title), el('p', 'de-problem', r.problem));
        if (r.benefit) card.append(el('p', 'subtle', 'Me facilitaría: ' + r.benefit));
        if (r.origin === 'local_rule_suggestion') card.append(el('small', 'subtle', 'Origen: sugerencia de una regla local, revisada en este formulario.'));
        const stateText = r.status === 'SHARED_IN_CONVERSATION' ? 'El chat confirmó la recepción de este mensaje en la conversación. Esto no confirma desarrollo ni instalación.' : r.status === 'AWAITING_CONVERSATION_RECEIPT' ? 'Se ha iniciado el envío desde el chat. La recepción en la conversación aún no está confirmada.' : r.status === 'CONVERSATION_CLOSED' ? (r.conversationClosure?.notAdmitted ? 'El chat no admitió este envío. Puedes revisar el mensaje e intentarlo de nuevo.' : 'El chat comunicó un final sin respuesta completada. Puedes revisar el mensaje e intentarlo de nuevo.') : r.status === 'PREPARED_FOR_CHAT' ? 'Hay una copia preparada para el editor del chat. Revisa el mensaje antes de enviarlo allí.' : r.status === 'IMPORTED_DRAFT' ? 'Copia por revisar. Las constancias del archivo importado no se toman como una recepción nueva.' : r.conversationDelivery ? 'Hay una versión anterior compartida; los cambios actuales siguen como borrador.' : r.conversationPending ? 'Una versión anterior espera confirmación en el chat. Los cambios actuales siguen como borrador local.' : 'Conservado localmente. Aún no compartido en una conversación.';
        card.append(el('p', 'de-state-text', stateText));
        if (r.conversationDelivery) card.append(el('p', 'de-receipt subtle', 'Referencia de conversación: ' + r.conversationDelivery.request_id));
        if (r.conversationPending) card.append(el('p', 'de-receipt subtle', 'Envío pendiente de confirmar: ' + r.conversationPending.request_id));
        const preview = el('details', 'de-preview'); preview.append(el('summary', null, 'Ver el contexto que se preparará'), el('p', 'subtle', contextNotes(r, store.getProject()).join('\n\n') || 'No has seleccionado datos adicionales del proyecto.')); card.append(preview);
        const controls = el('div', 'de-actions'); controls.append(button('Preparar para el chat', run(() => prepareRequest(r.id)), 'btn small'), button('Editar', () => fillForm(r)), button('Eliminar', run(async () => { if (!root.confirm('¿Eliminar este borrador de este proyecto? Una conversación ya compartida no se borra.')) return; await saveRequests(requests.filter(x => x.id !== r.id)); if (editingId === r.id) resetForm(); say('Solicitud eliminada de esta copia local.'); }), 'text-button danger')); card.append(controls); requestList.append(card);
      }
    }
    let sourceSerial = '', requestSerial = '';
    function sync(project, st) {
      if (destroyed) return;
      if (project.id !== activeProjectId) { activeProjectId = project.id; projectEpoch++; resetForm(); message.textContent = ''; sourceSerial = ''; requestSerial = ''; }
      currentStatus = st || store.getStatus?.(); scope.textContent = 'Proyecto: ' + (project.name || 'Sin nombre') + (project.client ? ' · ' + project.client : '');
      storage.textContent = currentStatus?.message || 'Estado de conservación no confirmado.'; storage.classList.toggle('de-warning', !currentStatus?.durable);
      const read = readEvolution(project); corrupt = read.corrupt; requests = read.requests; saveButton.disabled = corrupt; if (corrupt) message.textContent = read.error;
      for (const r of requests) owners.set(r.id, project.id);
      const inputSignature = project.id + JSON.stringify((project.inputs || []).map(i => [i.id, i.name]));
      if (inputSignature !== sourceSerial) { sourceSerial = inputSignature; const selected = new Set(Array.from(sourceChecks.querySelectorAll('input:checked')).map(i => i.value)); sourceChecks.textContent = ''; const items = (project.inputs || []).slice(0, 20); if (items.length) sourceChecks.append(el('p', 'subtle', 'Fuentes concretas (máximo cuatro; se prepara un extracto breve):')); for (const item of items) { const label = el('label', 'de-check'), input = el('input'); input.type = 'checkbox'; input.value = item.id; input.checked = selected.has(item.id); label.append(input, document.createTextNode(text(item.name, 100))); sourceChecks.append(label); } if ((project.inputs || []).length > 20) sourceChecks.append(el('p', 'subtle', 'Aquí se muestran las primeras 20 fuentes. Puedes preparar otro extracto en el chat.')); }
      const serial = project.id + JSON.stringify(requests); if (serial !== requestSerial) { requestSerial = serial; renderRequests(); }
      renderSuggestions(project);
      if (!corrupt && read.normalized) { const token = projectEpoch; queueMicrotask(() => { if (!destroyed && token === projectEpoch && store.getProject().id === project.id) saveRequests(requests).catch(e => say(e.message)); }); }
    }
    function refresh() { if (!activeProjectId) return; sync(store.getProject(), store.getStatus?.()); }
    const ready = Promise.resolve(store.ready).then(() => { if (destroyed) return; sync(store.getProject(), store.getStatus?.()); unsubscribe = store.subscribe(sync); });
    const api = { ready, getRequests: () => clone(requests), prepareRequest, prefillRequest, recordConversationPending, recordConversationDelivery, recordConversationClosed, getModuleContext: moduleContext, refresh, destroy() { destroyed = true; unsubscribe?.(); } };
    container.__deividEvolution = api; return api;
  }
  root.DeividEvolution = Object.freeze({ version: 1, mount, moduleContext, rules, normalizeRequest });
})(typeof window !== 'undefined' ? window : globalThis);
