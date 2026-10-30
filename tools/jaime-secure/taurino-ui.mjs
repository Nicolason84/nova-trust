import {normalizeText, filterEvents, safeHttpsUrl, publicSourceSearch, loadProgress, saveProgress, validateContent, validateFeed} from './taurino-core.mjs';
import {createDocumentVault} from './document-vault.mjs';

// Public editorial content only. No AI gateway, account, tracking or private upload.
const RAW_FEED = 'https://raw.githubusercontent.com/Nicolason84/nova-trust/main/docs/jaime/data/taurino-feed.json';
const PROGRESS_KEY = 'ojo-jaime-tendido-progress-v1';
const $ = id => document.getElementById(id);
const all = selector => [...document.querySelectorAll(selector)];
const node = (tag, text = '', className = '') => {
  const value = document.createElement(tag); value.textContent = text;
  if (className) value.className = className;
  return value;
};
const formatDate = (value, withYear = true) => new Intl.DateTimeFormat('es-ES', {
  day:'numeric',month:'long',...(withYear ? {year:'numeric'} : {}),timeZone:'Europe/Madrid',
}).format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value));
const formatTime = value => new Intl.DateTimeFormat('es-ES', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'}).format(new Date(value));
const clone = id => $(id).content.firstElementChild.cloneNode(true);
const fill = (container, key, text) => { container.querySelector(`[data-${key}]`).textContent = text ?? ''; };
const busyDone = id => $(id).setAttribute('aria-busy','false');
let content, sourceMap = new Map(), catalog = new Map(), allowedIds;
let progress = {learned:[],favorites:[]}, currentLesson, currentEvent, currentDebate, quizIndex = 0;
let toastTimer, speechToken = 0, storage;
try { storage = window.localStorage; } catch { storage = null; }
const audio = $('taurinoAudio');
const vault = createDocumentVault();
let pendingDraft = null, privateEpoch = 0, privateTimer, hiddenAt = null, saving = false;

function toast(message) {
  clearTimeout(toastTimer); $('taurinoToast').textContent = message; $('taurinoToast').hidden = false;
  toastTimer = setTimeout(() => { $('taurinoToast').hidden = true; $('taurinoToast').textContent = ''; },5500);
}
function externalLink(url, label) {
  const target = safeHttpsUrl(url);
  if (!target) return node('span',label);
  const a = node('a',label); a.href = target; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.referrerPolicy = 'no-referrer';
  return a;
}
function sourceList(target, ids, caveats = true) {
  target.replaceChildren();
  for (const id of new Set(ids ?? [])) {
    const source = sourceMap.get(id); if (!source) continue;
    const li = node('li');
    li.append(externalLink(source.url,`${source.publisher} · ${source.label || source.title || 'Fuente'} ↗`));
    if (caveats && source.caveat) li.append(node('p',source.caveat,'taurino-small'));
    if (caveats && source.accessNote) li.append(node('p',source.accessNote,'taurino-small'));
    target.append(li);
  }
}
function section(target, title, text) { target.append(node('h3',title),node('p',text)); }
function openDialog(id) {
  stopSpeech();
  for (const dialog of all('dialog[open]')) dialog.close();
  $(id).showModal(); $(id).scrollTop = 0;
}
function navigate(name, scroll = true) {
  const names = {news:'News',learn:'Learn',talk:'Talk',mine:'Mine'};
  if (!names[name]) return;
  stopSpeech();
  for (const [key,value] of Object.entries(names)) $( `taurino${value}Panel`).hidden = key !== name;
  for (const button of all('[data-taurino-tab]')) {
    if (button.dataset.taurinoTab === name) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  }
  if (scroll) $('taurinoNavigation').scrollIntoView({block:'start',behavior:'auto'});
}
function commitProgress(next, message) {
  if (!saveProgress(storage,PROGRESS_KEY,next,allowedIds)) { toast('Este navegador no ha podido guardar el cambio. No se ha marcado como guardado.'); return false; }
  progress = next; renderProgress(); if (message) toast(message); return true;
}
function toggleFavorite(id) {
  if (!catalog.has(id)) return;
  const exists = progress.favorites.includes(id);
  const next = {...progress,favorites:exists ? progress.favorites.filter(value => value !== id) : [...progress.favorites,id]};
  commitProgress(next,exists ? 'Quitado de favoritos.' : 'Guardado en tus favoritos de este navegador.');
}
function favoriteButton(button,id,label) {
  const selected = progress.favorites.includes(id);
  button.setAttribute('aria-pressed',String(selected));
  if (label) button.textContent = selected ? 'Quitar de favoritos' : label;
}
function renderProgress() {
  $('taurinoLearningProgress').max = content.lessons.length;
  $('taurinoLearningProgress').value = progress.learned.length;
  $('taurinoProgressText').textContent = `${progress.learned.length} de ${content.lessons.length} fichas marcadas como entendidas. Vuelve a cualquiera para repasarla.`;
  $('taurinoFavoriteCount').textContent = `${progress.favorites.length} ${progress.favorites.length === 1 ? 'guardado' : 'guardados'}`;
  const list = $('taurinoFavoritesList'); list.replaceChildren();
  for (const id of progress.favorites) {
    const item = catalog.get(id); if (!item) continue;
    const card = clone('taurinoFavoriteTemplate');
    fill(card,'favorite-kind',item.kind); fill(card,'favorite-title',item.title); fill(card,'favorite-description',item.description);
    card.querySelector('[data-favorite-open]').addEventListener('click',item.open);
    card.querySelector('[data-favorite-remove]').addEventListener('click',() => {
      const index = progress.favorites.indexOf(id); toggleFavorite(id);
      const buttons = [...list.querySelectorAll('[data-favorite-remove]')];
      if (buttons.length) buttons[Math.min(index,buttons.length-1)].focus();
      else { $('taurinoFavoritesTitle').tabIndex = -1; $('taurinoFavoritesTitle').focus(); }
    }); list.append(card);
  }
  if (!list.children.length) list.append(node('p','Guarda una corrida, una ficha o un tema para volver a él desde aquí.','taurino-empty-copy'));
  busyDone('taurinoFavoritesList');
  for (const button of all('[data-favorite-id]')) favoriteButton(button,button.dataset.favoriteId);
  for (const card of all('[data-lesson-id]')) {
    const learned = progress.learned.includes(card.dataset.lessonId); card.dataset.learned = String(learned);
    card.querySelector('[data-lesson-state]').textContent = learned ? 'Entendida' : 'Por descubrir';
  }
  if (currentEvent) favoriteButton($('taurinoFavoriteEvent'),currentEvent.id,'Guardar corrida');
  if (currentDebate) favoriteButton($('taurinoFavoriteDebate'),currentDebate.id,'Guardar tema');
  if (currentLesson) {
    favoriteButton($('taurinoFavoriteLesson'),currentLesson.id,'Guardar ficha');
    const learned = progress.learned.includes(currentLesson.id);
    $('taurinoMarkLearned').textContent = learned ? 'Entendida · volver a repasar' : 'Lo he entendido';
    $('taurinoMarkLearned').setAttribute('aria-pressed',String(learned));
  }
}

function renderEvents() {
  const events = filterEvents(content.events,{date:$('taurinoFilterDate').value,plaza:$('taurinoFilterPlaza').value,torero:$('taurinoFilterTorero').value});
  const list = $('taurinoEventsList'); list.replaceChildren();
  $('taurinoEventCount').textContent = `${events.length} de ${content.events.length} corridas`;
  $('taurinoEventsStatus').textContent = events.length ? '' : 'No hay una ficha que coincida. Puedes preparar la búsqueda de otra corrida más abajo.';
  for (const event of events) {
    const card = clone('taurinoEventTemplate');
    const time = card.querySelector('[data-event-date]'); time.dateTime = event.date; time.textContent = formatDate(event.date,false);
    fill(card,'event-status',event.resultStatus === 'reported_by_official_organizer' ? 'Ficha oficial' : 'Crónica atribuida');
    fill(card,'event-plaza',event.plaza); fill(card,'event-city',`${event.city} · ${event.ganaderias.map(g => g.name).join(' / ')}`);
    fill(card,'event-toreros',event.cartel.join(' · ')); fill(card,'event-summary',event.summaryEs);
    fill(card,'event-checked',event.discrepancies?.length ? 'Con matices de fuente' : 'Con fuente y fecha');
    const source = sourceMap.get(event.primarySourceId), a = card.querySelector('[data-event-source]');
    a.href = safeHttpsUrl(source.url); a.textContent = `${source.publisher} ↗`;
    card.querySelector('[data-event-open]').addEventListener('click',() => openEvent(event));
    const favorite = card.querySelector('[data-event-favorite]'); favorite.dataset.favoriteId = event.id;
    favoriteButton(favorite,event.id); favorite.addEventListener('click',() => toggleFavorite(event.id));
    list.append(card);
  }
  busyDone('taurinoEventsList');
}
function openEvent(event) {
  currentEvent = event;
  $('taurinoEventTitle').textContent = `${event.plaza} · ${formatDate(event.date,false)}`;
  $('taurinoEventMeta').textContent = `${event.city} · ${event.ganaderias.map(g => g.name).join(' / ')} · ${event.festival || 'Corrida de toros'}`;
  const body = $('taurinoEventBody'); body.replaceChildren();
  body.append(node('p',event.summaryEs));
  const resultList = node('ul');
  for (const row of event.results) {
    const li = node('li'); li.append(node('strong',row.torero+': '),document.createTextNode(row.outcomes.join(' · '))); resultList.append(li);
  }
  body.append(node('h3','El resultado publicado'),resultList,node('p','Los resultados de cada espada aparecen en el orden de sus actuaciones.','taurino-small'));
  section(body,'Lo que está documentado',event.canConcludeWithoutWatching);
  section(body,'Lo que pide mirar más',event.requiresFootageOrAttributedChronicle);
  if (event.discrepancies?.length) {
    body.append(node('h3','Diferencias y límites de las fuentes'));
    for (const difference of event.discrepancies) {
      const p = node('p'); p.append(node('strong',`${difference.field}: `));
      if (difference.note) p.append(document.createTextNode(difference.note));
      if (difference.values) p.append(document.createTextNode(difference.values.map(value => `${sourceMap.get(value.sourceId)?.publisher || 'Fuente'}: ${value.value}`).join(' / ')));
      body.append(p);
    }
  }
  section(body,'Una pregunta para conversar','¿Qué dato respalda tu valoración y qué escena te gustaría revisar antes de cerrar tu opinión? Compara el problema que planteó cada toro con las decisiones del torero. Es una propuesta de lectura, no una observación de esta tarde.');
  if (event.video?.url) {
    body.append(externalLink(event.video.url,'Abrir el vídeo enlazado por la fuente ↗'));
    body.append(node('p','No se ha revisado ese vídeo para elaborar esta ficha. Su disponibilidad puede cambiar.','taurino-small'));
  }
  const episode = content.episodes.find(value => value.eventId === event.id);
  if (episode) {
    const button = node('button','Escuchar el comentario de esta tarde','taurino-primary'); button.type = 'button';
    button.addEventListener('click',() => { $('taurinoEventDialog').close(); selectEpisode(episode); $('taurinoPodcastCard').scrollIntoView(); playEpisode(); });
    body.append(button);
  }
  const speak = node('button','Leer este resumen con el teléfono','taurino-secondary'); speak.type = 'button';
  const speechStatus = node('p','Lectura con la voz del dispositivo; no es un episodio grabado.','taurino-small'); speechStatus.setAttribute('role','status');
  const stop = node('button','Detener lectura','taurino-text-button'); stop.type = 'button'; stop.hidden = true;
  speak.addEventListener('click',() => speakText(`${event.plaza}. ${formatDate(event.date)}. ${event.summaryEs} ${event.results.map(row => `${row.torero}: ${row.outcomes.join(', ')}.`).join(' ')} Lo que está documentado: ${event.canConcludeWithoutWatching} Lo que pide mirar más: ${event.requiresFootageOrAttributedChronicle}`,speechStatus,stop));
  stop.addEventListener('click',stopSpeech); body.append(node('h3','Escuchar la ficha'),speak,stop,speechStatus);
  $('taurinoEventChecked').textContent = `Revisión editorial: ${formatDate(content.asOfDate)}. Resultado atribuido a las fuentes indicadas. No es una retransmisión.`;
  sourceList($('taurinoEventSources'),event.sourceIds);
  favoriteButton($('taurinoFavoriteEvent'),event.id,'Guardar corrida'); openDialog('taurinoEventDialog');
}

function renderLessons() {
  $('taurinoLessonCount').textContent = `${content.lessons.length} ideas para profundizar`;
  const list = $('taurinoLessonsList'); list.replaceChildren();
  for (const [index,lesson] of content.lessons.entries()) {
    const card = clone('taurinoLessonTemplate'); card.dataset.lessonId = lesson.id;
    fill(card,'lesson-number',String(index+1).padStart(2,'0')); fill(card,'lesson-title',lesson.title); fill(card,'lesson-summary',lesson.objective);
    card.querySelector('[data-lesson-open]').addEventListener('click',() => openLesson(lesson)); list.append(card);
  }
  busyDone('taurinoLessonsList');
  const date = new Date(), day = Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
  const daily = content.lessons[day % content.lessons.length];
  $('taurinoDailyTitle').textContent = daily.title; $('taurinoDailyText').textContent = daily.exercise;
  $('taurinoDailyOpen').disabled = false; $('taurinoDailyOpen').addEventListener('click',() => openLesson(daily));
}
function openLesson(lesson) {
  currentLesson = lesson;
  $('taurinoLessonTitle').textContent = lesson.title;
  $('taurinoLessonEyebrow').textContent = `${lesson.level} · Lee y practica a tu ritmo`;
  const body = $('taurinoLessonBody'); body.replaceChildren(node('p',lesson.objective));
  for (const paragraph of lesson.paragraphs) {
    body.append(node('p',paragraph.kind === 'sourced' ? 'Con apoyo documental' : 'Para formar tu criterio','taurino-eyebrow'),node('p',paragraph.text));
    if (paragraph.sourceIds?.length) { const refs = node('ul','','taurino-source-list'); sourceList(refs,paragraph.sourceIds,false); body.append(refs); }
  }
  section(body,'Pruébalo tú',lesson.exercise);
  sourceList($('taurinoLessonSources'),lesson.sourceIds);
  $('taurinoSpeechStatus').textContent = 'Lectura con la voz de tu dispositivo. Es distinta del episodio grabado.';
  renderProgress(); openDialog('taurinoLessonDialog');
}
function renderRanches() {
  const list = $('taurinoRanchesList'); list.replaceChildren();
  for (const ranch of content.ranches) {
    const card = clone('taurinoRanchTemplate');
    fill(card,'ranch-name',ranch.name); fill(card,'ranch-location',ranch.region); fill(card,'ranch-summary',ranch.attributedFact);
    const facts = card.querySelector('[data-ranch-facts]');
    facts.append(node('li',`Procedencia declarada: ${ranch.declaredLineage}`),node('li',`Fincas citadas: ${ranch.locations.join(' · ')}`),node('li',ranch.observationQuestion));
    const refs = card.querySelector('[data-ranch-sources]');
    for (const id of ranch.sourceIds) refs.append(externalLink(sourceMap.get(id).url,'Ficha de la RUCTL ↗'));
    list.append(card);
  }
  busyDone('taurinoRanchesList');
}
function renderGlossary() {
  const query = normalizeText($('taurinoGlossarySearch').value);
  const terms = content.glossary.filter(term => normalizeText(term.term+' '+term.definition).includes(query));
  const list = $('taurinoGlossaryList'); list.replaceChildren();
  for (const term of terms) {
    const item = clone('taurinoTermTemplate'); fill(item,'term-name',term.term); fill(item,'term-definition',term.definition);
    const example = item.querySelector('[data-term-example]'); example.textContent = term.example || ''; example.hidden = !term.example;
    const a = item.querySelector('[data-term-source]'), source = sourceMap.get(term.sourceIds[0]);
    a.href = safeHttpsUrl(source.url); a.textContent = `${source.publisher} ↗`; list.append(item);
  }
  $('taurinoTermCount').textContent = `${content.glossary.length} términos`;
  $('taurinoGlossaryStatus').textContent = terms.length ? `${terms.length} términos visibles.` : 'No hay coincidencias. Prueba otra palabra.';
  busyDone('taurinoGlossaryList');
}
function renderQuiz() {
  const question = content.quiz[quizIndex]; $('taurinoQuizQuestion').textContent = question.question;
  $('taurinoQuizProgress').textContent = `Pregunta ${quizIndex+1} de ${content.quiz.length}`;
  const options = $('taurinoQuizOptions'); options.replaceChildren();
  question.options.forEach((text,index) => {
    const label = node('label'), input = document.createElement('input'); input.type = 'radio'; input.name = 'taurino-answer'; input.value = String(index); input.required = true;
    label.append(input,node('span',text)); options.append(label);
  });
  $('taurinoQuizCheck').disabled = false; $('taurinoQuizNext').hidden = true; $('taurinoQuizFeedback').hidden = true; $('taurinoQuizFeedback').replaceChildren();
}
function renderDebates() {
  const list = $('taurinoDebatesList'); list.replaceChildren();
  for (const [index,debate] of content.debates.entries()) {
    const card = clone('taurinoDebateTemplate');
    fill(card,'debate-number',String(index+1).padStart(2,'0')); fill(card,'debate-title',debate.title); fill(card,'debate-summary',debate.claim);
    card.querySelector('[data-debate-open]').addEventListener('click',() => openDebate(debate)); list.append(card);
    const option = node('option',debate.title); option.value = debate.id; $('taurinoOpinionTopic').append(option);
  }
  busyDone('taurinoDebatesList');
}
function openDebate(debate) {
  currentDebate = debate; $('taurinoDebateTitle').textContent = debate.title; $('taurinoDebateIntro').textContent = debate.argumentStatus;
  const argument = $('taurinoDebateFor'); argument.replaceChildren(node('p',debate.claim));
  for (const evidence of debate.evidence) argument.append(node('p',evidence.text));
  $('taurinoDebateAgainst').replaceChildren(node('p',debate.counterargument)); $('taurinoDebateNuance').replaceChildren(node('p',debate.nuance));
  $('taurinoDebateQuestion').textContent = debate.question; sourceList($('taurinoDebateSources'),debate.sourceIds);
  favoriteButton($('taurinoFavoriteDebate'),debate.id,'Guardar tema'); openDialog('taurinoDebateDialog');
}

let activeSpeechStatus = null, activeSpeechStop = null;
function stopSpeech() {
  speechToken++;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (activeSpeechStatus) activeSpeechStatus.textContent = 'Lectura detenida. El texto sigue disponible.';
  if (activeSpeechStop) activeSpeechStop.hidden = true;
  activeSpeechStatus = null; activeSpeechStop = null;
}
function speakText(text,status,stopButton) {
  stopSpeech(); audio.pause();
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { status.textContent = 'Este navegador no ofrece lectura en voz alta. Puedes leer el texto o escuchar los episodios grabados.'; return; }
  const token = speechToken, utterance = new SpeechSynthesisUtterance(text), synth = window.speechSynthesis;
  utterance.lang = 'es-ES'; utterance.rate = 0.95;
  const voice = synth.getVoices().find(value => value.lang === 'es-ES') || synth.getVoices().find(value => /^es\b/.test(value.lang));
  if (voice) utterance.voice = voice;
  activeSpeechStatus = status; activeSpeechStop = stopButton; stopButton.hidden = false;
  status.textContent = 'Preparando la voz del dispositivo…';
  utterance.onstart = () => { if (token === speechToken) status.textContent = 'Lectura con la voz del dispositivo. La disponibilidad del español depende de las voces instaladas.'; };
  utterance.onend = () => { if (token === speechToken) { status.textContent = 'Lectura terminada.'; stopButton.hidden = true; activeSpeechStatus = null; activeSpeechStop = null; } };
  utterance.onerror = () => { if (token === speechToken) { status.textContent = 'La voz del dispositivo no ha podido leer el texto. Los episodios grabados siguen disponibles.'; stopButton.hidden = true; } };
  synth.speak(utterance);
}
function selectEpisode(episode) {
  audio.pause(); stopSpeech(); audio.src = episode.src; audio.playbackRate = Number($('taurinoPlaybackRate').value);
  $('taurinoEpisodeTitle').textContent = episode.title; $('taurinoEpisodeSummary').textContent = episode.summary;
  $('taurinoEpisodeDate').textContent = formatDate(episode.date); $('taurinoEpisodeDate').hidden = false;
  $('taurinoEpisodeDuration').textContent = `${Math.floor(episode.durationSeconds/60)} min ${Math.round(episode.durationSeconds%60)} s`; $('taurinoEpisodeDuration').hidden = false;
  $('taurinoTranscript').replaceChildren(...episode.transcript.split(/\n\s*\n/).map(text => node('p',text)));
  sourceList($('taurinoEpisodeSources'),episode.sourceIds); busyDone('taurinoTranscript');
  if (!episode.sourceIds.length) $('taurinoEpisodeSources').append(node('li','Comentario editorial original; no es la crónica de un festejo concreto.'));
  $('taurinoAudioStatus').textContent = 'Audio preparado. La primera reproducción necesita conexión.';
  for (const button of all('[data-episode-id]')) button.setAttribute('aria-pressed',String(button.dataset.episodeId === episode.id));
}
async function playEpisode() {
  stopSpeech();
  try { await audio.play(); } catch { $('taurinoAudioStatus').textContent = 'Pulsa el botón de reproducción del lector. Si no arranca, comprueba la conexión.'; }
}
function setupEpisodes() {
  const list = $('taurinoEpisodeList'); list.replaceChildren();
  for (const [index,episode] of content.episodes.entries()) {
    const button = node('button',`${String(index+1).padStart(2,'0')} · ${episode.title}`); button.type = 'button'; button.dataset.episodeId = episode.id;
    button.addEventListener('click',() => selectEpisode(episode)); list.append(button);
  }
  selectEpisode(content.episodes[0]); $('taurinoListenButton').disabled = false;
}

async function fetchJson(url,timeout = 8000) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(),timeout);
  try {
    const response = await fetch(url,{signal:controller.signal,credentials:'omit',cache:'no-cache',referrerPolicy:'no-referrer',redirect:'error'});
    if (!response.ok || Number(response.headers.get('content-length') || 0) > 2*1024*1024) throw new Error('CONTENT_UNAVAILABLE');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('CONTENT_UNAVAILABLE');
    const chunks = []; let length = 0;
    while (true) { const {done,value} = await reader.read(); if (done) break; length += value.length; if (length > 2*1024*1024) { await reader.cancel(); throw new Error('CONTENT_LIMIT'); } chunks.push(value); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  } finally { clearTimeout(timer); }
}
function renderFeed(feed,origin) {
  const list = $('taurinoFeedList'); list.replaceChildren();
  const sources = new Map(feed.sources.map(value => [value.id,value]));
  for (const item of [...feed.items].sort((a,b) => b.date.localeCompare(a.date)).slice(0,12)) {
    const card = clone('taurinoFeedTemplate'), source = sources.get(item.sourceId);
    fill(card,'feed-owner',source.name); const time = card.querySelector('[data-feed-date]'); time.dateTime = item.date; time.textContent = formatDate(item.date);
    const a = card.querySelector('[data-feed-link]'); a.href = safeHttpsUrl(item.url); a.textContent = item.label;
    const summary = card.querySelector('[data-feed-summary]'); summary.hidden = false;
    summary.textContent = `${item.kind === 'podcast' ? 'Escuchar en la fuente' : 'Consultar en la fuente'}${item.topics.length ? ' · ' + item.topics.join(' · ') : ''}`;
    list.append(card);
  }
  if (!list.children.length) list.append(node('p','No hay enlaces taurinos recientes disponibles en esta selección de fuentes.','taurino-empty-copy'));
  const stale = feed.sources.filter(source => source.status !== 'ok').map(source => source.name);
  const old = Date.now() - Date.parse(feed.generatedAtUtc) > 48*3600*1000;
  $('taurinoFeedStatus').textContent = `${origin === 'remote' ? 'Última comprobación del índice' : 'Copia disponible de la última publicación'}: ${formatTime(feed.generatedAtUtc)} (hora de Madrid). ${old ? 'La comprobación tiene más de 48 horas; abre la fuente para confirmar novedades. ' : ''}${stale.length ? `Sin actualización confirmada: ${stale.join(', ')}. ` : ''}La fecha de cada enlace es la publicación original. Este índice no genera nuevos resúmenes de corridas.`;
  busyDone('taurinoFeedList');
}
async function loadFeed() {
  let local = null;
  try { local = validateFeed(await fetchJson('data/taurino-feed.json',5000)); renderFeed(local,'local'); } catch {}
  try { const feed = validateFeed(await fetchJson(RAW_FEED)); if (!local || Date.parse(feed.generatedAtUtc) >= Date.parse(local.generatedAtUtc)) renderFeed(feed,'remote'); }
  catch { if (!local) { $('taurinoFeedStatus').textContent = 'No se ha podido cargar el índice de actualidad. Los contenidos documentados siguen disponibles.'; $('taurinoFeedList').replaceChildren(externalLink('https://www.rtve.es/play/audios/clarin/','Abrir Clarín en RTVE ↗')); busyDone('taurinoFeedList'); } }
}

