import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { webcrypto } from 'node:crypto';
import { createSecureMessenger, cryptoStoreName, MEGOLM } from '../matrix-client.mjs';

// These are contract doubles, not evidence of encryption, SAS, or message delivery.
const turn = () => new Promise(resolve => setImmediate(resolve));
const expectCode = (promise, code) => assert.rejects(promise, error => error.code === code);
let number = 0;
const ownId = '@jaime:example.invalid', peerId = '@tobias:example.invalid';

function locks() {
  const held = new Set();
  return { held, async request(name, options, fn) {
    assert.deepEqual(options, { mode: 'exclusive', ifAvailable: true });
    if (held.has(name)) return fn(null);
    held.add(name);
    try { return await fn({ name }); } finally { held.delete(name); }
  } };
}

function fixture(changes = {}) {
  const deviceId = `SYNTHETIC_${++number}`;
  const records = [], errors = [], states = [], messages = [], roomLists = [], lifecycleRecords = new Map();
  const options = { encrypted: true, private: true, synced: true, cryptoReady: true, ownVerified: true, peerVerified: true, peerDeviceVerified: true, ...changes };
  let client, cryptoApi, sdkOptions;
  const trustedDevice = (verified = true) => ({ isVerified: () => verified, signedByOwner: verified, crossSigningVerified: verified, blocked: false });
  const trustedIdentity = (verified = true) => ({ known: true, isCrossSigningVerified: () => verified, needsUserApproval: false });
  const stateEvents = new Map([
    ['m.room.encryption|', { algorithm: options.encrypted ? MEGOLM : 'unsupported' }],
    ['m.room.join_rules|', { join_rule: options.private ? 'invite' : 'public' }],
    [`m.room.member|${ownId}`, { membership: options.membership || 'join' }],
  ]);
  const timeline = [];
  const room = {
    roomId: '!opaqueRoomIdWithoutColon', name: 'Sala sintética', membership: options.membership || 'join', blacklist: false,
    currentState: { getStateEvents: (type, key) => stateEvents.has(`${type}|${key}`) ? { getContent: () => stateEvents.get(`${type}|${key}`) } : null },
    getMyMembership() { return this.membership; },
    async getEncryptionTargetMembers() { return [ownId, peerId].map(userId => ({ userId, membership: 'join' })); },
    setBlacklistUnverifiedDevices(value) { this.blacklist = value; },
    getLiveTimeline() { return { getEvents: () => timeline }; },
  };
  let backup = options.existingBackup || null;
  let secretDefault = options.existingSecretStorage || null;
  let crossSigningExists = options.existingIdentity ?? true;
  const deviceMap = new Map([[ownId, new Map([[deviceId, {}]])], [peerId, new Map([['PEER_DEVICE', {}]])]]);
  cryptoApi = {
    globalBlacklistUnverifiedDevices: false,
    setDeviceIsolationMode(mode) { records.push(['mode', mode]); this.mode = mode; },
    setTrustCrossSignedDevices(value) { records.push(['trustCrossSigned', value]); },
    async isEncryptionEnabledInRoom() { return options.encrypted; },
    async getUserVerificationStatus(id) { return trustedIdentity(id === ownId ? options.ownVerified : options.peerVerified); },
    async getDeviceVerificationStatus(id) { return trustedDevice(id === ownId ? options.ownVerified : options.peerDeviceVerified); },
    async getUserDeviceInfo() { return deviceMap; },
    async getOwnDeviceKeys() { return { ed25519: 'synthetic-ed', curve25519: 'synthetic-curve' }; },
    async getEncryptionInfoForEvent() { return { shieldColour: options.shieldColour ?? 0, shieldReason: options.shieldReason ?? null }; },
    async userHasCrossSigningKeys() { return crossSigningExists; },
    async checkKeyBackupAndEnable() { return backup ? { backupInfo: backup, trustInfo: { trusted: true, matchesDecryptionKey: true } } : null; },
    async getKeyBackupInfo() { return backup; },
    async createRecoveryKeyFromPassphrase() { records.push(['generateRecovery']); return { privateKey: new Uint8Array(32).fill(18), encodedPrivateKey: 'SYNTHETIC RECOVERY VALUE' }; },
    async bootstrapSecretStorage(opts) {
      records.push(['bootstrapSecretStorage', opts]);
      if (opts.createSecretStorageKey) {
        const key = await opts.createSecretStorageKey();
        secretDefault = 'secret-key-id';
        sdkOptions.cryptoCallbacks.cacheSecretStorageKey(secretDefault, {}, key.privateKey);
        const cached = await sdkOptions.cryptoCallbacks.getSecretStorageKey({ keys: { [secretDefault]: {} } });
        assert.equal(cached[0], secretDefault);
        assert.equal(cached[1][0], 18);
      }
      if (opts.setupNewKeyBackup) backup = { version: '1' };
    },
    async bootstrapCrossSigning(opts) { records.push(['bootstrapCrossSigning', opts]); await opts.authUploadDeviceSigningKeys(async () => {}); crossSigningExists = true; options.ownVerified = true; },
    async isCrossSigningReady() { return crossSigningExists; },
    async isSecretStorageReady() { return !!secretDefault; },
    async requestOwnUserVerification() { const request = new EventEmitter(); Object.assign(request, { pending: true, otherUserId: ownId, accept: async () => records.push(['accept']) }); records.push(['requestVerification']); return request; },
    async requestDeviceVerification() { return this.requestOwnUserVerification(); },
    async requestVerificationDM() { return this.requestOwnUserVerification(); },
    async importSecretsBundle(value) { records.push(['importSecrets', value]); options.ownVerified = true; },
    async getCrossSigningKeyId(type) { return `public-${type}`; },
    async crossSignDevice(id) { records.push(['crossSignDevice', id]); },
    async loadSessionBackupPrivateKeyFromSecretStorage() { records.push(['loadBackupKey']); },
    async restoreKeyBackup() { records.push(['restoreBackup']); return { total: 2, imported: 2 }; },
  };
  class Client extends EventEmitter {
    constructor(opts) {
      super(); sdkOptions = opts; this.token = opts.accessToken; this.initialized = false;
      this.http = { abort: () => records.push(['abort']) };
      this.secretStorage = {
        getDefaultKeyId: async () => secretDefault,
        getKey: async () => secretDefault ? [secretDefault, { algorithm: 'm.secret_storage.v1.aes-hmac-sha2' }] : null,
        checkKey: async () => options.recoveryMatches !== false,
        get: async name => options.missingRecoverySecret === name ? undefined : `secret-${name}`,
      };
    }
    async whoami() { records.push(['whoami']); if (options.whoamiWait) await options.whoamiWait; return options.whoami || { user_id: ownId, device_id: deviceId }; }
    async initRustCrypto(opts) { records.push(['initRustCrypto', { ...opts, storageKey: opts.storageKey?.slice() }]); if (options.cryptoInitError) throw new Error(`secret token=${this.token}`); this.initialized = true; }
    getCrypto() { return this.initialized && options.cryptoReady ? cryptoApi : null; }
    async startClient(opts) { records.push(['startClient', opts]); if (options.synced) this.emit('sync', 'PREPARED'); }
    stopClient() { records.push(['stopClient']); }
    setAccessToken(value) { this.token = value; records.push(['setAccessToken', value]); }
    async logout() { records.push(['logout']); if (options.logoutFails) throw new Error('synthetic network failure'); }
    getRooms() { return [room, ...(options.extraRooms || [])]; }
    getRoom(id) { return this.getRooms().find(value => value.roomId === id) || null; }
    async createRoom(value) { records.push(['createRoom', value]); return { room_id: room.roomId }; }
    async joinRoom(id) { records.push(['joinRoom', id]); room.membership = 'join'; stateEvents.set(`m.room.member|${ownId}`, { membership: 'join' }); return room; }
    async sendTextMessage(id, body) { records.push(['send', id, body]); return { event_id: '$serverAcceptedSynthetic' }; }
    async decryptEventIfNeeded() { records.push(['decrypt']); }
    async downloadKeysForUsers() {
      records.push(['downloadKeys']);
      return { ...Object.fromEntries(['master_keys', 'self_signing_keys', 'user_signing_keys'].map((type, index) => [type, { [ownId]: { keys: { only: `public-${['master_key', 'self_signing_key', 'user_signing_key'][index]}` } } }])),
        device_keys: options.deletedServerDevice ? {} : { [ownId]: { [deviceId]: { keys: { [`ed25519:${deviceId}`]: 'synthetic-ed', [`curve25519:${deviceId}`]: 'synthetic-curve' } } } },
      };
    }
  }
  const sdk = {
    createClient(opts) { records.push(['createClient']); client = new Client(opts); return client; },
    AllDevicesIsolationMode: class { constructor(errorOnVerifiedUserProblems) { this.errorOnVerifiedUserProblems = errorOnVerifiedUserProblems; } },
    EventShieldColour: { NONE: 0, GREY: 1, RED: 2 }, ClientEvent: { Sync: 'sync', Room: 'Room' }, RoomEvent: { Timeline: 'Room.timeline' },
    MatrixEventEvent: { Decrypted: 'Event.decrypted' }, CryptoEvent: { VerificationRequestReceived: 'crypto.verificationRequestReceived', UserTrustStatusChanged: 'userTrustStatusChanged', DevicesUpdated: 'crypto.devicesUpdated', KeysChanged: 'crossSigning.keysChanged' },
    decodeRecoveryKey(value) { if (value !== 'SYNTHETIC RECOVERY VALUE') throw new Error('bad key'); return new Uint8Array(32).fill(18); },
  };
  const runtime = { crypto: webcrypto, indexedDB: {}, locks: locks(), fetch: async (...args) => { records.push(['fetch', ...args]); return { ok: true }; }, ...options.runtime };
  const lifecycleFactory = (_idb, name) => ({
    async open() { records.push(['lifecycleOpen', name]); },
    async read() { return lifecycleRecords.get(name) || null; },
    async retire() { lifecycleRecords.set(name, { retired: true }); records.push(['retire', name]); },
    async rememberPublicKeys(publicDeviceKeys) { lifecycleRecords.set(name, { retired: false, publicDeviceKeys }); },
    close() { records.push(['lifecycleClose']); },
  });
  const config = { sdk, runtime, lifecycleFactory, keyUploadTimeoutMs: 100, onState: value => states.push(value), onRooms: value => roomLists.push(value), onMessage: value => messages.push(value), onError: value => errors.push(value) };
  const api = createSecureMessenger(config);
  const credentials = { homeserverUrl: 'https://matrix.example.invalid', userId: ownId, deviceId, accessToken: 'SYNTHETIC_SECRET_TOKEN', storagePassword: 'synthetic-storage-passphrase' };
  return { api, config, sdk, runtime, options, records, errors, states, messages, roomLists, room, timeline, stateEvents, deviceMap, lifecycleRecords, credentials, cryptoApi,
    get client() { return client; }, get sdkOptions() { return sdkOptions; },
    async connect(t) { await api.connect(credentials); t?.after(() => api.lock()); return api; },
  };
}

