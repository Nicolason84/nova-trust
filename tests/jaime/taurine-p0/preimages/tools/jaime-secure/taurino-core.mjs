/** Pure helpers for El tendido. No network, DOM, AI, or private-note access. */

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MAX_PROGRESS = 16 * 1024;
const MAX_IDS = 1000;
const SOURCE_KEYS = new Set(['sourceId', 'primarySourceId', 'linkedBySourceId', 'sourcePageId']);
const FEED_SOURCES = Object.freeze({
  __proto__: null,
  'rtve-clarin': { hosts: ['rtve.es', 'www.rtve.es'], feedHosts: ['api.rtve.es', 'www.rtve.es'], feedPath: '/api/programas/1907/audios.rss', prefix: '/play/audios/clarin/', kind: 'podcast' },
  'real-maestranza': { hosts: ['realmaestranza.com', 'www.realmaestranza.com'], feedHosts: ['realmaestranza.com', 'www.realmaestranza.com'], feedPath: '/feed/', prefix: '/', kind: 'institutional' },
  zafra: { hosts: ['zafra.es', 'www.zafra.es'], feedHosts: ['zafra.es', 'www.zafra.es'], feedPath: '/feed/', prefix: '/', kind: 'institutional' },
});
const TOPICS = new Set(['Perú', 'México', 'Ecuador', 'Francia', 'Madrid', 'Sevilla', 'Extremadura', 'Ganaderías', 'Temporada', 'Ferias', 'Indultos', 'Escuelas', 'Entrevistas', 'Debate', 'Literatura', 'Patrimonio', 'Cultura', 'Tauromaquia', 'Actualidad taurina']);

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)); }
function text(value, max, allowEmpty = false) { return typeof value === 'string' && value.length <= max && !value.includes('\0') && (allowEmpty || value.trim().length > 0); }
function validId(value) { return typeof value === 'string' && ID.test(value); }
function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
function utcTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) || !dateOnly(value.slice(0, 10))) return null;
  if (+value.slice(11, 13) > 23 || +value.slice(14, 16) > 59 || +value.slice(17, 19) > 59) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

export function normalizeText(value) {
  return typeof value === 'string' ? value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/gu, ' ').trim() : '';
}

/** Date is exact; plaza also matches city. Empty filters leave the order intact. */
export function filterEvents(events, filters = {}) {
  if (!Array.isArray(events) || !record(filters)) return [];
  const date = typeof filters.date === 'string' ? filters.date.trim() : '';
  if (date && !dateOnly(date)) return [];
  const plaza = normalizeText(filters.plaza), torero = normalizeText(filters.torero);
  return events.filter(event => {
    if (!record(event) || (date && event.date !== date)) return false;
    if (plaza && !normalizeText(`${event.plaza ?? ''} ${event.city ?? ''}`).includes(plaza)) return false;
    if (!torero) return true;
    const names = [...(Array.isArray(event.cartel) ? event.cartel : []), ...(Array.isArray(event.results) ? event.results.map(result => result?.torero) : [])];
    return names.some(name => normalizeText(name).includes(torero));
  });
}

/** Absolute HTTPS links only. This does not vouch for a destination's content. */
export function safeHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || !/^https:\/\//i.test(value) || /[\u0000-\u0020\u007f\\]/u.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || value.split('/')[2]?.includes('@')) return null;
    return url.href;
  } catch { return null; }
}

