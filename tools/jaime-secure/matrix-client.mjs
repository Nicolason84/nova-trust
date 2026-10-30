/**
 * Strict Matrix SDK 45.0.0 adapter. No network is performed until connect() is called.
 * Inject the real SDK in the browser entry; injected doubles are for contract tests only.
 * This file implements no cryptographic protocol, VPN, AI, automatic message, or token vault.
 */
export const MATRIX_SDK_VERSION = '45.0.0';
export const MEGOLM = 'm.megolm.v1.aes-sha2';

export class SecureMessagingError extends Error {
  constructor(code, message) { super(message); this.name = 'SecureMessagingError'; this.code = code; }
}
const failure = (code, message) => new SecureMessagingError(code, message);
const noop = () => {};
const silentLogger = Object.freeze({ trace: noop, debug: noop, info: noop, warn: noop, error: noop, log: noop, getChild() { return this; } });
const retiredInThisPage = new Set();
const MXID = /^@[^\s:\u0000-\u001f]+:[^\s\u0000-\u001f]+$/u;
// Current Matrix room versions also use opaque IDs without a server-name suffix.
const ROOMID = /^![^\s\u0000-\u001f\u007f]+$/u;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function checkedString(value, code, label, limit = 255) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw failure(code, `${label} no válido.`);
  }
  return value;
}
function userId(value) {
  if (typeof value !== 'string' || value.length > 255 || !MXID.test(value)) throw failure('INVALID_USER_ID', 'Identificador Matrix no válido.');
  return value;
}
function roomId(value) {
  if (typeof value !== 'string' || value.length > 512 || !ROOMID.test(value)) throw failure('INVALID_ROOM_ID', 'Sala Matrix no válida.');
  return value;
}
function serverUrl(value, allowLoopbackForTests) {
  let url;
  try { url = new URL(value); } catch { throw failure('INVALID_HOMESERVER', 'Dirección del servidor no válida.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(allowLoopbackForTests && loopback && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) {
    throw failure('INSECURE_HOMESERVER', 'El servidor debe utilizar HTTPS sin credenciales en la dirección.');
  }
  return url.href.replace(/\/+$/u, '');
}

/** Stable namespace contains no access token or storage secret. IndexedDB is origin-scoped. */
export async function cryptoStoreName({ homeserverUrl, userId: id, deviceId }, crypto = globalThis.crypto) {
  if (!crypto?.subtle) throw failure('WEBCRYPTO_UNAVAILABLE', 'Este navegador no permite preparar el almacén seguro.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([homeserverUrl, id, deviceId])));
  return 'ojo-jaime-matrix-v1-' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

async function acquireStoreLock(locks, name) {
  if (typeof locks?.request !== 'function') throw failure('WEB_LOCKS_UNAVAILABLE', 'Este navegador no puede evitar dos sesiones simultáneas. Usa un navegador compatible.');
  let release;
  let operation;
  const acquired = new Promise((resolve, reject) => {
    try {
      operation = locks.request(name, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) { reject(failure('STORE_IN_USE', 'Esta sesión ya está abierta en otra pestaña.')); return; }
        const held = new Promise(done => { release = done; });
        resolve();
        await held;
      });
      Promise.resolve(operation).catch(() => reject(failure('LOCK_FAILED', 'No se ha podido bloquear el almacén.')));
    } catch { reject(failure('LOCK_FAILED', 'No se ha podido bloquear el almacén.')); }
  });
  await acquired;
  return async () => { release(); await operation; };
}

/** Lifecycle metadata only: never contains passwords, tokens, message text, or keys. */
function lifecycleStore(indexedDB, name) {
  let db;
  return {
    async open() {
      if (typeof indexedDB?.open !== 'function') throw failure('INDEXEDDB_UNAVAILABLE', 'El almacenamiento protegido no está disponible.');
      db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(name + '-lifecycle', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('lifecycle');
        request.onsuccess = () => resolve(request.result);
        request.onerror = request.onblocked = () => reject(failure('STORE_UNAVAILABLE', 'No se puede abrir el almacén local.'));
      });
    },
    async read() {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('lifecycle', 'readonly');
        const request = transaction.objectStore('lifecycle').get('device');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = transaction.onabort = () => reject(failure('STORE_UNAVAILABLE', 'No se puede comprobar el estado del dispositivo.'));
      });
    },
    async retire() {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('lifecycle', 'readwrite');
        transaction.objectStore('lifecycle').put({ retired: true }, 'device');
        transaction.oncomplete = resolve;
        transaction.onerror = transaction.onabort = () => reject(failure('RETIREMENT_RECORD_FAILED', 'No se pudo registrar la retirada local del dispositivo. No reutilices este identificador.'));
      });
    },
    async rememberPublicKeys(publicDeviceKeys) {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('lifecycle', 'readwrite');
        transaction.objectStore('lifecycle').put({ retired: false, publicDeviceKeys }, 'device');
        transaction.oncomplete = resolve;
        transaction.onerror = transaction.onabort = () => reject(failure('STORE_UNAVAILABLE', 'No se puede recordar la identidad pública de este dispositivo.'));
      });
    },
    close() { db?.close(); db = null; },
  };
}

function stateContent(room, type) { return room?.currentState?.getStateEvents(type, '')?.getContent?.() || {}; }
function strictDevice(status) {
  return !!status && typeof status.isVerified === 'function' && status.isVerified() === true &&
    status.signedByOwner === true && status.crossSigningVerified === true && status.blocked !== true;
}
function strictIdentity(status) {
  return !!status && typeof status.isCrossSigningVerified === 'function' && status.isCrossSigningVerified() === true && status.needsUserApproval !== true;
}

/**
 * sdk must include createClient, AllDevicesIsolationMode, EventShieldColour, ClientEvent,
 * RoomEvent, MatrixEventEvent, CryptoEvent. Import the latter crypto exports from lib/crypto-api.
 * runtime and lifecycleFactory are dependency-injection seams for isolated tests, not user settings.
 */