function event(overrides = {}) {
  return {
    getId: () => '$incomingSynthetic', getRoomId: () => '!opaqueRoomIdWithoutColon', getSender: () => peerId, getTs: () => 1700000000000,
    getWireType: () => 'm.room.encrypted', getType: () => 'm.room.message', isDecryptionFailure: () => false, isBeingDecrypted: () => false,
    getOriginalContent: () => ({ msgtype: 'm.text', body: 'Hola' }), ...overrides,
  };
}

test('requires an encrypted crypto store and HTTPS before creating a client', async () => {
  const f = fixture();
  await expectCode(f.api.connect({ ...f.credentials, storagePassword: undefined }), 'STORAGE_SECRET_REQUIRED');
  await expectCode(f.api.connect({ ...f.credentials, homeserverUrl: 'http://example.invalid' }), 'INSECURE_HOMESERVER');
  assert.equal(f.records.filter(item => item[0] === 'createClient').length, 0);
});

test('fails closed without Web Locks and on a busy same-device lock', async t => {
  const missing = fixture({ runtime: { locks: undefined } });
  await expectCode(missing.api.connect(missing.credentials), 'WEB_LOCKS_UNAVAILABLE');
  const f = fixture(); await f.connect(t);
  const other = createSecureMessenger(f.config);
  await expectCode(other.connect(f.credentials), 'STORE_IN_USE');
  assert.equal(f.runtime.locks.held.size, 1);
});