function publicFilter(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.length > 120 || !/^[\p{L}\p{N} .,'’()\-]+$/u.test(value)) return null;
  return value.trim().replace(/ +/g, ' ');
}

/** Intentionally never reads a free question, note, or any other property. */
export function publicSourceSearch(filters = {}) {
  if (!record(filters)) return [];
  const plaza = publicFilter(filters.plaza), torero = publicFilter(filters.torero);
  const date = filters.date === undefined || filters.date === '' ? '' : filters.date;
  if (plaza === null || torero === null || (date !== '' && !dateOnly(date)) || !(plaza || date || torero)) return [];
  const query = ['corrida de toros resultados', plaza, date, torero].filter(Boolean).join(' ');
  return [['Buscar en Google', ''], ['Buscar en Las Ventas', 'site:las-ventas.com '], ['Buscar en Lances Maestranza', 'site:lancesmaestranza.com ']].map(([label, prefix]) => {
    const url = new URL('https://www.google.com/search');
    url.searchParams.set('q', prefix + query);
    return { label, url: url.href };
  });
}

function emptyProgress() { return { learned: [], favorites: [] }; }
function keyValid(key) { return typeof key === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(key); }
function allowSets(allowedIds) {
  if (!record(allowedIds)) return null;
  const result = {};
  for (const field of ['learned', 'favorites']) {
    const list = allowedIds[field];
    if (!(Array.isArray(list) || list instanceof Set) || (list.size ?? list.length) > MAX_IDS) return null;
    const values = Array.from(list);
    if (!values.every(validId)) return null;
    result[field] = new Set(values);
  }
  return result;
}
function cleanProgress(state, allowed) {
  if (!record(state) || !allowed) return null;
  const clean = emptyProgress();
  for (const field of ['learned', 'favorites']) {
    if (!Array.isArray(state[field]) || state[field].length > MAX_IDS) return null;
    clean[field] = [...new Set(state[field].filter(id => validId(id) && allowed[field].has(id)))];
  }
  return clean;
}

/** allowedIds: {learned: Array|Set, favorites: Array|Set}; state arrays contain raw IDs only. */
export function loadProgress(storage, key, allowedIds) {
  try {
    if (!keyValid(key) || typeof storage?.getItem !== 'function') return emptyProgress();
    const raw = storage.getItem(key);
    if (typeof raw !== 'string' || raw.length > MAX_PROGRESS) return emptyProgress();
    return cleanProgress(JSON.parse(raw), allowSets(allowedIds)) ?? emptyProgress();
  } catch { return emptyProgress(); }
}

/** Writes only IDs; a successful write must be confirmed by an identical read. */
export function saveProgress(storage, key, state, allowedIds) {
  try {
    if (!keyValid(key) || typeof storage?.setItem !== 'function' || typeof storage?.getItem !== 'function') return false;
    const clean = cleanProgress(state, allowSets(allowedIds));
    if (!clean) return false;
    const raw = JSON.stringify(clean);
    if (raw.length > MAX_PROGRESS) return false;
    storage.setItem(key, raw);
    return storage.getItem(key) === raw;
  } catch { return false; }
}

function boundedDocument(value, maxBytes, code) {
  if (!record(value)) fail(code);
  let serialized;
  try { serialized = JSON.stringify(value); } catch { fail(code); }
  if (serialized.length > maxBytes || new TextEncoder().encode(serialized).length > maxBytes) fail(`${code}_SIZE`);
  let nodes = 0;
  function walk(node, depth = 0) {
    if (++nodes > 30000 || depth > 20) fail(`${code}_COMPLEXITY`);
    if (node === null || typeof node === 'boolean' || typeof node === 'string') return;
    if (typeof node === 'number') { if (!Number.isFinite(node)) fail(code); return; }
    if (Array.isArray(node)) { for (const item of node) walk(item, depth + 1); return; }
    if (!record(node)) fail(code);
    for (const [key, item] of Object.entries(node)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) fail(code);
      walk(item, depth + 1);
    }
  }
  walk(value);
}
function records(value, max, code) {
  if (!Array.isArray(value) || value.length > max) fail(code);
  const seen = new Set();
  for (const item of value) {
    if (!record(item) || !validId(item.id) || seen.has(item.id)) fail(code);
    seen.add(item.id);
  }
  return seen;
}
function refs(value, sourceIds, nonempty = false) {
  if (!Array.isArray(value) || value.length > 30 || (nonempty && !value.length) || new Set(value).size !== value.length || value.some(id => !sourceIds.has(id))) fail('CONTENT_SOURCE_REFERENCE');
}

