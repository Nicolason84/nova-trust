import '/tmp/jaime-e2ee-browser-deps/node_modules/fake-indexeddb/auto/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import * as matrix from '/workspace/scratch/79058eaabd0a/jaime_app_work/secure-messaging/node_modules/matrix-js-sdk/lib/index.js';
import * as cryptoExports from '/workspace/scratch/79058eaabd0a/jaime_app_work/secure-messaging/node_modules/matrix-js-sdk/lib/crypto-api/index.js';
import { decodeRecoveryKey } from '/workspace/scratch/79058eaabd0a/jaime_app_work/secure-messaging/node_modules/matrix-js-sdk/lib/crypto-api/recovery-key.js';
import { createSecureMessenger } from '/workspace/scratch/79058eaabd0a/jaime_app_work/secure-messaging/matrix-client.mjs';

const root = '/tmp/jaime-e2ee-test';
const sourceFile = '/workspace/scratch/79058eaabd0a/jaime_app_work/secure-messaging/matrix-client.mjs';
const credentials = JSON.parse(await fs.readFile(`${root}/facade-credentials.json`, 'utf8'));
assert.equal(credentials.baseUrl, 'http://127.0.0.1:18765');
assert.equal(typeof navigator.locks.request, 'function');
const active = [];
const wire = { encryptedMessageSends: 0, plaintextMessageSends: 0, externalRequests: 0 };
const report = {
  startedAt: new Date().toISOString(), kind: 'real_facade_synapse_integration',
  sdk: '45.0.0', synapse: '1.164.1', node: process.version,
  indexedDB: 'fake-indexeddb 6.2.6, test-only in-memory implementation',
  locks: 'Native Node navigator.locks; no lock mock',
  localOnly: true, steps: [],
  sourceSha256: createHash('sha256').update(await fs.readFile(sourceFile)).digest('hex'),
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const progress = message => { report.steps.push(message); console.log(message); };
async function persistCredentials() {
  await fs.writeFile(`${root}/facade-credentials.json`, JSON.stringify(credentials, null, 2), { mode: 0o600 });
}
async function waitUntil(label, predicate, ms = 35000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const result = await predicate();
    if (result) return result;
    await delay(150);
  }
  throw new Error(`Timeout: ${label}`);
}
async function expectCode(operation, code) {
  let caught;
  try { await operation; } catch (error) { caught = error; }
  assert.equal(caught?.code, code, `Expected failure ${code}, got ${caught?.code || 'success'}`);
}
async function api(path, user, payload) {
  const reply = await fetch(credentials.baseUrl + path, {
    method: payload === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}) },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const data = await reply.json();
  if (!reply.ok) throw new Error(`Local API HTTP ${reply.status}: ${data.errcode || 'unknown'}`);
  return data;
}
async function login(user) {
  const result = await api('/_matrix/client/v3/login', null, {
    type: 'm.login.password', identifier: { type: 'm.id.user', user: user.userId },
    password: user.password, initial_device_display_name: 'Synthetic facade integration test',
  });
  user.deviceId = result.device_id;
  user.accessToken = result.access_token;
  user.storageKeyBase64 = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
  await persistCredentials();
  return user;
}
function connectInput(user) {
  return { homeserverUrl: credentials.baseUrl, userId: user.userId, deviceId: user.deviceId,
    accessToken: user.accessToken, storageKey: new Uint8Array(Buffer.from(user.storageKeyBase64, 'base64')) };
}
function makeMessenger(user) {
  const instance = { user, client: null, app: null, messages: [], errors: [], verifications: [] };
  const sdk = { ...matrix, ...cryptoExports, decodeRecoveryKey,
    createClient(options) { instance.client = matrix.createClient(options); return instance.client; },
  };
  const fetchOnlyLocal = async (url, options) => {
    const target = new URL(typeof url === 'string' ? url : url.url || url.href);
    if (target.origin !== credentials.baseUrl) { wire.externalRequests++; throw new Error('External test request blocked'); }
    if (/\/send\/m\.room\.encrypted\//.test(target.pathname)) wire.encryptedMessageSends++;
    if (/\/send\/m\.room\.message\//.test(target.pathname)) wire.plaintextMessageSends++;
    return fetch(url, options);
  };
  instance.app = createSecureMessenger({ sdk,
    runtime: { crypto: globalThis.crypto, indexedDB: globalThis.indexedDB, locks: navigator.locks, fetch: fetchOnlyLocal },
    allowLoopbackForTests: true,
    onMessage: message => instance.messages.push(message),
    onError: error => instance.errors.push({ code: error.code, message: error.message }),
    onVerification: request => instance.verifications.push(request),
  });
  active.push(instance);
  return instance;
}
async function initializeIdentity(instance) {
  const setup = await instance.app.prepareIdentity();
  assert.equal(setup.requiresHumanConfirmation, true);
  instance.user.recoveryKey = setup.recoveryKey;
  await persistCredentials();
  await expectCode(instance.app.initializeIdentity({ setupId: setup.setupId, recoveryKeyConfirmation: 'deliberately incorrect', authUploadDeviceSigningKeys: async () => {} }), 'RECOVERY_CONFIRMATION_REQUIRED');
  const initialized = await instance.app.initializeIdentity({
    setupId: setup.setupId, recoveryKeyConfirmation: instance.user.recoveryKey,
    authUploadDeviceSigningKeys: async makeRequest => {
      const auth = { type: 'm.login.password', identifier: { type: 'm.id.user', user: instance.user.userId }, password: instance.user.password };
      try { return await makeRequest(auth); }
      catch (error) {
        if (error.httpStatus === 401 && error.data?.session) return makeRequest({ ...auth, session: error.data.session });
        throw error;
      }
    },
  });
  assert.equal(initialized.configured, true);
  assert.equal(initialized.recoveryConfigured, true);
  assert.ok(initialized.backupVersion);
  await expectCode(instance.app.prepareIdentity(), 'IDENTITY_ALREADY_EXISTS');
  return initialized;
}
async function verifySas(alice, bob) {
  const requestA = await alice.app.requestDeviceVerification(bob.user.userId, bob.user.deviceId);
  const requestB = await waitUntil('incoming facade SAS request', () => bob.verifications.find(r => r.otherUserId === alice.user.userId && r.pending));
  await requestB.accept();
  await waitUntil('SAS ready', () => requestA.phase === cryptoExports.VerificationPhase.Ready);
  const verifierA = await requestA.startVerification('m.sas.v1');
  const verifierB = await waitUntil('other SAS verifier', () => requestB.verifier);
  const doneA = verifierA.verify().then(() => true, () => false);
  const doneB = verifierB.verify().then(() => true, () => false);
  const sasA = await waitUntil('Alice actual SAS values', () => verifierA.getShowSasCallbacks());
  const sasB = await waitUntil('Bob actual SAS values', () => verifierB.getShowSasCallbacks());
  assert.ok(sasA.sas.emoji?.length === 7 || sasA.sas.decimal?.length === 3);
  assert.deepEqual(sasA.sas, sasB.sas);
  await Promise.all([sasA.confirm(), sasB.confirm()]);
  assert.deepEqual(await Promise.all([doneA, doneB]), [true, true]);
  report.actualSasCompared = true;
}

try {
  let alice = makeMessenger(await login(credentials.users[0]));
  const bob = makeMessenger(await login(credentials.users[1]));
  await alice.app.connect(connectInput(alice.user));
  await bob.app.connect(connectInput(bob.user));
  progress('Facade connected two real SDK clients with encrypted IndexedDB stores and native locks.');

  const competing = makeMessenger(alice.user);
  await expectCode(competing.app.connect(connectInput(alice.user)), 'STORE_IN_USE');
  report.parallelStoreBlocked = true;

  await initializeIdentity(alice);
  await initializeIdentity(bob);
  report.identitySetup = { wrongConfirmationRejected: true, secretStorage: true, trustedKeyBackup: true, existingIdentityResetBlocked: true };
  progress('Facade identity setup creates real 4S, cross-signing and trusted backups; wrong confirmation is rejected.');

  const created = await alice.app.createEncryptedRoom({ invite: [bob.user.userId] });
  const roomId = created.roomId;
  await waitUntil('Alice encrypted room sync', () => alice.app.listEncryptedRooms().find(r => r.roomId === roomId && r.membership === 'join'));
  await waitUntil('Bob encrypted invitation sync', () => bob.app.listEncryptedRooms().find(r => r.roomId === roomId && r.membership === 'invite'));
  await bob.app.acceptInvite(roomId);
  await waitUntil('Both room members', () => alice.client.getRoom(roomId)?.getJoinedMemberCount() === 2);
  const before = await alice.app.inspectRoomSafety(roomId);
  assert.equal(before.allowed, false);
  assert.equal(before.code, 'RECIPIENT_IDENTITY_UNVERIFIED');
  const sendsBefore = wire.encryptedMessageSends;
  await expectCode(alice.app.sendText(roomId, 'SYNTHETIC MUST NOT BE SENT'), 'RECIPIENT_IDENTITY_UNVERIFIED');
  assert.equal(wire.encryptedMessageSends, sendsBefore);
  report.preSasSendBlocked = true;
  progress('Actual facade rejects an unverified recipient before any message HTTP send.');

  await verifySas(alice, bob);
  await waitUntil('Facade safety after SAS', async () => (await alice.app.inspectRoomSafety(roomId)).allowed);
  const plaintext = `SYNTHETIC-FACADE-E2EE-${randomUUID()}`;
  const sent = await alice.app.sendText(roomId, plaintext);
  assert.equal(sent.acceptedByHomeserver, true);
  assert.equal(sent.recipientDeliveryConfirmed, false);
  const raw = await api(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/event/${encodeURIComponent(sent.eventId)}`, alice.user);
  assert.equal(raw.type, 'm.room.encrypted');
  assert.equal(raw.content.algorithm, 'm.megolm.v1.aes-sha2');
  assert.equal(JSON.stringify(raw).includes(plaintext), false);
  const received = await waitUntil('Facade receives decrypted verified message', () => bob.messages.find(m => m.eventId === sent.eventId && m.body === plaintext));
  assert.equal(received.decrypted, true);
  assert.equal(received.senderVerified, true);
  const history = await bob.app.getRoomMessages(roomId, { limit: 50 });
  assert.ok(history.messages.some(m => m.eventId === sent.eventId && m.body === plaintext));
  assert.equal(history.completeHistory, false);
  report.messageRoundTrip = { ciphertextAtServer: true, plaintextAtRecipient: true, senderVerified: true, historyRead: true };
  report.roomId = roomId; report.eventId = sent.eventId;
  await fs.writeFile(`${root}/facade-fixture.json`, JSON.stringify({ plaintext, roomId, eventId: sent.eventId }, null, 2), { mode: 0o600 });
  progress('Facade send/receive/history pass; server retains ciphertext and recipient displays authenticated plaintext.');

  await alice.app.lock();
  alice = makeMessenger(alice.user);
  await alice.app.connect(connectInput(alice.user));
  await waitUntil('Reopened store retains own trust', async () => (await alice.app.refreshOwnTrust()).ownDeviceVerified);
  await waitUntil('Reopened store safety', async () => (await alice.app.inspectRoomSafety(roomId)).allowed);
  report.lockAndResumeSameDevice = true;
  progress('Lock and reopen preserve real device keys and trust in the IndexedDB test store.');

  await waitUntil('Bob room key reaches encrypted backup', async () => (await api('/_matrix/client/v3/room_keys/version', bob.user)).count > 0, 60000);
  const publicKeysBefore = await api('/_matrix/client/v3/keys/query', bob.user, { device_keys: { [bob.user.userId]: [] } });
  const masterBefore = JSON.stringify(publicKeysBefore.master_keys[bob.user.userId].keys);
  const bobSecondUser = { username: bob.user.username, userId: bob.user.userId, password: bob.user.password, recoveryKey: bob.user.recoveryKey };
  credentials.recoveryDevice = bobSecondUser;
  const bobSecond = makeMessenger(await login(bobSecondUser));
  await bobSecond.app.connect(connectInput(bobSecond.user));
  await waitUntil('New unverified device blocks send', async () => {
    const safety = await alice.app.inspectRoomSafety(roomId);
    return !safety.allowed && safety.code === 'RECIPIENT_DEVICE_UNVERIFIED';
  });
  const priorNewDeviceSendCount = wire.encryptedMessageSends;
  await expectCode(alice.app.sendText(roomId, 'SYNTHETIC UNVERIFIED DEVICE MUST BLOCK'), 'RECIPIENT_DEVICE_UNVERIFIED');
  assert.equal(wire.encryptedMessageSends, priorNewDeviceSendCount);
  await expectCode(bobSecond.app.prepareIdentity(), 'IDENTITY_ALREADY_EXISTS');
  await expectCode(bobSecond.app.restoreIdentity(alice.user.recoveryKey), 'RECOVERY_KEY_MISMATCH');
  const restored = await bobSecond.app.restoreIdentity(bob.user.recoveryKey);
  assert.equal(restored.identityRestored, true);
  assert.equal(restored.ownDeviceVerified, true);
  assert.equal(restored.ownIdentityVerified, true);
  assert.equal(restored.backupRestored, true);
  const publicKeysAfter = await api('/_matrix/client/v3/keys/query', bobSecond.user, { device_keys: { [bob.user.userId]: [] } });
  assert.equal(JSON.stringify(publicKeysAfter.master_keys[bob.user.userId].keys), masterBefore);
  await waitUntil('Peer trusts recovered device', async () => (await alice.app.inspectRoomSafety(roomId)).allowed);
  await waitUntil('Recovered device decrypts previous message', async () => (await bobSecond.app.getRoomMessages(roomId)).messages.some(m => m.eventId === sent.eventId && m.body === plaintext), 45000);
  report.recovery = { newDeviceBlockedBeforeRestore: true, wrongRecoveryKeyRejected: true, identityRestored: true, publicMasterKeyUnchanged: true, backupRestored: true, previousMessageDecrypted: true, newDeviceVerifiedAfterRestore: true };
  progress('Fresh-device recovery passes: wrong key rejected, same identity preserved, backup and earlier message recovered.');

  const revoked = await alice.app.logout();
  assert.equal(revoked.serverRevoked, true);
  assert.equal(revoked.retirementRecorded, true);
  const retiredRetry = makeMessenger(alice.user);
  await expectCode(retiredRetry.app.connect(connectInput(alice.user)), 'DEVICE_RETIRED');
  report.revokedDeviceCannotReopen = true;
  assert.equal(wire.externalRequests, 0);
  assert.equal(wire.plaintextMessageSends, 0);
  report.wire = wire;
  report.success = true;
  progress('Logout revokes and retires the device; reuse is blocked. No external request or plaintext message send.');
} catch (error) {
  report.success = false;
  report.error = { name: error.name, code: error.code || null, message: error.message };
  report.facadeErrors = active.flatMap(i => i.errors).slice(-20);
  if (error.code === 'RECOVERY_UNCONFIRMED') {
    const target = active.at(-1);
    const snapshots = [];
    for (const pause of [0, 500, 1500]) {
      if (pause) await delay(pause);
      try {
        const cryptoApi = target.client.getCrypto();
        const identity = await cryptoApi.getUserVerificationStatus(target.user.userId);
        const device = await cryptoApi.getDeviceVerificationStatus(target.user.userId, target.user.deviceId);
        snapshots.push({ pause, identityVerified: identity?.isCrossSigningVerified(), deviceVerified: device?.isVerified(), signedByOwner: device?.signedByOwner, crossSigningVerified: device?.crossSigningVerified, blocked: device?.blocked });
      } catch (inspectionError) { snapshots.push({ pause, inspectionFailed: inspectionError.name }); }
    }
    report.recoveryTrustSnapshots = snapshots;
    console.log('Recovery trust diagnostics:', JSON.stringify(snapshots));
  }
  console.error('Facade integration test failed:', error.name, error.code || '', error.message);
  process.exitCode = 1;
} finally {
  for (const item of active) {
    if (item.app.getState().phase !== 'disconnected') {
      try { await item.app.logout(); } catch { try { await item.app.lock(); } catch {} }
    }
  }
  report.finishedAt = new Date().toISOString();
  report.sourceSha256After = createHash('sha256').update(await fs.readFile(sourceFile)).digest('hex');
  report.sourceChangedDuringTest = report.sourceSha256After !== report.sourceSha256;
  await fs.writeFile(`${root}/facade-report.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log('Sanitized facade report:', `${root}/facade-report.json`);
  setTimeout(() => process.exit(process.exitCode || 0), 100);
}
