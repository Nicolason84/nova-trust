(() => {
  'use strict';
  // This adapter observes closed technical signals only. It never reads the
  // notebook, files, mood, faith, messages, vault, or Matrix session.
  const $ = id => document.getElementById(id);
  const note = text => { $('evolutionStatus').textContent = text; };
  let store;
  try { store = window.localStorage; } catch { store = null; }
  let evolution;
  try { evolution = window.NovaEvolution?.create({appId:'jaime', scope:'personal', storage:store, clock:() => new Date().toISOString()}); } catch {}
  const notify = text => window.JaimeApp?.notify?.(text);
  const boolFlags = () => ({memory:$('evolutionMemory').checked, observations:$('evolutionObservations').checked, suggestions:$('evolutionSuggestions').checked, technicalSharing:$('evolutionTechnicalSharing').checked});
  const stateWord = value => ({PROPOSED:'Por revisar', APPROVED_NOT_EXECUTED:'Te interesa · pendiente de revisión, sin ejecutar', REFUSED:'Descartada', CANCELLED:'Cancelada'}[value] || 'Por revisar');
  const spanish = {
    CHECK_CONNECTION:['Comprobar la conversación','Comprueba la conexión antes de enviar una nueva petición. Mientras tanto puedes guardar una idea o probar tus números.'],
    CHECK_STORAGE:['Comprobar el guardado local','Se ha observado un fallo de guardado. Conserva una copia antes de cerrar esta app.'],
    RESTORE_CONNECTION:['Continuar cuando vuelva la conexión','La red no está disponible. Conserva el trabajo local antes de continuar.'],
    VERIFY_INPUT:['Revisar los datos','Una validación ha rechazado los datos introducidos. Revísalos antes de repetir la operación.'],
    CHECK_SOURCE:['Comprobar la fuente','Una información útil necesita confirmación en su fuente.'],
    RESUME_TASK:['Retomar una tarea','Puedes revisar una tarea que quedó abierta en este espacio.'],
    REVIEW_UNSAVED_CHANGE:['Revisar los cambios','Hay cambios pendientes de revisar antes de guardarlos.'],
    REVIEW_FEATURE_REQUEST:['Examinar una mejora','Se ha solicitado una función que no está disponible. Puedes preparar una propuesta para revisar.']
  };
  function syncChoices() {
    if (!evolution) return;
    const c = evolution.consent();
    for (const [key,id] of Object.entries({memory:'evolutionMemory',observations:'evolutionObservations',suggestions:'evolutionSuggestions',technicalSharing:'evolutionTechnicalSharing'})) $(id).checked = c[key] === true;
    const prefs = evolution.preferences() || {};
    $('evolutionDetail').value = prefs.detail === 'standard' ? 'standard' : 'short';
    $('evolutionCadence').value = prefs.cadence === 'on_open' ? 'on_open' : 'off';
    $('evolutionExport').disabled = c.technicalSharing !== true;
    $('evolutionPreferenceControls').hidden = c.memory !== true;
  }
  function observe(signal) {
    if (!evolution || evolution.consent().observations !== true) return;
    try { evolution.observe(signal); } catch { note('No se ha podido conservar esta señal de funcionamiento.'); }
  }
  async function inspectConnection() {
    if (!evolution || evolution.consent().observations !== true) return;
    if (window.navigator.onLine === false) { observe('OFFLINE'); return; }
    try {
      const health = await window.JaimeGateway?.health?.();
      observe(health?.ok === true ? 'CHAT_OK' : 'CHAT_UNAVAILABLE');
    } catch { observe('CHAT_UNAVAILABLE'); }
  }
  function proposals() {
    const mount = $('evolutionProposals');
    mount.replaceChildren();
    if (!evolution) { note('Las mejoras no están disponibles en esta versión. Tus ideas y archivos no se modifican.'); return []; }
    const consent = evolution.consent();
    if (consent.suggestions !== true) { note('Las propuestas están desactivadas. Puedes seguir usando la app con normalidad.'); return []; }
    let items;
    try { const result = evolution.suggest(); items = Array.isArray(result) ? result : result?.proposals || result?.suggestions || []; }
    catch { note('No se han podido comprobar las propuestas.'); return []; }
    note(items.length ? 'Propuestas basadas en señales de funcionamiento, no en tus conversaciones.' : 'No hay propuestas de funcionamiento pendientes.');
    for (const item of items) {
      const card = document.createElement('section'); card.className = 'preferences-form';
      const localized = spanish[item.code];
      const title = document.createElement('h3'); title.textContent = localized?.[0] || 'Una mejora para revisar';
      const description = document.createElement('p');
      const explanation = localized?.[1] || 'Puedes revisar esta propuesta antes de decidir.';
      description.textContent = evolution.preferences().detail === 'standard' ? explanation : (explanation.match(/^[^.]+\./)?.[0] || explanation);
      const status = document.createElement('p'); status.className = 'small-note'; status.textContent = stateWord(item.decision || item.state || item.status);
      const actions = document.createElement('div'); actions.className = 'dialog-actions';
      for (const [decision,label] of [['accept','Me interesa'],['refuse','Ahora no'],['cancel','Cancelar mi elección']]) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = label;
        button.addEventListener('click',() => {
          try { evolution.decide(item.id,decision); proposals(); notify('Elección guardada. No se ha ejecutado ninguna acción externa.'); }
          catch { note('No se ha podido guardar tu elección.'); }
        });
        actions.append(button);
      }
      card.append(title,description,status,actions); mount.append(card);
    }
    return items;
  }
  $('evolutionOpen').addEventListener('click',() => { syncChoices(); proposals(); window.JaimeApp?.openDialog?.('evolutionDialog'); });
  $('evolutionMemory').addEventListener('change',() => { $('evolutionPreferenceControls').hidden = !$('evolutionMemory').checked; });
  $('evolutionConsentForm').addEventListener('submit',async event => {
    event.preventDefault();
    if (!evolution) return note('Las mejoras no están disponibles en esta versión.');
    try {
      evolution.setConsent(boolFlags());
      if (evolution.consent().memory === true) evolution.setPreferences({language:'es',detail:$('evolutionDetail').value,cadence:$('evolutionCadence').value});
      syncChoices(); await inspectConnection(); proposals(); notify('Opciones actualizadas. Ningún contenido personal se ha enviado.');
    } catch { note('No se han podido guardar estas opciones. Comprueba el espacio disponible del navegador.'); }
  });
  $('evolutionRefresh').addEventListener('click',async () => { await inspectConnection(); proposals(); });
  $('evolutionExport').addEventListener('click',() => {
    if (!evolution || evolution.consent().technicalSharing !== true) return;
    try {
      const contribution = evolution.exportTechnical();
      const blob = new Blob([JSON.stringify(contribution,null,2)],{type:'application/json'});
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'Jaime-propuesta-tecnica.json'; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url),10000);
      note('Archivo técnico preparado para que lo revises. No se ha enviado a SUPRA.');
    } catch { note('No se ha podido preparar la contribución técnica.'); }
  });
  $('evolutionForget').addEventListener('click',() => {
    if (!evolution) return;
    try { evolution.forget(); syncChoices(); proposals(); notify('Opciones y mejoras olvidadas. Tus ideas, mensajes y archivos se conservan.'); }
    catch { note('No se han podido borrar estas opciones.'); }
  });
  document.addEventListener('jaime:technical',event => { if (event.detail?.signal === 'STORAGE_FAILURE') { observe('STORAGE_FAILURE'); proposals(); } });
  window.addEventListener('storage',() => { syncChoices(); proposals(); });
  window.addEventListener('offline',() => { observe('OFFLINE'); proposals(); });
  window.addEventListener('online',async () => { await inspectConnection(); proposals(); });
  syncChoices();
  if (evolution?.consent().observations === true) inspectConnection().then(() => {
    const items = proposals();
    if (items.length && evolution.preferences()?.cadence === 'on_open') notify('Hay una propuesta disponible en Mis mejoras. Tú decides si revisarla.');
  });
})();