test('whoami authenticates account and device before accessing the crypto database', async () => {
  const f = fixture({ whoami: { user_id: '@wrong:example.invalid', device_id: 'WRONG' } });
  await expectCode(f.api.connect(f.credentials), 'SESSION_IDENTITY_MISMATCH');
  assert.equal(f.client.token, '');
  assert.equal(f.records.some(item => ['lifecycleOpen', 'initRustCrypto'].includes(item[0])), false);
  assert.equal(f.runtime.locks.held.size, 0);
});

test('crypto initialization failure clears token, frees lock and sanitizes errors', async () => {
  const f = fixture({ cryptoInitError: true });
  await expectCode(f.api.connect(f.credentials), 'CONNECT_FAILED');
  assert.equal(f.client.token, '');
  assert.equal(f.runtime.locks.held.size, 0);
  assert.equal(JSON.stringify(f.errors).includes(f.credentials.accessToken), false);
  assert.equal(f.api.getState().cryptoReady, false);
});

test('locking during whoami immediately cuts transport and clears the token without releasing the active store early', async () => {
  let rejectWhoami;
  const whoamiWait = new Promise((_resolve, reject) => { rejectWhoami = reject; });
  const f = fixture({ whoamiWait });
  const connection = f.api.connect(f.credentials);
  const connectionFailure = expectCode(connection, 'CONNECT_FAILED');
  await turn(); await turn();
  assert.equal(f.api.getState().phase, 'authenticating');
  const locking = f.api.lock();
  assert.equal(f.client.token, '');
  assert.ok(f.records.some(item => item[0] === 'abort'));
  assert.ok(f.records.some(item => item[0] === 'stopClient'));
  assert.equal(f.runtime.locks.held.size, 1);
  rejectWhoami(new Error('transport aborted'));
  await connectionFailure; await locking;
  assert.equal(f.runtime.locks.held.size, 0);
  assert.equal(f.records.some(item => item[0] === 'initRustCrypto'), false);
});