function beginPrivateSave(title,text,kind) {
  if (document.hidden || !text.trim() || !title.trim()) return;
  privateEpoch++; pendingDraft = {title:title.trim(),text:text.trim(),kind};
  $('taurinoVaultSummary').textContent = 'Se guardará una nota cifrada en la categoría tauromaquia de Mi archivo. Después, el archivo volverá a cerrarse.';
  $('taurinoVaultForm').reset(); $('taurinoVaultError').hidden = true; $('taurinoVaultError').textContent = '';
  openDialog('taurinoVaultDialog');
}
function clearVaultState() {
  privateEpoch++; pendingDraft = null; vault.lock(); saving = false;
  $('taurinoVaultPhrase').value = ''; $('taurinoVaultPhraseConfirm').value = '';
  $('taurinoVaultError').textContent = ''; $('taurinoVaultError').hidden = true;
  $('taurinoVaultSummary').textContent = 'Se guardará como una nota en tu archivo privado.';
  $('taurinoVaultSubmit').disabled = false; $('taurinoVaultSubmit').textContent = 'Abrir y guardar';
}
function clearPrivateForms() {
  clearVaultState();
  for (const id of ['taurinoOpinionText','taurinoNoteTitle','taurinoNoteText','taurinoRequestQuestion']) $(id).value = '';
  $('taurinoOpinionTopic').value = 'general';
  if ($('taurinoVaultDialog').open) $('taurinoVaultDialog').close();
}
async function savePrivateNote(event) {
  event.preventDefault(); if (saving || !pendingDraft || document.hidden) return;
  let phrase = $('taurinoVaultPhrase').value;
  if (phrase !== $('taurinoVaultPhraseConfirm').value) { $('taurinoVaultError').textContent = 'Las dos frases no coinciden. Revísalas antes de guardar.'; $('taurinoVaultError').hidden = false; return; }
  const stamp = privateEpoch, draft = pendingDraft; saving = true;
  $('taurinoVaultSubmit').disabled = true; $('taurinoVaultSubmit').textContent = 'Guardando en tu archivo…';
  $('taurinoVaultPhrase').value = ''; $('taurinoVaultPhraseConfirm').value = ''; $('taurinoVaultError').hidden = true;
  try {
    await vault.unlock(phrase); phrase = '';
    if (stamp !== privateEpoch || document.hidden) return;
    const contents = `# ${draft.title}\n\n${draft.text}\n\nFecha de la nota: ${new Date().toISOString()}\nTipo: ${draft.kind}\n`;
    const file = new File([contents],`tauromaquia-${new Date().toISOString().replace(/[:.]/g,'-')}.md`,{type:'text/markdown'});
    await vault.importFile(file,{category:'tauromaquia',tags:['reflexión','tendido']});
    if (stamp !== privateEpoch || document.hidden) return;
    // Saving one draft must not discard another unfinished form.
    if (draft.kind === 'Reflexión personal') {
      $('taurinoOpinionText').value = ''; $('taurinoOpinionTopic').value = 'general';
    } else { $('taurinoNoteTitle').value = ''; $('taurinoNoteText').value = ''; }
    clearVaultState(); $('taurinoVaultDialog').close();
    toast('Nota guardada en Mi archivo cifrado. El archivo se ha cerrado.');
  } catch (error) {
    if (stamp !== privateEpoch || document.hidden) return;
    const messages = {DOC_AUTH:'La frase no abre este archivo. Comprueba que sea la misma que usas en Mi archivo.',DOC_UNSUPPORTED:'Este navegador no dispone de las funciones necesarias para el archivo cifrado.',DOC_BUSY:'Mi archivo está ocupado. Espera un momento y vuelve a intentarlo.',DOC_CANCELLED:'El guardado se ha cancelado. Revisa Mi archivo antes de volver a guardar.',DOC_PHRASE:'Usa una frase de al menos 14 caracteres.'};
    $('taurinoVaultError').textContent = messages[error.code] || 'No se ha podido completar el guardado. El texto sigue en el formulario mientras mantengas esta página abierta.';
    $('taurinoVaultError').hidden = false;
  } finally {
    phrase = '';
    // A cancelled old operation must never lock a newer vault session.
    if (stamp === privateEpoch) { vault.lock(); saving = false; $('taurinoVaultSubmit').disabled = false; $('taurinoVaultSubmit').textContent = 'Abrir y guardar'; }
  }
}

