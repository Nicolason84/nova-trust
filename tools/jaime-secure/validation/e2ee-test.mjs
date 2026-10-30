import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import * as sdk from '/workspace/scratch/79058eaabd0a/jaime_app_work/secure-messaging/node_modules/matrix-js-sdk/lib/index.js';
import { AllDevicesIsolationMode, VerificationPhase, CryptoEvent } from '/workspace/scratch/79058eaabd0a/jaime_app_work/secure-messaging/node_modules/matrix-js-sdk/lib/crypto-api/index.js';
import { logger } from '/workspace/scratch/79058eaabd0a/jaime_app_work/secure-messaging/node_modules/matrix-js-sdk/lib/logger.js';

// Synthetic local-only integration test. No production accounts, no UI shortcuts.
logger.setLevel('silent');
const root = '/tmp/jaime-e2ee-test';
const credentials = JSON.parse(await fs.readFile(`${root}/credentials.json`, 'utf8'));
const endpoint = new URL(credentials.baseUrl);
assert.equal(endpoint.hostname, '127.0.0.1');
assert.equal(endpoint.port, '18765');
const clients = [];
const report = { startedAt: new Date().toISOString(), sdk: '45.0.0', localOnly: true, steps: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const progress = message => { report.steps.push(message); console.log(message); };
async function waitUntil(label, predicate, ms = 30000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const result = await predicate();
    if (result) return result;
    await delay(100);
  }
  throw new Error(`Timeout: ${label}`);
}
async function api(path, user, payload) {
  const response = await fetch(credentials.baseUrl + path, {
    method: payload === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}) },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Local API HTTP ${response.status}, ${body.errcode || 'unknown'}`);
  return body;
}
async function login(user) {
  const result = await api('/_matrix/client/v3/login', null, {
    type: 'm.login.password', identifier: { type: 'm.id.user', user: user.userId },
    password: user.password, initial_device_display_name: 'Synthetic local E2EE test',
  });
  user.deviceId = result.device_id;
  user.accessToken = result.access_token;
  await fs.writeFile(`${root}/credentials.json`, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  const client = sdk.createClient({ baseUrl: credentials.baseUrl, userId: user.userId, deviceId: user.deviceId,
    accessToken: user.accessToken, verificationMethods: ['m.sas.v1'], });
  clients.push(client);
  await client.initRustCrypto({ useIndexedDB: false });
  const crypto = client.getCrypto();
  crypto.setDeviceIsolationMode(new AllDevicesIsolationMode(true));
  crypto.globalBlacklistUnverifiedDevices = true;
  crypto.setTrustCrossSignedDevices(true);
  await client.startClient({ initialSyncLimit: 20, lazyLoadMembers: false });
  await waitUntil('client initial sync', () => ['PREPARED', 'SYNCING'].includes(client.getSyncState()));
  await crypto.bootstrapCrossSigning({ setupNewCrossSigning: true,
    authUploadDeviceSigningKeys: async makeRequest => {
      const auth = { type: 'm.login.password', identifier: { type: 'm.id.user', user: user.userId }, password: user.password };
      try { return await makeRequest(auth); }
      catch (error) {
        if (error.httpStatus === 401 && error.data?.session) return makeRequest({ ...auth, session: error.data.session });
        throw error;
      }
    },
  });
  return { client, crypto, user };
}
async function identityAndDeviceVerified(observer, subject) {
  await observer.crypto.getUserDeviceInfo([subject.user.userId], true);
  const identity = await observer.crypto.getUserVerificationStatus(subject.user.userId);
  const device = await observer.crypto.getDeviceVerificationStatus(subject.user.userId, subject.user.deviceId);
  return Boolean(identity?.isCrossSigningVerified() && !identity.needsUserApproval &&
    device?.isVerified() && device.signedByOwner && device.crossSigningVerified && !device.blocked);
}

try {
  const alice = await login(credentials.users[0]);
  const bob = await login(credentials.users[1]);
  progress('Two Rust crypto clients initialized; local cross-signing keys published.');
  report.cryptoVersion = alice.crypto.getVersion();
  const { room_id: roomId } = await alice.client.createRoom({
    preset: 'private_chat', visibility: 'private', invite: [bob.user.userId],
    initial_state: [
      { type: 'm.room.encryption', state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } },
      { type: 'm.room.history_visibility', state_key: '', content: { history_visibility: 'joined' } },
    ],
  });
  await waitUntil('Bob invitation', () => bob.client.getRoom(roomId)?.getMyMembership() === 'invite');
  await bob.client.joinRoom(roomId);
  await waitUntil('Alice sees both members', () => alice.client.getRoom(roomId)?.getJoinedMemberCount() === 2);
  await waitUntil('Bob joined', () => bob.client.getRoom(roomId)?.getMyMembership() === 'join');
  alice.client.getRoom(roomId).setBlacklistUnverifiedDevices(true);
  bob.client.getRoom(roomId).setBlacklistUnverifiedDevices(true);
  assert.equal(await alice.crypto.isEncryptionEnabledInRoom(roomId), true);
  assert.equal(await bob.crypto.isEncryptionEnabledInRoom(roomId), true);
  await alice.crypto.getUserDeviceInfo([alice.user.userId, bob.user.userId], true);
  await bob.crypto.getUserDeviceInfo([alice.user.userId, bob.user.userId], true);
  assert.equal(await identityAndDeviceVerified(alice, bob), false);
  assert.equal(await identityAndDeviceVerified(bob, alice), false);
  report.preVerificationGate = 'blocked';
  progress('Encrypted private room ready; identity/device gate blocks both peers before verification.');

  let incomingRequest;
  bob.client.on(CryptoEvent.VerificationRequestReceived, request => {
    if (request.otherUserId === alice.user.userId) incomingRequest = request;
  });
  const requestA = await alice.crypto.requestDeviceVerification(bob.user.userId, bob.user.deviceId);
  const requestB = await waitUntil('incoming verification request', () => incomingRequest);
  await requestB.accept();
  await waitUntil('Alice SAS request ready', () => requestA.phase === VerificationPhase.Ready);
  const verifierA = await requestA.startVerification('m.sas.v1');
  const verifierB = await waitUntil('Bob SAS verifier', () => requestB.verifier);
  const completionA = verifierA.verify().then(() => ({ ok: true }), e => ({ ok: false, error: e.message }));
  const completionB = verifierB.verify().then(() => ({ ok: true }), e => ({ ok: false, error: e.message }));
  const sasA = await waitUntil('Alice SAS values', () => verifierA.getShowSasCallbacks());
  const sasB = await waitUntil('Bob SAS values', () => verifierB.getShowSasCallbacks());
  assert.ok(sasA.sas.emoji?.length === 7 || sasA.sas.decimal?.length === 3);
  assert.deepEqual(sasA.sas, sasB.sas);
  // For these two controlled synthetic endpoints only, compare the actual SAS output
  // before invoking the SDK confirmation callbacks. No mocked trust flags are used.
  report.sasValuesMatched = true;
  await Promise.all([sasA.confirm(), sasB.confirm()]);
  const completions = await Promise.all([completionA, completionB]);
  assert.ok(completions.every(result => result.ok), 'SAS verification did not complete');
  await waitUntil('Alice verifies Bob cross-signing and device', () => identityAndDeviceVerified(alice, bob));
  await waitUntil('Bob verifies Alice cross-signing and device', () => identityAndDeviceVerified(bob, alice));
  report.postVerificationGate = 'allowed';
  report.realSas = true;
  progress('Real SAS codes match on both clients; both cross-signing identities and devices are verified.');

  const plaintext = `SYNTHETIC-LOCAL-E2EE-${randomUUID()}`;
  assert.equal(await identityAndDeviceVerified(alice, bob), true);
  const { event_id: eventId } = await alice.client.sendTextMessage(roomId, plaintext);
  const raw = await api(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/event/${encodeURIComponent(eventId)}`, alice.user);
  assert.equal(raw.type, 'm.room.encrypted');
  assert.equal(raw.content.algorithm, 'm.megolm.v1.aes-sha2');
  assert.equal(typeof raw.content.ciphertext, 'string');
  assert.ok(raw.content.ciphertext.length > 32);
  assert.equal(JSON.stringify(raw).includes(plaintext), false);
  const received = await waitUntil('Bob receives encrypted event', () => bob.client.getRoom(roomId)?.findEventById(eventId));
  await bob.client.decryptEventIfNeeded(received);
  await waitUntil('Bob decrypts expected content', () => received.getContent()?.body === plaintext);
  assert.equal(received.getType(), 'm.room.message');
  report.ciphertextOnServer = true;
  report.serverEventType = raw.type;
  report.serverAlgorithm = raw.content.algorithm;
  report.serverCiphertextLength = raw.content.ciphertext.length;
  report.clientDecryptionMatches = true;
  report.plaintextSha256 = createHash('sha256').update(plaintext).digest('hex');
  report.roomId = roomId;
  report.eventId = eventId;
  await fs.writeFile(`${root}/synthetic-fixture.json`, JSON.stringify({ plaintext, roomId, eventId }, null, 2), { mode: 0o600 });
  progress('Server event is ciphertext only; recipient client decrypts the exact synthetic message.');
  report.success = true;
} catch (error) {
  report.success = false;
  report.error = { name: error.name, message: error.message };
  console.error('E2EE test failed:', error.name, error.message);
  process.exitCode = 1;
} finally {
  for (const client of clients) {
    try { await client.logout(true); } catch {}
    client.stopClient();
  }
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(`${root}/report.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log('Sanitized test report:', `${root}/report.json`);
  setTimeout(() => process.exit(process.exitCode || 0), 100);
}
