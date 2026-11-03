import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeText, filterEvents, safeHttpsUrl, publicSourceSearch, loadProgress, saveProgress, validateContent, validateFeed } from '../taurino-core.mjs';

const allowed = { learned: new Set(['L01', 'L02']), favorites: ['L01', 'D01', 'madrid-2026-10-11'] };
const makeStorage = initial => {
  const values = new Map(initial === undefined ? [] : [['progress', initial]]);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
};
const hasCode = code => error => error instanceof Error && error.code === code;
const eventFixture = [
  { id: 'a', date: '2026-10-11', city: 'Madrid', plaza: 'Las Ventas', cartel: ['Antonio Ferrera', 'Román'] },
  { id: 'b', date: '2026-10-04', city: 'Madrid', plaza: 'Las Ventas', cartel: ['Paco Ureña'] },
  { id: 'c', date: '2026-09-26', city: 'Sevilla', plaza: 'Maestranza', cartel: ['Pablo Aguado'] },
];
let cachedContent;
function builtContent() {
  if (cachedContent) return structuredClone(cachedContent);
  const candidates = ['../../app/dist/data/taurino-content.json', '../../../docs/jaime/data/taurino-content.json'].map(relative => fileURLToPath(new URL(relative, import.meta.url)));
  const path = candidates.find(existsSync);
  assert.ok(path, 'Build the reviewed taurino-content.json with build-content.py before running content contract tests.');
  cachedContent = JSON.parse(readFileSync(path, 'utf8'));
  return structuredClone(cachedContent);
}
function feedFixture() {
  return {
    schemaVersion: 1, generatedAtUtc: '2026-10-30T12:00:00Z',
    coverage: { type: 'source_links', isLive: false, includesCorridaSummaries: false, noteEs: 'Enlaces oficiales, sin crónicas automáticas.' },
    sources: [
      { id: 'rtve-clarin', name: 'Clarín · RTVE', url: 'https://api.rtve.es/api/programas/1907/audios.rss', status: 'ok', lastSuccessAt: '2026-10-30T12:00:00Z', errorCode: null },
      { id: 'real-maestranza', name: 'Real Maestranza de Sevilla', url: 'https://www.realmaestranza.com/feed/', status: 'stale', lastSuccessAt: '2026-10-29T12:00:00Z', errorCode: 'TIMEOUT' },
      { id: 'zafra', name: 'Ayuntamiento de Zafra', url: 'https://zafra.es/feed/', status: 'failed', lastSuccessAt: null, errorCode: 'NETWORK_ERROR' },
    ],
    items: [
      { id: 'item-1', sourceId: 'rtve-clarin', kind: 'podcast', date: '2026-10-25T22:48:04Z', url: 'https://www.rtve.es/play/audios/clarin/temporada/17282892/', label: 'Clarín · 25 octubre', topics: ['Temporada'] },
      { id: 'item-2', sourceId: 'real-maestranza', kind: 'institutional', date: '2026-10-29T12:00:00Z', url: 'https://www.realmaestranza.com/patrimonio/', label: 'Patrimonio · Sevilla', topics: ['Patrimonio'] },
    ],
  };
}

test('Accent-insensitive filters retain exact dates and preserve source order', () => {
  assert.equal(normalizeText('  UREÑA  y   Román '), 'urena y roman');
  assert.equal(normalizeText(null), '');
  const before = structuredClone(eventFixture);
  assert.deepEqual(filterEvents(eventFixture, { plaza: 'MADRID', torero: 'romAn', date: '2026-10-11' }).map(e => e.id), ['a']);
  assert.deepEqual(filterEvents(eventFixture, { torero: 'urena' }).map(e => e.id), ['b']);
  assert.deepEqual(filterEvents(eventFixture, { date: '2026-02-30' }), []);
  assert.deepEqual(filterEvents(eventFixture, { date: '2026-10' }), []);
  assert.deepEqual(filterEvents(eventFixture, {}).map(e => e.id), ['a', 'b', 'c']);
  assert.deepEqual(eventFixture, before);
});

test('Only absolute HTTPS URLs without credentials or control characters survive', () => {
  assert.equal(safeHttpsUrl('HTTPS://Example.COM:443/a#b'), 'https://example.com/a#b');
  for (const value of ['javascript:alert(1)', 'http://example.com/', '//example.com/', 'https://user:secret@example.com/', 'https://@example.com/', 'https://example.com/\npath', 'https://example.com/%0afoo', 'https://example.com\\@evil.test/', 'https://' + 'a'.repeat(2050), null]) assert.equal(safeHttpsUrl(value), null);
});

