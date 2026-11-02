/* ojO FRANCE · consent-based, cookie-free, minimal audience signals.
 * This static page is not a redirect or a traffic counter on GitHub itself.
 * Source/channel labels are deliberately coarse; raw referrers and URLs are never sent.
 * No requests to the analytics provider occur before the visitor consents.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const banner = $('audienceChoice');
  const status = $('audienceStatus');
  const savedKey = 'ojo_france_optional_audience_v1';
  const allowedOrigin = new Set(['linkedin', 'partage', 'email', 'whatsapp', 'direct', 'autre']);
  const allowedCampaign = new Set(['episode01', 'episode02', 'decouverte']);
  const params = new URLSearchParams(location.search);
  const origin = allowedOrigin.has(params.get('origine')) ? params.get('origine') : 'indefini';
  const campaign = allowedCampaign.has(params.get('campagne')) ? params.get('campagne') : 'decouverte';
  const pageInstanceId = self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : 'ephemeral-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
  let memoryChoice = null;
  let configPromise = null;
  let firstVisitEmitted = false;

  const getChoice = () => {
    try { return localStorage.getItem(savedKey); } catch { return memoryChoice; }
  };
  const setChoice = value => {
    memoryChoice = value;
    try { localStorage.setItem(savedKey, value); } catch { /* browser privacy mode: session only */ }
  };
  const referrerGroup = () => {
    try {
      if (!document.referrer) return 'absent';
      const domain = new URL(document.referrer).hostname.toLowerCase();
      if (domain === 'linkedin.com' || domain.endsWith('.linkedin.com') || domain === 'lnkd.in') return 'linkedin';
      if (domain === 'wa.me' || domain === 'web.whatsapp.com' || domain.endsWith('.whatsapp.com')) return 'whatsapp';
      if (domain === 'nicolason84.github.io') return 'site_nova_era';
      return 'autre_site';
    } catch { return 'absent'; }
  };

  function validConfig(cfg) {
    return cfg && typeof cfg === 'object' && /^phc_[A-Za-z0-9_-]{10,}$/.test(cfg.public_project_key) &&
      cfg.api_host === 'https://eu.i.posthog.com' && cfg.collect_personal_data === false;
  }
  async function config() {
    if (!configPromise) configPromise = fetch('./analytics-config.json', { credentials: 'omit', cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('CONFIG_NOT_PUBLISHED');
        return response.json();
      }).then(cfg => {
        if (!validConfig(cfg)) throw new Error('CONFIG_INVALID');
        return cfg;
      });
    return configPromise;
  }
  async function track(event) {
    if (getChoice() !== 'yes') return false;
    if (!['ojo_france_visit', 'ojo_france_la_bete_click', 'ojo_france_share_copy'].includes(event)) return false;
    try {
      const cfg = await config();
      const payload = {
        api_key: cfg.public_project_key,
        event,
        timestamp: new Date().toISOString(),
        properties: {
          distinct_id: pageInstanceId,
          $process_person_profile: false,
          $geoip_disable: true,
          source_lien_initial: origin,
          campagne: campaign,
          provenance_referrer: referrerGroup(),
          page: 'ojo_france_entree_v1',
          personnalisation: false
        }
      };
      const response = await fetch(cfg.api_host + '/i/v0/e/', {
        method: 'POST', mode: 'cors', credentials: 'omit', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('COLLECT_REJECTED');
      return true;
    } catch {
      // Audience tracking cannot break the educational page or its outgoing links.
      return false;
    }
  }
  function showChoice() {
    banner.style.display = 'block';
  }
  function hideChoice() {
    banner.style.display = 'none';
  }
  function describeChoice() {
    const choice = getChoice();
    status.textContent = choice === 'yes' ? 'Mesure facultative activée. Vous pouvez la désactiver.'
      : choice === 'no' ? 'Mesure facultative refusée. Aucun événement envoyé.'
      : 'Mesure facultative non configurée.';
  }
  function reportVisit() {
    if (firstVisitEmitted || getChoice() !== 'yes') return;
    firstVisitEmitted = true;
    void track('ojo_france_visit');
  }

  $('acceptAudience').addEventListener('click', () => {
    setChoice('yes');
    hideChoice();
    describeChoice();
    reportVisit();
  });
  $('declineAudience').addEventListener('click', () => {
    setChoice('no');
    hideChoice();
    describeChoice();
  });
  $('privacyPreferences').addEventListener('click', showChoice);

  document.querySelectorAll('a[data-measure="open_la_bete"]').forEach(link => {
    link.addEventListener('click', () => { void track('ojo_france_la_bete_click'); }, { passive: true });
  });

  $('copyLink').addEventListener('click', async () => {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set('origine', 'partage');
    url.searchParams.set('campagne', 'episode02');
    try {
      await navigator.clipboard.writeText(url.href);
      $('copyFeedback').textContent = 'Lien public copié. Son ouverture sera comptée si le lecteur accepte les statistiques.';
      void track('ojo_france_share_copy');
    } catch {
      $('copyFeedback').textContent = 'Copie non autorisée par le navigateur : sélectionnez le lien dans la barre d’adresse.';
    }
  });

  if (getChoice() === 'yes') reportVisit();
  else if (getChoice() !== 'no') showChoice();
  describeChoice();
})();