'use strict';
// Bounded source-level reproduction. Header tuples are synthetic: this does
// not claim to be a capture of the original private Cloudflare return.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ownerPath = process.env.JAIME_OWNER_SOURCE;
if (!ownerPath) throw new Error('JAIME_OWNER_SOURCE required');
const source = fs.readFileSync(ownerPath, 'utf8');
const entry = source.split('\n').find(line => line.includes("const entry=req.method==='GET'"));
const rejection = source.split('\n').find(line => line.includes("return deny(403,'JAIME_BROWSER_AUTHORITY_REJECTED')"));
assert(entry && rejection, 'Exact existing owner predicate is required');
const condition = rejection.trim().replace(/^if\(/, '').replace(/\)return deny\(403,'JAIME_BROWSER_AUTHORITY_REJECTED'\);$/, '');
const rejects = new Function('req', 'c', 'count', `${entry}\nreturn (${condition});`);
const count = (req, name) => req.rawHeaders.reduce((n, value, i) => n + (i % 2 === 0 && value.toLowerCase() === name ? 1 : 0), 0);
const tuples = [
  ['original_navigation', 'cross-site', 'navigate', 'document', false],
  ['service_worker_passthrough', 'cross-site', 'navigate', 'empty', true],
  ['fresh_address_bar_tab', 'none', 'navigate', 'empty', false],
  ['direct_tab_reload_same_origin', 'same-origin', 'navigate', 'empty', false],
  ['cross_site_fetch_still_denied', 'cross-site', 'cors', 'empty', true],
];
const cases = tuples.map(([name, site, mode, dest, expected]) => {
  const headers = { 'sec-fetch-site': site, 'sec-fetch-mode': mode, 'sec-fetch-dest': dest };
  const req = { method: 'GET', headers, rawHeaders: Object.entries(headers).flat() };
  const authorityRejected = !!rejects(req, { publicOrigin: 'https://jaime.example.test' }, count);
  assert.equal(authorityRejected, expected, name);
  return { name, headers, authority_rejected: authorityRejected, expected, pass: true };
});
const result = {
  schema: 'JAIME_AUTHORITY_PREDICATE_SYNTHETIC_PROOF_V1',
  at: new Date().toISOString(),
  executed_by: 'GPT_isolated_scratch',
  original_private_incident_headers_captured: false,
  real_authentication_tested: false,
  owner_source_sha256: crypto.createHash('sha256').update(source).digest('hex'),
  cases,
};
const json = `${JSON.stringify(result, null, 2)}\n`;
process.stdout.write(json);
if (process.env.JAIME_PREDICATE_EVIDENCE) fs.writeFileSync(process.env.JAIME_PREDICATE_EVIDENCE, json, { flag: 'wx', mode: 0o600 });