function bind() {
  for (const button of all('[data-taurino-tab]')) button.addEventListener('click',() => navigate(button.dataset.taurinoTab));
  for (const button of all('[data-taurino-close]')) button.addEventListener('click',() => $(button.dataset.taurinoClose).close());
  for (const dialog of all('dialog')) dialog.addEventListener('close',stopSpeech);
  $('taurinoVaultDialog').addEventListener('close',clearVaultState);
  $('taurinoEventFilters').addEventListener('submit',event => event.preventDefault());
  $('taurinoEventFilters').addEventListener('input',renderEvents);
  $('taurinoEventFilters').addEventListener('reset',() => { for (const id of ['taurinoFilterDate','taurinoFilterPlaza','taurinoFilterTorero']) $(id).value = ''; renderEvents(); });
  $('taurinoGlossarySearch').addEventListener('input',renderGlossary);
  $('taurinoFavoriteEvent').addEventListener('click',() => currentEvent && toggleFavorite(currentEvent.id));
  $('taurinoFavoriteLesson').addEventListener('click',() => currentLesson && toggleFavorite(currentLesson.id));
  $('taurinoFavoriteDebate').addEventListener('click',() => currentDebate && toggleFavorite(currentDebate.id));
  $('taurinoMarkLearned').addEventListener('click',() => {
    if (!currentLesson) return;
    const id = currentLesson.id, learned = progress.learned.includes(id);
    commitProgress({...progress,learned:learned ? progress.learned.filter(value => value !== id) : [...progress.learned,id]},learned ? 'La ficha vuelve a tu recorrido para repasarla.' : 'Una idea más en tu recorrido.');
  });
  $('taurinoResetProgress').addEventListener('click',() => {
    if (window.confirm('¿Reiniciar las fichas marcadas como entendidas? Tus favoritos y notas se conservan.')) commitProgress({...progress,learned:[]},'Recorrido reiniciado.');
  });
  $('taurinoQuizForm').addEventListener('submit',event => {
    event.preventDefault(); const selected = $('taurinoQuizOptions').querySelector('input:checked'); if (!selected) return;
    const question = content.quiz[quizIndex], correct = Number(selected.value) === question.correctIndex, feedback = $('taurinoQuizFeedback');
    feedback.hidden = false; feedback.dataset.state = correct ? 'correct' : 'review';
    feedback.replaceChildren(node('strong',correct ? 'Exacto. ' : 'Vamos a razonarlo. '),node('p',question.explanation));
    if (!correct) feedback.append(node('p',`La respuesta es: ${question.options[question.correctIndex]}`));
    const refs = node('ul','','taurino-source-list'); sourceList(refs,question.sourceIds,false); feedback.append(refs);
    $('taurinoQuizCheck').disabled = true; $('taurinoQuizNext').hidden = false;
    for (const input of $('taurinoQuizOptions').querySelectorAll('input')) input.disabled = true;
  });
  $('taurinoQuizNext').addEventListener('click',() => { quizIndex = (quizIndex+1) % content.quiz.length; renderQuiz(); $('taurinoQuizOptions').querySelector('input')?.focus(); });
  $('taurinoSpeakLesson').addEventListener('click',() => currentLesson && speakText(`${currentLesson.title}. ${currentLesson.paragraphs.map(value => value.text).join(' ')} Ejercicio: ${currentLesson.exercise}`,$('taurinoSpeechStatus'),$('taurinoStopSpeaking')));
  $('taurinoStopSpeaking').addEventListener('click',stopSpeech);
  $('taurinoListenButton').addEventListener('click',() => { $('taurinoPodcastCard').scrollIntoView({block:'start'}); playEpisode(); });
  $('taurinoPlaybackRate').addEventListener('change',() => { audio.playbackRate = Number($('taurinoPlaybackRate').value); });
  audio.addEventListener('playing',() => { stopSpeech(); $('taurinoAudioStatus').textContent = 'Episodio en reproducción · voz generada.'; });
  audio.addEventListener('pause',() => { if (!audio.ended) $('taurinoAudioStatus').textContent = 'Reproducción en pausa.'; });
  audio.addEventListener('ended',() => { $('taurinoAudioStatus').textContent = 'Episodio terminado. Puedes volver a escucharlo o consultar el texto.'; });
  audio.addEventListener('error',() => { $('taurinoAudioStatus').textContent = 'No se ha podido cargar el audio. Comprueba la conexión; el texto completo sigue disponible.'; });
  $('taurinoRequestForm').addEventListener('submit',event => {
    event.preventDefault();
    const plaza = $('taurinoRequestPlaza').value.trim(), date = $('taurinoRequestDate').value, torero = $('taurinoRequestTorero').value.trim();
    // The free-form question is deliberately not passed to any search provider.
    const links = publicSourceSearch({plaza,date,torero}); const list = $('taurinoRequestLinks'); list.replaceChildren();
    $('taurinoRequestResult').querySelector('h4').textContent = links.length ? 'Búsqueda preparada' : 'Revisa la búsqueda';
    if (!links.length) {
      $('taurinoRequestSummary').textContent = 'Usa el nombre de una plaza o localidad, con un máximo de 120 caracteres por campo. Evita direcciones web, barras y símbolos; no se ha preparado ni enviado una búsqueda.';
      $('taurinoRequestResult').hidden = false; return;
    }
    for (const link of links) { const li = node('li'); li.append(externalLink(link.url,link.label+' ↗')); list.append(li); }
    $('taurinoRequestSummary').textContent = `Búsqueda de ${plaza}${date ? ' · '+formatDate(date) : ''}${torero ? ' · '+torero : ''}. Solo esos datos públicos se incluyen en los enlaces. Tu pregunta libre permanece en esta página; no se envía ni se ha generado todavía un resumen.`;
    $('taurinoRequestResult').hidden = false;
  });
  $('taurinoWriteOpinion').addEventListener('click',() => { if (!currentDebate) return; $('taurinoDebateDialog').close(); navigate('talk'); $('taurinoOpinionTopic').value = currentDebate.id; $('taurinoOpinionText').focus(); });
  $('taurinoOpinionForm').addEventListener('submit',event => { event.preventDefault(); const selected = $('taurinoOpinionTopic').selectedOptions[0]; beginPrivateSave(selected.textContent,$('taurinoOpinionText').value,'Reflexión personal'); });
  $('taurinoNoteForm').addEventListener('submit',event => { event.preventDefault(); beginPrivateSave($('taurinoNoteTitle').value,$('taurinoNoteText').value,'Nota personal'); });
  $('taurinoVaultForm').addEventListener('submit',savePrivateNote);
  window.addEventListener('storage',event => { if (event.key === PROGRESS_KEY || event.key === null) { progress = loadProgress(storage,PROGRESS_KEY,allowedIds); renderProgress(); } });
}