test('does not call a session synced until the SDK emits its real sync state', async t => {
  const f = fixture({ synced: false });
  const connection = f.api.connect(f.credentials);
  await turn(); await turn();
  assert.equal(f.api.getState().phase, 'syncing');
  await expectCode(f.api.sendText(f.room.roomId, 'Hola'), 'NOT_SYNCED');
  f.client.emit('sync', 'PREPARED');
  await connection; t.after(() => f.api.lock());
  assert.equal(f.api.getState().synced, true);
  f.client.emit('sync', 'RECONNECTING');
  await expectCode(f.api.sendText(f.room.roomId, 'Hola'), 'NOT_SYNCED');
});

test('uses isolated named IndexedDB with SDK store encryption and strict Rust policy', async t => {
  const f = fixture(); await f.connect(t);
  const init = f.records.find(item => item[0] === 'initRustCrypto')[1];
  assert.equal(init.useIndexedDB, true);
  assert.equal(init.storagePassword, f.credentials.storagePassword);
  assert.match(init.cryptoDatabasePrefix, /^ojo-jaime-matrix-v1-[a-f0-9]{64}$/);
  assert.equal(f.cryptoApi.globalBlacklistUnverifiedDevices, true);
  assert.equal(f.cryptoApi.mode.errorOnVerifiedUserProblems, true);
  const otherDevice = await cryptoStoreName({ ...f.credentials, deviceId: 'DIFFERENT' }, webcrypto);
  assert.notEqual(otherDevice, init.cryptoDatabasePrefix);
  assert.equal(f.api.getState().sessionPersisted, false);
  assert.equal(JSON.stringify(f.lifecycleRecords).includes('SECRET_TOKEN'), false);
});

