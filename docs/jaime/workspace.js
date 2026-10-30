(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const C = window.JaimeCommunications;
  const KEY = 'ojo-jaime-daily-communications-v1';
  const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const stamp = () => new Date().toISOString();
  const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const el = (tag, cls, text) => {const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n;};
  const notify = message => window.JaimeApp.notify(message);
  const open = id => window.JaimeApp.openDialog(id);
  const close = id => $(id).close();
  const channelLabel = channel => ({email:'Correo',phone:'Llamada',sms:'SMS',other:'Otro intercambio'}[channel] || 'Otro');
  const statusLabel = status => ({to_reply:'Por responder',draft:'Borrador',waiting:'En espera · marcado por ti',done:'Resuelto · marcado por ti'}[status] || 'Guardado');
  const fold = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const plain = (value, max) => typeof value === 'string' ? value.slice(0,max) : '';
  let data = {version:1,tasks:[],communications:[],checkins:[]};
  let checkinDirty = false;
  let unreadableOriginal = null, currentView = 'chat', currentFilter = 'all', showCompleted = false;
  let currentTask = null, currentCommunication = null, importCandidate = null, draftTimer = null, unsavedDraft = null;
  const selectedImports = new Set();
  function validDay(value) {
    if (!value) return '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Revisa la fecha elegida.');
    const d = new Date(value+'T12:00:00');
    if (!Number.isFinite(d.getTime()) || localDay(d) !== value) throw new Error('La fecha no es válida.');
    return value;
  }
  function normalTask(raw) {
    if (!raw || typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 160) throw new Error('Hay un paso sin título o demasiado largo.');
    return {id:plain(raw.id,160) || uid(),title:raw.title.trim(),note:plain(raw.note,2000),due:validDay(raw.due || ''),done:raw.done === true,communicationId:plain(raw.communicationId,160),createdAt:plain(raw.createdAt,40) || stamp(),updatedAt:plain(raw.updatedAt,40) || stamp()};
  }
  function normalCheckin(raw) {
    if (!raw || !['bien','regular','dificil',''].includes(raw.mood || '')) throw new Error('Hay una nota personal no válida.');
    return {day:validDay(raw.day),mood:raw.mood || '',note:plain(raw.note,2000),updatedAt:plain(raw.updatedAt,40) || stamp()};
  }
  function normalizedWorkspace(raw) {
    if (!raw || raw.version !== 1 || !Array.isArray(raw.tasks) || !Array.isArray(raw.communications) || !Array.isArray(raw.checkins)) throw new Error('No se reconoce esta copia.');
    if (raw.tasks.length > 1000 || raw.communications.length > 1000 || raw.checkins.length > 1500) throw new Error('La copia contiene demasiados elementos. Divide la copia antes de recuperarla.');
    return {version:1,tasks:raw.tasks.map(normalTask),communications:raw.communications.map(item => C.normalizeItem(item)),checkins:raw.checkins.map(normalCheckin)};
  }
  function load() {
    let raw;
    try {raw = localStorage.getItem(KEY); if (raw) data = normalizedWorkspace(JSON.parse(raw));}
    catch {unreadableOriginal = raw || ''; setTimeout(() => notify('No se han podido recuperar tus mensajes y tareas. Conserva una copia desde Mis cuentas antes de cerrar.'),500);}
  }
  function commit(change) {
    if (unreadableOriginal !== null) {notify('Los datos anteriores no se pueden leer. Conserva la copia original desde Mis cuentas; no se han sobrescrito.'); return false;}
    const previous = JSON.stringify(data);
    try {
      change(data);
      if (data.tasks.length > 1000 || data.communications.length > 1000 || data.checkins.length > 1500) throw new Error('Este espacio ha alcanzado su límite. Guarda una copia antes de añadir más contenido.');
      localStorage.setItem(KEY,JSON.stringify(data)); return true;
    } catch (error) {data = JSON.parse(previous); notify(error?.name === 'QuotaExceededError' ? 'El navegador no tiene espacio para guardar esto. Conserva una copia antes de cerrar.' : error.message || 'No se ha podido guardar. El contenido anterior se conserva.'); return false;}
  }
  const message = id => data.communications.find(item => item.id === id);
  const task = id => data.tasks.find(item => item.id === id);
  function displayDay(value) {if (!value) return 'Sin fecha'; return new Date(value+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'});}
  function taskWhen(item) {const today = localDay(); return !item.due ? 'A tu ritmo' : item.due === today ? 'Para hoy' : item.due < today ? `Pendiente desde el ${displayDay(item.due)}` : `Para el ${displayDay(item.due)}`;}
  function openTasks() {return data.tasks.filter(item => !item.done).sort((a,b) => (a.due || '9999').localeCompare(b.due || '9999') || a.createdAt.localeCompare(b.createdAt));}
  function setView(view) {
    if (!['chat','day','messages'].includes(view)) return;
    flushDraft();
    currentView = view;
    document.dispatchEvent(new CustomEvent('jaime:viewchange',{detail:{view}}));
    $('mainContent').hidden = view !== 'chat'; $('dayView').hidden = view !== 'day'; $('messagesView').hidden = view !== 'messages';
    document.querySelectorAll('[data-view]').forEach(button => {const active = button.dataset.view === view; button.classList.toggle('active',active); if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');});
    if (view === 'day') renderDay();
    if (view === 'messages') renderCommunications();
  }
  function renderDay() {
    $('dayDate').textContent = new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}).toLocaleUpperCase();
    const pending = openTasks(), next = pending[0];
    $('daySummary').textContent = pending.length ? `${pending.length === 1 ? 'Tienes un paso apuntado' : `Tienes ${pending.length} pasos apuntados`}. Puedes elegir por dónde empezar.` : 'Un pequeño paso también cuenta.';
    $('nextActionTitle').textContent = next?.title || '¿Qué te gustaría dejar hecho?';
    $('nextActionDescription').textContent = next ? `${taskWhen(next)}${next.note ? ' · '+next.note : ''}` : 'Puede ser una llamada, una pregunta o algo para ti.';
    $('nextActionButton').textContent = next ? 'Ver este paso' : 'Elegir un paso';
    const root = $('taskList'); root.replaceChildren();
    const shown = showCompleted ? data.tasks.filter(item => item.done) : pending;
    if (!shown.length) {
      const empty = el('div','empty-state compact'); empty.append(el('h3','',showCompleted ? 'Aquí quedará lo que vayas haciendo.' : 'Empieza por algo pequeño.'),el('p','',showCompleted ? 'Puedes volver a tus pasos pendientes cuando quieras.' : 'Apunta una llamada, un dato que necesitas o un momento para ti.')); root.append(empty);
    }
    for (const item of shown) {
      const row = el('div',`day-task ${item.done ? 'done' : ''}`);
      const check = el('button','task-check',item.done ? '✓' : '○'); check.type = 'button'; check.setAttribute('aria-label',`${item.done ? 'Volver a dejar pendiente' : 'Dar por hecho'}: ${item.title}`);
      check.addEventListener('click',() => {if (commit(() => {const t = task(item.id); t.done = !t.done; t.updatedAt = stamp();})) renderDay();});
      const body = el('div'); body.append(el('strong','task-title',item.title)); if (item.note) body.append(el('p','',item.note));
      body.append(el('span',`task-due ${item.due && item.due < localDay() && !item.done ? 'is-overdue' : ''}`,taskWhen(item)));
      const actions = el('div','task-actions'); const edit = el('button','subtle-link','Ver / cambiar'); edit.addEventListener('click',() => openTask(item.id)); actions.append(edit);
      if (item.communicationId && message(item.communicationId)) {const linked = el('button','subtle-link','Ver mensaje'); linked.addEventListener('click',() => openCommunication(item.communicationId)); actions.append(linked);}
      body.append(actions); row.append(check,body); root.append(row);
    }
    $('showCompletedTasks').textContent = showCompleted ? 'Volver a mis pendientes' : 'Ver lo que ya hice';
    const waiting = data.communications.filter(item => item.status === 'to_reply' || item.status === 'draft').length;
    $('communicationDaySummary').textContent = waiting ? `Tienes ${waiting === 1 ? 'un intercambio' : `${waiting} intercambios`} que has dejado por preparar.` : 'Puedes guardar un mensaje y preparar tu respuesta con calma.';
    $('faithSpace').hidden = !window.JaimeApp.faithEnabled();
    if (checkinDirty) return;
    const own = data.checkins.find(item => item.day === localDay());
    const selected = own?.mood || '';
    $('checkinForm').querySelectorAll('input[name=mood]').forEach(input => {input.checked = input.value === selected;});
    $('checkinNote').value = own?.note || '';
    $('checkinStatus').textContent = own ? 'Tu nota de hoy está guardada aquí, sin cifrar.' : 'Se guarda en este navegador sin cifrar. No se envía a nadie.';
  }
  function openTask(id) {
    const item = id ? task(id) : null; currentTask = item?.id || null;
    $('taskDialogTitle').textContent = item ? 'Tu siguiente paso' : 'Un siguiente paso';
    $('taskTitle').value = item?.title || ''; $('taskDue').value = item?.due || ''; $('taskNote').value = item?.note || ''; $('taskError').textContent = ''; open('taskDialog');
  }
  $('taskForm').addEventListener('submit',event => {
    event.preventDefault();
    try {
      const previous = currentTask ? task(currentTask) : null;
      const item = normalTask({...previous,id:previous?.id || uid(),title:$('taskTitle').value,note:$('taskNote').value,due:$('taskDue').value,updatedAt:stamp()});
      if (commit(() => {const at = data.tasks.findIndex(t => t.id === item.id); if (at < 0) data.tasks.push(item); else data.tasks[at] = item;})) {close('taskDialog'); renderDay(); notify('Paso guardado. Puedes cambiarlo cuando quieras.');}
    } catch (error) {$('taskError').textContent = error.message;}
  });
  $('addTaskButton').addEventListener('click',() => openTask());
  $('nextActionButton').addEventListener('click',() => openTask(openTasks()[0]?.id));
  $('showCompletedTasks').addEventListener('click',() => {showCompleted = !showCompleted; renderDay();});
  $('checkinForm').addEventListener('input',() => {checkinDirty = true;});
  $('checkinForm').addEventListener('submit',event => {
    event.preventDefault(); const mood = $('checkinForm').querySelector('input[name=mood]:checked')?.value || ''; const note = $('checkinNote').value.trim();
    if (!mood && !note) {$('checkinStatus').textContent = 'Puedes elegir cómo te encuentras o dejar una frase.'; return;}
    const item = normalCheckin({day:localDay(),mood,note,updatedAt:stamp()});
    if (commit(() => {const at = data.checkins.findIndex(c => c.day === item.day); if (at < 0) data.checkins.push(item); else data.checkins[at] = item;})) {checkinDirty = false; $('checkinStatus').textContent = 'Guardado para ti. Puedes cambiarlo cuando quieras.'; notify('Tu nota de hoy está guardada.');}
  });
  $('dayMessagesButton').addEventListener('click',() => setView('messages'));
  $('daySettingsButton').addEventListener('click',() => open('helpDialog'));
  $('faithTopicButton').addEventListener('click',() => window.JaimeApp.startTopic({title:'Un momento para mi fe',topicType:'personal',draft:'Quiero dejar una reflexión sobre mi fe. Hoy…'}));

  function renderCommunications() {
    const search = fold($('messageSearch').value);
    const entries = [...data.communications].reverse().filter(item => (currentFilter === 'all' || item.status === currentFilter) && (!search || fold([item.contact,item.subject,item.body,item.draft].join(' ')).includes(search)));
    const list = $('communicationsList'); list.replaceChildren();
    $('messageCount').textContent = data.communications.length ? `${entries.length} ${entries.length === 1 ? 'intercambio visible' : 'intercambios visibles'} · guardados por ti` : '';
    if (!entries.length) {
      const empty = el('div','empty-state');
      empty.append(el('span','empty-icon','✉'),el('h2','',data.communications.length ? 'Nada en esta vista.' : 'Tu primer intercambio, aquí.'),el('p','',data.communications.length ? 'Puedes cambiar el filtro o buscar otro nombre.' : 'Un correo o unas notas de una llamada. Tú eliges lo que quieres traer.'));
      list.append(empty); return;
    }
    for (const item of entries) {
      const card = el('article','comms-card'); const top = el('div','comms-card-top'); const contact = el('div','contact-line');
      contact.append(el('span','contact-avatar',(item.contact || '?').slice(0,1).toLocaleUpperCase()));
      const identity = el('div'); identity.append(el('h2','',item.contact || 'Contacto por confirmar'),el('span','comm-meta',item.source === 'manual' ? 'Añadido por ti' : 'Importado por ti')); contact.append(identity);
      top.append(contact,el('span',`channel-tag ${item.channel}`,channelLabel(item.channel))); card.append(top);
      if (item.subject) card.append(el('h3','',item.subject));
      card.append(el('p','comm-preview',item.body.slice(0,180)+(item.body.length > 180 ? '…' : '')));
      const footer = el('div','comms-card-footer'); footer.append(el('span',`channel-tag ${item.status === 'draft' ? 'draft' : ''}`,statusLabel(item.status)));
      const button = el('button','subtle-link',item.status === 'done' ? 'Ver intercambio' : item.draft ? 'Ver mi borrador' : 'Preparar respuesta'); button.addEventListener('click',() => openCommunication(item.id)); footer.append(button); card.append(footer);
      if (item.nextFollowUpAt) card.append(el('span','task-due',`Retomarlo el ${displayDay(item.nextFollowUpAt)}`)); list.append(card);
    }
  }
  function showNewMessage() {$('newMessageForm').reset(); $('newMessageError').textContent = ''; open('newMessageDialog');}
  $('addMessageButton').addEventListener('click',showNewMessage);
  $('newMessageForm').addEventListener('submit',event => {
    event.preventDefault();
    try {
      const item = C.normalizeItem({id:uid(),contact:$('newContact').value.trim(),channel:$('newChannel').value,email:$('newEmail').value.trim(),subject:$('newSubject').value,body:$('newMessageBody').value,source:'manual',status:'to_reply',meta:{addedAt:stamp(),pendingChosenByUser:true}});
      if (!item.contact || !item.body.trim()) throw new Error('Añade la persona y el mensaje que quieres guardar.');
      if (commit(() => data.communications.push(item))) {close('newMessageDialog'); renderCommunications(); openCommunication(item.id);}
    } catch (error) {$('newMessageError').textContent = error.message;}
  });
  $('messageSearch').addEventListener('input',renderCommunications);
  document.querySelectorAll('[data-message-filter]').forEach(button => button.addEventListener('click',() => {currentFilter = button.dataset.messageFilter; document.querySelectorAll('[data-message-filter]').forEach(b => {const selected = b === button; b.classList.toggle('active',selected); b.setAttribute('aria-pressed',String(selected));}); renderCommunications();}));
  function saveDraft(id,text,quiet = false) {
    const item = message(id); if (!item) return false;
    if (item.draft === text) {if (currentCommunication === id) $('draftSaveState').textContent = 'Borrador guardado en este dispositivo.'; return true;}
    const ok = commit(() => {const target = message(id); target.draft = text; if (text.trim()) target.status = 'draft'; else if (target.status === 'draft') target.status = 'to_reply';});
    if (currentCommunication === id) $('draftSaveState').textContent = ok ? 'Borrador guardado en este dispositivo.' : 'No se pudo guardar. Copia el texto antes de cerrar.';
    if (ok) {if (unsavedDraft?.id === id && unsavedDraft.text === text) unsavedDraft = null; if (currentView === 'messages') renderCommunications(); if (!quiet) notify('Borrador guardado. No se ha enviado.');}
    return ok;
  }
  function flushDraft() {clearTimeout(draftTimer); if (unsavedDraft) return saveDraft(unsavedDraft.id,unsavedDraft.text,true); return true;}
  function openCommunication(id) {
    flushDraft(); const item = message(id); if (!item) return;
    currentCommunication = id;
    $('communicationTitle').textContent = item.contact || 'Contacto por confirmar'; $('communicationChannel').textContent = channelLabel(item.channel);
    const date = item.dateText || (item.receivedAt ? item.receivedAt.replace('T',' · ') : 'Fecha no indicada');
    $('communicationMeta').textContent = `${item.source === 'manual' ? 'Añadido por ti' : 'Importado por ti'} · ${date}${item.email ? ' · '+item.email : ''}`;
    $('communicationSubject').textContent = item.subject || ''; $('communicationSubject').hidden = !item.subject;
    $('communicationBody').textContent = item.body;
    const notices = [];
    if (item.imported) notices.push('Se ha recuperado texto. No se ha confirmado su lectura por un asistente.');
    if (item.dateText && !item.receivedAt) notices.push('La fecha original queda por confirmar.');
    if (item.meta?.attachments?.length) notices.push('El correo incluye referencias a adjuntos que no se han importado. Conserva el original.');
    if (item.messageKind !== 'message') notices.push('Este elemento es una nota del sistema o un fragmento que requiere revisión.');
    $('communicationNotices').textContent = notices.join(' ');
    $('communicationDraft').value = unsavedDraft?.id === id ? unsavedDraft.text : item.draft;
    $('communicationFollowUp').value = item.nextFollowUpAt || '';
    $('draftState').textContent = 'Borrador local'; $('draftSaveState').textContent = item.draft ? 'Borrador guardado en este dispositivo.' : 'Puedes escribir libremente o preparar una base.';
    $('communicationActionState').textContent = statusLabel(item.status);
    $('openEmailDraft').hidden = item.channel !== 'email' || !item.email;
    $('shareCommunicationDraft').hidden = typeof navigator.share !== 'function';
    open('communicationDialog');
  }
  $('communicationDraft').addEventListener('input',event => {
    if (!currentCommunication) return;
    unsavedDraft = {id:currentCommunication,text:event.target.value}; $('draftSaveState').textContent = 'Guardando borrador…'; clearTimeout(draftTimer); draftTimer = setTimeout(flushDraft,350);
  });
  $('communicationDialog').addEventListener('close',flushDraft);
  $('saveCommunicationDraft').addEventListener('click',() => {clearTimeout(draftTimer); if (currentCommunication) saveDraft(currentCommunication,$('communicationDraft').value);});
  $('makeTemplateButton').addEventListener('click',() => {
    try {
      const item = message(currentCommunication); if (!item) return;
      if ($('communicationDraft').value.trim()) {notify('Tu borrador ya tiene texto. Consérvalo o vacíalo antes de preparar otra base.'); return;}
      const result = C.makeDraft(item,{intent:$('draftIntent').value,language:$('draftLanguage').value,tone:$('draftTone').value,name:window.JaimeApp.name()});
      $('communicationDraft').value = result.text; $('draftState').textContent = result.label; unsavedDraft = {id:item.id,text:result.text}; flushDraft();
      notify('Base preparada. Completa los campos entre corchetes y revisa el mensaje.');
    } catch (error) {notify(error.message);}
  });
  $('copyCommunicationDraft').addEventListener('click',async () => {
    const text = $('communicationDraft').value; if (!text.trim()) {notify('Escribe una respuesta antes de copiarla.'); return;}
    flushDraft();
    try {await navigator.clipboard.writeText(text); $('communicationActionState').textContent = 'Texto copiado. La app no confirma ningún envío.'; notify('Borrador copiado. Pégalo en el chat o correo que tú elijas.');}
    catch {$('communicationDraft').focus(); $('communicationDraft').select(); notify('Selecciona y copia el texto. El navegador no permitió copiarlo automáticamente.');}
  });
  $('shareCommunicationDraft').addEventListener('click',async () => {
    const text = $('communicationDraft').value; if (!text.trim()) {notify('Escribe una respuesta antes de compartirla.'); return;}
    flushDraft();
    try {await navigator.share({text}); $('communicationActionState').textContent = 'Has usado el menú de compartir. Comprueba el destinatario y el envío en la app elegida.';}
    catch (error) {if (error.name !== 'AbortError') notify('No se pudo abrir el menú de compartir. Puedes copiar el texto.');}
  });
  $('openEmailDraft').addEventListener('click',() => {
    try {const item = message(currentCommunication); const uri = C.buildMailto(item,$('communicationDraft').value); flushDraft(); window.location.href = uri; $('communicationActionState').textContent = 'Se ha solicitado abrir tu correo con un borrador. Nada se marca como enviado.';}
    catch (error) {notify(error.message);}
  });
  function markCommunication(status) {
    if (!flushDraft()) return;
    const id = currentCommunication;
    if (commit(() => {const item = message(id); if (item) item.status = status;})) {$('communicationActionState').textContent = statusLabel(status); renderCommunications();}
  }
  $('markCommunicationWaiting').addEventListener('click',() => markCommunication('waiting'));
  $('markCommunicationDone').addEventListener('click',() => markCommunication('done'));
  $('createFollowUpTask').addEventListener('click',() => {
    if (!flushDraft()) return;
    try {
      const item = message(currentCommunication); if (!item) return; const due = validDay($('communicationFollowUp').value);
      const existing = data.tasks.find(t => t.communicationId === item.id && !t.done);
      const next = normalTask({...existing,id:existing?.id || uid(),title:`Retomar con ${item.contact || 'este contacto'}`.slice(0,160),note:item.subject || '',due,communicationId:item.id,updatedAt:stamp()});
      if (commit(() => {const at = data.tasks.findIndex(t => t.id === next.id); if (at < 0) data.tasks.push(next); else data.tasks[at] = next; message(item.id).nextFollowUpAt = due || null;})) {$('communicationActionState').textContent = 'Paso guardado en Mi día. No se ha programado un aviso al teléfono.'; notify('Añadido a Mi día.'); renderCommunications();}
    } catch (error) {notify(error.message);}
  });
  $('moveCommunicationToTopic').addEventListener('click',() => {
    if (!flushDraft()) return; const item = message(currentCommunication); if (!item) return; close('communicationDialog');
    window.JaimeApp.startTopic({title:(item.subject || `Intercambio con ${item.contact}`).slice(0,90),topicType:'general',draft:`Quiero ordenar este intercambio con ${item.contact || 'un contacto'}.\n\nTexto aportado como referencia (${channelLabel(item.channel)}):\n${item.body.slice(0,9500)}${item.body.length > 9500 ? '\n[Extracto: el texto completo permanece en Mis mensajes.]' : ''}\n\nMi siguiente paso: `,communicationId:item.id});
  });

  function showImport(candidate) {
    importCandidate = candidate; selectedImports.clear();
    $('importCommunicationSummary').textContent = `${candidate.items.length} elementos encontrados. Elige los que quieres guardar como pendientes de seguimiento.`;
    const notices = $('importCommunicationNotices'); notices.replaceChildren();
    for (const item of candidate.notices || []) notices.append(el('p','small-note',item.message));
    const list = $('importCommunicationList'); list.replaceChildren();
    const existing = new Set(data.communications.map(item => item.sourceKey));
    candidate.items.forEach((item,index) => {
      const row = el('label','import-message-row'); const check = el('input'); check.type = 'checkbox'; check.dataset.importIndex = String(index); const duplicate = existing.has(item.sourceKey); check.disabled = duplicate;
      check.addEventListener('change',() => {if (check.checked) selectedImports.add(index); else selectedImports.delete(index); updateImportButton();});
      const body = el('div'); body.append(el('strong','',item.contact || 'Contacto por confirmar'),el('p','',item.body.slice(0,320)+(item.body.length > 320 ? '…' : '')),el('small','',duplicate ? 'Ya está guardado · no se duplicará' : item.dateText || item.receivedAt || 'Fecha por confirmar')); row.append(check,body); list.append(row);
    });
    $('communicationImportError').textContent = ''; updateImportButton(); open('communicationImportDialog');
  }
  function updateImportButton() {$('confirmCommunicationImport').disabled = selectedImports.size === 0; $('confirmCommunicationImport').textContent = selectedImports.size ? `Guardar ${selectedImports.size} ${selectedImports.size === 1 ? 'seleccionado' : 'seleccionados'}` : 'Selecciona al menos un mensaje';}
  $('selectAllImportMessages').addEventListener('click',() => {$('importCommunicationList').querySelectorAll('input').forEach(input => {if (!input.disabled && importCandidate.items[Number(input.dataset.importIndex)].messageKind === 'message') {input.checked = true; selectedImports.add(Number(input.dataset.importIndex));}}); updateImportButton();});
  $('selectNoImportMessages').addEventListener('click',() => {selectedImports.clear(); $('importCommunicationList').querySelectorAll('input').forEach(input => {input.checked = false;}); updateImportButton();});
  $('confirmCommunicationImport').addEventListener('click',() => {
    if (!importCandidate || !selectedImports.size) return;
    const seen = new Set(data.communications.map(item => item.sourceKey)), imported = [];
    for (const index of selectedImports) {const item = importCandidate.items[index]; if (!item || seen.has(item.sourceKey)) continue; seen.add(item.sourceKey); imported.push(C.normalizeItem({...item,id:uid(),status:'to_reply',meta:{...item.meta,pendingChosenByUser:true,addedAt:stamp()}}));}
    if (!imported.length) {$('communicationImportError').textContent = 'Estos mensajes ya estaban guardados.'; return;}
    if (commit(() => data.communications.push(...imported))) {close('communicationImportDialog'); importCandidate = null; currentFilter = 'all'; document.querySelectorAll('[data-message-filter]').forEach(b => {const yes = b.dataset.messageFilter === 'all'; b.classList.toggle('active',yes); b.setAttribute('aria-pressed',String(yes));}); setView('messages'); notify(`${imported.length} intercambios guardados. No se ha enviado ninguna respuesta.`);}
  });
  $('importMessageButton').addEventListener('click',() => $('communicationImportInput').click());
  $('importWorkspaceButton').addEventListener('click',() => $('communicationImportInput').click());
  $('communicationImportInput').addEventListener('change',async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > C.limits.maxBytes) throw new Error('El archivo supera 5 MB. Divide la exportación antes de importarla.');
      const text = await file.text();
      if (/\.json$/i.test(file.name)) {
        const copy = JSON.parse(text);
        if (copy?.source !== 'OJO_JAIME_ORGANIZATION_BACKUP') throw new Error('Este archivo no es una copia de mensajes y tareas de ojO Jaime. Para las conversaciones, usa Mis temas.');
        const restored = normalizedWorkspace(copy.workspace);
        restoreOrganization(restored); return;
      }
      if (/\.eml$/i.test(file.name) || file.type === 'message/rfc822') showImport(C.parseEml(text));
      else throw new Error('Selecciona un correo .eml o una copia de organización .json.');
    } catch (error) {notify(error.message || 'No se ha podido leer este archivo.');}
  });
  let restoreCandidate = null;
  function restoreOrganization(restored) {
    restoreCandidate = restored;
    $('restoreOrganizationSummary').textContent = `La copia contiene ${restored.communications.length} intercambios, ${restored.tasks.length} pasos y ${restored.checkins.length} notas personales. Se añadirán los elementos que aún no tengas; lo actual se conserva.`;
    open('restoreOrganizationDialog');
  }
  $('confirmRestoreOrganization').addEventListener('click',() => {
    if (!restoreCandidate) return;
    const copy = restoreCandidate;
    if (commit(() => {
      const knownMessages = new Set(data.communications.map(x => x.sourceKey)), knownTasks = new Set(data.tasks.map(x => x.id)), knownDays = new Set(data.checkins.map(x => x.day));
      const idMap = new Map();
      for (const item of copy.communications) {const existing = data.communications.find(x => x.sourceKey === item.sourceKey); if (existing) idMap.set(item.id,existing.id); else {const id = uid(); idMap.set(item.id,id); if (!knownMessages.has(item.sourceKey)) {data.communications.push({...item,id}); knownMessages.add(item.sourceKey);}}}
      for (const item of copy.tasks) if (!knownTasks.has(item.id)) {data.tasks.push({...item,communicationId:idMap.get(item.communicationId) || item.communicationId}); knownTasks.add(item.id);}
      for (const item of copy.checkins) if (!knownDays.has(item.day)) {data.checkins.push(item); knownDays.add(item.day);}
    })) {restoreCandidate = null; close('restoreOrganizationDialog'); renderCommunications(); renderDay(); notify('Copia recuperada. Los datos que ya tenías se conservan.');}
  });
  function download(name,content) {const url = URL.createObjectURL(new Blob([content],{type:'application/json'})); const a = el('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),10000);}
  $('exportWorkspaceButton').addEventListener('click',() => {
    flushDraft();
    const content = unreadableOriginal !== null ? unreadableOriginal : JSON.stringify({source:'OJO_JAIME_ORGANIZATION_BACKUP',version:1,exportedAt:stamp(),workspace:data,notice:'Copia local de textos, tareas y notas. No contiene adjuntos, contraseñas ni conexiones de cuentas.'},null,2);
    download(`Jaime-mensajes-y-tareas-${localDay()}.json`,content); notify('Copia preparada. Contiene tus mensajes, tareas y notas personales.');
  });
  $('accountsButton').addEventListener('click',() => open('accountsDialog'));
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click',() => setView(button.dataset.view)));
  document.addEventListener('jaime:navigate',event => setView(event.detail?.view || 'chat'));
  document.addEventListener('jaime:preferences',() => {if (currentView === 'day') renderDay();});
  window.addEventListener('pagehide',flushDraft);
  document.addEventListener('visibilitychange',() => {if (document.visibilityState === 'hidden') flushDraft();});
  function fitViewport() {
    if (!window.visualViewport || window.visualViewport.scale !== 1) return;
    const height = window.visualViewport.height;
    document.documentElement.style.setProperty('--workspace-height',`${Math.round(height)}px`);
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    const keyboard = typing && Math.max(window.innerHeight,document.documentElement.clientHeight) - height > 100;
    document.body.classList.toggle('keyboard-open',keyboard);
  }
  window.visualViewport?.addEventListener('resize',fitViewport);
  document.addEventListener('focusin',fitViewport); document.addEventListener('focusout',() => requestAnimationFrame(fitViewport));
  load(); renderDay(); renderCommunications(); fitViewport();
})();