// Obscure personal drafts immediately in the background; purge after one minute.
document.addEventListener('visibilitychange',() => {
  if (document.hidden) {
    hiddenAt = Date.now(); document.body.classList.add('taurino-private-hidden');
    clearVaultState(); if ($('taurinoVaultDialog').open) $('taurinoVaultDialog').close();
    stopSpeech(); clearTimeout(privateTimer); privateTimer = setTimeout(clearPrivateForms,60000);
  } else {
    if (hiddenAt !== null && Date.now()-hiddenAt >= 60000) clearPrivateForms();
    hiddenAt = null; clearTimeout(privateTimer); document.body.classList.remove('taurino-private-hidden');
  }
});
window.addEventListener('pagehide',() => { document.body.classList.add('taurino-private-hidden'); clearTimeout(privateTimer); clearPrivateForms(); stopSpeech(); });
window.addEventListener('pageshow',() => { if (!document.hidden) document.body.classList.remove('taurino-private-hidden'); });

async function start() {
  try {
    content = validateContent(await fetchJson('data/taurino-content.json'));
    sourceMap = new Map(content.sources.map(source => [source.id,source]));
    for (const event of content.events) catalog.set(event.id,{kind:'Corrida',title:`${event.plaza} · ${formatDate(event.date,false)}`,description:event.cartel.join(' · '),open:() => openEvent(event)});
    for (const lesson of content.lessons) catalog.set(lesson.id,{kind:'Ficha',title:lesson.title,description:lesson.objective,open:() => openLesson(lesson)});
    for (const debate of content.debates) catalog.set(debate.id,{kind:'Conversación',title:debate.title,description:debate.question,open:() => openDebate(debate)});
    allowedIds = {learned:content.lessons.map(value => value.id),favorites:[...catalog.keys()]};
    progress = loadProgress(storage,PROGRESS_KEY,allowedIds);
    $('taurinoLastChecked').textContent = formatDate(content.asOfDate);
    $('taurinoCoverage').textContent = `${content.events.length} tardes de Madrid, Sevilla y Zafra · ${formatDate(content.coverage.earliestEventDate,false)}–${formatDate(content.coverage.latestEventDate)}. Selección retrospectiva, no exhaustiva.`;
    renderEvents(); renderLessons(); renderRanches(); renderGlossary(); renderQuiz(); renderDebates(); renderProgress(); setupEpisodes(); bind();
    loadFeed();
  } catch {
    for (const target of all('[aria-busy="true"]')) { target.setAttribute('aria-busy','false'); target.replaceChildren(node('p','No se ha podido cargar este contenido. Comprueba la conexión y vuelve a abrir la página.','taurino-empty-copy')); }
    $('taurinoEventsStatus').textContent = 'El contenido no se ha cargado. No se muestran resultados sin validar.';
    $('taurinoEventCount').textContent = 'Contenido no disponible'; $('taurinoLastChecked').textContent = 'No disponible';
    $('taurinoQuizQuestion').textContent = 'La pregunta no está disponible.'; $('taurinoProgressText').textContent = 'La progresión estará disponible cuando se carguen las fichas.';
    for (const button of all('button')) button.disabled = true;
  }
}
start();