test('SDK fetch cannot follow redirects, send cookies, leak a referrer or change origin', async t => {
  const f = fixture(); await f.connect(t);
  await f.sdkOptions.fetchFn('https://matrix.example.invalid/_matrix/client/versions', { credentials: 'include', redirect: 'follow' });
  const options = f.records.find(item => item[0] === 'fetch')[2];
  assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store'); assert.equal(options.referrerPolicy, 'no-referrer');
  await expectCode(f.sdkOptions.fetchFn('https://other.invalid/steal'), 'REQUEST_BLOCKED');
});

for (const [name, options, code] of [
  ['non encrypted room', { encrypted: false }, 'ROOM_NOT_ENCRYPTED'],
  ['public room', { private: false }, 'ROOM_NOT_PRIVATE'],
  ['own identity/device unverified', { ownVerified: false }, 'OWN_IDENTITY_UNVERIFIED'],
  ['recipient identity unverified', { peerVerified: false }, 'RECIPIENT_IDENTITY_UNVERIFIED'],
  ['recipient device unverified', { peerDeviceVerified: false }, 'RECIPIENT_DEVICE_UNVERIFIED'],
]) test(`send refuses ${name}`, async t => {
  const f = fixture(options); await f.connect(t);
  await expectCode(f.api.sendText(f.room.roomId, 'Hola'), code);
  assert.equal(f.records.some(item => item[0] === 'send'), false);
});

test('unknown devices and identity replacements fail closed', async t => {
  const f = fixture(); await f.connect(t);
  f.deviceMap.delete(peerId);
  await expectCode(f.api.sendText(f.room.roomId, 'Hola'), 'DEVICE_LIST_UNKNOWN');
  f.deviceMap.set(peerId, new Map([['PEER_DEVICE', {}]]));
  f.cryptoApi.getUserVerificationStatus = async () => ({ known: true, isCrossSigningVerified: () => true, needsUserApproval: true });
  await expectCode(f.api.sendText(f.room.roomId, 'Hola'), 'OWN_IDENTITY_UNVERIFIED');
  assert.equal(f.records.some(item => item[0] === 'send'), false);
});

test('membership changes during the trust check cannot silently expand recipients', async t => {
  const f = fixture(); await f.connect(t);
  let reads = 0;
  f.room.getEncryptionTargetMembers = async () => (++reads === 1 ? [ownId, peerId] : [ownId, peerId, '@new:example.invalid']).map(userId => ({ userId }));
  await expectCode(f.api.sendText(f.room.roomId, 'Hola'), 'ROOM_MEMBERS_CHANGED');
});

test('send rechecks trust and applies the encryption-time gate even when room override was false', async t => {
  const f = fixture(); await f.connect(t);
  assert.equal((await f.api.inspectRoomSafety(f.room.roomId)).allowed, true);
  assert.equal(f.records.some(item => item[0] === 'send'), false);
  const result = await f.api.sendText(f.room.roomId, 'Mensaje explícito');
  assert.equal(f.room.blacklist, true);
  assert.equal(result.acceptedByHomeserver, true);
  assert.equal(result.recipientDeliveryConfirmed, false);
  f.options.peerVerified = false;
  assert.equal((await f.api.inspectRoomSafety(f.room.roomId)).allowed, false);
  await expectCode(f.api.sendText(f.room.roomId, 'Segundo'), 'RECIPIENT_IDENTITY_UNVERIFIED');
  assert.equal(f.records.filter(item => item[0] === 'send').length, 1);
});

