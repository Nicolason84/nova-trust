import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { filterEvents, validateContent } from '../taurino-core.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const proof = join(root, 'tests/jaime/taurine-p0');
const sourceDir = join(root, 'tools/jaime-secure/taurino-content');
const output = join(root, 'docs/jaime/data/taurino-content.json');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const current = json(join(sourceDir, 'research-learning.json'));
const before = json(join(proof, 'preimages/tools/jaime-secure/taurino-content/research-learning.json'));
const content = json(output);
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');

test('Canonical corpus validates with the bounded factual amendments', () => {
  assert.strictEqual(validateContent(content), content);
  assert.deepEqual(
    ['sources', 'lessons', 'glossary', 'ranches', 'events'].map(key => content[key].length),
    [51, 13, 48, 5, 8],
  );
  assert.equal(content.verifiedAt, before.verifiedAt, 'A limited review must not redatestamp the whole corpus.');
  assert.equal(content.asOfDate, '2026-10-30');
  assert.equal(Object.hasOwn(content, 'research'), false, 'This change does not expose or enable a research engine.');
});

test('Prior corpus records and known access caveats survive unchanged', () => {
  for (const key of ['lessons', 'quiz', 'debates', 'ranches', 'sources', 'researchRefs']) {
    assert.deepEqual(current[key].slice(0, before[key].length), before[key], key);
  }
  assert.deepEqual(current.glossary.filter(item => item.id !== 'T02'), before.glossary.filter(item => item.id !== 'T02'));
  for (const [key, value] of Object.entries(before)) {
    if (!['lessons', 'glossary', 'ranches', 'sources', 'researchRefs', 'sourceWordAudit'].includes(key)) {
      assert.deepEqual(current[key], value, key);
    }
  }
  const oldEvents = json(join(proof, 'preimages/tools/jaime-secure/taurino-content/research-events.json'));
  assert.deepEqual(content.events, oldEvents.events);
  assert.deepEqual(content.coverage, oldEvents.coverage);
  assert.ok(content.events.find(event => event.id === 'zafra-2026-10-04').discrepancies.length);
});

test('Preserved source preimages verify and unrelated builder, audio texts and validator are byte-identical', () => {
  const manifest = json(join(proof, 'preimages.json'));
  assert.equal(manifest.files.length, 8);
  const intendedChanges = new Set([
    'tools/jaime-secure/taurino-content/research-learning.json',
    'tools/jaime-secure/tests/taurino-core.test.mjs',
  ]);
  for (const entry of manifest.files) {
    assert.equal(sha256(join(proof, 'preimages', entry.path)), entry.sha256, entry.path);
    if (!intendedChanges.has(entry.path)) assert.equal(sha256(join(root, entry.path)), entry.sha256, entry.path);
  }
});

test('Grounding data distinguishes a selected population, historical castas and Miura dates', () => {
  const term = content.glossary.find(item => item.id === 'T02');
  assert.deepEqual(term.sourceIds, ['S33']);
  assert.match(term.definition, /Subpoblación de una raza/);
  assert.match(term.definition, /al menos cinco generaciones/);
  assert.match(term.editorialNote, /ni se define como descendencia de un único toro/i);
  const lesson = content.lessons.find(item => item.id === 'L13');
  const statement = lesson.paragraphs.find(item => item.kind === 'sourced');
  assert.deepEqual(statement.sourceIds, ['S34']);
  for (const name of ['Morucha Castellana', 'Jijona-Toros de la Tierra', 'Navarra', 'Cabrera', 'Gallardo', 'Vistahermosa', 'Vazqueña']) {
    assert.ok(statement.text.includes(name), name);
  }
  const ranch = content.ranches.find(item => item.id === 'R05');
  assert.deepEqual(ranch.sourceIds, ['S35', 'S36']);
  assert.match(ranch.attributedFact, /formación por Juan Miura en 1842/);
  assert.match(ranch.attributedFact, /antigüedad es el 30 de abril de 1849/);
  assert.ok(!/1854|1855/.test(ranch.attributedFact), 'Unresolved historical detail is not a corpus fact.');
  assert.ok(content.sources.filter(item => ['S33', 'S34', 'S35', 'S36'].includes(item.id)).every(item => item.retrievedOn === '2026-10-31' && item.accessNote));
});

