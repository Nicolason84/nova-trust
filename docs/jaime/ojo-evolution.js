/* NOVA ERA shared projection of La Bête care methods. No timer, network or executor. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NovaEvolution = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const METHOD_SHA = '02fb155a27f11855db33ece9706691622b552d3d34e8d223336facfb5d0d524b';
  const APPS = ['helene', 'deivid', 'jaime', 'founder', 'freight'];
  const SCOPES = ['personal', 'private', 'real', 'demo', 'local'];
  const SIGNALS = ['CHAT_UNAVAILABLE', 'CHAT_OK', 'STORAGE_FAILURE', 'OFFLINE', 'INVALID_DATA',
    'MISSING_SOURCE', 'PENDING_TASK', 'UNSAVED_CHANGE', 'FEATURE_REQUESTED'];
  const TECHNICAL = ['CHAT_UNAVAILABLE', 'STORAGE_FAILURE', 'OFFLINE', 'INVALID_DATA'];
  const FLAGS = ['memory', 'observations', 'suggestions', 'technicalSharing'];
  const CODES = {
    CHAT_UNAVAILABLE: ['CHECK_CONNECTION', 'Vérifier la conversation', 'La connexion doit être vérifiée avant de confier une nouvelle demande.'],
    STORAGE_FAILURE: ['CHECK_STORAGE', 'Vérifier la sauvegarde locale', 'La dernière opération de stockage a signalé une erreur.'],
    OFFLINE: ['RESTORE_CONNECTION', 'Reprendre après la connexion', 'La connexion réseau est indisponible ; conserver le travail local disponible.'],
    INVALID_DATA: ['VERIFY_INPUT', 'Revoir les informations', 'Une validation a refusé les informations saisies.'],
    MISSING_SOURCE: ['CHECK_SOURCE', 'Vérifier la source', 'Une information utile doit être confirmée par sa source.'],
    PENDING_TASK: ['RESUME_TASK', 'Reprendre une tâche', 'Une tâche ouverte a été observée dans cet espace.'],
    UNSAVED_CHANGE: ['REVIEW_UNSAVED_CHANGE', 'Relire les modifications', 'Des changements restent à relire avant leur enregistrement.'],
    FEATURE_REQUESTED: ['REVIEW_FEATURE_REQUEST', 'Examiner une amélioration', 'Une fonction indisponible a été demandée ; préparer une proposition.']
  };
  const ES = {
    CHECK_CONNECTION: ['Comprobar la conversación', 'Verifica la conexión antes de confiar una nueva petición.'],
    CHECK_STORAGE: ['Comprobar el guardado local', 'La última operación de almacenamiento indicó un error.'],
    RESTORE_CONNECTION: ['Continuar cuando vuelva la conexión', 'La red no está disponible; conserva el trabajo local disponible.'],
    VERIFY_INPUT: ['Revisar los datos', 'Una validación rechazó los datos introducidos.'],
    CHECK_SOURCE: ['Comprobar la fuente', 'Una información útil necesita confirmación en su fuente.'],
    RESUME_TASK: ['Retomar una tarea', 'Se ha observado una tarea abierta en este espacio.'],
    REVIEW_UNSAVED_CHANGE: ['Revisar los cambios', 'Hay cambios pendientes de revisar antes de guardarlos.'],
    REVIEW_FEATURE_REQUEST: ['Examinar una mejora', 'Se ha solicitado una función no disponible; prepara una propuesta.']
  };
  const copy = value => JSON.parse(JSON.stringify(value));
  const plain = value => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
  const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(value, k));
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  const flags = () => ({memory: false, observations: false, suggestions: false, technicalSharing: false});
  const empty = (appId, scope) => ({schema: 'NOVA_OJO_EVOLUTION_LOCAL_V1', appId, scope,
    consent: flags(), preferences: {}, events: [], health: {}, decisions: {}, sequence: 0});

  function validState(s, appId, scope) {
    if (!exact(s, ['schema', 'appId', 'scope', 'consent', 'preferences', 'events', 'health', 'decisions', 'sequence']) ||
        s.schema !== 'NOVA_OJO_EVOLUTION_LOCAL_V1' || s.appId !== appId || s.scope !== scope ||
        !exact(s.consent, FLAGS) || FLAGS.some(k => typeof s.consent[k] !== 'boolean') || !integer(s.sequence)) return false;
    if (!plain(s.preferences) || Object.keys(s.preferences).some(k => !['language', 'detail', 'cadence'].includes(k))) return false;
    if ('language' in s.preferences && !['fr', 'es'].includes(s.preferences.language)) return false;
    if ('detail' in s.preferences && !['short', 'standard'].includes(s.preferences.detail)) return false;
    if ('cadence' in s.preferences && !['on_open', 'off'].includes(s.preferences.cadence)) return false;
    if (!Array.isArray(s.events) || s.events.length > 120 || new Set(s.events.map(e => e.id)).size !== s.events.length) return false;
    if (s.events.some(e => !exact(e, ['id', 'signal', 'at']) || !integer(e.id) || e.id > s.sequence ||
        !SIGNALS.includes(e.signal) || typeof e.at !== 'string' || !Number.isFinite(Date.parse(e.at)))) return false;
    if (!plain(s.health) || Object.keys(s.health).some(k => !SIGNALS.includes(k) || k === 'CHAT_OK')) return false;
    for (const h of Object.values(s.health)) {
      if (!exact(h, ['state', 'observed', 'goodStreak', 'episode', 'result']) ||
          !['OBSERVED', 'RECOVERED'].includes(h.state) || !integer(h.observed) || !integer(h.goodStreak) ||
          !integer(h.episode) || !['PENDING', 'GOAL_MET', 'NOT_MET'].includes(h.result)) return false;
    }
    if (!plain(s.decisions) || Object.entries(s.decisions).some(([id, d]) =>
      !Object.values(CODES).some(r => id === r[0]) || !['accept', 'refuse', 'cancel'].includes(d))) return false;
    return true;
  }

  function create(options) {
    if (!options || !APPS.includes(options.appId)) throw new Error('APP_ID_REQUIRED');
    const appId = options.appId, scope = options.scope || 'local';
    if (!SCOPES.includes(scope)) throw new Error('SCOPE_REJECTED');
    const storage = options.storage || null;
    const clock = options.clock || (() => new Date().toISOString());
    const key = 'nova:ojo:evolution:v1:' + appId + ':' + scope;
    let state = empty(appId, scope), storageStatus = storage ? 'AVAILABLE' : 'SESSION_ONLY', lastStorageRaw = null;
    if (storage) {
      try {
        const raw = storage.getItem(key);
        lastStorageRaw = raw;
        if (raw !== null) {
          try {
            const parsed = JSON.parse(raw);
            if (!validState(parsed, appId, scope)) storageStatus = 'CORRUPT_REQUIRES_FORGET';
            else state = parsed;
          } catch (_) { storageStatus = 'CORRUPT_REQUIRES_FORGET'; }
        }
      } catch (_) { storageStatus = 'UNAVAILABLE'; }
    }
    function syncStorage() {
      if (!storage || storageStatus === 'CORRUPT_REQUIRES_FORGET') return;
      try {
        const raw = storage.getItem(key);
        if (raw === lastStorageRaw) return;
        if (raw === null) state = empty(appId, scope);
        else {
          let parsed;
          try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }
          if (!validState(parsed, appId, scope)) {
            state = empty(appId, scope); storageStatus = 'CORRUPT_REQUIRES_FORGET'; return;
          }
          state = parsed;
        }
        lastStorageRaw = raw;
      } catch (_) { state = empty(appId, scope); storageStatus = 'UNAVAILABLE'; }
    }
    function persist() {
      if (!storage || storageStatus === 'CORRUPT_REQUIRES_FORGET') return;
      const saved = copy(state);
      if (!saved.consent.memory) { saved.preferences = {}; saved.decisions = {}; }
      if (!saved.consent.observations) { saved.events = []; saved.health = {}; saved.sequence = 0; }
      try { const raw = JSON.stringify(saved); storage.setItem(key, raw); lastStorageRaw = raw; storageStatus = 'AVAILABLE'; }
      catch (_) { storageStatus = 'UNAVAILABLE'; }
    }
    function consent() { syncStorage(); return copy(state.consent); }
    function setConsent(next) {
      syncStorage();
      if (!plain(next) || Object.keys(next).some(k => !FLAGS.includes(k) || typeof next[k] !== 'boolean')) throw new Error('CONSENT_REJECTED');
      if (storageStatus === 'CORRUPT_REQUIRES_FORGET') throw new Error('FORGET_CORRUPT_STATE_FIRST');
      state.consent = Object.assign({}, state.consent, next);
      if (!state.consent.memory) { state.preferences = {}; state.decisions = {}; }
      if (!state.consent.observations) { state.events = []; state.health = {}; state.sequence = 0; }
      persist(); return consent();
    }
    function setPreferences(p) {
      syncStorage();
      if (!state.consent.memory) throw new Error('MEMORY_CONSENT_REQUIRED');
      if (!plain(p) || Object.keys(p).some(k => !['language', 'detail', 'cadence'].includes(k)) ||
          ('language' in p && !['fr', 'es'].includes(p.language)) ||
          ('detail' in p && !['short', 'standard'].includes(p.detail)) ||
          ('cadence' in p && !['on_open', 'off'].includes(p.cadence))) throw new Error('PREFERENCE_REJECTED');
      state.preferences = Object.assign({}, state.preferences, p); persist(); return copy(state.preferences);
    }
    function observe(signal) {
      syncStorage();
      if (arguments.length !== 1 || !SIGNALS.includes(signal)) throw new Error('OBSERVATION_ENUM_REQUIRED');
      if (!state.consent.observations) return status();
      const at = clock();
      if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))) throw new Error('OBSERVATION_TIME_REQUIRED');
      const last = state.events[state.events.length - 1];
      if (last && last.signal === signal && last.at === at) return status();
      if (last && Date.parse(at) < Date.parse(last.at)) throw new Error('STALE_OBSERVATION');
      // Port of the registered La Bête method: fresh observations, two confirmations,
      // bounded history, and never equating a proposed action with an execution.
      if (state.sequence >= Number.MAX_SAFE_INTEGER) throw new Error('OBSERVATION_COUNTER_EXHAUSTED');
      state.sequence += 1;
      state.events.push({id: state.sequence, signal, at});
      state.events = state.events.slice(-120);
      if (signal === 'CHAT_OK') {
        const h = state.health.CHAT_UNAVAILABLE;
        if (h && h.state !== 'RECOVERED') {
          h.observed += 1; h.goodStreak += 1;
          if (h.goodStreak >= 2) {
            h.state = 'RECOVERED';
            // Later recovery does not rewrite a previously failed observation window.
            if (h.result !== 'NOT_MET') h.result = 'GOAL_MET';
          }
        }
      } else {
        const old = state.health[signal];
        const fresh = !old || old.state === 'RECOVERED';
        state.health[signal] = {state: 'OBSERVED', observed: fresh ? 1 : old.observed + 1,
          goodStreak: 0, episode: fresh ? (old ? old.episode : 0) + 1 : old.episode,
          result: !fresh && old.observed >= 2 ? 'NOT_MET' : 'PENDING'};
        if (fresh && CODES[signal]) delete state.decisions[CODES[signal][0]];
      }
      persist(); return status();
    }
    function suggest() {
      syncStorage();
      if (!state.consent.suggestions || state.preferences.cadence === 'off') return [];
      return Object.keys(state.health).filter(s => state.health[s].state === 'OBSERVED' && CODES[s]).map(signal => {
        const [id, title, message] = CODES[signal];
        const text = state.preferences.language === 'es' ? ES[id] : [title, message];
        const decision = state.decisions[id] || null;
        return {id, code: id, signal, title: text[0], message: text[1],
          status: decision === 'accept' ? 'APPROVED_NOT_EXECUTED' : decision === 'refuse' ? 'REFUSED' : decision === 'cancel' ? 'CANCELLED' : 'PROPOSED',
          evidence: 'LOCAL_ENUM_OBSERVATION', requiresNativeValidation: true,
          executed: false, causalEffectProven: false};
      });
    }
    function decide(id, decision) {
      syncStorage();
      if (!['accept', 'refuse', 'cancel'].includes(decision) || !suggest().some(p => p.id === id)) throw new Error('PROPOSAL_DECISION_REJECTED');
      state.decisions[id] = decision; persist(); return suggest().find(p => p.id === id);
    }
    function exportTechnical() {
      syncStorage();
      if (!state.consent.technicalSharing) throw new Error('TECHNICAL_SHARING_CONSENT_REQUIRED');
      return {schema: 'OJO_TECHNICAL_METHOD_CANDIDATE_V1', component: 'nova.ojo-evolution', component_version: VERSION,
        method: 'LA_BETE_PROSPECTIVE_RECOVERY', method_source_sha256: METHOD_SHA,
        issue_codes: Object.keys(state.health).filter(k => TECHNICAL.includes(k) && state.health[k].state === 'OBSERVED').sort(),
        requested_action: 'QUALIFY_ONLY', privacy: 'TECHNICAL_ENUMS_ONLY',
        contains_personal_data: false, automatic_promotion: false};
    }
    function status() {
      syncStorage();
      return {schema: 'NOVA_OJO_EVOLUTION_STATUS_V1', appId, scope, moduleVersion: VERSION,
        owner: 'SUPRA_LOCAL_EXECUTION_AGENT_V1', ownerConnection: 'CANDIDATE_NOT_CONNECTED',
        methodSourceSha256: METHOD_SHA, localOnly: true, secondLoop: false,
        storage: storageStatus, observationCount: state.sequence, health: copy(state.health),
        consent: consent(), proposalCount: suggest().length, automaticPromotion: false};
    }
    function forget() {
      if (storage) {
        try { storage.removeItem(key); lastStorageRaw = null; storageStatus = 'AVAILABLE'; }
        catch (_) { storageStatus = 'UNAVAILABLE'; throw new Error('FORGET_STORAGE_FAILED'); }
      }
      state = empty(appId, scope); return status();
    }
    return Object.freeze({consent, setConsent, preferences: () => { syncStorage(); return copy(state.preferences); },
      setPreferences, observe, status, suggest, decide, exportTechnical, forget});
  }
  return Object.freeze({VERSION, METHOD_SHA, SIGNALS: Object.freeze(SIGNALS.slice()), create});
});