test('Public search never reads or exports a free question and bounds filters', () => {
  const input = { plaza: 'Las Ventas', date: '2026-10-11', torero: 'Román', privateNote: 'PRIVATE_SENTINEL' };
  Object.defineProperty(input, 'question', { get() { throw new Error('Question must never be accessed'); } });
  const links = publicSourceSearch(input);
  assert.equal(links.length, 3);
  assert.ok(links.every(item => new URL(item.url).hostname === 'www.google.com'));
  assert.ok(links.every(item => !decodeURIComponent(item.url).includes('PRIVATE_SENTINEL')));
  assert.match(new URL(links[1].url).searchParams.get('q'), /^site:las-ventas\.com /);
  assert.match(new URL(links[2].url).searchParams.get('q'), /^site:lancesmaestranza\.com /);
  for (const filters of [{}, { question: 'private' }, { plaza: 'a'.repeat(121) }, { plaza: 'site:evil.test' }, { date: '2026-02-30' }]) assert.deepEqual(publicSourceSearch(filters), []);
});

test('Progress load recovers only allowed unique IDs from bounded storage', () => {
  const storage = makeStorage(JSON.stringify({ learned: ['L01', 'L01', 'D01', 8], favorites: ['madrid-2026-10-11', 'unknown', 'D01'], question: 'private' }));
  assert.deepEqual(loadProgress(storage, 'progress', allowed), { learned: ['L01'], favorites: ['madrid-2026-10-11', 'D01'] });
  for (const raw of ['{broken', ' '.repeat(17000), 'null', '{"learned":{},"favorites":[]}']) assert.deepEqual(loadProgress(makeStorage(raw), 'progress', allowed), { learned: [], favorites: [] });
  assert.deepEqual(loadProgress({ getItem() { throw new Error('blocked'); } }, 'progress', allowed), { learned: [], favorites: [] });
  assert.deepEqual(loadProgress(storage, 'progress', null), { learned: [], favorites: [] });
});

test('Progress save never persists prose and reports actual storage failure', () => {
  const storage = makeStorage();
  assert.equal(saveProgress(storage, 'progress', { learned: ['L02', 'L02'], favorites: ['D01', 'bad'], note: 'PRIVATE_SENTINEL' }, allowed), true);
  assert.deepEqual(JSON.parse(storage.values.get('progress')), { learned: ['L02'], favorites: ['D01'] });
  assert.ok(!storage.values.get('progress').includes('PRIVATE_SENTINEL'));
  assert.equal(saveProgress({ getItem: () => null, setItem() {} }, 'progress', { learned: [], favorites: [] }, allowed), false);
  assert.equal(saveProgress({ getItem: () => null, setItem() { throw new Error('quota'); } }, 'progress', { learned: [], favorites: [] }, allowed), false);
  assert.equal(saveProgress(storage, 'progress', { learned: 'L01', favorites: [] }, allowed), false);
});

test('Real assembled content preserves source caveats, discrepancies and local episodes', () => {
  const data = builtContent();
  assert.strictEqual(validateContent(data), data);
  assert.equal(data.events.length, 8);
  assert.equal(data.lessons.length, 12);
  assert.equal(data.episodes[0].durationSeconds, 186.502676);
  assert.equal(data.episodes[1].durationSeconds, 205.078639);
  assert.deepEqual(data.episodes[1].sourceIds, ['ventas-20261011']);
  assert.equal(data.episodes[1].eventId, 'madrid-2026-10-11');
  assert.deepEqual(data.episodes[0].sourceIds, []);
  assert.ok(data.episodes.every(episode => episode.transcript.length > 1000));
  assert.ok(data.events.find(event => event.id === 'zafra-2026-10-04').discrepancies.length);
  assert.ok(data.sources.find(source => source.id === 'S15').caveat);
  for (const technical of ['research', 'researchRefs', 'sourceWordAudit']) assert.ok(!Object.hasOwn(data, technical));
  assert.ok(data.refreshSources.every(source => !Object.hasOwn(source, 'observation')));
});

test('Content rejects invalid calendars and missing or dangling references at every depth', () => {
  for (const change of [
    data => { data.events[0].date = '2026-02-30'; },
    data => { data.episodes[0].date = '2026-13-01'; },
    data => { data.sources[0].publicationDate = '2025-02-29'; },
  ]) { const data = builtContent(); change(data); assert.throws(() => validateContent(data), hasCode('CONTENT_DATE')); }
  for (const change of [
    data => { delete data.glossary[0].sourceIds; },
    data => { data.lessons[0].paragraphs[0].sourceIds = []; },
    data => { data.debates[0].evidence[0].sourceIds = ['missing']; },
    data => { data.events.find(event => event.id === 'zafra-2026-10-04').discrepancies[0].values[0].sourceId = 'missing'; },
  ]) { const data = builtContent(); change(data); assert.throws(() => validateContent(data), hasCode('CONTENT_SOURCE_REFERENCE')); }
});