test('Adjacent Madrid dates retain distinct participants, trophies and cited source', () => {
  const eleventh = filterEvents(content.events, { date: '2026-10-11', plaza: 'Las Ventas' });
  const twelfth = filterEvents(content.events, { date: '2026-10-12', plaza: 'Las Ventas' });
  assert.equal(eleventh.length, 1);
  assert.equal(twelfth.length, 1);
  assert.deepEqual(eleventh[0].cartel, ['Antonio Ferrera', 'Román']);
  assert.equal(eleventh[0].primarySourceId, 'ventas-20261011');
  assert.deepEqual(twelfth[0].cartel, ['Morante de la Puebla', 'Héctor Gutiérrez', 'Aarón Palacio']);
  assert.equal(twelfth[0].primarySourceId, 'ventas-20261012');
  assert.ok(eleventh[0].results.every(row => row.outcomes.filter(item => item.startsWith('oreja')).length === 2));
  assert.ok(twelfth[0].results.every(row => row.outcomes.every(item => !/oreja|rabo/i.test(item))));
  assert.ok([eleventh[0], twelfth[0]].every(event => event.videoViewed === false));
});

test('The 18-case model recipe is source-consistent and explicitly unexecuted', () => {
  const recipe = json(join(proof, 'recipe.json'));
  assert.equal(recipe.status, 'PENDING_REAL_MODEL_RECETTE');
  assert.equal(recipe.cases.length, 18);
  assert.equal(new Set(recipe.cases.map(item => item.id)).size, 18);
  assert.deepEqual(recipe.requiredProfileCapabilities, { research: false });
  assert.equal(recipe.actualModelTested, false);
  assert.equal(recipe.browserTested, false);
  assert.equal(recipe.physicalIphoneTested, false);
  const known = new Set(content.sources.map(item => item.id));
  for (const item of recipe.cases) {
    assert.equal(item.executionStatus, 'NOT_RUN');
    assert.deepEqual(item.executions, []);
    assert.ok(item.question && item.followUp && item.expected.length && item.forbidden.length);
    assert.ok(item.sourceIds.every(id => known.has(id)), item.id);
  }
  assert.ok(recipe.acceptanceMethod.modelRunRequired);
  assert.ok(recipe.acceptanceMethod.browserRunRequiredAfterAdmission);
});

test('Word attribution is fully recomputed and remains within the established source budget', () => {
  const auditor = join(proof, 'audit_source_words.py');
  for (const path of [join(sourceDir, 'research-learning.json'), join(proof, 'preimages/tools/jaime-secure/taurino-content/research-learning.json')]) {
    const result = spawnSync('python3', [auditor, '--source', path], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.maximumAttributedWords, 192);
    assert.equal(report.limitPerSource, 200);
    assert.equal(report.modelTested, false);
  }
  const receipt = json(join(proof, 'source-word-audit.json'));
  assert.equal(receipt.sourcesChecked, 29);
  assert.deepEqual(receipt.changes.map(item => [item.sourceId, item.before, item.after]), [
    ['S01', 164, 146], ['S33', null, 70], ['S34', null, 43], ['S35', null, 74], ['S36', null, 73],
  ]);
});

test('Existing offline builder reproduces the candidate bytes without another corpus', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'jaime-taurine-build-'));
  try {
    const rebuilt = join(temporary, 'taurino-content.json');
    const result = spawnSync('python3', [join(sourceDir, 'build-content.py'), '--output', rebuilt], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readFileSync(rebuilt), readFileSync(output));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
