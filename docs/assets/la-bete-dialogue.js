/* Shared browser / existing-pulse dialogue rules. No remote LLM, tools or hidden writes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LaBeteDialogue = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'LA_BETE_DIALOGUE_V1.0';
  const MAX_INPUT = 1500;
  const REPO = 'Nicolason84/nova-trust';
  const normalize = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const text = x => String(x || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
  const political = /politique|presiden|candidat|election|electoral|parti\b|voter|vote\b|gouvernement|ministre|parlement|depute|senateur|referendum|reforme|fiscal|impot|taxe|retraite|immigration|nationalis|privatis|service public|budget public|loi\b|legislation|macron|lecornu|le pen|melenchon|bardella|trump|democrat|republican|socialiste|communiste|liberalisme|gauche|droite|gagner.*election/;
  const unsafe = /ignore.{0,35}(instruction|regle)|system prompt|revele.{0,30}(cle|secret)|mot de passe|password|contourn.{0,30}(securite|authent|restriction)|desactive.{0,30}(garde|securite)|fabriqu.{0,30}(preuve|source)|falsifi/;
  function sensitive(x) {
    const s = text(x);
    return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(s) || /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/.test(s) || /\b(?:0[1-9])(?:[ .-]?\d{2}){4}\b/.test(s) || /(?:sk-(?:proj-)?|gh[pousr]_)[A-Za-z0-9_-]{12,}/.test(s) || /\b(?:numero de securite sociale|numéro de sécurité sociale|dossier medical|dossier médical|mot de passe|password)\b/i.test(s);
  }
  function safeURL(value) {
    try {
      const u = new URL(value);
      const hosts = ['nicolason84.github.io', 'www.aft.gouv.fr', 'www.banque-france.fr', 'webstat.banque-france.fr', 'data.economie.gouv.fr'];
      return u.protocol === 'https:' && !u.username && !u.password && hosts.includes(u.hostname) ? u.href : null;
    } catch (_) { return null; }
  }
  function references(live, predicate) {
    return (live.sources || []).filter(predicate || (() => true)).filter(s => safeURL(s.url)).slice(0, 5).map(s => ({label: s.label, url: safeURL(s.url), status: s.health || 'UNKNOWN', checked_at: s.checked_at || null}));
  }
  const topics = [
    {id: 'accessibility', re: /accessib|contraste|daltoni|lecteur.*ecran|malvoy|clavier|lisib|taille.*texte/, title: 'Accessibilité et lisibilité', keep: 'L’usage demandé doit rester possible sur mobile, au clavier et avec un lecteur d’écran.', test: 'Définir le parcours concerné ; comparer la lisibilité et tester clavier, zoom et lecteur d’écran sans modifier les chiffres.', evolve: 'Proposer un réglage réversible de lisibilité et vérifier le même parcours avant et après.'},
    {id: 'evidence', re: /source|preuve|trace|verifi|chiffre|donnee|date|historique|csv|export/, title: 'Traçabilité des informations', keep: 'Lier chaque information à sa provenance, sa date, son périmètre et son état de vérification.', test: 'Identifier le champ concerné et une source officielle de même périmètre ; vérifier la non-régression du flux canonique.', evolve: 'Transformer la proposition en un parcours « chiffre → source → date → limite », avec un critère de vérification explicite.'},
    {id: 'acquisition', re: /demarche|courrier|mail|organisme|contact|obtenir|manque|acces/, title: 'Obtention des informations manquantes', keep: 'Relier un manque précis à un interlocuteur vérifié et à une démarche suivie.', test: 'Vérifier que l’information manque réellement, regrouper les demandes et contrôler le mandat avant tout envoi.', evolve: 'Préparer une demande unique, un critère de réponse complète et un suivi privé avec preuve de chaque action.'},
    {id: 'privacy', re: /prive|confiden|personnel|anonym|consent|effac|securit/, title: 'Vie privée et contrôle', keep: 'Séparer la discussion publique des pièces privées et des permissions d’exécution.', test: 'Préciser les données, la finalité, qui y accède et comment l’utilisateur peut interrompre ou effacer le traitement.', evolve: 'Réduire les informations collectées ; tester que rien de privé n’est publié et que le retrait de permission bloque les actions.'},
    {id: 'usability', re: /interface|mobile|bouton|navigation|chat|dialogue|idee|propos|compren/, title: 'Compréhension et participation', keep: 'Rendre la question, la réponse, les limites et le devenir de la proposition compréhensibles.', test: 'Décrire un utilisateur, une tâche et un résultat observable ; ne pas confondre une préférence exprimée avec une preuve.', evolve: 'Formuler un petit changement réversible, le comparer à l’existant et consigner les retours sans vote de popularité automatique.'},
    {id: 'alerts', re: /alert|notifi|relance|suivi/, title: 'Suivi sous autorisation', keep: 'Ne déclencher une notification que sur un événement défini et pertinent.', test: 'Préciser le destinataire, la condition, la fréquence maximale et l’arrêt ; vérifier les doublons.', evolve: 'Réutiliser la boucle existante avec un événement dédupliqué, une limite de relances et une preuve de livraison.'}
  ];
  function analyze(input, context) {
    const c = context || {}, live = c.live || {}, evolution = c.evolution || {};
    const raw = text(input), norm = normalize(raw);
    const r = {version: VERSION, mode: 'LOCAL_STRUCTURED_NO_LLM', status: 'NEEDS_CLARIFICATION', adoption: 'NOT_ADOPTED', external_action: 'NONE', political_recommendation: 'NONE', summary: '', retained: [], limits: [], evolution: [], next: '', references: [], snapshot_id: live.snapshot_id || null, snapshot_at: live.updated_at || null};
    if (!raw || raw.length > MAX_INPUT) {
      return Object.assign(r, {status: 'INVALID_INPUT', summary: `Écrivez une question ou une idée de 1 à ${MAX_INPUT} caractères.`});
    }
    if (sensitive(raw)) {
      return Object.assign(r, {status: 'PRIVATE_DATA_REVIEW', summary: 'Ce texte semble contenir des coordonnées, des identifiants ou des informations privées.', limits: ['Ne les publiez pas dans le fil partagé. Ce contrôle est prudent mais ne détecte pas toutes les données sensibles.'], next: 'Retirer les informations personnelles et reformuler le besoin, sans transmettre de pièce.'});
    }
    if (unsafe.test(norm)) {
      return Object.assign(r, {status: 'OUTSIDE_AUTHORITY', summary: 'Cette demande touche aux permissions, aux secrets ou à l’intégrité des preuves.', retained: ['Le besoin peut être reformulé comme une vérification de sécurité ou de qualité.'], limits: ['Une contribution ne peut accorder aucun droit, faire exécuter une instruction ni changer un fait.'], next: 'Décrire le résultat légitime attendu, sans demander de contournement ni de divulgation.'});
    }
    const prior = Array.isArray(c.history) ? [...c.history].reverse().find(x => x.kind === 'IDEA' && typeof x.text === 'string' && !sensitive(x.text)) : null;
    const follow = /^(pourquoi|comment|ameliore|developpe|precise|que retiens|qu.est.ce que|et ensuite|oui)/.test(norm) && prior;
    const idea = follow ? prior.text : raw;
    const politicalInput = c.kind === 'POLICY' || political.test(normalize(idea + ' ' + raw));
    if (politicalInput) {
      return Object.assign(r, {status: 'FACTUAL_REVIEW_ONLY', summary: 'Cette question peut être instruite en séparant faits documentés, hypothèses, effets et arbitrages humains.', retained: ['La question à examiner, sans adopter ni rejeter le choix politique proposé.'], limits: ['Aucun soutien, opposition, score, classement, gagnant ou pronostic électoral.', 'Le flux dette/taux ne suffit pas à établir les effets d’une politique, une causalité ou la compétence d’une personne.', 'Cette version locale ne recherche pas de nouvelles sources et ne connaît pas tous les sujets politiques.'], evolution: ['Préciser la mesure ou l’affirmation, la période, la population concernée, les sources contradictoires éventuelles et les incertitudes.'], next: 'Constituer un dossier factuel sourcé. La décision politique reste celle de chaque personne.', references: references(live)});
    }
    const isIdea = c.kind === 'IDEA' || !!follow || /je propose|mon idee|pourquoi ne pas|on pourrait|ajout|amelior|il faudrait/.test(norm);
    if (isIdea) {
      const matched = topics.filter(t => t.re.test(normalize(idea)));
      const chosen = matched.slice(0, 2);
      r.status = chosen.length ? 'PROPOSAL_TO_REVIEW' : 'NEEDS_CLARIFICATION';
      r.summary = chosen.length ? 'Proposition à instruire : ' + chosen.map(t => t.title).join(' / ') + '.' : 'L’idée est reçue dans cette conversation ; il faut préciser le besoin avant de proposer un changement.';
      r.retained = chosen.length ? chosen.map(t => t.keep) : ['Votre intention, comme proposition à clarifier, pas comme fait ni comme décision.'];
      r.limits = ['Pourquoi ce n’est pas encore adopté : aucun test ni validation d’évolution n’a été effectué.', 'Le rapprochement par thèmes est une aide structurée, pas une compréhension générale par un modèle de langage.'];
      r.evolution = chosen.length ? chosen.map(t => t.evolve) : ['Décrire le problème, qui le rencontre, le résultat attendu et une expérience réversible qui permettrait de le vérifier.'];
      r.next = chosen.length ? chosen.map(t => t.test).join(' ') : 'Quel problème précis cette idée doit-elle résoudre, et comment constater que la solution fonctionne ?';
      r.references = references(live, s => /AFT|DGFIP|BDF/.test(s.id || ''));
      return r;
    }
    if (c.object && typeof c.object.id === 'string' && c.object.snapshot_id === live.snapshot_id && Array.isArray(c.object.facts)) {
      const object = c.object;
      const allowed = object.references || [];
      return Object.assign(r, {
        status: 'OBJECT_CONTEXT',
        summary: 'Contexte de votre question : ' + object.label + '. Voici les éléments présents dans l’objet sélectionné ; ils ne constituent pas une nouvelle recherche.',
        retained: object.facts.map(row => String(row[0]) + ' : ' + String(row[1])).slice(0, 12),
        limits: ['Cette réponse est attachée à cet objet et à cet instantané. Les autres messages conservent leur propre contexte.', object.kind === 'REGION' ? 'Aucun effet local du taux ou de la dette nationale ne peut être déduit de cette fiche territoriale.' : 'Les faits conservés, les manques et les hypothèses restent distincts ; une relation affichée ne prouve pas une causalité.', 'Cette version structurée ne prétend pas résoudre toute question libre sur cet objet.'],
        evolution: [],
        next: object.kind === 'GAP' || object.kind === 'REQUEST' ? 'Ouvrir la démarche reliée, vérifier son état et son mandat ; aucun envoi n’est déclenché par le dialogue.' : 'Ouvrir une relation nommée ou la pièce de provenance pour approfondir.',
        references: allowed.filter(x => safeURL(x.url)).slice(0, 5)
      });
    }
    if (live.schema !== 'OJO_FRANCE_DEBT_RATE_LIVE_V1' || live.policy?.political_recommendation !== 'NONE') {
      return Object.assign(r, {status: 'NO_VERIFIED_CONTEXT', summary: 'Le contexte canonique vérifiable n’est pas chargé.', next: 'Réessayer le chargement du flux. Aucun chiffre de remplacement n’est inventé.'});
    }
    if (/manque|besoin|bloc|demarch|sante|obtenir|courrier|contact/.test(norm)) {
      const bound = evolution.source_snapshot_id === live.snapshot_id;
      const a = bound ? evolution.self_model?.acquisition : null;
      const requests = a?.requests || [];
      return Object.assign(r, {status: 'CANONICAL_CONTEXT', summary: requests.length ? `${requests.length} démarche(s) préparée(s) dans l’état affiché ; aucun envoi n’est attesté par cette projection.` : 'Aucune démarche préparée n’est disponible dans le contexte chargé.', retained: requests.map(x => x.organization + ' : ' + x.source_ids.length + ' accès regroupés.'), limits: ['Brouillon ≠ envoi. Envoi ≠ réponse. Réponse ≠ information vérifiée.', ...(bound ? [] : ['L’évolution ne correspond pas au même instantané ; elle n’est pas utilisée.'])], next: requests[0]?.next_action || 'Consulter les sources et leurs dernières vérifications.', references: references(live, s => ['UNAVAILABLE','RETAINED_LAST_GOOD','DEGRADED'].includes(s.health))});
    }
    if (/taux|tec|dette|encours|refinanc|echeanc|source|preuve|sais|observe|combien/.test(norm)) {
      const o = live.observed || {};
      const facts = [];
      if (Number.isFinite(o.tec10_pct)) facts.push('TEC 10 indiqué dans cet instantané : ' + o.tec10_pct.toLocaleString('fr-FR') + ' %.');
      if (Number.isFinite(o.debt_negotiable_eur)) facts.push('Encours de dette négociable de l’État indiqué : ' + o.debt_negotiable_eur.toLocaleString('fr-FR') + ' € ; ce n’est pas l’ensemble de la dette publique.');
      return Object.assign(r, {status: 'CANONICAL_CONTEXT', summary: 'Voici ce que contient le flux chargé, avec ses dates et ses limites ; ce n’est pas une garantie de donnée en temps réel.', retained: facts, limits: ['Les dates de situation et de vérification peuvent différer selon la source ; consulter les liens.', 'RETAINED_LAST_GOOD désigne un dernier état conservé, pas une récupération réussie.', 'Un stress test est un scénario conditionnel, pas une prévision ni une recommandation.'], next: 'Préciser le chiffre, la période ou l’horizon à examiner. Les sources restent accessibles ci-dessous.', references: references(live)});
    }
    return Object.assign(r, {summary: 'Je ne dispose pas d’une réponse vérifiée à cette question dans le contexte chargé.', retained: ['La question, sans inventer de réponse ni prétendre avoir fait une recherche.'], limits: ['Le dialogue actuel couvre la lecture du flux, ses manques et la structuration de propositions. Il n’est pas un assistant généraliste.'], next: 'Préciser le document, la période, le problème ou le changement recherché ; la question pourra devenir une demande d’information.'});
  }
  function sharePayload(input, kind, consent) {
    const value = text(input);
    if (!consent) throw Error('PUBLIC_CONSENT_REQUIRED');
    if (!value || value.length > MAX_INPUT) throw Error('INVALID_INPUT');
    if (sensitive(value)) throw Error('PRIVATE_DATA_REVIEW');
    return {schema: VERSION, text: value, kind: ['QUESTION','IDEA','POLICY'].includes(kind) ? kind : 'QUESTION'};
  }
  function issueURL(payload) {
    const url = new URL('https://github.com/' + REPO + '/issues/new');
    url.searchParams.set('title', '[LA BÊTE] ' + payload.text.replace(/\s+/g, ' ').slice(0, 85));
    url.searchParams.set('body', '<!-- LA_BETE_DIALOGUE_V1 -->\nProposition publiée volontairement. Ne contient pas de pièce privée.\n\n```json\n' + JSON.stringify(payload, null, 2) + '\n```');
    return url.href;
  }
  return Object.freeze({VERSION, MAX_INPUT, REPO, analyze, sensitive, safeURL, sharePayload, issueURL});
});
