/* Maison des Preuves — continuation of the received V2; public catalogue only. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const rooms = [...document.querySelectorAll('.room')];
  const buttons = [...document.querySelectorAll('[data-room]')];
  const params = new URLSearchParams(location.search);
  const attribution = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  let current = 0, report, catalog, voiceOn = false, sceneLoading = false;
  const cues = [
    'Bienvenue dans la Maison des Preuves. Chaque rapport garde ses sources, ses dates et ses limites.',
    'Nico vous accueille dans la scène existante de LA BÊTE. La visite documentaire reste disponible sans animation.',
    'Un chiffre n’a de sens qu’avec son unité, sa date et son périmètre. Les prévisions ne sont pas des observations.',
    'Le laboratoire distingue observations, hypothèses et calculs. Le stock ne se refinance pas en un jour.',
    'Les contradictions restent ouvertes tant que leurs causes n’ont pas été démontrées.',
    'ojO porte la conversation personnelle. Cette Maison donne accès à la lecture publique gratuite.',
    'Le rapport conserve son contexte complet. Retrouvez ici le document et ses sources.',
    'Une piste de solution exige des preuves propres, un responsable, un coût et une mesure.',
    'Le simulateur illustre une multiplication sur un volume choisi. Il ne prédit pas la charge de la dette.',
    'Vous pouvez ouvrir le rapport, vérifier une source et conserver le lien de votre visite.'
  ];
  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }
  function trackedUrl(href) {
    const url = new URL(href, location.href);
    if (url.origin === location.origin) attribution.forEach(key => {
      if (params.has(key)) url.searchParams.set(key, params.get(key));
    });
    return url.href;
  }
  function link(href, label, className = 'source-link') {
    const node = element('a', className, label);
    node.href = trackedUrl(href);
    node.dataset.trackLink = '';
    if (new URL(node.href).origin !== location.origin) {
      node.target = '_blank'; node.rel = 'noopener noreferrer';
    }
    return node;
  }
  function announceNavigation(action, detail = {}) {
    window.dispatchEvent(new CustomEvent('nova-era:public-navigation', {detail: {action, report_id: report?.id, room: current + 1, ...detail}}));
    // Reuse an existing tracker when the owning deployment supplies one. No key or collector is created here.
    
  }
  function speakCue() {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cues[current]);
    utterance.lang = 'fr-FR'; utterance.rate = .96; speechSynthesis.speak(utterance);
  }
  function go(index, focus = false) {
    current = Math.max(0, Math.min(rooms.length - 1, index));
    rooms.forEach((room, n) => {room.hidden = n !== current; room.classList.toggle('active', n === current); room.setAttribute('aria-hidden', String(n !== current));});
    buttons.forEach((button, n) => {if (n === current) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');});
    $('crumb').textContent = rooms[current].dataset.title;
    $('progressLabel').textContent = `Espace ${String(current + 1).padStart(2,'0')} / ${rooms.length}`;
    $('progressBar').style.width = `${(current + 1) / rooms.length * 100}%`;
    const url = new URL(location.href); url.hash = `salle-${String(current + 1).padStart(2,'0')}`;
    history.replaceState(null, '', url);
    if (focus) {$('main').focus({preventScroll:true}); window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
    speakCue(); announceNavigation('room_open');
  }
  function renderReport(value) {
    report = value;
    document.querySelectorAll('[data-report-title]').forEach(node => {node.textContent = report.title;});
    document.querySelectorAll('[data-report-summary]').forEach(node => {node.textContent = report.summary;});
    document.querySelectorAll('[data-report-context]').forEach(node => {node.textContent = report.context;});
    document.querySelectorAll('[data-report-eyebrow]').forEach(node => {node.textContent = report.eyebrow;});
    document.querySelectorAll('[data-report-link]').forEach(node => {node.href = trackedUrl(report.href); node.dataset.trackLink = '';});
    document.querySelectorAll('[data-pdf-link]').forEach(node => {node.hidden = !report.pdf; if (report.pdf) node.href = trackedUrl(report.pdf); node.dataset.trackLink = '';});
    const facts = $('facts'); facts.replaceChildren();
    if (!report.facts.length) {
      const card = element('article', 'card'); card.append(element('h2','','Lire les données à leur source'),element('p','','Ce rapport vivant affiche ses propres chiffres et horloges. La Maison ne les recopie pas pour ne pas créer un deuxième état de vérité.'),link(report.href,'Ouvrir les chiffres et leurs dates ↗')); facts.append(card);
    }
    report.facts.forEach(fact => {
      const card = element('article','card'); card.append(element('span','badge',fact.status),element('div','metric-label',fact.label));
      const metric = element('div','proof-figure',fact.value + ' '); metric.append(element('small','',fact.unit));
      card.append(metric,element('p','',fact.note),link(fact.url,fact.source+' ↗')); facts.append(card);
    });
    $('methods').replaceChildren(...report.methods.map(value => element('li','',value)));
    $('limits').replaceChildren(...report.limits.map(value => element('li','',value)));
    $('conflicts').replaceChildren(...report.conflicts.map(conflict => {
      const card=element('article','card');card.append(element('span','badge unknown',conflict.status),element('h2','',conflict.title),element('p','',conflict.detail),element('div','disclaimer',conflict.effect));return card;
    }));
    $('sources').replaceChildren(...report.sources.map(source => {
      const box=element('div','source-item');const content=element('div','');content.append(link(source.url,source.title+' ↗'),element('p','small-note',source.note));box.append(content);return box;
    }));
    $('catalog').replaceChildren(...catalog.reports.map(item => {
      const url = new URL(location.href); url.searchParams.set('rapport',item.id);url.hash='salle-01';
      const itemLink=link(url.href,'','catalog-item');itemLink.append(element('span','eyebrow',item.eyebrow),element('h3','',item.title),element('p','small-note',item.summary));return itemLink;
    }));
    $('reportPicker').value=report.id;
    document.title = `La Maison des Preuves · ${report.title} — NOVA ERA`;
    const url=new URL(location.href);url.searchParams.set('rapport',report.id);history.replaceState(null,'',url);
  }
  function releaseScene() {
    const frame=$('houseScene');
    try {frame.contentWindow?.LaBeteHouseGameV1?.exit();} catch (_) {}
    frame.removeAttribute('src');frame.hidden=true;$('sceneWelcome').hidden=false;$('stopScene').hidden=true;$('loadScene').disabled=false;sceneLoading=false;
    $('sceneStatus').textContent='La scène est fermée. Vous pouvez la rouvrir ou continuer la visite documentaire.';
    announceNavigation('scene_close');
  }
  async function loadScene() {
    if (sceneLoading) return; sceneLoading=true;
    const frame=$('houseScene');$('loadScene').disabled=true;
    $('sceneStatus').textContent='Ouverture de la scène Three.js existante et chargement de Nico GLB v2…';
    frame.hidden=false;$('sceneWelcome').hidden=true;$('stopScene').hidden=false;
    frame.src=trackedUrl('../france-debt-rate-risk-live-2026-10-02.html?house=20261005-v11&lecture=explain&lang=fr&maison=1#house-desk');
    frame.onload=async () => {
      if (!frame.getAttribute('src')) return;
      try {
        const child=frame.contentWindow;
        for (let n=0;n<100&&!child.LaBeteHouseGameV1;n++) await new Promise(resolve=>setTimeout(resolve,100));
        if (!child.LaBeteHouseGameV1) throw new Error('SCENE_UNAVAILABLE');
        await child.LaBeteHouseGameV1.enter({pointerLock:false});
        const state=child.LaBeteHouseGameV1.state();
        if (!state.active || !state.native_skeleton_loaded || state.avatar_model_mode !== 'canonical_glb_skinned_curved_face_v2_web_preview') throw new Error('SCENE_NOT_READY');
        $('sceneStatus').textContent='Scène ouverte · Nico GLB v2 chargé · Bureau et Décision · WASD/flèches, E pour interagir. La visite des dix espaces reste dans le menu.';
        frame.dataset.qualified='true';announceNavigation('scene_ready',{avatar:'canonical-v2'});
      } catch (error) {
        $('sceneStatus').textContent='La scène n’a pas pu être ouverte dans ce navigateur. La lecture des dix espaces reste disponible ; vous pouvez ouvrir la scène dans le rapport original.';
        $('sceneStatus').append(link('../france-debt-rate-risk-live-2026-10-02.html?house=20261005-v11#house-desk','Ouvrir LA BÊTE dans une page complète ↗'));
        frame.dataset.qualified='false';announceNavigation('scene_unavailable');
      }
    };
  }
  buttons.forEach(button=>button.addEventListener('click',()=>go(Number(button.dataset.room),true)));
  document.querySelectorAll('[data-next]').forEach(button=>button.addEventListener('click',()=>go(current+1,true)));
  document.querySelectorAll('[data-jump]').forEach(button=>button.addEventListener('click',()=>go(Number(button.dataset.jump),true)));
  document.addEventListener('keydown',event=>{if(event.altKey&&event.key==='ArrowRight')go(current+1,true);if(event.altKey&&event.key==='ArrowLeft')go(current-1,true);});
  document.addEventListener('click',event=>{const target=event.target.closest('a[data-track-link]');if(target)announceNavigation('link_open',{destination:new URL(target.href).pathname});});
  $('reportPicker').addEventListener('change',event=>{const selected=catalog.reports.find(item=>item.id===event.target.value);if(selected){renderReport(selected);go(0,true);}});
  $('loadScene').addEventListener('click',loadScene);$('stopScene').addEventListener('click',releaseScene);
  $('narrationToggle').addEventListener('click',()=>{voiceOn=!voiceOn;$('narrationToggle').setAttribute('aria-pressed',String(voiceOn));$('narrationToggle').textContent=voiceOn?'Désactiver la voix système':'Activer la voix système';if(voiceOn)speakCue();else window.speechSynthesis?.cancel();});
  if(!('speechSynthesis'in window)){$('narrationToggle').disabled=true;$('narrationToggle').textContent='Voix système indisponible';}
  $('copyLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);$('copyStatus').textContent='Lien copié : rapport et espace conservés.';}catch(_){$('copyStatus').textContent=location.href;}});
  const updateCost=()=>{const volume=Number($('volume').value),rate=Number($('rate').value);$('volumeOutput').textContent=volume.toLocaleString('fr-FR')+' Md€';$('rateOutput').textContent='+'+rate.toLocaleString('fr-FR')+' pb';$('costOutput').textContent=(volume*rate/10000).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});};
  $('volume').addEventListener('input',updateCost);$('rate').addEventListener('input',updateCost);updateCost();
  window.addEventListener('pagehide',()=>{window.speechSynthesis?.cancel();});
  window.addEventListener('hashchange',()=>{const n=Number(location.hash.match(/^#salle-(\d+)$/)?.[1]);if(n>=1&&n<=10)go(n-1);});
  fetch('rapports.json',{cache:'no-cache'}).then(response=>{if(!response.ok)throw Error('CATALOG_UNAVAILABLE');return response.json();}).then(value=>{
    catalog=value;
    $('reportPicker').replaceChildren(...catalog.reports.map(item=>{const option=element('option','',item.eyebrow);option.value=item.id;return option;}));
    const requested=params.get('rapport');const selected=catalog.reports.find(item=>item.id===requested)||catalog.reports.find(item=>item.id===catalog.default);
    renderReport(selected);
    const n=Number(location.hash.match(/^#salle-(\d+)$/)?.[1]);go(n>=1&&n<=10?n-1:0);
    document.documentElement.dataset.maisonReady='true';
  }).catch(()=>{$('pageError').hidden=false;$('pageError').textContent='Le catalogue n’a pas pu être chargé. Les liens directs vers les rapports restent disponibles.';});
})();
