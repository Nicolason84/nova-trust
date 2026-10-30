import test from 'node:test';
import assert from 'node:assert/strict';
import {sealSession,openSession,safeHomeserver,validatePhrase} from '../session-vault.mjs';

const phrase = 'cuatro palabras largas diferentes 123';
const sample = {homeserverUrl:'https://matrix.example.test',userId:'@test:example.test',deviceId:'TESTDEVICE',accessToken:'synthetic-test-token-only'};
test('local envelope encrypts credentials and authenticates their recovery', async () => {
  const sealed = await sealSession(sample,phrase);
  for (const value of Object.values(sample)) assert.ok(!JSON.stringify(sealed).includes(value));
  assert.deepEqual(await openSession(sealed,phrase),sample);
  const second = await sealSession(sample,phrase);
  assert.notEqual(sealed.salt,second.salt);
  assert.notEqual(sealed.iv,second.iv);
  assert.notEqual(sealed.ciphertext,second.ciphertext);
});
test('wrong phrase, tampered ciphertext and KDF downgrade cannot unlock', async () => {
  const sealed = await sealSession(sample,phrase);
  await assert.rejects(openSession(sealed,'otra frase larga que no coincide'),/VAULT_LOCKED/);
  const bytes = Buffer.from(sealed.ciphertext,'base64'); bytes[5] ^= 1;
  await assert.rejects(openSession({...sealed,ciphertext:bytes.toString('base64')},phrase),/VAULT_LOCKED/);
  await assert.rejects(openSession({...sealed,iterations:1},phrase),/VAULT_FORMAT/);
  await assert.rejects(openSession({...sealed,version:2},phrase),/VAULT_FORMAT/);
});
test('short phrases and credential-bearing, insecure or ambiguous URLs fail before storage', async () => {
  assert.throws(() => validatePhrase('123456'),/VAULT_PHRASE/);
  for (const url of ['http://matrix.example.test','https://user:password@matrix.example.test','https://matrix.example.test/#token','https://matrix.example.test/?token=x']) assert.throws(() => safeHomeserver(url));
  await assert.rejects(sealSession({...sample,userId:'invalid'},phrase),/VAULT_PAYLOAD/);
});
