/* A view on the existing canonical pulse. No polling, tracking or private API. */
(function () {
  'use strict';
  const D = window.LaBeteDialogue;
  const form = document.getElementById('beastDialogueForm');
  if (!D || !form) return;
  const byId = id => document.getElementById(id);
  const history = [];
  let last = null, current = {live: {}, evolution: {}};
  function element(tag, value, cls) {
    const e = document.createElement(tag);
    if (value !== undefined) e.textContent = String(value);
    if (cls) e.className = cls;
    return e;
  }
  function context() {
    if (typeof window.getLaBeteDialogueContext === 'function') {
      const c = window.getLaBeteDialogueContext();
      if (c?.live) return c;
    }
    return current;
  }
  function message(role, value) {
    const card = element('article', undefined, 'beastMessage beastMessage-' + role);
    card.append(element('strong', role === 'user' ? 'Vous' : 'La Bête'));
    if (typeof value === 'string') card.append(element('p', value));
    else {
      card.append(element('p', value.summary));
      const parts = [['Ce qui est retenu pour examen', value.retained], ['Pourquoi pas encore / limites', value.limits], ['Comment faire évoluer la proposition', value.evolution]];
      parts.forEach(([title, rows]) => {
        if (!rows?.length) return;
        card.append(element('h4', title));
        const list = element('ul');
        rows.forEach(row => list.append(element('li', row)));
        card.append(list);
      });
      if (value.next) { card.append(element('h4', 'Prochaine étape')); card.append(element('p', value.next)); }
      if (value.references?.length) {
        const list = element('div', undefined, 'beastReferences');
        list.append(element('h4', 'Contexte chargé · sources et limites'));
        value.references.forEach(ref => {
          const href = D.safeURL(ref.url);
          if (!href) return;
          const a = element('a', ref.label + ' · ' + ref.status);
          a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
          list.append(a);
          if (ref.checked_at) list.append(element('small', 'Vérification enregistrée : ' + ref.checked_at));
        });
        card.append(list);
      }
      card.append(element('small', value.status + ' · proposition non adoptée · aucune action externe', 'beastStatus'));
    }
    byId('beastDialogueLog').append(card);
    while (byId('beastDialogueLog').children.length > 20) byId('beastDialogueLog').firstElementChild.remove();
    return card;
  }
  function updateShare() {
    byId('beastShareIdea').disabled = !last || !byId('beastPublicConsent').checked || D.sensitive(last.text);
  }
  function submit(value, kind) {
    const c = context();
    const result = D.analyze(value, {...c, kind, history});
    if (result.status === 'INVALID_INPUT') { byId('beastDialogueNotice').textContent = result.summary; return; }
    message('user', value);
    message('assistant', result);
    last = {text: value, kind};
    history.push({...last, result});
    if (history.length > 10) history.shift();
    byId('beastPublicConsent').checked = false;
    byId('beastDialogueNotice').textContent = 'Réponse locale. Rien n’a été envoyé ni ajouté au système partagé.';
    byId('beastExportDialogue').disabled = false;
    updateShare();
  }
  function exportJSON(value, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], {type: 'application/json'}));
    const a = element('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function update(live, evolution) {
    current = {live: live || {}, evolution: evolution || {}};
    const host = byId('beastAcquisitionList');
    if (!host) return;
    host.replaceChildren();
    if (!live || evolution?.source_snapshot_id !== live.snapshot_id || evolution?.status !== 'ACTIVE') {
      host.append(element('p', 'Démarches indisponibles : le flux et l’évolution vérifiée doivent correspondre au même instantané.')); return;
    }
    const acquisition = evolution.self_model?.acquisition;
    const records = acquisition?.requests || [];
    byId('beastAcquisitionStatus').textContent = records.length + ' dossier(s) préparé(s) · aucun envoi attesté';
    if (!records.length) host.append(element('p', 'Aucun dossier actif dans cette projection. Cela ne prouve pas l’absence de tout besoin.'));
    records.forEach(record => {
      const card = element('article', undefined, 'beastAcquisitionCard');
      card.append(element('span', record.state + ' · ' + record.id, 'beastStatus'));
      card.append(element('h3', record.organization));
      card.append(element('p', record.purpose));
      card.append(element('p', record.source_ids.length + ' accès regroupés ; une seule demande préparée.'));
      const list = element('ol', undefined, 'beastSteps');
      (record.steps || []).forEach(s => list.append(element('li', s.name + ' — ' + s.state)));
      card.append(list);
      const details = element('details'); details.append(element('summary', 'Lire la demande écrite préparée'));
      const pre = element('pre', 'Objet : ' + record.subject + '\n\n' + record.draft); details.append(pre); card.append(details);
      const actions = element('div', undefined, 'beastActionRow');
      const copy = element('button', 'Copier le brouillon'); copy.type = 'button';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText('Objet : ' + record.subject + '\n\n' + record.draft); copy.textContent = 'Brouillon copié · non envoyé'; }
        catch (_) { details.open = true; copy.textContent = 'Sélectionner le texte pour le copier'; }
      });
      const download = element('button', 'Exporter le dossier public'); download.type = 'button';
      download.addEventListener('click', () => exportJSON(record, record.id + '.json'));
      actions.append(copy, download); card.append(actions);
      const officialContact = D.safeURL(record.contact?.url);
      if (officialContact) { const a = element('a', 'Ouvrir le formulaire officiel AFT · validation humaine'); a.href = officialContact; a.target = '_blank'; a.rel = 'noopener noreferrer'; card.append(a); }
      card.append(element('p', 'À débloquer dans l’espace privé : ' + record.next_action, 'beastGate'));
      host.append(card);
    });
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = byId('beastDialogueInput').value.trim();
    submit(value, byId('beastDialogueKind').value);
    if (value && value.length <= D.MAX_INPUT) byId('beastDialogueInput').value = '';
  });
  document.querySelectorAll('[data-beast-question]').forEach(button => button.addEventListener('click', () => {
    byId('beastDialogueInput').value = button.dataset.beastQuestion;
    byId('beastDialogueKind').value = button.dataset.beastKind || 'QUESTION';
    byId('beastDialogueInput').focus();
  }));
  byId('beastPublicConsent').addEventListener('change', updateShare);
  byId('beastShareIdea').addEventListener('click', () => {
    try {
      const payload = D.sharePayload(last?.text, last?.kind, byId('beastPublicConsent').checked);
      const url = D.issueURL(payload);
      const a = element('a', 'Ouvrir le brouillon public sur GitHub');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      const notice = byId('beastDialogueNotice'); notice.replaceChildren(element('span', 'Pas encore publié. Un compte GitHub et une confirmation sur GitHub sont nécessaires. '), a);
      a.click();
    } catch (err) { byId('beastDialogueNotice').textContent = 'Publication non préparée : ' + err.message; }
  });
  byId('beastExportDialogue').addEventListener('click', () => exportJSON({schema: D.VERSION, mode: 'LOCAL_ONLY', conversation: history}, 'la-bete-conversation-locale.json'));
  byId('beastClearDialogue').addEventListener('click', () => {
    history.splice(0); last = null; byId('beastDialogueLog').replaceChildren(); byId('beastDialogueInput').value = ''; byId('beastPublicConsent').checked = false; byId('beastExportDialogue').disabled = true; updateShare(); byId('beastDialogueNotice').textContent = 'Conversation locale effacée. Cela ne supprime pas une contribution déjà publiée volontairement sur GitHub.';
  });
  byId('beastDialogueSubmit').disabled = false;
  window.LaBeteParticipation = Object.freeze({update});
  const c = context(); update(c.live, c.evolution);
})();
