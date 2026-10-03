/* Canonical identity -> presentation only. No polling, no analytical mutation. */
(async function () {
  'use strict';
  const root = document.documentElement;
  const endpoint = root.dataset.identityUrl || document.body?.dataset.identityUrl || 'system_identity.json';
  const defaults = {fog_density:.42,fog_red_bias:.68,prism_intensity:.74,prism_dispersion:.56,glass_refraction:.61,copper_glow:.58,membrane_iridescence:.66,particle_density:.35,halo_bloom:.62};
  const fallbackPalette = {night:'#101719',signal_red:'#D34B52',patinated_copper:'#B87333',milk_glass:'#E0C9A2',fog_light:'#EAF0EF'};
  const clamp = (n, fallback=0) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0,Math.min(1,n)) : fallback;
  const color = (v, fallback) => /^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : fallback;
  let identity;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), 12000);
  try {
    const url = new URL(endpoint, document.baseURI);
    if (url.origin !== location.origin) throw Error('Identity origin rejected');
    const response = await fetch(url.href, {cache:'no-store',signal:controller?.signal});
    if (!response.ok) throw Error('HTTP '+response.status);
    identity = await response.json();
    if (!identity.artistic_identity || !['1.0','1.1'].includes(identity.schema_version)) throw Error('Identity schema rejected');
  } catch (error) {
    root.dataset.identityState = 'UNAVAILABLE';
    root.dataset.artMotion = 'calm';
    document.querySelectorAll('.artDNAControls button').forEach(b=>{b.disabled=true;});
    document.querySelectorAll('[data-identity-error]').forEach(n => n.hidden = false);
    document.querySelectorAll('[data-art-state]').forEach(n => n.textContent = 'ADN canonique injoignable · palette de secours statique');
    document.querySelectorAll('[data-track-play]').forEach(n => {n.disabled=true;n.textContent='Identité indisponible · lien Spotify conservé';});
    return;
  } finally { clearTimeout(timeout); }
  const art = identity.artistic_identity;
  const palette = Object.fromEntries(Object.entries(fallbackPalette).map(([k,v])=>[k,color(art.palette?.[k],v)]));
  const dna = Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,clamp(identity.visual_dna?.[k],v)]));
  const paletteVars={night:'--supra-night',signal_red:'--supra-red',patinated_copper:'--supra-copper',milk_glass:'--supra-glass',fog_light:'--supra-fog'};
  for (const [k,v] of Object.entries(paletteVars)) root.style.setProperty(v,palette[k]);
  root.style.setProperty('--supra-amber',palette.patinated_copper);
  const dnaVars={fog_density:'fog-density',fog_red_bias:'fog-red-bias',prism_intensity:'prism-intensity',prism_dispersion:'prism-dispersion',glass_refraction:'glass-refraction',copper_glow:'copper-glow',membrane_iridescence:'iridescence',particle_density:'particle-density',halo_bloom:'halo-bloom'};
  for (const [k,v] of Object.entries(dnaVars)) root.style.setProperty('--beast-'+v,String(dna[k]));
  root.dataset.identityState = 'READY';
  document.querySelectorAll('.artDNAControls button').forEach(b=>{b.disabled=false;});
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  function applyMotion() {
    root.dataset.artMotion = motion.matches || paused ? 'calm' : 'living';
    root.dataset.artVisibility = document.hidden ? 'hidden' : 'visible';
    document.querySelectorAll('button[data-art-motion]').forEach(b=>{b.setAttribute('aria-pressed',String(motion.matches||paused));b.textContent=motion.matches?'Mouvements réduits':paused?'Animer la matière':'Apaiser la matière';});
  }
  document.querySelectorAll('button[data-art-motion]').forEach(b=>b.addEventListener('click',()=>{paused=!paused;applyMotion();}));
  motion.addEventListener?.('change',applyMotion);
  document.addEventListener('visibilitychange',applyMotion);
  document.querySelectorAll('button[data-art-effects]').forEach(b=>b.addEventListener('click',()=>{
    const essential=root.dataset.artEffects!=='essential';root.dataset.artEffects=essential?'essential':'full';b.setAttribute('aria-pressed',String(essential));b.textContent=essential?'Réactiver les prismes':'Alléger les effets';window.refreshBeastIdentity?.();
  }));
  applyMotion();
  function project(feed, evolution) {
    const s=feed?.summary, known=typeof s?.monitored==='number' && s.monitored>0 && typeof s.warnings==='number' && typeof s.healthy==='number';
    const pressure=known?clamp(s.warnings/s.monitored):0,serenity=known?clamp(s.healthy/s.monitored):0;
    const signal=feed?.snapshot_id && evolution?.source_snapshot_id===feed.snapshot_id ? evolution.dna?.signal : null;
    const regime=signal?.curve_regime||feed?.decision_delta?.curve_regime||'UNKNOWN';
    const material=(signal?.decision_delta_status||s?.decision_delta_status)==='MATERIAL_CHANGE';
    const projection=Object.freeze({known,pressure,serenity,regime,material,palette,dna,
      fog:clamp(dna.fog_density*(.8+.45*pressure)),red:clamp(dna.fog_red_bias*(.7+.4*pressure)),
      copper:clamp(dna.copper_glow*(.8+(material ? .2 : 0))),prism:clamp(dna.prism_intensity*(.65+.2*serenity+(material ? .15 : 0))),
      iridescence:clamp(dna.membrane_iridescence*(.8+.2*serenity)),refraction:dna.glass_refraction,
      halo:clamp(dna.halo_bloom*(.8+(material ? .2 : 0)))});
    root.style.setProperty('--beast-fog-live',String(projection.fog));
    root.style.setProperty('--beast-prism-live',String(projection.prism));
    root.style.setProperty('--beast-red-live',String(projection.red));
    root.style.setProperty('--beast-halo-live',String(projection.halo));
    root.style.setProperty('--beast-prism-tilt',regime==='STEEPENING'?'12deg':regime==='FLATTENING'?'-8deg':'0deg');
    root.dataset.artSignal=known?'OBSERVED_SNAPSHOT':'UNKNOWN';
    root.dataset.artMaterial=material?'material':'stable';
    document.querySelectorAll('[data-art-state]').forEach(n=>n.textContent=known?'ADN vivant · '+s.warnings+'/'+s.monitored+' sources en alerte · '+regime+' · projection artistique, pas diagnostic national':'ADN canonique · signal inconnu · projection artistique neutre');
    return projection;
  }
  window.SupraIdentity=Object.freeze({identity,project});
  document.querySelectorAll('[data-identity-name]').forEach(n=>n.textContent=art.name||'La Bête');
  document.querySelectorAll('[data-identity-art]').forEach(img=>{
    if (!art.image_asset) return;const u=new URL(art.image_asset,document.baseURI);if(u.origin===location.origin)img.src=u.href;
  });
  const music=identity.music||{};
  const spotifyURL=(value,embed=false)=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='open.spotify.com'&&(embed?/^\/embed\/track\/[A-Za-z0-9]+$/:/^\/track\/[A-Za-z0-9]+$/).test(u.pathname)?u:null;}catch{return null;}};
  document.querySelectorAll('[data-track-title]').forEach(n=>n.textContent=(music.title||'Musique')+' · '+(music.artist||''));
  const track=spotifyURL(music.track_url);
  document.querySelectorAll('[data-track-link]').forEach(n=>{if(track){n.href=track.href;n.target='_blank';n.rel='noopener noreferrer';}});
  document.querySelectorAll('[data-track-play]').forEach(button=>button.addEventListener('click',()=>{
    const host=button.closest('[data-track]'),embed=spotifyURL(music.embed_url,true);
    if(!host||!embed||music.playback!=='click_to_load')return;
    const existing=host.querySelector('iframe');
    if(existing){existing.remove();clearTimeout(button._trackTimer);button.setAttribute('aria-pressed','false');button.removeAttribute('aria-busy');button.textContent='Charger le lecteur Spotify';return;}
    embed.searchParams.set('theme','0');
    const frame=document.createElement('iframe');
    frame.title=(music.title||'Musique')+' — '+(music.artist||'')+' · Spotify';
    frame.loading='eager';frame.referrerPolicy='no-referrer';frame.height='152';frame.style.width='100%';
    frame.allow='encrypted-media; clipboard-write; fullscreen; picture-in-picture';
    button.setAttribute('aria-pressed','true');button.setAttribute('aria-busy','true');button.textContent='Chargement Spotify… · fermer';
    const finish=()=>{clearTimeout(button._trackTimer);button.removeAttribute('aria-busy');button.textContent='Fermer le lecteur · lecture dans Spotify';};
    frame.addEventListener('load',finish,{once:true});
    frame.addEventListener('error',()=>{clearTimeout(button._trackTimer);button.removeAttribute('aria-busy');button.textContent='Lecteur indisponible · fermer et ouvrir Spotify';},{once:true});
    button._trackTimer=setTimeout(()=>{button.removeAttribute('aria-busy');button.textContent='Chargement non confirmé · ouvrir Spotify';},12000);
    frame.src=embed.href;host.appendChild(frame);
  }));
  if(typeof window.refreshBeastIdentity==='function')window.refreshBeastIdentity();else project(null,null);
})();