/** Validates before rendering. Text must still be assigned via textContent, never innerHTML. */
export function validateContent(data) {
  boundedDocument(data, 2 * 1024 * 1024, 'CONTENT_INVALID');
  if (data.schemaVersion !== 1 || data.language !== 'es') fail('CONTENT_SCHEMA');
  if (!dateOnly(data.asOfDate) || !dateOnly(data.verifiedAt)) fail('CONTENT_DATE');
  const sourceIds = records(data.sources, 200, 'CONTENT_SOURCES');
  if (!sourceIds.size) fail('CONTENT_SOURCES');
  for (const source of data.sources) {
    if (!safeHttpsUrl(source.url) || !text(source.title ?? source.label, 500)) fail('CONTENT_SOURCE_URL');
    for (const key of ['publicationDate', 'updatedDate', 'retrievedOn', 'observedOn']) if (source[key] != null && !dateOnly(source[key])) fail('CONTENT_DATE');
  }
  const eventIds = records(data.events, 500, 'CONTENT_EVENTS');
  const lessonIds = records(data.lessons, 100, 'CONTENT_LESSONS');
  records(data.glossary, 300, 'CONTENT_GLOSSARY');
  records(data.quiz, 100, 'CONTENT_QUIZ');
  const debateIds = records(data.debates, 50, 'CONTENT_DEBATES');
  records(data.ranches, 100, 'CONTENT_RANCHES');
  records(data.episodes, 30, 'CONTENT_EPISODES');
  if (new Set([...eventIds, ...lessonIds, ...debateIds]).size !== eventIds.size + lessonIds.size + debateIds.size) fail('CONTENT_DUPLICATE_ID');
  for (const event of data.events) {
    if (!dateOnly(event.date) || event.date > data.asOfDate) fail('CONTENT_DATE');
    if (!text(event.plaza, 300) || !text(event.city, 200) || !Array.isArray(event.cartel) || event.cartel.length > 30 || !event.cartel.every(name => text(name, 200))) fail('CONTENT_EVENT');
    refs(event.sourceIds, sourceIds, true);
    if (!sourceIds.has(event.primarySourceId) || !event.sourceIds.includes(event.primarySourceId)) fail('CONTENT_SOURCE_REFERENCE');
  }
  for (const lesson of data.lessons) {
    if (!text(lesson.title, 300) || !Array.isArray(lesson.paragraphs) || !lesson.paragraphs.length || lesson.paragraphs.length > 20) fail('CONTENT_LESSON');
    refs(lesson.sourceIds, sourceIds, true);
    for (const paragraph of lesson.paragraphs) {
      if (!record(paragraph) || !['sourced', 'editorial'].includes(paragraph.kind) || !text(paragraph.text, 6000)) fail('CONTENT_LESSON');
      refs(paragraph.sourceIds, sourceIds, paragraph.kind === 'sourced');
    }
  }
  for (const entry of data.glossary) {
    if (!text(entry.term, 300) || !text(entry.definition, 3000)) fail('CONTENT_GLOSSARY');
    refs(entry.sourceIds, sourceIds, true);
  }
  for (const question of data.quiz) {
    if (!lessonIds.has(question.lessonId) || !text(question.question, 2000) || !text(question.explanation, 4000) || !Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6 || !question.options.every(option => text(option, 1000)) || !Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= question.options.length) fail('CONTENT_QUIZ');
    refs(question.sourceIds, sourceIds, true);
  }
  for (const debate of data.debates) {
    if (!['title', 'claim', 'counterargument', 'nuance', 'question'].every(key => text(debate[key], 6000)) || !Array.isArray(debate.evidence) || !debate.evidence.length || debate.evidence.length > 20) fail('CONTENT_DEBATE');
    refs(debate.sourceIds, sourceIds, true);
    for (const evidence of debate.evidence) {
      if (!record(evidence) || !text(evidence.text, 6000)) fail('CONTENT_DEBATE');
      refs(evidence.sourceIds, sourceIds, true);
    }
  }
  for (const ranch of data.ranches) {
    if (!['name', 'region', 'declaredLineage', 'attributedFact', 'observationQuestion'].every(key => text(ranch[key], 3000))) fail('CONTENT_RANCH');
    refs(ranch.sourceIds, sourceIds, true);
  }
  for (const episode of data.episodes) {
    if (episode.eventId !== undefined && !eventIds.has(episode.eventId)) fail('CONTENT_EPISODE_EVENT');
    if (!text(episode.title, 300) || !text(episode.summary, 3000) || !text(episode.transcript, 60000)) fail('CONTENT_EPISODE');
    if (typeof episode.src !== 'string' || !/^audio\/taurino\/[a-z0-9][a-z0-9._-]{0,95}\.mp3$/.test(episode.src) || episode.src.includes('..')) fail('CONTENT_AUDIO_PATH');
    if (!dateOnly(episode.date)) fail('CONTENT_DATE');
    if (episode.durationSeconds !== null && (!Number.isFinite(episode.durationSeconds) || episode.durationSeconds <= 0 || episode.durationSeconds > 7200)) fail('CONTENT_AUDIO_DURATION');
    refs(episode.sourceIds, sourceIds);
  }
  // Also cover references inside discrepancies, evidence and optional video/source metadata.
  function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!record(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'sourceIds') refs(value, sourceIds);
      if (SOURCE_KEYS.has(key) && value !== null && !sourceIds.has(value)) fail('CONTENT_SOURCE_REFERENCE');
      if (['url', 'officialSite', 'landingUrl', 'fullTextUrl'].includes(key) && value !== null && !safeHttpsUrl(value)) fail('CONTENT_URL');
      if (value && typeof value === 'object') walk(value);
    }
  }
  walk(data);
  return data;
}

