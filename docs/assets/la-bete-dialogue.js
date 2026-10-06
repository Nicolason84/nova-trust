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
      const hosts = ['nicolason84.github.io', 'www.aft.gouv.fr', 'www.banque-france.fr', 'webstat.banque-france.fr', 'data.economie.gouv.fr','www.economie.gouv.fr','geo.api.gouv.fr','www.insee.fr','www.assemblee-nationale.fr','lannuaire.service-public.gouv.fr','www.nogentsuroise.fr'];
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
    if(c.kind!=='POLICY'&&!political.test(norm)){const cashAnswer=Cash.explanation(raw,c);if(cashAnswer)return Object.assign(r,cashAnswer,{snapshot_id:null,snapshot_at:null});}
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
        limits: ['Cette réponse est attachée à cet objet et à cet instantané. Les autres messages conservent leur propre contexte.', ['REGION','DEPARTMENT','EPCI','COMMUNE'].includes(object.kind) ? 'Aucun effet local du taux ou de la dette nationale ne peut être déduit de cette fiche territoriale.' : 'Les faits conservés, les manques et les hypothèses restent distincts ; une relation affichée ne prouve pas une causalité.', 'Cette version structurée ne prétend pas résoudre toute question libre sur cet objet.'],
        evolution: [],
        next: object.kind === 'GAP' || object.kind === 'REQUEST' ? 'Ouvrir la démarche reliée, vérifier son état et son mandat ; aucun envoi n’est déclenché par le dialogue.' : 'Ouvrir une relation nommée ou la pièce de provenance pour approfondir.',
        references: allowed.filter(x => safeURL(x.url)).slice(0, 5)
      });
    }
    if (live.schema !== 'OJO_FRANCE_DEBT_RATE_LIVE_V1' || live.policy?.political_recommendation !== 'NONE') {
      return Object.assign(r, {status: 'NO_VERIFIED_CONTEXT', summary: 'Le contexte canonique vérifiable n’est pas chargé.', next: 'Réessayer le chargement du flux. Aucun chiffre de remplacement n’est inventé.'});
    }
    const business = /entreprise|machine|transport|tresorerie|acquisition|ma banque|mon pret|mon credit|mes clients|mon activite/.test(norm);
    const publicDebt = /tec10|tec 10|oat|taux et de la dette|dette (publique|nationale|de l.etat|francaise)|france.*(emprunt|taux|dette)|taux.*france|refinancement.*etat/.test(norm);
    const publicOperation = /source|preuve|donnee|flux|sante|demarche|courrier|acces|la bete/.test(norm);
    if (business || (!publicDebt && !publicOperation)) {
      return Object.assign(r, {status:business?'OUT_OF_SCOPE':'NEEDS_CLARIFICATION', summary:'Votre question : « '+raw+' ». Cette demande ne dispose pas encore de méthode reliée à la Maison.',
        retained:['Le besoin exprimé, à qualifier avant toute analyse.'],
        limits:['Le dossier public chargé traite de la dette de l’État français. Ses taux et conclusions ne constituent pas un résultat pour votre entreprise ou votre projet.'],
        next:/transport|tresorerie|carburant|gazole/.test(norm)
          ?'Le laboratoire « Qui finance le plein ? » permet un essai séparé sur données synthétiques : ventes, coûts de carburant, délais clients, trésorerie initiale et crédit disponible. Il peut être rattaché au brouillon local via « Tester le laboratoire de trésorerie ». Le dossier natif reste séparé.'
          :'Préciser l’objectif, l’horizon et les données disponibles, sans transmettre de pièce privée ici. Aucune mission n’est lancée.'});
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
  // Adapter and evidence contract only. The arithmetic owner stays window.OJO in the existing laboratory.
  const Cash = (() => {
    const METHOD='OJO_GAZOLE_1.0', PATH='gazole-qui-finance-2026-09-20.html';
    const fields=Object.freeze({sales:['Ventes mensuelles de référence','EUR HT/mois'],fuel:['Carburant dans les ventes','%'],other:['Autres coûts variables','%'],surplus:['Surplus simplifié','%'],activity:['Hausse du volume pendant le choc','%'],rise:['Hausse du prix du carburant','%'],duration:['Durée du choc','jours'],index:['Hausse de l’indice répercuté','%'],weight:['Pondération carburant facturée','%'],cycle:['Période de facturation','jours'],client:['Règlement après émission','jours'],bill:['Décalage d’émission','jours'],late:['Retard client pendant le choc','jours'],fuelDays:['Paiement du carburant','jours'],otherDays:['Paiement des autres variables','jours'],surchargeLag:['Décalage de la surcharge','jours'],capacity:['Surcoût de capacité','%'],empty:['Surconsommation à vide','%'],cash:['Trésorerie initiale','EUR'],credit:['Ligne de crédit supposée disponible','EUR'],vat:['Convention TVA (0 non, 1 oui)','0 ou 1'],vatLag:['Décalage du règlement TVA','jours'],otherVat:['Part des autres variables soumise à TVA','%'],rate:['Taux de financement supposé','%/an'],exceptional:['Décaissement exceptionnel à J15','EUR'],flex:['Flexibilité des charges fixes','%']});
    const metrics=['min','minDay','need','unfunded','interest','profit','rev','surcharge','fuelExpense','otherExpense','fixedExpense','final'];
    const limits=Object.freeze(['Scénario synthétique, pas une observation ni une estimation professionnelle validée.','Horizon fixe de 180 jours. Les encaissements et décaissements ultérieurs sont hors résultat.','Intérêts théoriques calculés séparément, non débités de la courbe ; disponibilité du crédit non garantie.','TVA selon la convention pédagogique du laboratoire ; les délais simulés ne prouvent pas leur conformité légale.','Le surplus simplifié ne déduit ni le décaissement exceptionnel ni le coût de financement ; il ne vaut pas trésorerie disponible.']);
    const canon=v=>Array.isArray(v)?'['+v.map(canon).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}':JSON.stringify(v);
    async function hash(v){const raw=typeof v==='string'?v:canon(v);const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
    const fail=c=>{throw Error(c);};
    function exact(v,names){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==names.length||names.some(k=>!Object.hasOwn(v,k)))fail('CASH_SCHEMA_REJECTED');}
    function inputs(p){exact(p,Object.keys(fields));for(const v of Object.values(p))if(typeof v!=='number'||!Number.isFinite(v))fail('CASH_INPUT_MISSING_OR_NONFINITE');return p;}
    function approximately(a,b){return Math.abs(a-b)<=Math.max(1e-6,Math.abs(b)*1e-10);}
    function verifyLedger(r,p){
      if(!Array.isArray(r.rows)||r.rows.length!==181)fail('CASH_LEDGER_LENGTH');let min=p.cash,day=0;
      for(let i=0;i<181;i++){const row=r.rows[i];if(row.day!==i||!Number.isFinite(row.cash)||!Number.isFinite(row.in)||!Number.isFinite(row.out))fail('CASH_LEDGER_INVALID');
        if(i===0){if(row.cash!==p.cash)fail('CASH_INITIAL_MISMATCH');continue;}
        const out=['fuel','other','fixed','tax','exceptional'].reduce((sum,k)=>sum+row[k],0);
        if(!approximately(row.out,out)||!approximately(row.cash,r.rows[i-1].cash+row.in-row.out))fail('CASH_LEDGER_INVARIANT');
        if(row.cash<min){min=row.cash;day=i;}
      }
      if(!approximately(r.min,min)||r.minDay!==day||!approximately(r.need,Math.max(0,-min))||!approximately(r.unfunded,Math.max(0,-min-p.credit))||r.final!==r.rows[180].cash)fail('CASH_RESULT_INVARIANT');
      for(const k of metrics)if(!Number.isFinite(r[k]))fail('CASH_RESULT_NONFINITE');return true;
    }
    function validateReceipt(r){
      exact(r,['schema','method','method_path','method_sha256','draft_id','draft_version','executed_at','input_kind','contract','contract_sha256','inputs','inputs_sha256','outputs','outputs_sha256','ledger_sha256','previous_receipt_sha256','receipt_sha256']);
      if(r.schema!=='LA_BETE_CASH_RECEIPT_V1'||r.method!==METHOD||r.method_path!==PATH||r.input_kind!=='SYNTHETIC_DECLARED')fail('CASH_METHOD_REJECTED');
      if(!/^draft-[0-9a-f-]{36}$/.test(r.draft_id)||!Number.isSafeInteger(r.draft_version)||r.draft_version<1||!Number.isFinite(Date.parse(r.executed_at)))fail('CASH_IDENTITY_REJECTED');
      for(const k of ['method_sha256','contract_sha256','inputs_sha256','outputs_sha256','ledger_sha256','receipt_sha256'])if(!/^[a-f0-9]{64}$/.test(r[k]))fail('CASH_HASH_REJECTED');
      if(r.previous_receipt_sha256!==null&&!/^[a-f0-9]{64}$/.test(r.previous_receipt_sha256))fail('CASH_PREVIOUS_REJECTED');inputs(r.inputs);
      exact(r.outputs,['base','stress','gap','gapDay']);for(const branch of ['base','stress']){exact(r.outputs[branch],metrics);for(const v of Object.values(r.outputs[branch]))if(typeof v!=='number'||!Number.isFinite(v))fail('CASH_RESULT_NONFINITE');}
      if(!Number.isFinite(r.outputs.gap)||r.outputs.gap<0||!Number.isInteger(r.outputs.gapDay)||r.outputs.gapDay<0||r.outputs.gapDay>180)fail('CASH_GAP_REJECTED');
      exact(r.contract,['objective','expected_outcome','horizon','constraints']);for(const v of Object.values(r.contract))if(typeof v!=='string'||v.length>1500||sensitive(v))fail('CASH_CONTRACT_REJECTED');
      return r;
    }
    async function verifyHashes(r){validateReceipt(r);const core={...r};delete core.receipt_sha256;if(await hash(core)!==r.receipt_sha256||await hash(r.contract)!==r.contract_sha256||await hash(r.inputs)!==r.inputs_sha256||await hash(r.outputs)!==r.outputs_sha256)fail('CASH_CHECKSUM_MISMATCH');return true;}
    async function run(engine,p,meta,previous=null){
      if(!engine||engine.methodID!==METHOD||typeof engine.methodSource!=='function')fail('CASH_EXISTING_METHOD_UNAVAILABLE');
      inputs(p);engine.validate(p);const result=engine.compare({...p});verifyLedger(result.base,p);verifyLedger(result.stress,p);
      let gap=0,gapDay=0;for(let i=0;i<=180;i++){const value=result.base.rows[i].cash-result.stress.rows[i].cash;if(value>gap){gap=value;gapDay=i;}}
      if(!approximately(gap,result.gap)||gapDay!==result.gapDay)fail('CASH_COMPARISON_INVARIANT');
      const summarize=x=>Object.fromEntries(metrics.map(k=>[k,x[k]]));const outputs={base:summarize(result.base),stress:summarize(result.stress),gap:result.gap,gapDay:result.gapDay};
      const r={schema:'LA_BETE_CASH_RECEIPT_V1',method:METHOD,method_path:PATH,method_sha256:await hash(engine.methodSource()),draft_id:meta.id,draft_version:meta.version,executed_at:new Date().toISOString(),input_kind:'SYNTHETIC_DECLARED',contract:Object.fromEntries(['objective','expected_outcome','horizon','constraints'].map(k=>[k,meta[k]])),contract_sha256:await hash(Object.fromEntries(['objective','expected_outcome','horizon','constraints'].map(k=>[k,meta[k]]))),inputs:{...p},inputs_sha256:await hash(p),outputs,outputs_sha256:await hash(outputs),ledger_sha256:await hash({base:result.base.rows,stress:result.stress.rows}),previous_receipt_sha256:previous?.receipt_sha256||null};
      r.receipt_sha256=await hash(r);validateReceipt(r);return r;
    }
    function changes(a,b){if(!a||!b)return[];return Object.keys(fields).filter(k=>a.inputs[k]!==b.inputs[k]);}
    function summarize(r){const f=v=>v.toLocaleString('fr-FR',{maximumFractionDigits:2});return 'Simulation synthétique sur 180 jours : minimum '+f(r.outputs.stress.min)+' EUR à J'+r.outputs.stress.minDay+', besoin brut '+f(r.outputs.stress.need)+' EUR, besoin hors ligne supposée '+f(r.outputs.stress.unfunded)+' EUR. Sans choc, minimum '+f(r.outputs.base.min)+' EUR.';}
    function explanation(input,c){
      const evidence=c.cashEvidence,r=evidence?.receipt,meta=c.draftMeta;if(!r||!meta||c.object||r.draft_id!==meta.id)return null;
      const q=normalize(input);if(!/creux|tresorerie|carburant|financement|interet|scenario|calcul|parametre|variante|solde|pic|cash|credit|tv[a]?\b/.test(q))return null;
      if(/france|tec.?10|dette publique|mon entreprise reelle|garanti|sante|medical/.test(q))return null;
      const current=evidence.state==='EXECUTED_CURRENT'&&r.draft_version<=meta.version&&Object.entries(r.contract).every(([k,v])=>meta[k]===v);
      return {status:current?'LOCAL_METHOD_CONTEXT':'METHOD_RECHECK_REQUIRED',summary:current?summarize(r):'Le brouillon possède un calcul antérieur, mais il doit être réexaminé avant de répondre avec ses chiffres.',retained:current?['Méthode '+r.method+' ; brouillon '+r.draft_id+' v'+r.draft_version+'.','Reçu '+r.receipt_sha256+'.','Intérêts théoriques : '+r.outputs.stress.interest.toLocaleString('fr-FR',{maximumFractionDigits:2})+' EUR, non débités de la courbe.']:[],limits:[...limits,...(current?[]:['Archive importée, brouillon révisé ou hypothèses modifiées : aucun chiffre ancien n’est présenté comme résultat courant.'])],next:current?'Comparer une seule hypothèse à la fois dans le laboratoire, puis consulter le reçu et la variation.':'Relancer explicitement le calcul sur les hypothèses synthétiques affichées.',references:[],cash_ref:r.receipt_sha256};
    }
    return Object.freeze({METHOD,PATH,fields,limits,inputs,hash,validateReceipt,verifyHashes,verifyLedger,run,changes,summarize,explanation});
  })();
  // M03: pure helpers for the existing history; never a native case/mission store.
  const Draft = (() => {
    const SCHEMA='LA_BETE_DIALOGUE_DRAFT_V1', PACKAGE='LA_BETE_DIALOGUE_DRAFT_PACKAGE_V1', MAX_BYTES=262144, MAX_TURNS=40;
    const fail=code=>{throw Error(code);};
    const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
    function keys(v,allowed){if(!plain(v)||Object.keys(v).some(k=>!allowed.includes(k))||allowed.some(k=>!Object.hasOwn(v,k)))fail('DRAFT_SCHEMA_REJECTED');}
    function bounded(v,max=1500,nullable=false){if(nullable&&v===null)return;if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail('DRAFT_TEXT_REJECTED');}
    function safeText(v,max=1500){bounded(v,max);if(sensitive(v)||unsafe.test(normalize(v)))fail('DRAFT_PRIVATE_OR_UNSAFE_TEXT');}
    function tree(v,depth=0){
      if(depth>12)fail('DRAFT_DEPTH_LIMIT');
      if(typeof v==='string')bounded(v,16000);
      else if(typeof v==='number'){if(!Number.isFinite(v))fail('DRAFT_NUMBER_REJECTED');}
      else if(Array.isArray(v)){if(v.length>80)fail('DRAFT_ARRAY_LIMIT');v.forEach(x=>tree(x,depth+1));}
      else if(v&&typeof v==='object'){if(!plain(v))fail('DRAFT_OBJECT_REJECTED');for(const[k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))fail('DRAFT_KEY_REJECTED');tree(x,depth+1);}}
      else if(v!==null&&typeof v!=='boolean')fail('DRAFT_TYPE_REJECTED');
    }
    function date(v){bounded(v,40);if(!/^\d{4}-\d\d-\d\dT.*Z$/.test(v)||!Number.isFinite(Date.parse(v)))fail('DRAFT_DATE_REJECTED');}
    function validateMeta(m){
      keys(m,['id','version','created_at','updated_at','objective','expected_outcome','horizon','constraints']);
      if(!/^draft-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(m.id))fail('DRAFT_ID_REJECTED');
      if(!Number.isSafeInteger(m.version)||m.version<1||m.version>1000000)fail('DRAFT_VERSION_REJECTED');
      date(m.created_at);date(m.updated_at);if(m.updated_at<m.created_at)fail('DRAFT_CHRONOLOGY_REJECTED');
      ['objective','expected_outcome','horizon','constraints'].forEach(k=>safeText(m[k]));
    }
    function create(objective=''){
      safeText(objective);if(!globalThis.crypto?.randomUUID)fail('DRAFT_SECURE_ID_UNAVAILABLE');const now=new Date().toISOString();
      return{id:'draft-'+globalThis.crypto.randomUUID(),version:1,created_at:now,updated_at:now,objective,expected_outcome:'',horizon:'',constraints:''};
    }
    function revise(m,patch={}){
      validateMeta(m);if(!plain(patch)||Object.keys(patch).some(k=>!['objective','expected_outcome','horizon','constraints'].includes(k)))fail('DRAFT_PATCH_REJECTED');
      const next={...m,...patch,version:m.version+1,updated_at:new Date().toISOString()};validateMeta(next);return next;
    }
    function qualification(m){
      if(!m)return{code:'NEEDS_INFORMATION',label:'À préciser',missing:['objectif','résultat attendu','horizon','contraintes'],native:'NOT_ADMITTED'};
      validateMeta(m);const fields={objective:'objectif',expected_outcome:'résultat attendu',horizon:'horizon',constraints:'contraintes'};
      const missing=Object.entries(fields).filter(([k])=>!m[k].trim()).map(([,v])=>v);
      return{code:missing.length?'NEEDS_INFORMATION':'QUALIFIED_DRAFT',label:missing.length?'À préciser':'Brouillon renseigné · non instruit',missing,native:'NOT_ADMITTED'};
    }
    function objectContext(c){
      if(!plain(c)||Object.keys(c).some(k=>!['id','label','snapshot_id','version'].includes(k)))fail('DRAFT_CONTEXT_REJECTED');
      bounded(c.id,256,true);bounded(c.label,500);bounded(c.snapshot_id,120,true);
      if(c.version!==undefined&&c.version!==null&&typeof c.version!=='string'&&!(typeof c.version==='number'&&Number.isFinite(c.version)))fail('DRAFT_CONTEXT_VERSION_REJECTED');
    }
    function validate(p){
      tree(p);keys(p,['schema','owner','authority','native_case_id','native_mission_id','data_scope','meta','conversation']);
      if(p.schema!==SCHEMA||p.owner!=='LaBeteParticipation'||p.authority!=='USER_DRAFT_NOT_NATIVE'||p.native_case_id!==null||p.native_mission_id!==null||p.data_scope!=='PUBLIC_OR_SYNTHETIC_DECLARED')fail('DRAFT_AUTHORITY_REJECTED');
      validateMeta(p.meta);if(!Array.isArray(p.conversation)||p.conversation.length>MAX_TURNS)fail('DRAFT_TURN_LIMIT');let previous=0,lastCashHash=null;const cashHashes=new Set();
      for(const row of p.conversation){
        keys(row,['text','kind','object_context','result','draft_id','draft_version','recorded_at']);
        if(row.draft_id!==p.meta.id||!Number.isSafeInteger(row.draft_version)||row.draft_version<=previous||row.draft_version>p.meta.version)fail('DRAFT_LINEAGE_REJECTED');
        previous=row.draft_version;date(row.recorded_at);if(row.recorded_at<p.meta.created_at||row.recorded_at>p.meta.updated_at)fail('DRAFT_CHRONOLOGY_REJECTED');
        safeText(row.text);if(!row.text.trim()||!['QUESTION','IDEA','POLICY'].includes(row.kind))fail('DRAFT_MESSAGE_REJECTED');objectContext(row.object_context);
        const r=row.result;
        keys(r,['version','mode','status','adoption','external_action','political_recommendation','summary','retained','limits','evolution','next','references','snapshot_id','snapshot_at','object_context','draft_ref',...['cash_receipt','cash_ref'].filter(k=>Object.hasOwn(r,k))]);
        if(r.version!==VERSION||r.mode!=='LOCAL_STRUCTURED_NO_LLM'||r.adoption!=='NOT_ADOPTED'||r.external_action!=='NONE'||r.political_recommendation!=='NONE')fail('DRAFT_RESULT_AUTHORITY_REJECTED');
        if(!['NEEDS_CLARIFICATION','FACTUAL_REVIEW_ONLY','PROPOSAL_TO_REVIEW','OBJECT_CONTEXT','NO_VERIFIED_CONTEXT','OUT_OF_SCOPE','CANONICAL_CONTEXT','LOCAL_METHOD_RESULT','LOCAL_METHOD_CONTEXT','METHOD_RECHECK_REQUIRED','METHOD_CHALLENGE'].includes(r.status))fail('DRAFT_RESULT_STATE_REJECTED');
        keys(r.draft_ref,['id','version','method']);if(r.draft_ref.id!==p.meta.id||r.draft_ref.version!==row.draft_version||r.draft_ref.method!==VERSION)fail('DRAFT_RESULT_LINEAGE_REJECTED');
        if(r.cash_receipt!==undefined){
          if(r.status!=='LOCAL_METHOD_RESULT')fail('DRAFT_CASH_STATE_REJECTED');Cash.validateReceipt(r.cash_receipt);
          if(r.cash_receipt.draft_id!==p.meta.id||r.cash_receipt.draft_version!==row.draft_version||r.cash_receipt.previous_receipt_sha256!==lastCashHash)fail('DRAFT_CASH_LINEAGE_REJECTED');
          lastCashHash=r.cash_receipt.receipt_sha256;cashHashes.add(lastCashHash);
        }else if(r.status==='LOCAL_METHOD_RESULT')fail('DRAFT_CASH_RECEIPT_REQUIRED');
        if(r.cash_ref!==undefined){if(!['LOCAL_METHOD_CONTEXT','METHOD_RECHECK_REQUIRED','METHOD_CHALLENGE'].includes(r.status)||!cashHashes.has(r.cash_ref))fail('DRAFT_CASH_REFERENCE_REJECTED');}
        else if(['LOCAL_METHOD_CONTEXT','METHOD_RECHECK_REQUIRED','METHOD_CHALLENGE'].includes(r.status))fail('DRAFT_CASH_REFERENCE_REQUIRED');
        if(r.status.startsWith('LOCAL_METHOD')||r.status==='METHOD_RECHECK_REQUIRED'||r.status==='METHOD_CHALLENGE'){if(r.references.length||r.snapshot_id!==null||r.snapshot_at!==null)fail('DRAFT_CASH_PUBLIC_CONTEXT_REJECTED');}
        safeText(r.summary,4096);safeText(r.next,4096);
        for(const k of ['retained','limits','evolution']){if(!Array.isArray(r[k])||r[k].length>16)fail('DRAFT_RESULT_ARRAY_REJECTED');r[k].forEach(s=>safeText(s,4096));}
        bounded(r.snapshot_id,120,true);bounded(r.snapshot_at,64,true);objectContext(r.object_context);
        if(canonical(r.object_context)!==canonical(row.object_context))fail('DRAFT_CONTEXT_MISMATCH');
        if(!Array.isArray(r.references)||r.references.length>5)fail('DRAFT_REFERENCES_REJECTED');
        for(const ref of r.references){if(!plain(ref)||Object.keys(ref).some(k=>!['label','url','status','checked_at'].includes(k)))fail('DRAFT_REFERENCE_REJECTED');bounded(ref.label,500);bounded(ref.url,2048);if(!safeURL(ref.url))fail('DRAFT_REFERENCE_URL_REJECTED');if(ref.status!==undefined)bounded(ref.status,80);if(ref.checked_at!==undefined)bounded(ref.checked_at,64,true);}
      }
      if(new TextEncoder().encode(JSON.stringify(p)).byteLength>MAX_BYTES-1024)fail('DRAFT_FILE_LIMIT');return p;
    }
    function payload(meta,conversation,consent){
      if(consent!==true)fail('DRAFT_SCOPE_CONFIRMATION_REQUIRED');
      return validate(JSON.parse(JSON.stringify({schema:SCHEMA,owner:'LaBeteParticipation',authority:'USER_DRAFT_NOT_NATIVE',native_case_id:null,native_mission_id:null,data_scope:'PUBLIC_OR_SYNTHETIC_DECLARED',meta,conversation})));
    }
    function canonical(v){return Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);}
    async function digest(p){if(!globalThis.crypto?.subtle)fail('DRAFT_CHECKSUM_UNAVAILABLE');const b=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(p)));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');}
    async function seal(p){validate(p);return{schema:PACKAGE,integrity:'SHA256_CHECKSUM_NOT_SIGNATURE',sha256:await digest(p),payload:p};}
    async function open(raw,consent){
      if(consent!==true)fail('DRAFT_SCOPE_CONFIRMATION_REQUIRED');if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>MAX_BYTES)fail('DRAFT_FILE_LIMIT');
      const pack=JSON.parse(raw);tree(pack);keys(pack,['schema','integrity','sha256','payload']);
      if(pack.schema!==PACKAGE||pack.integrity!=='SHA256_CHECKSUM_NOT_SIGNATURE'||!/^[a-f0-9]{64}$/.test(pack.sha256))fail('DRAFT_PACKAGE_REJECTED');
      validate(pack.payload);if(await digest(pack.payload)!==pack.sha256)fail('DRAFT_CHECKSUM_MISMATCH');for(const row of pack.payload.conversation)if(row.result.cash_receipt)await Cash.verifyHashes(row.result.cash_receipt);return pack.payload;
    }
    return Object.freeze({SCHEMA,PACKAGE,MAX_BYTES,MAX_TURNS,create,revise,qualification,validate,payload,seal,open});
  })();
  return Object.freeze({VERSION, MAX_INPUT, REPO, analyze, sensitive, safeURL, sharePayload, issueURL, Draft, Cash});
});