test('Content refuses external or ambiguous audio, duplicates and oversized data', () => {
  for (const src of ['https://www.rtve.es/a.mp3', '//example.com/a.mp3', 'audio/taurino/../a.mp3', 'audio/taurino/%2e%2e/a.mp3', 'audio/taurino/a.mp3?token=secret']) {
    const data = builtContent(); data.episodes[0].src = src;
    assert.throws(() => validateContent(data), hasCode('CONTENT_AUDIO_PATH'));
  }
  const duplicate = builtContent(); duplicate.events.push(duplicate.events[0]);
  assert.throws(() => validateContent(duplicate), hasCode('CONTENT_EVENTS'));
  const oversized = builtContent(); oversized.extra = 'x'.repeat(2 * 1024 * 1024);
  assert.throws(() => validateContent(oversized), hasCode('CONTENT_INVALID_SIZE'));
  const unknownDuration = builtContent(); unknownDuration.episodes[0].durationSeconds = null;
  assert.equal(validateContent(unknownDuration).episodes[0].durationSeconds, null);
  const wrongEvent = builtContent(); wrongEvent.episodes[1].eventId = 'missing';
  assert.throws(() => validateContent(wrongEvent), hasCode('CONTENT_EPISODE_EVENT'));
  const badLink = builtContent(); badLink.events[0].video.url = 'javascript:alert(1)';
  assert.throws(() => validateContent(badLink), hasCode('CONTENT_URL'));
});

test('Feed retains honest stale/failed status while accepting official metadata links', () => {
  const feed = feedFixture();
  feed.items[1].topics = [];
  assert.strictEqual(validateFeed(feed), feed);
  assert.equal(feed.sources[1].status, 'stale');
  assert.equal(feed.sources[2].lastSuccessAt, null);
  const falseFreshness = feedFixture(); falseFreshness.sources[1].status = 'ok';
  assert.throws(() => validateFeed(falseFreshness), hasCode('FEED_STATUS'));
  const candidates = ['../../app/dist/data/taurino-feed.json', '../../../docs/jaime/data/taurino-feed.json'].map(relative => fileURLToPath(new URL(relative, import.meta.url)));
  const snapshot = candidates.find(existsSync);
  if (snapshot) {
    const actual = JSON.parse(readFileSync(snapshot, 'utf8'));
    assert.strictEqual(validateFeed(actual), actual, 'The real refresh pipeline snapshot must satisfy the browser contract.');
  }
});

test('Feed rejects lookalike hosts, credentials, wrong source links and audio enclosures', () => {
  for (const url of ['https://www.rtve.es.evil.test/play/audios/clarin/a/', 'https://name@www.rtve.es/play/audios/clarin/a/', 'https://www.realmaestranza.com/article/', 'https://www.rtve.es/play/audios/clarin/a/?redirect=evil', 'https://www.rtve.es/play/audios/clarin/a.mp3']) {
    const feed = feedFixture(); feed.items[0].url = url;
    assert.throws(() => validateFeed(feed), hasCode('FEED_ITEM_URL'));
  }
  const injected = feedFixture(); injected.items[0].enclosure = 'https://example.com/a.mp3';
  assert.throws(() => validateFeed(injected), hasCode('FEED_ITEM_URL'));
  const unknown = feedFixture(); unknown.sources[0].id = 'constructor';
  assert.throws(() => validateFeed(unknown), hasCode('FEED_SOURCE_URL'));
});

test('Feed bounds items and requires coherent real dates rather than rolled-over timestamps', () => {
  for (const date of ['2026-02-30T12:00:00Z', '2026-10-25T24:00:00Z', '2026-10-25T12:00:00', '2026-11-01T12:00:00Z']) {
    const feed = feedFixture(); feed.items[0].date = date;
    assert.throws(() => validateFeed(feed), hasCode('FEED_DATE'));
  }
  const excess = feedFixture(); excess.items = Array.from({ length: 21 }, (_, i) => ({ ...excess.items[0], id: `item-${i}`, url: `https://www.rtve.es/play/audios/clarin/item-${i}/` }));
  assert.throws(() => validateFeed(excess), hasCode('FEED_ITEMS'));
  const missingSource = feedFixture(); missingSource.items[0].sourceId = 'unknown';
  assert.throws(() => validateFeed(missingSource), hasCode('FEED_SOURCE_REFERENCE'));
  const falseLive = feedFixture(); falseLive.coverage.isLive = true;
  assert.throws(() => validateFeed(falseLive), hasCode('FEED_COVERAGE'));
});
