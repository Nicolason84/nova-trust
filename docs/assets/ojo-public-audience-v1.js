/* Optional first-party analytics — existing NOVA ERA audience circuit, extended to the public House and report routes.
   No cookies, no recorder, no visitor identity, no personal data, no network before opt-in.
   One ephemeral distinct ID per page load; measure openings, not unique individuals. */
(() => {
  'use strict';
  const pages = Object.freeze({
    'france-debt-rate-risk-live-2026-10-02.html':'la_bete_aft',
    'valerii-real-estate-returns-osint-2026-09-19.html':'ojo_valerii',
    'speed-to-cash-colasante-2026-09-19.html':'ojo_colasante',
    'agentic-ai-memory-fahs-2026-09-19.html':'ojo_fahs',
    'russie-actifs-gazel-2026-09-19.html':'ojo_gazel',
    'newfund-infinite-orbits-procurement-2026-09-19.html':'ojo_newfund',
    'krimi-premier-echange-2026-09-20.html':'ojo_krimi'
  });
  const path = location.pathname.split('/').pop();
  const surface = location.pathname.endsWith('/maison-des-preuves/') || location.pathname.endsWith('/maison-des-preuves/index.html') ? 'la_bete_maison' : location.pathname.endsWith('/la-bete/') || location.pathname.endsWith('/la-bete/index.html') ? 'la_bete_accueil' : location.pathname.endsWith('/rapports/episode-2-dette-taux/') || location.pathname.endsWith('/rapports/episode-2-dette-taux/index.html') ? 'la_bete_episode02' : pages[path];
  if (!surface) return;
  const preference = 'nova_era_public_audience_consent_v1';
  const configURL = new URL('../france/analytics-config.json',document.currentScript.src).href;
  const tags = new Set(['linkedin','partage','email','whatsapp','direct','autre','sans_marquage']);
  const campaignTags = new Set(['episode01','episode02','ojofrance','decouverte']);
  const search = new URLSearchParams(location.search);
  const safe = (value,set,fallback) => set.has(value) ? value : fallback;
  const originHint = safe(search.get('origine') || search.get('utm_source'),tags,'sans_marquage');
  const campaignHint = safe(search.get('campagne') || (search.get('utm_campaign')==='la_bete_ep02'?'episode02':null),campaignTags,'decouverte');
  const id = self.crypto?.randomUUID?.() || 'event-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
  let decisionMemory = null;
  let firstVisitSent = false;
  let configPromise = null;
  const getDecision = () => {
    try { return localStorage.getItem(preference) || decisionMemory; }
    catch { return decisionMemory; }
  };
  const saveDecision = value => {
    decisionMemory = value;
    try { localStorage.setItem(preference,value); } catch { /* session-only privacy mode */ }
  };
  function referrerCategory() {
    try {
      if (!document.referrer) return 'inconnu';
      const host = new URL(document.referrer).hostname.toLowerCase();
      if (host==='linkedin.com' || host.endsWith('.linkedin.com') || host==='lnkd.in') return 'linkedin';
      if (host==='wa.me' || host==='web.whatsapp.com' || host.endsWith('.whatsapp.com')) return 'whatsapp';
      if (host==='nicolason84.github.io') return 'interne';
      return 'autre_site';
    } catch { return 'inconnu'; }
  }
  function configuration() {
    if (!configPromise) configPromise = fetch(configURL,{credentials:'omit',cache:'no-store'})
      .then(r => {if(!r.ok)throw Error('ANALYTICS_CONFIG_MISSING');return r.json()})
      .then(c => {
        if (!c || c.api_host!=='https://eu.i.posthog.com' ||
            !/^phc_[A-Za-z0-9_-]{10,}$/.test(c.public_project_key) || c.collect_personal_data!==false)
          throw Error('ANALYTICS_CONFIG_REJECTED');
        return c;
      });
    return configPromise;
  }
  async function capture(event,action='') {
    if(getDecision()!=='yes')return false;
    if(!['ojo_public_visit','ojo_public_action'].includes(event))return false;
    if(event==='ojo_public_action' && !/^(open_dialogue|view_evidence|open_scenario|copy_historic_link|open_la_bete|external_source|open_explore|dialogue_submit_click|open_report|download_pdf|download_editable)$/.test(action))return false;
    try {
      const config=await configuration();
      const response=await fetch(config.api_host+'/i/v0/e/',{
        method:'POST', mode:'cors',credentials:'omit',keepalive:true,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          api_key:config.public_project_key,event,
          timestamp:new Date().toISOString(),
          properties:{
            distinct_id:id, $process_person_profile:false, $geoip_disable:true,
            surface,action:action||'page_open',source_hint:originHint,campagne:campaignHint,
            referrer_group:referrerCategory(),telemetry:'consented_ephemeral_no_cookie'
          }
        })
      });
      return response.ok;
    } catch { return false; }
  }
  function captureVisit() {
    if (firstVisitSent || getDecision()!=='yes')return;
    firstVisitSent=true;
    void capture('ojo_public_visit');
  }
  function dom() {
    if (!document.body) return;
    const style=document.createElement('style');
    style.textContent =
      '.ojo-audience-choice{position:fixed;z-index:9999;right:14px;bottom:14px;width:min(420px,calc(100vw - 28px));background:#112732f5;color:#e8f5f0;border:1px solid #769795;border-radius:17px;box-shadow:0 10px 50px #0009;padding:17px;font:14px/1.5 system-ui,sans-serif}'+
      '.ojo-audience-choice p{margin:4px 0 13px;color:#c1d5d3;font-size:12px}'+
      '.ojo-audience-choice strong{font-size:14px;color:#fff}.ojo-audience-choice .ojo-buttons{display:flex;flex-wrap:wrap;gap:9px}'+
      '.ojo-audience-choice button{appearance:none;cursor:pointer;font:700 13px system-ui,sans-serif;border-radius:30px;border:1px solid #b6c9c1;background:#1d3945;color:#fff;padding:9px 13px;min-height:42px}'+
      '.ojo-audience-choice button:first-child{background:#efd0a0;color:#182c32;border-color:#efd0a0}'+
      '.ojo-audience-settings{position:fixed;z-index:9998;bottom:6px;left:8px;border:0;border-radius:99px;padding:4px 9px;font:11px system-ui,sans-serif;background:#142a32d9;color:#b7cfd0;cursor:pointer}'+
      '.ojo-audience-choice button:focus-visible,.ojo-audience-settings:focus-visible{outline:3px solid #efd0a0;outline-offset:2px}'+
      '@media(max-width:500px){.ojo-audience-choice{bottom:12px;padding:14px}.ojo-audience-settings{font-size:10px}}';
    document.head.appendChild(style);
    const box=document.createElement('div');
    box.className='ojo-audience-choice';
    box.setAttribute('role','group');
    box.setAttribute('aria-label',"Mesure d'audience facultative");
    const title=document.createElement('strong');
    title.textContent='Mesurer la portée de NOVA ERA ?';
    const explanation=document.createElement('p');
    explanation.textContent="Avec votre accord, nous comptons les ouvertures de cette page et les clics utiles, même après partage hors LinkedIn. Pas de cookie de suivi, pas de profil ni d'enregistrement d'écran. La préférence est mémorisée localement. Vous pouvez refuser et changer d'avis.";
    const buttons=document.createElement('div');buttons.className='ojo-buttons';
    const yes=document.createElement('button');yes.type='button';yes.textContent='Oui, compter ma visite';
    const no=document.createElement('button');no.type='button';no.textContent='Non, continuer';
    buttons.append(yes,no);box.append(title,explanation,buttons);
    document.body.appendChild(box);
    const toggle=document.createElement('button');
    toggle.className='ojo-audience-settings';toggle.type='button';toggle.textContent='Audience · préférences';
    toggle.setAttribute('aria-label',"Modifier l'autorisation de mesure d'audience");
    document.body.appendChild(toggle);
    const display=() => {box.hidden=getDecision()==='yes'||getDecision()==='no';box.style.display=box.hidden?'none':'block';};
    yes.addEventListener('click',()=>{saveDecision('yes');display();captureVisit()});
    no.addEventListener('click',()=>{saveDecision('no');display()});
    toggle.addEventListener('click',()=>{box.hidden=false;box.style.display='block';});
    display();
  }
  function interactions() {
    document.addEventListener('click',event=>{
      if (getDecision()!=='yes') return;
      const element=event.target?.closest?.('a,button');
      if (!element) return;
      let action=element.getAttribute('data-ojo-action');
      if (!action) {
        const href=element.getAttribute('href')||'';
        if (element.hasAttribute('data-report-link') || /\/rapports\//.test(href) && !/\.(pdf|pptx)(\?|$)/.test(href))action='open_report';
        else if (/\.pdf(\?|$)/.test(href))action='download_pdf';
        else if (/\.pptx(\?|$)/.test(href))action='download_editable';
        else if (href.includes('/maison-des-preuves/'))action='view_evidence';
        else if (href.includes('/la-bete/'))action='open_la_bete';
        else if (href==='#evidence-graph')action='view_evidence';
        else if (href==='#experience-explore')action='open_explore';
        else if (element.id==='beastDialogueSubmit')action='dialogue_submit_click';
        else if (href.startsWith('http')) {
          try {
            const host=new URL(href,location.href).hostname;
            if (host==='www.aft.gouv.fr'||host==='www.banque-france.fr'||host.endsWith('.gouv.fr'))action='external_source';
          }catch{}
        }
      }
      if (action && /^(open_dialogue|view_evidence|open_scenario|open_la_bete|external_source|open_explore|dialogue_submit_click|open_report|download_pdf|download_editable)$/.test(action))
        void capture('ojo_public_action',action);
    },{passive:true});
    window.addEventListener('nova-era:public-navigation',event=>{if(event.detail?.action==='room_open'||event.detail?.action==='scene_ready')void capture('ojo_public_action','open_explore');});
    document.addEventListener('ojo-france:link-copied',()=>{void capture('ojo_public_action','copy_historic_link')});
  }
  if (document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{dom();interactions();captureVisit()},{once:true});
  else{dom();interactions();captureVisit();}
})();