test('room creation requests encryption, private invitations and joined-only history', async t => {
  const f = fixture(); await f.connect(t);
  const result = await f.api.createEncryptedRoom({ name: 'Tobias', invite: [peerId] });
  const opts = f.records.find(item => item[0] === 'createRoom')[1];
  assert.equal(opts.visibility, 'private'); assert.equal(opts.preset, 'private_chat');
  assert.deepEqual(opts.initial_state.find(item => item.type === 'm.room.encryption').content, { algorithm: MEGOLM });
  assert.equal(opts.initial_state.find(item => item.type === 'm.room.history_visibility').content.history_visibility, 'joined');
  assert.equal(result.readyToSend, false);
  assert.equal(result.roomId, '!opaqueRoomIdWithoutColon');
});

test('accepts only a direct encrypted invite, with no automatic join', async t => {
  const f = fixture({ membership: 'invite' }); await f.connect(t);
  assert.equal(f.api.listEncryptedRooms()[0].membership, 'invite');
  assert.equal(f.records.some(item => item[0] === 'joinRoom'), false);
  await f.api.acceptInvite(f.room.roomId);
  assert.equal(f.room.getMyMembership(), 'join');
  await expectCode(f.api.acceptInvite(f.room.roomId), 'DIRECT_INVITATION_REQUIRED');
});

test('receive emits actual decrypted original text, never server-bundled replacement HTML', async t => {
  const f = fixture(); await f.connect(t);
  const incoming = event({ getOriginalContent: () => ({ msgtype: 'm.text', body: '<script>inert text</script>' }), getContent: () => ({ body: 'untrusted bundled replacement' }) });
  f.client.emit('Room.timeline', incoming, f.room, false);
  await turn();
  f.client.emit('Event.decrypted', incoming); await turn();
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].body, '<script>inert text</script>');
  assert.equal(f.messages[0].decrypted, true);
  assert.equal(f.messages[0].senderVerified, true);
  f.timeline.push(incoming);
  const history = await f.api.getRoomMessages(f.room.roomId);
  assert.equal(history.messages.length, 1); assert.equal(history.completeHistory, false);
});

test('plain messages, decryption failures and authenticity warnings never get a false verified badge', async t => {
  const f = fixture({ shieldColour: 2, shieldReason: 1 }); await f.connect(t);
  f.client.emit('Room.timeline', event({ getWireType: () => 'm.room.message' }), f.room, false);
  f.client.emit('Room.timeline', event({ getId: () => '$failed', isDecryptionFailure: () => true }), f.room, false);
  f.client.emit('Room.timeline', event({ getId: () => '$warning' }), f.room, false);
  await turn();
  assert.equal(f.messages.length, 1); assert.equal(f.messages[0].senderVerified, false);
  assert.ok(f.errors.some(error => error.code === 'UNENCRYPTED_EVENT'));
  assert.ok(f.errors.some(error => error.code === 'DECRYPTION_FAILED'));
});

test('attachments are represented as unsupported without fetching media', async t => {
  const f = fixture(); await f.connect(t);
  f.client.emit('Room.timeline', event({ getOriginalContent: () => ({ msgtype: 'm.file', url: 'https://other.invalid/private', body: 'document.pdf' }) }), f.room, false);
  await turn();
  assert.equal(f.messages[0].kind, 'unsupported'); assert.equal(f.messages[0].attachmentSupported, false);
  assert.equal(f.records.some(item => item[0] === 'fetch'), false);
});

test('lock clears local access token and listeners but keeps the device reusable without server logout', async t => {
  const f = fixture(); await f.connect(); const previousClient = f.client;
  const result = await f.api.lock();
  assert.equal(result.serverRevoked, false); assert.equal(previousClient.token, '');
  assert.equal(previousClient.listenerCount('Room.timeline'), 0);
  assert.equal(f.records.some(item => item[0] === 'logout'), false); assert.ok([...f.lifecycleRecords.values()].every(value => value.retired === false));
  assert.equal(f.runtime.locks.held.size, 0);
  await f.api.connect(f.credentials); t.after(() => f.api.lock());
});