function keysOnly(value, keys) { return Object.keys(value).every(key => keys.includes(key)); }
function feedUrl(value, config, feed = false) {
  const clean = safeHttpsUrl(value);
  if (!clean) return false;
  const url = new URL(clean);
  if (url.port || url.search || url.hash || !(feed ? config.feedHosts : config.hosts).includes(url.hostname)) return false;
  if (feed) return url.pathname === config.feedPath;
  return url.pathname.startsWith(config.prefix) && url.pathname !== config.prefix && !/\.mp3$/i.test(url.pathname);
}

/** Only the limited metadata schema produced by taurino_refresh.py is accepted. */
export function validateFeed(data) {
  boundedDocument(data, 256 * 1024, 'FEED_INVALID');
  const generated = utcTime(data.generatedAtUtc);
  if (data.schemaVersion !== 1 || generated === null || !keysOnly(data, ['schemaVersion', 'generatedAtUtc', 'coverage', 'sources', 'items'])) fail('FEED_SCHEMA');
  if (!record(data.coverage) || !keysOnly(data.coverage, ['type', 'isLive', 'includesCorridaSummaries', 'noteEs']) || data.coverage.type !== 'source_links' || data.coverage.isLive !== false || data.coverage.includesCorridaSummaries !== false || !text(data.coverage.noteEs, 2000)) fail('FEED_COVERAGE');
  const known = records(data.sources, 3, 'FEED_SOURCES');
  if (!known.size) fail('FEED_SOURCES');
  const statusById = new Map();
  for (const source of data.sources) {
    const config = FEED_SOURCES[source.id];
    if (!config || !text(source.name, 100) || !feedUrl(source.url, config, true) || !keysOnly(source, ['id', 'name', 'url', 'status', 'lastSuccessAt', 'errorCode'])) fail('FEED_SOURCE_URL');
    if (!['ok', 'stale', 'failed'].includes(source.status)) fail('FEED_STATUS');
    const lastSuccess = source.lastSuccessAt === null ? null : utcTime(source.lastSuccessAt);
    if ((source.lastSuccessAt !== null && lastSuccess === null) || (lastSuccess !== null && lastSuccess > generated + 300000)) fail('FEED_DATE');
    if (source.status === 'ok' ? (lastSuccess === null || source.errorCode !== null) : (typeof source.errorCode !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}$/.test(source.errorCode))) fail('FEED_STATUS');
    statusById.set(source.id, source.status);
  }
  records(data.items, 60, 'FEED_ITEMS');
  const count = new Map(), links = new Set();
  for (const item of data.items) {
    if (!known.has(item.sourceId)) fail('FEED_SOURCE_REFERENCE');
    const config = FEED_SOURCES[item.sourceId];
    if (!keysOnly(item, ['id', 'sourceId', 'kind', 'date', 'url', 'label', 'topics']) || !feedUrl(item.url, config)) fail('FEED_ITEM_URL');
    if (item.kind !== config.kind || !text(item.label, 200) || !Array.isArray(item.topics) || item.topics.length > TOPICS.size || new Set(item.topics).size !== item.topics.length || item.topics.some(topic => !TOPICS.has(topic)) || (item.kind === 'podcast' && !item.topics.length)) fail('FEED_ITEM');
    if (item.sourceId === 'zafra' && !item.topics.includes('Tauromaquia')) fail('FEED_ITEM');
    const date = utcTime(item.date);
    if (date === null || date > generated + 300000) fail('FEED_DATE');
    const url = safeHttpsUrl(item.url);
    if (links.has(url) || statusById.get(item.sourceId) === 'failed') fail('FEED_ITEM');
    links.add(url);
    count.set(item.sourceId, (count.get(item.sourceId) ?? 0) + 1);
    if (count.get(item.sourceId) > 20) fail('FEED_ITEMS');
  }
  return data;
}