export function createSecureMessenger({
  sdk,
  onState = noop, onRooms = noop, onMessage = noop, onError = noop, onVerification = noop,
  runtime = { crypto: globalThis.crypto, indexedDB: globalThis.indexedDB, locks: globalThis.navigator?.locks, fetch: globalThis.fetch?.bind(globalThis) },
  lifecycleFactory = lifecycleStore,
  allowLoopbackForTests = false,
  initialSyncTimeoutMs = 30000,
  keyUploadTimeoutMs = 10000,
} = {}) {
  if (typeof sdk?.createClient !== 'function' || typeof sdk?.AllDevicesIsolationMode !== 'function' ||
      !sdk.ClientEvent?.Sync || !sdk.RoomEvent?.Timeline || !sdk.MatrixEventEvent?.Decrypted || !sdk.CryptoEvent?.VerificationRequestReceived ||
      typeof sdk.EventShieldColour?.NONE !== 'number') {
    throw failure('SDK_UNAVAILABLE', 'Falta el SDK Matrix verificado o sus interfaces de seguridad.');
  }
  let client = null, cryptoApi = null, session = null, releaseLock = null, lifecycle = null;
  let connecting = null, closing = null, stopRequested = false, serial = 0;
  let syncResolve = null, syncReject = null;
  let listeners = [], pendingSetup = null, initializationRunning = false, identityIntegrityBlocked = false;
  const secretKeys = new Map(), verifications = new Set(), emittedMessages = new Set();
  let state = { phase: 'disconnected', synced: false, cryptoReady: false, deviceKeysConfirmed: false, ownDeviceVerified: false, ownIdentityVerified: false, sessionPersisted: false, pendingVerifications: 0 };

  const callback = (fn, value) => { try { fn(value); } catch { /* UI errors must not alter the security policy. */ } };
  function update(patch) { state = { ...state, ...patch }; callback(onState, Object.freeze({ ...state })); }
  function report(error, code = 'SDK_OPERATION_FAILED', message = 'La operación no se ha completado. Comprueba la conexión y el estado de seguridad.') {
    const safe = error instanceof SecureMessagingError ? error : failure(code, message);
    callback(onError, Object.freeze({ code: safe.code, message: safe.message }));
    return safe;
  }
  async function guarded(fn) { try { return await fn(); } catch (error) { throw report(error); } }
  function requireSession() {
    if (!client || !session || stopRequested || closing) throw failure('NOT_CONNECTED', 'Primero abre la sesión.');
    if (!state.cryptoReady || !cryptoApi || client.getCrypto() !== cryptoApi) throw failure('CRYPTO_NOT_READY', 'El motor de cifrado todavía no está preparado.');
    if (!state.synced) throw failure('NOT_SYNCED', 'Espera a que termine la sincronización.');
    if (!session.keysConfirmed) throw failure('DEVICE_KEYS_NOT_CONFIRMED', 'El servidor todavía no ha confirmado las claves de este dispositivo.');
    return { client, cryptoApi, session, serial };
  }
  function sameSession(context) {
    if (context.serial !== serial || context.client !== client || stopRequested || closing) throw failure('SESSION_CHANGED', 'La sesión ha cambiado; la operación se ha detenido.');
  }
  function listen(event, handler) { client.on(event, handler); listeners.push([event, handler]); }
  function clearSecrets() {
    for (const key of secretKeys.values()) key.fill(0);
    secretKeys.clear();
    pendingSetup?.generated?.privateKey?.fill(0);
    pendingSetup = null;
    verifications.clear();
    emittedMessages.clear();
  }
  async function deviceStatus(id, device) {
    const context = requireSession();
    const status = await context.cryptoApi.getDeviceVerificationStatus(userId(id), checkedString(device, 'INVALID_DEVICE_ID', 'Dispositivo'));
    sameSession(context);
    return Object.freeze({ userId: id, deviceId: device, known: !!status, verified: strictDevice(status), signedByOwner: status?.signedByOwner === true, crossSigningVerified: status?.crossSigningVerified === true, blocked: status?.blocked === true });
  }
  async function identityStatus(id) {
    const context = requireSession();
    const status = await context.cryptoApi.getUserVerificationStatus(userId(id));
    sameSession(context);
    return Object.freeze({ userId: id, known: status?.known === true, verified: strictIdentity(status), needsUserApproval: status?.needsUserApproval === true });
  }
  async function refreshOwnTrust() {
    const context = requireSession();
    const [identity, device] = await Promise.all([
      context.cryptoApi.getUserVerificationStatus(context.session.userId),
      context.cryptoApi.getDeviceVerificationStatus(context.session.userId, context.session.deviceId),
    ]);
    sameSession(context);
    const result = { ownDeviceVerified: strictDevice(device), ownIdentityVerified: strictIdentity(identity) };
    if (identityIntegrityBlocked) { result.ownDeviceVerified = false; result.ownIdentityVerified = false; }
    update(result);
    return result;
  }
  async function waitForOwnTrust(context) {
    const deadline = Date.now() + Math.max(100, Math.min(keyUploadTimeoutMs, 30000));
    let attempts = 0;
    for (;;) {
      sameSession(context);
      const trust = await refreshOwnTrust();
      if ((trust.ownDeviceVerified && trust.ownIdentityVerified) || Date.now() >= deadline) return trust;
      // Signature upload acknowledgement can precede the device-list update in /sync.
      // Only observed cross-signing status can satisfy this wait.
      await new Promise(resolve => setTimeout(resolve, Math.min(200 * ++attempts, 1000, deadline - Date.now())));
    }
  }

  function roomMetadata(room) {
    const encrypted = stateContent(room, 'm.room.encryption').algorithm === MEGOLM;
    const participants = (room.getMembers?.() || []).filter(member => ['join', 'invite'].includes(member.membership)).map(member => ({
      userId: member.userId, membership: member.membership, displayName: typeof member.name === 'string' ? member.name : member.userId,
    }));
    return Object.freeze({ roomId: room.roomId, name: typeof room.name === 'string' ? room.name : room.roomId, encrypted, algorithm: encrypted ? MEGOLM : null,
      privateInviteOnly: stateContent(room, 'm.room.join_rules').join_rule === 'invite', membership: room.getMyMembership(),
      participants, sendPolicy: 'verified_devices_and_identities_only' });
  }
  function listRooms() {
    requireSession();
    return client.getRooms().filter(room => stateContent(room, 'm.room.encryption').algorithm === MEGOLM).map(roomMetadata);
  }
  function emitRooms() { if (state.synced && session?.keysConfirmed && !stopRequested && !closing) { try { callback(onRooms, listRooms()); } catch (error) { report(error); } } }
  async function secureRoom(id) {
    const context = requireSession();
    roomId(id);
    const room = context.client.getRoom(id);
    if (!room || room.getMyMembership() !== 'join') throw failure('ROOM_NOT_JOINED', 'Debes entrar en la sala antes de enviar.');
    if (stateContent(room, 'm.room.encryption').algorithm !== MEGOLM || !(await context.cryptoApi.isEncryptionEnabledInRoom(id))) {
      throw failure('ROOM_NOT_ENCRYPTED', 'No se envían mensajes a salas sin cifrado Megolm confirmado.');
    }
    sameSession(context);
    if (stateContent(room, 'm.room.join_rules').join_rule !== 'invite') throw failure('ROOM_NOT_PRIVATE', 'Esta función requiere una sala privada por invitación.');
    return { ...context, room };
  }
  async function verifyRecipients(context) {
    if (initializationRunning || identityIntegrityBlocked) throw failure('IDENTITY_OPERATION_PENDING', 'La identidad debe terminar de configurarse o recuperarse antes de enviar.');
    const members = await context.room.getEncryptionTargetMembers();
    sameSession(context);
    const ids = [...new Set(members.map(member => userId(member.userId)))].sort();
    if (!ids.includes(context.session.userId)) throw failure('ROOM_MEMBERS_UNKNOWN', 'No se conoce la lista completa de destinatarios.');
    if (ids.length > 100) throw failure('ROOM_TOO_LARGE', 'Esta versión admite hasta 100 participantes por sala.');
    const devicesByUser = await context.cryptoApi.getUserDeviceInfo(ids, true);
    sameSession(context);
    for (const id of ids) {
      const identity = await context.cryptoApi.getUserVerificationStatus(id);
      sameSession(context);
      if (!strictIdentity(identity)) throw failure(id === context.session.userId ? 'OWN_IDENTITY_UNVERIFIED' : 'RECIPIENT_IDENTITY_UNVERIFIED', 'Verifica la identidad actual de todos los participantes antes de enviar.');
      const devices = devicesByUser?.get(id);
      if (!(devices instanceof Map) || !devices.size) throw failure('DEVICE_LIST_UNKNOWN', 'Falta una lista de dispositivos verificada.');
      if (id === context.session.userId && !devices.has(context.session.deviceId)) throw failure('OWN_DEVICE_UNKNOWN', 'El servidor no ha confirmado este dispositivo.');
      for (const deviceId of devices.keys()) {
        const status = await context.cryptoApi.getDeviceVerificationStatus(id, deviceId);
        sameSession(context);
        if (!strictDevice(status)) throw failure(id === context.session.userId && deviceId === context.session.deviceId ? 'OWN_DEVICE_UNVERIFIED' : 'RECIPIENT_DEVICE_UNVERIFIED', 'Hay un dispositivo sin verificar o bloqueado. No se ha enviado el mensaje.');
      }
    }
    const currentIds = [...new Set((await context.room.getEncryptionTargetMembers()).map(member => member.userId))].sort();
    sameSession(context);
    if (JSON.stringify(currentIds) !== JSON.stringify(ids)) throw failure('ROOM_MEMBERS_CHANGED', 'Los participantes han cambiado. Revisa la sala y vuelve a intentarlo.');
  }

  async function receive(event, room, toStartOfTimeline = false, emit = true) {
    const context = { client, cryptoApi, session, serial };
    if (!context.client || !context.cryptoApi || !context.session?.keysConfirmed || !state.cryptoReady || stopRequested || closing || toStartOfTimeline) return;
    const id = event?.getId?.();
    if (typeof id !== 'string' || !id.startsWith('$') || (emit && emittedMessages.has(id))) return;
    const eventRoom = room || client.getRoom(event.getRoomId?.());
    if (!eventRoom || stateContent(eventRoom, 'm.room.encryption').algorithm !== MEGOLM) return;
    if (event.getWireType?.() !== 'm.room.encrypted') {
      if (event.getType?.() === 'm.room.message') report(failure('UNENCRYPTED_EVENT', 'Se ha recibido un mensaje sin cifrar dentro de una sala cifrada; no se muestra como mensaje seguro.'));
      return;
    }
    try {
      await context.client.decryptEventIfNeeded(event);
      sameSession(context);
      if (event.isDecryptionFailure?.() || event.isBeingDecrypted?.() || event.getType?.() === 'm.room.encrypted') {
        report(failure('DECRYPTION_FAILED', 'Un mensaje cifrado todavía no se puede descifrar en este dispositivo.'));
        return;
      }
      if (event.getType() !== 'm.room.message' || event.isRedacted?.()) return;
      // Avoid trusting server-bundled replacement text as part of the original authenticated event.
      if (typeof event.getOriginalContent !== 'function') throw failure('EVENT_CONTENT_UNAVAILABLE', 'No se puede comprobar el contenido original del mensaje.');
      const content = event.getOriginalContent();
      const info = await context.cryptoApi.getEncryptionInfoForEvent(event);
      const identity = await context.cryptoApi.getUserVerificationStatus(event.getSender());
      sameSession(context);
      if (emit && emittedMessages.has(id)) return;
      if (emit) emittedMessages.add(id);
      if (emittedMessages.size > 4000) emittedMessages.delete(emittedMessages.values().next().value);
      const isText = ['m.text', 'm.notice', 'm.emote'].includes(content.msgtype) && typeof content.body === 'string';
      const rawBody = isText ? content.body : '';
      const message = Object.freeze({ eventId: id, roomId: eventRoom.roomId, sender: event.getSender(), timestamp: event.getTs(),
        kind: isText ? 'text' : 'unsupported', msgtype: typeof content.msgtype === 'string' ? content.msgtype : 'unknown',
        body: rawBody.slice(0, 65536), truncated: rawBody.length > 65536,
        decrypted: true, senderVerified: strictIdentity(identity) && info?.shieldColour === sdk.EventShieldColour.NONE,
        shieldColour: info?.shieldColour ?? null, shieldReason: info?.shieldReason ?? null,
        isEdit: content['m.relates_to']?.rel_type === 'm.replace', attachmentSupported: false,
      });
      if (emit) callback(onMessage, message);
      return message;
    } catch (error) { if (context.serial === serial && !stopRequested && !closing) report(error, 'DECRYPTION_FAILED', 'No se puede verificar o descifrar este mensaje en este dispositivo.'); }
  }

  function incomingVerification(request) {
    if (!request || stopRequested || closing) return;
    verifications.add(request);
    update({ pendingVerifications: [...verifications].filter(item => item.pending).length });
    callback(onVerification, request); // A real SDK request; caller must implement human SAS/QR comparison.
  }

  async function cleanup({ revoke = false } = {}) {
    const current = client;
    let serverRevoked = false, stopSucceeded = true, retirementRecorded = !revoke;
    for (const [event, handler] of listeners) current?.off(event, handler);
    listeners = [];
    syncReject?.(failure('SESSION_CLOSED', 'La sesión se ha cerrado.'));
    syncReject = syncResolve = null;
    try {
      if (current) {
        try { current.stopClient(); current.http?.abort?.(); } catch { stopSucceeded = false; report(failure('STOP_FAILED', 'El cierre no pudo completarse; cierra esta pestaña antes de abrir otra sesión.')); }
        if (revoke) {
          try { await current.logout(true); serverRevoked = true; }
          catch { report(failure('LOGOUT_REVOKE_FAILED', 'La sesión local se ha cerrado, pero el servidor no confirmó la revocación. Conserva el acceso de recuperación para revocarla.')); }
          if (serverRevoked && session?.storeName) {
            retiredInThisPage.add(session.storeName);
            try { await lifecycle?.retire(); retirementRecorded = true; } catch (error) { report(error); }
          }
        }
      }
    } finally {
      current?.setAccessToken('');
      client = cryptoApi = session = null;
      clearSecrets();
      lifecycle?.close(); lifecycle = null;
      if (releaseLock && stopSucceeded) { const release = releaseLock; releaseLock = null; await release(); }
      update({ phase: 'disconnected', synced: false, cryptoReady: false, deviceKeysConfirmed: false, ownDeviceVerified: false, ownIdentityVerified: false, pendingVerifications: 0, userId: null, deviceId: null, homeserverUrl: null, cryptoStoreName: null });
    }
    return Object.freeze({ localSessionClosed: true, serverRevoked, deviceRetired: serverRevoked, retirementRecorded, newDeviceRequired: serverRevoked });
  }

  async function doConnect(input) {
    let initArgs;
    try {
      const homeserverUrl = serverUrl(input?.homeserverUrl, allowLoopbackForTests);
      const id = userId(input?.userId);
      const device = checkedString(input?.deviceId, 'INVALID_DEVICE_ID', 'Dispositivo');
      const accessToken = checkedString(input?.accessToken, 'INVALID_TOKEN', 'Token de acceso', 16384);
      const key = input?.storageKey;
      const password = input?.storagePassword;
      if (key !== undefined && password !== undefined) throw failure('AMBIGUOUS_STORAGE_KEY', 'Utiliza una sola forma de desbloquear el almacén.');
      if (!(key instanceof Uint8Array && key.byteLength === 32) && !(typeof password === 'string' && password.length >= 12 && password.length <= 1024)) {
        throw failure('STORAGE_SECRET_REQUIRED', 'El almacén requiere una frase de al menos 12 caracteres o una clave de 32 bytes.');
      }
      if (!runtime.crypto?.subtle || !runtime.indexedDB || typeof runtime.fetch !== 'function') throw failure('BROWSER_CAPABILITY_MISSING', 'Faltan funciones de seguridad necesarias en este navegador.');
      update({ phase: 'connecting' });
      identityIntegrityBlocked = false;
      const storeName = await cryptoStoreName({ homeserverUrl, userId: id, deviceId: device }, runtime.crypto);
      if (stopRequested) throw failure('SESSION_CLOSED', 'La sesión se ha cerrado.');
      releaseLock = await acquireStoreLock(runtime.locks, storeName);
      if (retiredInThisPage.has(storeName)) throw failure('DEVICE_RETIRED', 'Este dispositivo fue retirado. Inicia una sesión con un identificador nuevo.');
      const allowedOrigin = new URL(homeserverUrl).origin;
      const fetchFn = (url, options = {}) => {
        let destination;
        try { destination = new URL(typeof url === 'string' ? url : url.url || url.href); } catch { return Promise.reject(failure('REQUEST_BLOCKED', 'Dirección de solicitud no válida.')); }
        if (destination.origin !== allowedOrigin || destination.username || destination.password) return Promise.reject(failure('REQUEST_BLOCKED', 'El cliente no envía credenciales a otro servidor.'));
        return runtime.fetch(url, { ...options, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' });
      };
      const cryptoCallbacks = {
        getSecretStorageKey: async ({ keys }) => {
          for (const [keyId, value] of secretKeys) if (own(keys, keyId)) return [keyId, new Uint8Array(value)];
          return null;
        },
        cacheSecretStorageKey: (keyId, _keyInfo, value) => {
          secretKeys.get(keyId)?.fill(0);
          secretKeys.set(keyId, new Uint8Array(value));
        },
      };
      client = sdk.createClient({ baseUrl: homeserverUrl, userId: id, deviceId: device, accessToken, useAuthorizationHeader: true,
        localTimeoutMs: 20000, timelineSupport: true, fetchFn, logger: silentLogger, cryptoCallbacks, verificationMethods: ['m.sas.v1'],
      });
      update({ phase: 'authenticating' });
      const identity = await client.whoami();
      if (stopRequested) throw failure('SESSION_CLOSED', 'La sesión se ha cerrado.');
      if (identity?.user_id !== id || identity?.device_id !== device || identity?.is_guest === true) throw failure('SESSION_IDENTITY_MISMATCH', 'El token no corresponde a este usuario y dispositivo.');
      session = { homeserverUrl, userId: id, deviceId: device, storeName, keysConfirmed: false };
      lifecycle = lifecycleFactory(runtime.indexedDB, storeName);
      await lifecycle.open();
      const previousLifecycle = await lifecycle.read();
      if (previousLifecycle?.retired) throw failure('DEVICE_RETIRED', 'Este dispositivo fue retirado. Inicia una sesión con un identificador nuevo.');
      if (previousLifecycle?.publicDeviceKeys) {
        const remote = await client.downloadKeysForUsers([id]);
        const keys = remote?.device_keys?.[id]?.[device]?.keys;
        if (!keys || keys[`ed25519:${device}`] !== previousLifecycle.publicDeviceKeys.ed25519 || keys[`curve25519:${device}`] !== previousLifecycle.publicDeviceKeys.curve25519) {
          throw failure('DEVICE_ID_REUSED', 'El dispositivo del servidor ya no coincide con este almacén. Crea un dispositivo nuevo y recupera tu identidad.');
        }
      }
      if (stopRequested) throw failure('SESSION_CLOSED', 'La sesión se ha cerrado.');
      initArgs = { useIndexedDB: true, cryptoDatabasePrefix: storeName, ...(key instanceof Uint8Array ? { storageKey: new Uint8Array(key) } : { storagePassword: password }) };
      input = null;
      update({ phase: 'initializing_crypto' });
      await client.initRustCrypto(initArgs);
      initArgs.storageKey?.fill(0); delete initArgs.storagePassword;
      if (stopRequested) throw failure('SESSION_CLOSED', 'La sesión se ha cerrado.');
      cryptoApi = client.getCrypto();
      if (!cryptoApi || typeof cryptoApi.setDeviceIsolationMode !== 'function' || typeof cryptoApi.getDeviceVerificationStatus !== 'function' || typeof cryptoApi.getUserVerificationStatus !== 'function') throw failure('CRYPTO_NOT_READY', 'El SDK no ha inicializado las interfaces de cifrado necesarias.');
      const localDeviceKeys = await cryptoApi.getOwnDeviceKeys();
      if (previousLifecycle?.publicDeviceKeys && (localDeviceKeys.ed25519 !== previousLifecycle.publicDeviceKeys.ed25519 || localDeviceKeys.curve25519 !== previousLifecycle.publicDeviceKeys.curve25519)) {
        throw failure('DEVICE_KEYS_CHANGED', 'Las claves locales de este dispositivo han cambiado. Recupera la identidad en un dispositivo nuevo.');
      }
      // SDK 45 source: OnlySignedDevicesIsolationMode ignores blacklist and allows never-verified identities.
      // This combination maps to Rust CollectStrategy.deviceBasedStrategy(true, true).
      cryptoApi.globalBlacklistUnverifiedDevices = true;
      cryptoApi.setDeviceIsolationMode(new sdk.AllDevicesIsolationMode(true));
      cryptoApi.setTrustCrossSignedDevices(true);
      update({ phase: 'syncing', cryptoReady: true, userId: id, deviceId: device, homeserverUrl, cryptoStoreName: storeName });
      let timeout;
      const synced = new Promise((resolve, reject) => {
        syncResolve = resolve; syncReject = reject;
        timeout = setTimeout(() => reject(failure('SYNC_TIMEOUT', 'La sincronización no ha terminado. Comprueba el servidor e inténtalo de nuevo.')), Math.max(1000, Math.min(initialSyncTimeoutMs, 60000)));
      });
      // Attach the rejection handler immediately, before startClient() can fail.
      synced.catch(noop);
      listen(sdk.ClientEvent.Sync, syncState => {
        if (stopRequested || closing) return;
        if (['PREPARED', 'SYNCING'].includes(syncState)) {
          update({ phase: session?.keysConfirmed ? 'connected' : 'syncing', synced: true }); syncResolve?.();
          if (session?.keysConfirmed) { void refreshOwnTrust().catch(error => report(error)); emitRooms(); }
        } else if (['ERROR', 'RECONNECTING', 'STOPPED'].includes(syncState)) {
          update({ phase: syncState === 'STOPPED' ? 'disconnected' : 'reconnecting', synced: false, ownDeviceVerified: false, ownIdentityVerified: false });
        }
      });
      listen(sdk.RoomEvent.Timeline, (event, room, atStart) => { void receive(event, room, atStart); });
      listen(sdk.MatrixEventEvent.Decrypted, event => { void receive(event); });
      listen(sdk.ClientEvent.Room || 'Room', emitRooms);
      listen(sdk.CryptoEvent.VerificationRequestReceived, incomingVerification);
      const refresh = () => { if (state.synced && session?.keysConfirmed && !stopRequested && !closing) void refreshOwnTrust().catch(error => report(error)); };
      for (const event of [sdk.CryptoEvent.UserTrustStatusChanged, sdk.CryptoEvent.DevicesUpdated, sdk.CryptoEvent.KeysChanged].filter(Boolean)) listen(event, refresh);
      try { await client.startClient({ initialSyncLimit: 30, lazyLoadMembers: false, pendingEventOrdering: 'detached' }); await synced; }
      finally { clearTimeout(timeout); syncResolve = syncReject = null; }
      if (stopRequested) throw failure('SESSION_CLOSED', 'La sesión se ha cerrado.');
      // RustCrypto.onSyncCompleted starts the key-upload queue without awaiting it. A sync PREPARED
      // event therefore does not prove that a fresh device's public keys are already on the server.
      // Wait a bounded interval for the real /keys/query evidence; never infer success from elapsed time.
      const keyDeadline = Date.now() + Math.max(100, Math.min(keyUploadTimeoutMs, 30000));
      let keyAttempts = 0;
      for (;;) {
        const remote = await client.downloadKeysForUsers([id]);
        if (stopRequested) throw failure('SESSION_CLOSED', 'La sesión se ha cerrado.');
        const registeredKeys = remote?.device_keys?.[id]?.[device]?.keys;
        if (registeredKeys?.[`ed25519:${device}`] === localDeviceKeys.ed25519 && registeredKeys?.[`curve25519:${device}`] === localDeviceKeys.curve25519) break;
        // Conflicting keys are not an upload delay and must fail immediately.
        if (registeredKeys || Date.now() >= keyDeadline) throw failure('DEVICE_KEYS_NOT_CONFIRMED', 'El servidor aún no confirma las claves de este dispositivo. Vuelve a abrir la sesión.');
        await new Promise(resolve => setTimeout(resolve, Math.min(200 * ++keyAttempts, 1000, keyDeadline - Date.now())));
        if (stopRequested) throw failure('SESSION_CLOSED', 'La sesión se ha cerrado.');
      }
      await lifecycle.rememberPublicKeys({ ed25519: localDeviceKeys.ed25519, curve25519: localDeviceKeys.curve25519 });
      if (stopRequested) throw failure('SESSION_CLOSED', 'La sesión se ha cerrado.');
      session.keysConfirmed = true;
      update({ phase: 'connected', deviceKeysConfirmed: true });
      await refreshOwnTrust(); emitRooms();
      return Object.freeze({ ...state });
    } catch (error) {
      await cleanup();
      throw report(error, 'CONNECT_FAILED', 'No se pudo abrir la sesión. Comprueba el servidor, las credenciales y la frase del almacén.');
    } finally { initArgs?.storageKey?.fill(0); if (initArgs) delete initArgs.storagePassword; }
  }

  function connect(input) {
    if (client || connecting || closing || releaseLock) return Promise.reject(report(failure('SESSION_ACTIVE', 'Cierra la sesión anterior antes de abrir otra.')));
    stopRequested = false; serial++;
    connecting = doConnect(input);
    return connecting.finally(() => { connecting = null; });
  }
  function close(revoke) {
    if (closing) return closing;
    stopRequested = true; serial++;
    syncReject?.(failure('SESSION_CLOSED', 'La sesión se ha cerrado.'));
    // pagehide/lock must cut transport now, not after an in-flight login or crypto initialization.
    // Rust initialization may still settle: retain the store lock until doConnect's cleanup has stopped
    // that newly initialized backend as well. SDK stopClient() is idempotent, including its Rust stop().
    try { client?.stopClient(); } catch { report(failure('STOP_FAILED', 'El cierre requiere terminar de detener el cliente.')); }
    try { client?.http?.abort?.(); } catch { /* cleanup still runs; no raw error reaches UI. */ }
    if (!revoke) client?.setAccessToken('');
    closing = (async () => {
      if (connecting) await connecting.catch(noop);
      if (revoke && !client) throw report(failure('NO_SESSION_TO_REVOKE', 'Vuelve a abrir la sesión antes de revocar este dispositivo.'));
      return cleanup({ revoke });
    })();
    return closing.finally(() => { closing = null; stopRequested = false; });
  }

  async function pristineIdentity(context) {
    const hasKeys = await context.cryptoApi.userHasCrossSigningKeys(context.session.userId, true);
    const defaultKey = await context.client.secretStorage.getDefaultKeyId();
    await context.cryptoApi.checkKeyBackupAndEnable();
    const backup = await context.cryptoApi.getKeyBackupInfo();
    sameSession(context);
    if (hasKeys || defaultKey || backup) throw failure('IDENTITY_ALREADY_EXISTS', 'Ya existe una identidad, una recuperación o una copia de seguridad. Verifica o recupera la existente; no se restablece automáticamente.');
  }

  const api = {
    connect,
    getState: () => Object.freeze({ ...state }),
    listEncryptedRooms: () => { try { return listRooms(); } catch (error) { throw report(error); } },
    getDeviceStatus: (id, device) => guarded(() => deviceStatus(id, device)),
    getIdentityStatus: id => guarded(() => identityStatus(id)),
    getRoomDevices: id => guarded(async () => {
      const context = await secureRoom(id);
      const ids = [...new Set((await context.room.getEncryptionTargetMembers()).map(member => userId(member.userId)))];
      if (ids.length > 100) throw failure('ROOM_TOO_LARGE', 'Esta versión admite hasta 100 participantes por sala.');
      const devices = await context.cryptoApi.getUserDeviceInfo(ids, true);
      const result = [];
      for (const id of ids) {
        const identity = await identityStatus(id);
        const entries = devices?.get(id);
        if (!entries?.size) result.push(Object.freeze({ userId: id, deviceId: null, known: false, verified: false, blocked: false, identityVerified: identity.verified }));
        else for (const deviceId of entries.keys()) result.push(Object.freeze({ ...(await deviceStatus(id, deviceId)), identityVerified: identity.verified }));
      }
      sameSession(context);
      return result;
    }),
    refreshOwnTrust: () => guarded(refreshOwnTrust),
    inspectRoomSafety: id => guarded(async () => {
      try {
        const context = await secureRoom(id);
        await verifyRecipients(context);
        sameSession(context);
        return Object.freeze({ roomId: id, allowed: true, code: null, message: 'Comprobación actual correcta. Se volverá a comprobar al enviar.', checkedAt: new Date().toISOString() });
      } catch (error) {
        const safe = error instanceof SecureMessagingError ? error : failure('SAFETY_CHECK_FAILED', 'No se ha podido comprobar la seguridad de esta sala.');
        return Object.freeze({ roomId: id, allowed: false, code: safe.code, message: safe.message, checkedAt: new Date().toISOString() });
      }
    }),
    acceptInvite: id => guarded(async () => {
      const context = requireSession(); roomId(id);
      const room = context.client.getRoom(id);
      const invite = room?.currentState?.getStateEvents('m.room.member', context.session.userId)?.getContent?.();
      if (!room || room.getMyMembership() !== 'invite' || invite?.membership !== 'invite') throw failure('DIRECT_INVITATION_REQUIRED', 'No hay una invitación directa a este usuario.');
      if (stateContent(room, 'm.room.encryption').algorithm !== MEGOLM || stateContent(room, 'm.room.join_rules').join_rule !== 'invite') throw failure('INVITATION_SECURITY_UNKNOWN', 'No se puede confirmar el cifrado y la privacidad de esta invitación.');
      const joined = await context.client.joinRoom(id);
      sameSession(context);
      if (joined?.roomId !== id) throw failure('JOIN_NOT_CONFIRMED', 'El servidor no confirmó la sala solicitada.');
      // joinRoom resolves on its HTTP response; the existing Room may still have invitation state
      // until /sync receives our membership. Do not mistake the HTTP acknowledgement for joined state.
      const joinDeadline = Date.now() + Math.max(1000, Math.min(initialSyncTimeoutMs, 15000));
      while (context.client.getRoom(id)?.getMyMembership() !== 'join') {
        if (Date.now() >= joinDeadline) throw failure('JOIN_NOT_CONFIRMED', 'El servidor aceptó la entrada, pero falta la confirmación sincronizada. Actualiza las conversaciones antes de volver a intentarlo.');
        await new Promise(resolve => setTimeout(resolve, 100));
        sameSession(context);
      }
      const checked = await secureRoom(id);
      if (joined?.roomId !== id || checked.room.getMyMembership() !== 'join') throw failure('JOIN_NOT_CONFIRMED', 'La entrada en la sala todavía no está confirmada.');
      emitRooms();
      return roomMetadata(checked.room);
    }),
    getRoomMessages: (id, { limit = 50 } = {}) => guarded(async () => {
      const context = await secureRoom(id);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw failure('INVALID_HISTORY_LIMIT', 'Solicita entre 1 y 100 eventos del historial disponible.');
      const events = context.room.getLiveTimeline().getEvents();
      const messages = [];
      for (const event of events.slice(-limit)) {
        const message = await receive(event, context.room, false, false);
        if (message) messages.push(message);
      }
      sameSession(context);
      return Object.freeze({ messages, completeHistory: false, limited: events.length > limit, source: 'synced_live_timeline' });
    }),
    createEncryptedRoom: ({ name = '', invite = [] } = {}) => guarded(async () => {
      const context = requireSession();
      if (!Array.isArray(invite) || invite.length > 99) throw failure('INVALID_INVITEES', 'Indica hasta 99 destinatarios Matrix.');
      const users = [...new Set(invite.map(userId))].filter(id => id !== context.session.userId);
      if (!users.length) throw failure('INVITEE_REQUIRED', 'Indica a quién quieres invitar.');
      if (name !== '') checkedString(name, 'INVALID_ROOM_NAME', 'Nombre de sala', 120);
      const result = await context.client.createRoom({ name: name || undefined, invite: users, preset: 'private_chat', visibility: 'private',
        initial_state: [
          { type: 'm.room.encryption', state_key: '', content: { algorithm: MEGOLM } },
          { type: 'm.room.join_rules', state_key: '', content: { join_rule: 'invite' } },
          { type: 'm.room.history_visibility', state_key: '', content: { history_visibility: 'joined' } },
          { type: 'm.room.guest_access', state_key: '', content: { guest_access: 'forbidden' } },
        ],
      });
      sameSession(context);
      roomId(result?.room_id);
      emitRooms();
      return Object.freeze({ roomId: result.room_id, created: true, encryptionRequested: true, readyToSend: false });
    }),
    sendText: (id, text) => guarded(async () => {
      if (typeof text !== 'string' || !text.trim() || text.length > 16000 || text.includes('\0')) throw failure('INVALID_MESSAGE', 'El mensaje debe contener entre 1 y 16 000 caracteres.');
      const context = await secureRoom(id);
      await verifyRecipients(context);
      sameSession(context);
      if (!state.synced) throw failure('NOT_SYNCED', 'La sincronización se ha interrumpido.');
      if (stateContent(context.room, 'm.room.encryption').algorithm !== MEGOLM || stateContent(context.room, 'm.room.join_rules').join_rule !== 'invite') throw failure('ROOM_SECURITY_CHANGED', 'La seguridad de la sala ha cambiado.');
      // Enforce the SDK encryption-time gate too; frontend checks alone have a time-of-check race.
      context.cryptoApi.globalBlacklistUnverifiedDevices = true;
      context.cryptoApi.setDeviceIsolationMode(new sdk.AllDevicesIsolationMode(true));
      context.room.setBlacklistUnverifiedDevices(true);
      const result = await context.client.sendTextMessage(id, text);
      sameSession(context);
      if (!result?.event_id) throw failure('SEND_NOT_CONFIRMED', 'El servidor no confirmó el envío. Comprueba la conversación antes de volver a enviar.');
      return Object.freeze({ eventId: result.event_id, acceptedByHomeserver: true, recipientDeliveryConfirmed: false });
    }),
    prepareIdentity: () => guarded(async () => {
      const context = requireSession();
      if (pendingSetup || initializationRunning) throw failure('IDENTITY_SETUP_PENDING', 'Ya hay una preparación de recuperación pendiente.');
      await pristineIdentity(context);
      const generated = await context.cryptoApi.createRecoveryKeyFromPassphrase();
      sameSession(context);
      if (!(generated?.privateKey instanceof Uint8Array) || generated.privateKey.byteLength !== 32 || typeof generated.encodedPrivateKey !== 'string') throw failure('RECOVERY_KEY_UNAVAILABLE', 'El SDK no produjo una clave de recuperación válida.');
      const setupId = Array.from(runtime.crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      pendingSetup = { setupId, generated, serial: context.serial };
      return Object.freeze({ setupId, recoveryKey: generated.encodedPrivateKey, requiresHumanConfirmation: true });
    }),
    cancelIdentityPreparation: () => {
      if (initializationRunning) throw report(failure('IDENTITY_SETUP_RUNNING', 'La configuración ya ha empezado. Espera al resultado.'));
      pendingSetup?.generated.privateKey.fill(0); pendingSetup = null;
    },
    initializeIdentity: ({ setupId, recoveryKeyConfirmation, authUploadDeviceSigningKeys } = {}) => guarded(async () => {
      const context = requireSession();
      const setup = pendingSetup;
      if (!setup || setupId !== setup.setupId || setup.serial !== context.serial || initializationRunning) throw failure('IDENTITY_SETUP_MISSING', 'Prepara y guarda primero la clave de recuperación.');
      const normalized = value => typeof value === 'string' ? value.replace(/\s/gu, '') : '';
      if (!normalized(recoveryKeyConfirmation) || normalized(recoveryKeyConfirmation) !== normalized(setup.generated.encodedPrivateKey)) throw failure('RECOVERY_CONFIRMATION_REQUIRED', 'Vuelve a introducir la clave de recuperación que acabas de guardar.');
      if (typeof authUploadDeviceSigningKeys !== 'function') throw failure('INTERACTIVE_AUTH_REQUIRED', 'Se necesita autenticación humana para crear esta identidad.');
      initializationRunning = true;
      let started = false;
      try {
        await pristineIdentity(context);
        started = true;
        await context.cryptoApi.bootstrapSecretStorage({ createSecretStorageKey: async () => setup.generated, setupNewSecretStorage: false, setupNewKeyBackup: false });
        sameSession(context);
        await context.cryptoApi.bootstrapCrossSigning({ setupNewCrossSigning: false, authUploadDeviceSigningKeys });
        sameSession(context);
        await context.cryptoApi.checkKeyBackupAndEnable();
        if (await context.cryptoApi.getKeyBackupInfo()) throw failure('BACKUP_APPEARED', 'Apareció una copia de seguridad durante la configuración. Se conserva y no se reemplaza.');
        await context.cryptoApi.bootstrapSecretStorage({ setupNewSecretStorage: false, setupNewKeyBackup: true });
        sameSession(context);
        const [crossSigningReady, secretStorageReady, backup] = await Promise.all([
          context.cryptoApi.isCrossSigningReady(), context.cryptoApi.isSecretStorageReady(), context.cryptoApi.checkKeyBackupAndEnable(),
        ]);
        const trust = await waitForOwnTrust(context);
        if (!crossSigningReady || !secretStorageReady || !backup?.backupInfo?.version || backup?.trustInfo?.trusted !== true || backup?.trustInfo?.matchesDecryptionKey !== true || !trust.ownDeviceVerified || !trust.ownIdentityVerified) throw failure('IDENTITY_SETUP_UNCONFIRMED', 'El servidor y el dispositivo aún no confirman toda la configuración. No se permite enviar.');
        return Object.freeze({ configured: true, ownDeviceVerified: true, ownIdentityVerified: true, recoveryConfigured: true, backupVersion: backup.backupInfo.version });
      } catch (error) {
        if (started) { identityIntegrityBlocked = true; update({ ownDeviceVerified: false, ownIdentityVerified: false }); throw failure('IDENTITY_SETUP_INCOMPLETE', 'La configuración pudo quedar incompleta. Conserva la clave guardada y recupera esta identidad; no se ha intentado restablecerla automáticamente.'); }
        throw error;
      } finally {
        initializationRunning = false;
        if (started) { setup.generated.privateKey.fill(0); pendingSetup = null; }
      }
    }),
    restoreIdentity: recoveryKey => guarded(async () => {
      const context = requireSession();
      if (initializationRunning || pendingSetup) throw failure('IDENTITY_SETUP_PENDING', 'Termina o cancela la preparación en curso.');
      if (typeof sdk.decodeRecoveryKey !== 'function' || typeof context.cryptoApi.importSecretsBundle !== 'function') throw failure('RECOVERY_UNAVAILABLE', 'Esta versión no dispone de recuperación verificada.');
      if (typeof recoveryKey !== 'string' || recoveryKey.length > 1024) throw failure('INVALID_RECOVERY_KEY', 'Clave de recuperación no válida.');
      initializationRunning = true;
      let rawKey, imported = false;
      try {
        try { rawKey = sdk.decodeRecoveryKey(recoveryKey); } catch { throw failure('INVALID_RECOVERY_KEY', 'Clave de recuperación no válida.'); }
        const keyTuple = await context.client.secretStorage.getKey();
        sameSession(context);
        if (!keyTuple || keyTuple[1]?.algorithm !== 'm.secret_storage.v1.aes-hmac-sha2') throw failure('RECOVERY_NOT_CONFIGURED', 'Este usuario no tiene una recuperación compatible configurada.');
        if (!(await context.client.secretStorage.checkKey(rawKey, keyTuple[1]))) throw failure('RECOVERY_KEY_MISMATCH', 'La clave no corresponde a la recuperación actual.');
        secretKeys.get(keyTuple[0])?.fill(0);
        secretKeys.set(keyTuple[0], new Uint8Array(rawKey));
        // 4S authenticates/decrypts these values in the SDK. No plaintext export is returned to UI.
        const names = ['m.cross_signing.master', 'm.cross_signing.self_signing', 'm.cross_signing.user_signing'];
        const values = await Promise.all(names.map(name => context.client.secretStorage.get(name)));
        sameSession(context);
        if (values.some(value => typeof value !== 'string' || !value)) throw failure('RECOVERY_SECRETS_MISSING', 'Faltan secretos de identidad. La recuperación se detiene sin crear nuevas claves.');
        const remote = await context.client.downloadKeysForUsers([context.session.userId]);
        const expected = ['master_keys', 'self_signing_keys', 'user_signing_keys'].map(type => {
          const keys = remote?.[type]?.[context.session.userId]?.keys;
          if (!keys || Object.keys(keys).length !== 1) throw failure('RECOVERY_PUBLIC_KEYS_MISSING', 'No se pueden confirmar las claves públicas actuales.');
          return Object.values(keys)[0];
        });
        sameSession(context);
        await context.cryptoApi.importSecretsBundle({ cross_signing: { master_key: values[0], self_signing_key: values[1], user_signing_key: values[2] } });
        imported = true;
        const restored = await Promise.all(['master_key', 'self_signing_key', 'user_signing_key'].map(type => context.cryptoApi.getCrossSigningKeyId(type)));
        sameSession(context);
        if (restored.some((value, index) => !value || value !== expected[index])) throw failure('RECOVERY_IDENTITY_MISMATCH', 'La identidad recuperada no coincide con la publicada. Se bloquea el envío.');
        await context.cryptoApi.crossSignDevice(context.session.deviceId);
        sameSession(context);
        identityIntegrityBlocked = false;
        const trust = await waitForOwnTrust(context);
        if (!trust.ownDeviceVerified || !trust.ownIdentityVerified) throw failure('RECOVERY_UNCONFIRMED', 'La verificación del dispositivo recuperado aún no está confirmada.');
        let backupRestored = false, backupResult = null, backupCode = 'NO_BACKUP';
        try {
          const backup = await context.cryptoApi.checkKeyBackupAndEnable();
          if (backup?.backupInfo?.version) {
            await context.cryptoApi.loadSessionBackupPrivateKeyFromSecretStorage();
            const checked = await context.cryptoApi.checkKeyBackupAndEnable();
            if (checked?.trustInfo?.trusted !== true || checked?.trustInfo?.matchesDecryptionKey !== true) throw failure('BACKUP_NOT_TRUSTED', 'La copia de seguridad no tiene una confianza confirmada.');
            backupResult = await context.cryptoApi.restoreKeyBackup();
            backupRestored = true; backupCode = null;
          }
        } catch (error) { backupCode = report(error, 'BACKUP_RESTORE_FAILED', 'La identidad se recuperó, pero el historial de la copia no pudo recuperarse.').code; }
        sameSession(context);
        return Object.freeze({ identityRestored: true, ...trust, backupRestored, backupCode, backupResult, completeHistory: false });
      } catch (error) {
        if (imported) { identityIntegrityBlocked = true; update({ ownDeviceVerified: false, ownIdentityVerified: false }); }
        throw error;
      } finally { rawKey?.fill(0); initializationRunning = false; }
    }),
    requestOwnVerification: () => guarded(async () => {
      const context = requireSession(); const request = await context.cryptoApi.requestOwnUserVerification(); sameSession(context); incomingVerification(request); return request;
    }),
    requestDeviceVerification: (id, device) => guarded(async () => {
      const context = requireSession(); const request = await context.cryptoApi.requestDeviceVerification(userId(id), checkedString(device, 'INVALID_DEVICE_ID', 'Dispositivo')); sameSession(context); incomingVerification(request); return request;
    }),
    requestPeerVerification: (id, room) => guarded(async () => {
      const context = await secureRoom(room); userId(id);
      const members = await context.room.getEncryptionTargetMembers();
      if (!members.some(member => member.userId === id) || id === context.session.userId) throw failure('VERIFICATION_PEER_NOT_IN_ROOM', 'El interlocutor debe estar presente en la sala.');
      sameSession(context);
      if (!strictIdentity(await context.cryptoApi.getUserVerificationStatus(id))) throw failure('USE_DEVICE_VERIFICATION', 'Elige un dispositivo del interlocutor para iniciar la verificación SAS.');
      const request = await context.cryptoApi.requestVerificationDM(id, room); sameSession(context); incomingVerification(request); return request;
    }),
    getPendingVerifications: () => [...verifications].filter(request => request.pending),
    lock: () => close(false),
    disconnect: () => close(false),
    logout: () => close(true),
  };
  return Object.freeze(api);
}