test('logout retires a confirmed revoked device and refuses to reuse its store', async () => {
  const f = fixture(); await f.connect();
  const result = await f.api.logout();
  assert.equal(result.serverRevoked, true); assert.equal(result.deviceRetired, true); assert.equal(result.newDeviceRequired, true);
  assert.equal(f.client.token, '');
  await expectCode(f.api.connect(f.credentials), 'DEVICE_RETIRED');
});

test('logout network failure still clears memory, reports no confirmed revocation and allows a retry', async t => {
  const f = fixture({ logoutFails: true }); await f.connect();
  const result = await f.api.logout();
  assert.equal(result.serverRevoked, false); assert.equal(result.deviceRetired, false); assert.equal(f.client.token, '');
  assert.ok([...f.lifecycleRecords.values()].every(value => value.retired === false));
  assert.ok(f.errors.some(error => error.code === 'LOGOUT_REVOKE_FAILED'));
  await f.api.connect(f.credentials); t.after(() => f.api.lock());
});

test('a deleted/recreated server device cannot reuse an earlier crypto store', async () => {
  const f = fixture(); await f.connect(); await f.api.lock();
  const previousInitializations = f.records.filter(item => item[0] === 'initRustCrypto').length;
  f.options.deletedServerDevice = true;
  await expectCode(f.api.connect(f.credentials), 'DEVICE_ID_REUSED');
  assert.equal(f.records.filter(item => item[0] === 'initRustCrypto').length, previousInitializations);
  assert.equal(f.client.token, '');
});

test('a freshly created device cannot appear connected before its public keys reach the server', async () => {
  const f = fixture({ deletedServerDevice: true });
  await expectCode(f.api.connect(f.credentials), 'DEVICE_KEYS_NOT_CONFIRMED');
  assert.equal(f.states.some(state => state.phase === 'connected'), false);
});

test('fresh key upload may finish after initial sync without weakening confirmation', async t => {
  const f = fixture({ deletedServerDevice: true });
  const connection = f.api.connect(f.credentials);
  await turn(); await turn();
  assert.equal(f.states.some(state => state.phase === 'connected'), false);
  f.options.deletedServerDevice = false;
  await connection; t.after(() => f.api.lock());
  assert.equal(f.api.getState().deviceKeysConfirmed, true);
});

test('invitation acceptance waits for synchronized membership after the HTTP acknowledgement', async t => {
  const f = fixture({ membership: 'invite' }); await f.connect(t);
  f.client.joinRoom = async () => {
    setTimeout(() => { f.room.membership = 'join'; f.stateEvents.set(`m.room.member|${ownId}`, { membership: 'join' }); }, 20);
    return f.room;
  };
  const result = await f.api.acceptInvite(f.room.roomId);
  assert.equal(result.membership, 'join');
});

test('room device listing is read-only and supports choosing the actual SAS target', async t => {
  const f = fixture({ peerVerified: false, peerDeviceVerified: false }); await f.connect(t);
  const devices = await f.api.getRoomDevices(f.room.roomId);
  assert.ok(devices.some(device => device.userId === peerId && device.deviceId === 'PEER_DEVICE' && device.verified === false));
  assert.equal(f.records.some(item => item[0] === 'send' || item[0] === 'requestVerification'), false);
  await expectCode(f.api.requestPeerVerification(peerId, f.room.roomId), 'USE_DEVICE_VERIFICATION');
});

test('new identity requires recovery-key re-entry before any server setup and never forces a reset', async t => {
  const f = fixture({ existingIdentity: false, ownVerified: false }); await f.connect(t);
  const prepared = await f.api.prepareIdentity();
  assert.equal(f.records.some(item => item[0] === 'bootstrapSecretStorage'), false);
  await expectCode(f.api.initializeIdentity({ setupId: prepared.setupId, recoveryKeyConfirmation: 'wrong', authUploadDeviceSigningKeys: async make => make({}) }), 'RECOVERY_CONFIRMATION_REQUIRED');
  await expectCode(f.api.prepareIdentity(), 'IDENTITY_SETUP_PENDING');
  const result = await f.api.initializeIdentity({ setupId: prepared.setupId, recoveryKeyConfirmation: prepared.recoveryKey, authUploadDeviceSigningKeys: async make => make({}) });
  assert.equal(result.configured, true); assert.equal(result.backupVersion, '1');
  assert.ok(f.records.filter(item => item[0] === 'bootstrapSecretStorage').every(item => item[1].setupNewSecretStorage === false));
  assert.equal(f.records.find(item => item[0] === 'bootstrapCrossSigning')[1].setupNewCrossSigning, false);
});

