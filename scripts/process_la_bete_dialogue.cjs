#!/usr/bin/env node
'use strict';
// Invoked once by the EXISTING Reality Pulse. Issues are data, never executable input.
const fs = require('node:fs');
const crypto = require('node:crypto');
const D = require('../docs/assets/la-bete-dialogue.js');
const REPO = 'Nicolason84/nova-trust';
const MARKER = '<!-- LA_BETE_DIALOGUE_V1';
function parseBody(body) {
  if (typeof body !== 'string' || body.length > 12000) throw Error('INPUT_SIZE');
  const match = body.match(/```json\s*\n([\s\S]*?)\n```/);
  if (match && body.includes(MARKER)) {
    const p = JSON.parse(match[1]);
    if (p.schema !== D.VERSION || typeof p.text !== 'string' || p.text.length > D.MAX_INPUT) throw Error('INPUT_SCHEMA');
    return {text: p.text, kind: ['IDEA','POLICY','QUESTION'].includes(p.kind) ? p.kind : 'QUESTION'};
  }
  if (body.length > D.MAX_INPUT) throw Error('INPUT_SIZE');
  return {text: body.trim(), kind: 'QUESTION'};
}
function messageBody(r, marker) {
  const lines = [marker, '### La Bête · réponse structurée', '', '**Mode : règles locales partagées, sans modèle de langage ni recherche web nouvelle.**', '', r.summary];
  for (const [title, values] of [['Retenu pour examen', r.retained], ['Limites / pourquoi ce n’est pas adopté', r.limits], ['Évolution proposée', r.evolution]]) {
    if (values?.length) lines.push('', '**' + title + '**', ...values.map(x => '- ' + x));
  }
  if (r.next) lines.push('', '**Prochaine étape**', r.next);
  if (r.references?.length) lines.push('', '**Sources du contexte chargé — vérifier dates et périmètres**', ...r.references.map(x => '- [' + String(x.label).replace(/[\[\]]/g, '') + '](' + x.url + ') · ' + x.status + ' · contrôle : ' + (x.checked_at || 'non renseigné')));
  lines.push('', '`' + r.status + '` · **Aucune adoption, modification du système ni action administrative exécutée.**', '', 'Vous pouvez préciser votre idée dans un commentaire. Le fil est partagé ; aucune pièce privée, coordonnée ni identifiant. Les choix politiques restent ceux des personnes.');
  return lines.join('\n');
}
async function processIssue(issue, comments, api, context) {
  if (issue.pull_request || !/^\[LA B[ÊE]TE\]/i.test(issue.title || '') || issue.state !== 'open') return {status: 'SKIP'};
  const human = comments.filter(c => c.user?.type !== 'Bot' && !/\[bot\]$/.test(c.user?.login || '') && !c.body?.startsWith('<!-- LA_BETE_TEST_CONTROL'));
  const last = human.at(-1);
  const input = last ? last.body : issue.body;
  const hash = crypto.createHash('sha256').update(D.VERSION + '|' + issue.number + '|' + (last?.id || 'root') + '|' + String(input)).digest('hex').slice(0, 32);
  const marker = '<!-- LA_BETE_DIALOGUE_V1:' + hash + ' -->';
  if (comments.some(c => c.user?.login === 'github-actions[bot]' && c.user?.type === 'Bot' && String(c.body).includes(marker))) return {status: 'ALREADY_REPLIED', issue: issue.number};
  let payload, root;
  try { payload = parseBody(input); root = parseBody(issue.body || ''); }
  catch (_) { payload = {text: '', kind: 'QUESTION'}; }
  const history = root && root.kind === 'IDEA' ? [root] : [];
  const result = D.analyze(payload.text, {...context, kind: payload.kind, history});
  // No user-supplied URLs are fetched; only canonical source URLs can be linked.
  const receipt = await api('POST', '/issues/' + Number(issue.number) + '/comments', {body: messageBody(result, marker)});
  if (!receipt?.id || !receipt?.html_url) throw Error('NO_COMMENT_RECEIPT');
  return {status: 'REPLIED', issue: issue.number, comment_id: receipt.id, classification: result.status};
}
async function main() {
  if ((process.env.GITHUB_REPOSITORY || '').toLowerCase() !== REPO.toLowerCase()) throw Error('REPOSITORY_BINDING_REQUIRED');
  if (!process.env.GH_TOKEN) throw Error('GITHUB_TOKEN_REQUIRED');
  async function api(method, path, body) {
    if (!/^\/issues(?:[/?]|$)/.test(path)) throw Error('API_PATH_NOT_ALLOWED');
    const response = await fetch('https://api.github.com/repos/' + REPO + path, {
      method, headers: {Authorization: 'Bearer ' + process.env.GH_TOKEN, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28'},
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000), redirect: 'error'
    });
    if (!response.ok) throw Error('GITHUB_HTTP_' + response.status);
    return response.json();
  }
  const context = {live: JSON.parse(fs.readFileSync('docs/data/france-debt-rate-live.json', 'utf8')), evolution: JSON.parse(fs.readFileSync('docs/data/france-debt-rate-evolution.json', 'utf8'))};
  let replied = 0, failures = 0, inspected = 0;
  for (let page = 1; page <= 2 && replied < 5; page++) {
    const issues = await api('GET', '/issues?state=open&sort=updated&direction=desc&per_page=50&page=' + page);
    for (const issue of issues) {
      if (replied >= 5 || inspected >= 15) break;
      if (issue.pull_request || !/^\[LA B[ÊE]TE\]/i.test(issue.title || '')) continue;
      inspected++;
      try {
        const count = Number(issue.comments || 0);
        const pages = Math.max(1, Math.ceil(count / 100));
        const comments = await api('GET', '/issues/' + issue.number + '/comments?per_page=100&page=' + pages);
        const receipt = await processIssue(issue, comments, api, context);
        console.log(JSON.stringify(receipt));
        if (receipt.status === 'REPLIED') replied++;
      } catch (error) { failures++; console.error(JSON.stringify({status: 'ISSUE_PROCESSING_FAILED', issue: issue.number, reason: String(error.message).slice(0, 80)})); }
    }
    if (issues.length < 50 || inspected >= 15) break;
  }
  console.log(JSON.stringify({status: failures ? 'COMPLETED_WITH_ERRORS' : 'COMPLETE', inspected, replied, failures, same_existing_pulse: true}));
  if (failures) process.exitCode = 1;
}
module.exports = {parseBody, messageBody, processIssue};
if (require.main === module) main().catch(error => { console.error('DIALOGUE_BLOCKED', String(error.message).slice(0, 100)); process.exitCode = 1; });