test('existing identity or backup cannot be overwritten by first-account setup', async t => {
  const f = fixture({ existingIdentity: false, existingBackup: { version: 'old' } }); await f.connect(t);
  await expectCode(f.api.prepareIdentity(), 'IDENTITY_ALREADY_EXISTS');
  assert.equal(f.records.some(item => item[0] === 'generateRecovery'), false);
});

test('verification requests are real SDK handles and never auto-accepted or marked verified', async t => {
  const f = fixture({ ownVerified: false }); await f.connect(t);
  const request = await f.api.requestOwnVerification();
  assert.equal(f.api.getPendingVerifications()[0], request);
  assert.equal(f.records.some(item => item[0] === 'accept'), false);
  assert.equal(f.api.getState().ownIdentityVerified, false);
});

test('restore uses authenticated 4S secrets and imports without any bootstrap/reset path', async t => {
  const f = fixture({ existingSecretStorage: 'secret-key-id', ownVerified: false, existingBackup: { version: '4' } }); await f.connect(t);
  const result = await f.api.restoreIdentity('SYNTHETIC RECOVERY VALUE');
  assert.equal(result.identityRestored, true); assert.equal(result.backupRestored, true);
  assert.equal(f.records.some(item => item[0] === 'bootstrapCrossSigning'), false);
  assert.equal(f.records.some(item => item[0] === 'bootstrapSecretStorage'), false);
  assert.equal(f.records.filter(item => item[0] === 'crossSignDevice').length, 1);
});

test('restoration waits for actual cross-signing flags after the signature upload returns', async t => {
  const f = fixture({ existingSecretStorage: 'secret-key-id', ownVerified: false }); await f.connect(t);
  let signatureArrived = false;
  const readDevice = f.cryptoApi.getDeviceVerificationStatus;
  f.cryptoApi.getDeviceVerificationStatus = async id => ({ ...(await readDevice(id)), signedByOwner: signatureArrived, crossSigningVerified: signatureArrived });
  f.cryptoApi.crossSignDevice = async () => { setTimeout(() => { signatureArrived = true; }, 20); };
  const result = await f.api.restoreIdentity('SYNTHETIC RECOVERY VALUE');
  assert.equal(result.ownDeviceVerified, true); assert.equal(signatureArrived, true);
});

test('wrong recovery key and missing identity secrets fail before import or signing', async t => {
  const f = fixture({ existingSecretStorage: 'secret-key-id', missingRecoverySecret: 'm.cross_signing.master' }); await f.connect(t);
  await expectCode(f.api.restoreIdentity('bad'), 'INVALID_RECOVERY_KEY');
  await expectCode(f.api.restoreIdentity('SYNTHETIC RECOVERY VALUE'), 'RECOVERY_SECRETS_MISSING');
  assert.equal(f.records.some(item => item[0] === 'importSecrets'), false);
  assert.equal(f.records.some(item => item[0] === 'crossSignDevice'), false);
});

test('restored public identity mismatch blocks all sends and does not sign the device', async t => {
  const f = fixture({ existingSecretStorage: 'secret-key-id' }); await f.connect(t);
  f.cryptoApi.getCrossSigningKeyId = async () => 'unexpected-public-key';
  await expectCode(f.api.restoreIdentity('SYNTHETIC RECOVERY VALUE'), 'RECOVERY_IDENTITY_MISMATCH');
  await expectCode(f.api.sendText(f.room.roomId, 'Must not leave'), 'IDENTITY_OPERATION_PENDING');
  assert.equal(f.records.some(item => item[0] === 'crossSignDevice'), false);
});
