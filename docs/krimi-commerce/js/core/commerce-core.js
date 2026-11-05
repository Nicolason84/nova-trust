/* KRIMI Commerce A — pure, supervised domain model. No network, storage or payment action. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KrimiCommerceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCHEMA = 'KRIMI_COMMERCE_A_V1';
  const MAX_CENTS = 1000000000000;
  const ACTIVE = ['ordered', 'purchased', 'shipped', 'delivered', 'disputed', 'returned'];
  const STAGES = ['detected', 'qualified', 'supply_secured', 'offered', 'ordered', 'purchased', 'shipped', 'delivered', 'settled'];
  const COSTS = ['purchaseCents', 'shippingCents', 'packagingCents', 'commissionCents', 'paymentCents', 'chargesCents'];
  const MONEY_FIELDS = COSTS.concat(['saleCents', 'returnProvisionCents']);
  const CASH_SIGNS = { BUYER_RECEIPT: 1, SUPPLIER_PAYMENT: -1, FEE: -1, REFUND: -1, SUPPLIER_REFUND: 1, CHARGE: -1 };
  const EVIDENCE_KINDS = ['product', 'source', 'stock', 'supplier_terms', 'channel', 'offer', 'order', 'purchase', 'shipping', 'delivery', 'payment', 'costs_final', 'charges', 'cancellation', 'return', 'refund', 'photo', 'ownership'];
  const SKILLS = ['Éclaireur', 'Évaluateur', 'Négociateur', 'Marchand', 'Gestionnaire'];
  const LEARNING_SKILLS = ['identification', 'source', 'cost', 'negotiation', 'fulfilment', 'review'];
  const SETUP_KEYS = ['sellerIdentity', 'legalStatus', 'termsRef', 'sharingTerms', 'chargesDescription'];
  const TEXT_FIELDS = ['title', 'productRef', 'edition', 'language', 'condition', 'inventoryKey', 'supplierName', 'supplierIdentityRef', 'supplierTermsRef', 'returnsRef', 'packagingRef', 'channelName', 'channelRulesRef', 'chargesMethod', 'heldProofRef', 'note'];
  const BOOL_FIELDS = ['sealed', 'directShippingAccepted', 'channelDirectAllowed', 'externalUncertain'];
  const MUTABLE_FIELDS = TEXT_FIELDS.concat(BOOL_FIELDS, MONEY_FIELDS, ['mode', 'stockCheckedAt', 'priceCheckedAt', 'availableQuantity', 'deliveryDays', 'imageData']);
  const CRITICAL_FIELDS = ['productRef', 'edition', 'language', 'condition', 'sealed', 'inventoryKey', 'mode', 'supplierName', 'supplierIdentityRef', 'supplierTermsRef', 'returnsRef', 'packagingRef', 'directShippingAccepted', 'channelName', 'channelRulesRef', 'channelDirectAllowed', 'availableQuantity', 'deliveryDays', 'chargesMethod', 'heldProofRef'].concat(MONEY_FIELDS);
  const BUYER_AGREEMENT_FIELDS = ['productRef', 'edition', 'language', 'condition', 'sealed', 'inventoryKey', 'saleCents', 'deliveryDays'];
  const LABELS = { title: 'nom du produit', productRef: 'référence exacte', edition: 'édition', language: 'langue', condition: 'état', inventoryKey: 'identifiant de la pièce unique',
    purchaseCents: 'prix d’achat', shippingCents: 'transport', packagingCents: 'emballage', commissionCents: 'commissions', paymentCents: 'frais de paiement', chargesCents: 'charges applicables',
    saleCents: 'prix de vente', returnProvisionCents: 'provision pour retours', chargesMethod: 'base de calcul des charges', sellerIdentity: 'identité du vendeur', legalStatus: 'cadre juridique et régime',
    termsRef: 'conditions de vente', sharingTerms: 'accord sur les apports, résultats et pertes', chargesDescription: 'régime et méthode de calcul des charges' };
  function fail(message) { throw new Error(message); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function own(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' invalide.'); return value; }
  function text(value, label, max) {
    if (typeof value !== 'string' || value.length > (max || 4000)) fail(label + ' invalide ou trop long.');
    if (/\u0000/.test(value)) fail(label + ' contient un caractère interdit.');
    return value.trim();
  }
  function identifier(value, label) {
    const out = text(value, label, 160);
    if (!out || !/^[A-Za-z0-9_.:-]+$/.test(out)) fail(label + ' invalide.');
    return out;
  }
  function cents(value, label, signed) {
    if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_CENTS || (!signed && value < 0)) fail(label + ' doit être un montant entier en centimes.');
    return value;
  }
  function sum(values) {
    return values.reduce(function (a, b) { const n = a + b; if (!Number.isSafeInteger(n) || Math.abs(n) > MAX_CENTS) fail('Total monétaire hors limites.'); return n; }, 0);
  }
  function instant(value, label) {
    const out = text(value, label || 'Date', 50);
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(out) || !Number.isFinite(Date.parse(out))) fail((label || 'Date') + ' doit être une date ISO complète.');
    return out;
  }
  function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
  function money(value) {
    if (typeof value !== 'string' && typeof value !== 'number') fail('Montant invalide.');
    const s = String(value).trim().replace(/[ \u00a0\u202f]/g, '').replace(/€$/, '');
    if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(s)) fail('Saisir un montant avec au plus deux décimales, sans exposant.');
    const negative = s[0] === '-';
    const parts = (negative ? s.slice(1) : s).split(/[.,]/);
    const big = BigInt(parts[0]) * 100n + BigInt(((parts[1] || '') + '00').slice(0, 2));
    if (big > BigInt(MAX_CENTS)) fail('Montant trop élevé.');
    const n = Number(big) * (negative ? -1 : 1);
    return Object.is(n, -0) ? 0 : n;
  }
  function format(value) {
    cents(value, 'Montant', true);
    const s = String(Math.abs(value)).padStart(3, '0');
    return (value < 0 ? '−' : '') + s.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + ',' + s.slice(-2) + ' €';
  }
  function createState() {
    return { schema: SCHEMA, version: 1, revision: 0, paused: false,
      contributions: [{ id: 'nicolas', name: 'Nicolas', declaredCents: 12500, confirmedCents: 0, proofRef: '' }, { id: 'krimi', name: 'Krimi', declaredCents: 12500, confirmedCents: 0, proofRef: '' }],
      reserveCents: 0, reserveConfigured: false, unavailableCents: 0,
      setup: { sellerIdentity: '', legalStatus: '', termsRef: '', sharingTerms: '', chargesDescription: '' },
      operations: [], ledger: [], events: [], commands: [] };
  }
  function blankOperation(id, at) {
    const op = { id: id, createdAt: at, updatedAt: at, status: 'detected', mode: 'direct', sealed: false,
      directShippingAccepted: false, channelDirectAllowed: false, externalUncertain: false,
      stockCheckedAt: null, priceCheckedAt: null, availableQuantity: 0, deliveryDays: null, imageData: '',
      evidence: [], learning: [], time: [], forecast: null, forecastRevisions: [], suspended: false,
      suspensionReason: '', costsCompleteConfirmed: false, everOrdered: false, reopenedCount: 0 };
    TEXT_FIELDS.forEach(function (key) { op[key] = ''; });
    MONEY_FIELDS.forEach(function (key) { op[key] = null; });
    return op;
  }
  function checkImage(value) {
    if (typeof value !== 'string' || value.length > 700000) fail('Photo trop volumineuse (700 000 caractères maximum).');
    if (value && !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) fail('La photo doit être un fichier PNG, JPEG ou WebP local.');
    return value;
  }
  function patchOperation(op, patch) {
    object(patch, 'Modification');
    Object.keys(patch).forEach(function (key) {
      if (!MUTABLE_FIELDS.includes(key)) fail('Champ de dossier non modifiable : ' + key);
      const value = patch[key];
      if (TEXT_FIELDS.includes(key)) op[key] = text(value, key);
      else if (BOOL_FIELDS.includes(key)) { if (typeof value !== 'boolean') fail(key + ' doit être booléen.'); op[key] = value; }
      else if (MONEY_FIELDS.includes(key)) op[key] = value === null ? null : cents(value, key, false);
      else if (key === 'mode') { if (!['direct', 'held'].includes(value)) fail('Mode d’approvisionnement invalide.'); op.mode = value; }
      else if (key === 'stockCheckedAt' || key === 'priceCheckedAt') op[key] = value === null || value === '' ? null : instant(value, key);
      else if (key === 'availableQuantity') { if (!Number.isSafeInteger(value) || value < 0 || value > 1000000) fail('Quantité disponible invalide.'); op[key] = value; }
      else if (key === 'deliveryDays') { if (value !== null && (!Number.isSafeInteger(value) || value < 0 || value > 365)) fail('Délai de livraison invalide.'); op[key] = value; }
      else if (key === 'imageData') op.imageData = checkImage(value);
    });
  }
  function findOperation(state, id) { const op = state.operations.find(function (x) { return x.id === id; }); if (!op) fail('Dossier introuvable.'); return op; }
  function estimate(op) {
    const missing = MONEY_FIELDS.filter(function (key) { return op[key] === null || op[key] === undefined; });
    if (!nonempty(op.chargesMethod)) missing.push('chargesMethod');
    const costCents = COSTS.every(function (key) { return Number.isSafeInteger(op[key]); }) ? sum(COSTS.map(function (key) { return op[key]; })) : null;
    const complete = missing.length === 0;
    return { complete: complete, missing: missing, costCents: costCents,
      netCents: complete ? sum([op.saleCents, -costCents, -op.returnProvisionCents]) : null,
      exposureCents: complete ? sum([costCents, op.returnProvisionCents]) : null,
      provisionCents: Number.isSafeInteger(op.returnProvisionCents) ? op.returnProvisionCents : null };
  }
  function operationCash(state, id) {
    const rows = state.ledger.filter(function (row) { return row.operationId === id; });
    const by = function (kind) { return sum(rows.filter(function (row) { return row.kind === kind; }).map(function (row) { return row.amountCents; })); };
    return { totalCents: sum(rows.map(function (row) { return row.amountCents; })),
      buyerCents: sum([by('BUYER_RECEIPT'), by('REFUND')]), supplierPaidCents: -by('SUPPLIER_PAYMENT'),
      supplierRefundCents: by('SUPPLIER_REFUND'), feesCents: -by('FEE'), chargesCents: -by('CHARGE'),
      refundsCents: -by('REFUND'), buyerReceivedCents: by('BUYER_RECEIPT') };
  }
  function commitment(state, op) {
    const cash = operationCash(state, op.id);
    if (op.status === 'settled') return 0;
    if (['cancelled', 'returned', 'disputed'].includes(op.status)) {
      // A buyer refund due is a liability, never spendable working capital.
      return Math.max(0, cash.buyerCents) + (op.status === 'disputed' ? (op.returnProvisionCents || 0) : 0);
    }
    if (!ACTIVE.includes(op.status)) return 0;
    const e = estimate(op);
    // Unknown remaining costs cannot turn into a zero estimate after commitment.
    const baseline = e.exposureCents === null ? (op.forecast ? op.forecast.exposureCents : null) : e.exposureCents;
    if (baseline === null) return MAX_CENTS;
    return Math.max(0, baseline - cash.supplierPaidCents - cash.feesCents - cash.chargesCents);
  }
  function metrics(state) {
    const confirmed = sum(state.contributions.map(function (x) { return x.confirmedCents; }));
    const cash = sum([confirmed].concat(state.ledger.map(function (x) { return x.amountCents; })));
    const committed = sum(state.operations.map(function (op) { return commitment(state, op); }));
    const observations = state.operations.reduce(function (n, op) { return n + op.learning.length; }, 0);
    const timed = state.operations.flatMap(function (op) { return op.time; });
    const finals = state.operations.filter(function (op) { return op.costsCompleteConfirmed && ['settled', 'cancelled', 'returned'].includes(op.status); });
    const points = observations * 10;
    return { declaredCents: sum(state.contributions.map(function (x) { return x.declaredCents; })), confirmedCents: confirmed,
      cashCents: cash, committedCents: committed,
      expectedCents: sum(state.operations.filter(function (op) { return ACTIVE.includes(op.status) && op.status !== 'returned' && op.status !== 'disputed'; }).map(function (op) { return Math.max(0, (op.saleCents || 0) - operationCash(state, op.id).buyerCents); })),
      reserveCents: state.reserveCents, unavailableCents: state.unavailableCents,
      availableCents: Math.max(0, cash - committed - state.reserveCents - state.unavailableCents),
      shortfallCents: Math.max(0, committed + state.reserveCents + state.unavailableCents - cash),
      resultCents: finals.length ? sum(finals.map(function (op) { return operationCash(state, op.id).totalCents; })) : null,
      resultComplete: state.operations.filter(function (op) { return op.everOrdered; }).every(function (op) { return finals.includes(op); }),
      settledCount: state.operations.filter(function (op) { return op.status === 'settled'; }).length,
      operationCount: state.operations.length, humanMinutes: timed.length ? timed.reduce(function (n, row) { return n + row.minutes; }, 0) : null,
      automatedTasks: null, observations: observations, skillPoints: points, level: SKILLS[Math.min(4, Math.floor(points / 50))] };
  }
  function hasEvidence(op, kind) { return op.evidence.some(function (row) { return row.kind === kind && nonempty(row.ref); }); }
  function fresh(value, at) {
    if (!value || !at) return false;
    const delta = Date.parse(at) - Date.parse(value);
    return Number.isFinite(delta) && delta >= 0 && delta <= 24 * 60 * 60 * 1000;
  }
  function basicBlockers(state, op) {
    const out = [];
    ['title', 'productRef', 'edition', 'language', 'condition', 'inventoryKey'].forEach(function (key) { if (!nonempty(op[key])) out.push('Préciser ' + LABELS[key] + '.'); });
    const e = estimate(op);
    if (!e.complete) out.push('Estimation incomplète : ' + e.missing.map(function (key) { return LABELS[key] || key; }).join(', ') + '.');
    if (op.saleCents !== null && op.saleCents <= 0) out.push('Le prix de vente doit être positif.');
    if (!hasEvidence(op, 'product')) out.push('Documenter précisément le produit (preuve product).');
    if (!hasEvidence(op, 'source')) out.push('Ajouter la source du prix de vente envisagé (preuve source).');
    if (op.externalUncertain) out.push('Résultat externe incertain : rapprocher avant toute nouvelle tentative.');
    return out;
  }
  function supplyBlockers(op, at) {
    const out = [];
    if (!nonempty(op.supplierName) || !nonempty(op.supplierIdentityRef)) out.push('Identifier le fournisseur et sa preuve d’identité.');
    if (!nonempty(op.supplierTermsRef) || !nonempty(op.returnsRef) || !nonempty(op.packagingRef)) out.push('Documenter les conditions fournisseur, retours et protection du produit.');
    if (!hasEvidence(op, 'supplier_terms')) out.push('Ajouter l’accord fournisseur (preuve supplier_terms).');
    if (!hasEvidence(op, 'stock')) out.push('Ajouter la preuve de disponibilité (preuve stock).');
    if (op.availableQuantity < 1) out.push('Disponibilité non confirmée.');
    if (!fresh(op.stockCheckedAt, at)) out.push('Revérifier le stock (moins de 24 heures, sans date future).');
    if (!fresh(op.priceCheckedAt, at)) out.push('Revérifier le prix fournisseur (moins de 24 heures, sans date future).');
    if (!Number.isSafeInteger(op.deliveryDays)) out.push('Documenter le délai de livraison.');
    if (op.mode === 'direct' && !op.directShippingAccepted) out.push('L’expédition directe doit être expressément acceptée par le fournisseur.');
    if (op.mode === 'held' && (!nonempty(op.heldProofRef) || !hasEvidence(op, 'ownership'))) out.push('Documenter la détention physique de l’objet (preuve ownership).');
    return out;
  }
  function setupBlockers(state, op) {
    const out = [];
    SETUP_KEYS.forEach(function (key) { if (!nonempty(state.setup[key])) out.push('Cadre d’activité à renseigner : ' + LABELS[key] + '.'); });
    if (!nonempty(op.channelName) || !nonempty(op.channelRulesRef) || !hasEvidence(op, 'channel')) out.push('Qualifier le canal et ses conditions actuelles (preuve channel).');
    if (op.mode === 'direct' && !op.channelDirectAllowed) out.push('Le canal doit permettre ce mode précis d’expédition directe.');
    return out;
  }
  function blockers(state, op, action, at) {
    object(state, 'État'); object(op, 'Dossier');
    const to = action || 'qualified';
    const when = at || (state.events.length ? state.events[state.events.length - 1].at : null);
    const out = [];
    const rank = STAGES.indexOf(to);
    if (rank >= 1 && rank <= 5) out.push.apply(out, basicBlockers(state, op));
    if (rank >= 2 && rank <= 5) out.push.apply(out, supplyBlockers(op, when));
    if (rank >= 3 && rank <= 5) out.push.apply(out, setupBlockers(state, op));
    if (['offered', 'ordered', 'purchased'].includes(to) && state.paused) out.push('Arrêt actif : aucun nouvel engagement.');
    if (['ordered', 'purchased'].includes(to)) {
      if (op.suspended) out.push('Dossier suspendu après modification : revérifier et valider le recalcul.');
      if (!state.reserveConfigured) out.push('Fixer explicitement la réserve minimale avant engagement.');
      const e = estimate(op);
      if (e.complete && e.netCents <= 0) out.push('Marge prévisionnelle insuffisante après coûts et provision.');
      const other = state.operations.find(function (candidate) { return candidate.id !== op.id && candidate.inventoryKey === op.inventoryKey && candidate.everOrdered && !(candidate.status === 'cancelled' && operationCash(state, candidate.id).supplierPaidCents === 0 && operationCash(state, candidate.id).buyerCents === 0); });
      if (other) out.push('Cette pièce est déjà engagée ou vendue dans le dossier ' + other.id + '.');
      const m = metrics(state);
      const needed = e.exposureCents === null ? MAX_CENTS : Math.max(0, e.exposureCents - operationCash(state, op.id).supplierPaidCents - operationCash(state, op.id).feesCents - operationCash(state, op.id).chargesCents);
      const otherCommitments = m.committedCents - commitment(state, op);
      if (m.cashCents - otherCommitments - state.reserveCents - state.unavailableCents < needed) out.push('Trésorerie confirmée insuffisante après engagements, indisponibilités et réserve.');
    }
    const required = { offered: 'offer', ordered: 'order', purchased: 'purchase', shipped: 'shipping', delivered: 'delivery', settled: 'costs_final' };
    if (required[to] && !hasEvidence(op, required[to])) out.push('Ajouter la preuve ' + required[to] + '.');
    if (to === 'purchased' && operationCash(state, op.id).supplierPaidCents < (op.purchaseCents || 0)) out.push('Rapprocher le paiement fournisseur réellement constaté.');
    if (to === 'settled') {
      ['purchase', 'shipping', 'delivery', 'payment', 'charges', 'costs_final'].forEach(function (kind) { if (!hasEvidence(op, kind)) out.push('Clôture : preuve ' + kind + ' manquante.'); });
      const cash = operationCash(state, op.id);
      if (op.saleCents === null || cash.buyerCents !== op.saleCents) out.push('Le montant acheteur réellement encaissé doit être rapproché du montant de vente.');
      if (cash.supplierPaidCents < (op.purchaseCents || 0)) out.push('Le paiement fournisseur reste à rapprocher.');
      const finalNonTaxCosts = COSTS.filter(function (key) { return key !== 'chargesCents'; });
      if (!finalNonTaxCosts.every(function (key) { return Number.isSafeInteger(op[key]); }) ||
          sum([cash.supplierPaidCents, -cash.supplierRefundCents, cash.feesCents]) !== sum(finalNonTaxCosts.map(function (key) { return op[key] || 0; }))) {
        out.push('Rapprocher tous les coûts réels : achat, transport, emballage, commissions et paiement. Corriger les montants finaux si nécessaire.');
      }
      if (op.chargesCents === null || cash.chargesCents !== op.chargesCents) out.push('Rapprocher le montant complet des charges réellement payées.');
      if (op.externalUncertain) out.push('Résultat externe incertain : clôture impossible.');
      if (op.suspended) out.push('Modification non requalifiée : clôture impossible.');
    }
    return Array.from(new Set(out));
  }
  function freezeForecast(op, at) {
    const e = estimate(op);
    const forecast = Object.assign({ at: at, productRef: op.productRef, supplierName: op.supplierName, saleCents: op.saleCents,
      costs: Object.fromEntries(MONEY_FIELDS.filter(function (key) { return key !== 'saleCents'; }).map(function (key) { return [key, op[key]]; })),
      deliveryDays: op.deliveryDays, chargesMethod: op.chargesMethod,
      product: Object.fromEntries(BUYER_AGREEMENT_FIELDS.map(function (key) { return [key, op[key]]; })),
      evidenceIds: op.evidence.map(function (x) { return x.id; }) }, e);
    if (!op.forecast) op.forecast = clone(forecast);
    op.forecastRevisions.push(clone(forecast));
  }
  function cashFingerprint(row) { return JSON.stringify([row.operationId, row.kind, row.amountCents, row.ref]); }
  function requireHuman(payload) { if (payload.humanConfirmed !== true) fail('Une validation humaine explicite est nécessaire.'); }
  function validateEvidence(row) {
    object(row, 'Preuve'); identifier(row.id, 'Identifiant de preuve');
    if (!EVIDENCE_KINDS.includes(row.kind)) fail('Type de preuve invalide.');
    if (!nonempty(text(row.ref, 'Référence de preuve', 4000))) fail('Référence de preuve obligatoire.');
    instant(row.at, 'Date de preuve'); text(row.note || '', 'Note de preuve', 4000);
  }
  function validateState(state) {
    object(state, 'État');
    if (state.schema !== SCHEMA || state.version !== 1) fail('Format de dossier KRIMI non pris en charge.');
    if (!Number.isSafeInteger(state.revision) || state.revision < 0) fail('Révision invalide.');
    if (typeof state.paused !== 'boolean' || typeof state.reserveConfigured !== 'boolean') fail('Paramètres d’arrêt ou de réserve invalides.');
    cents(state.reserveCents, 'Réserve', false); cents(state.unavailableCents, 'Indisponibilités', false);
    ['contributions', 'operations', 'ledger', 'events', 'commands'].forEach(function (key) { if (!Array.isArray(state[key]) || state[key].length > 20000) fail('Liste invalide : ' + key); });
    if (state.operations.length > 1000) fail('Sauvegarde limitée à 1 000 dossiers.');
    object(state.setup, 'Cadre d’activité'); SETUP_KEYS.forEach(function (key) { text(state.setup[key], key); });
    if (state.contributions.length !== 2) fail('Les deux apports déclarés doivent être conservés.');
    ['nicolas', 'krimi'].forEach(function (id) {
      const c = state.contributions.find(function (x) { return x.id === id; });
      if (!c || c.declaredCents !== 12500) fail('Apport déclaré non conforme.');
      cents(c.confirmedCents, 'Apport confirmé', false);
      if (c.confirmedCents > c.declaredCents || (c.confirmedCents > 0 && !nonempty(c.proofRef))) fail('Apport non justifié.');
      text(c.proofRef, 'Preuve d’apport');
    });
    const ids = new Set();
    state.operations.forEach(function (op) {
      object(op, 'Dossier'); identifier(op.id, 'Identifiant de dossier'); if (ids.has(op.id)) fail('Dossier dupliqué.'); ids.add(op.id);
      if (!STAGES.concat(['cancelled', 'returned', 'disputed']).includes(op.status)) fail('Statut de dossier invalide.');
      instant(op.createdAt, 'Création'); instant(op.updatedAt, 'Modification');
      const clean = blankOperation(op.id, op.createdAt); const fields = {};
      MUTABLE_FIELDS.forEach(function (key) { fields[key] = op[key]; }); patchOperation(clean, fields);
      ['evidence', 'learning', 'time', 'forecastRevisions'].forEach(function (key) { if (!Array.isArray(op[key]) || op[key].length > 5000) fail('Historique de dossier invalide.'); });
      if (typeof op.suspended !== 'boolean' || typeof op.costsCompleteConfirmed !== 'boolean' || typeof op.everOrdered !== 'boolean') fail('Drapeaux du dossier invalides.');
      const evid = new Set(); const evidenceRefs = new Set(); op.evidence.forEach(function (row) { validateEvidence(row); if (evid.has(row.id)) fail('Preuve dupliquée.'); evid.add(row.id); const key = row.kind + '\n' + row.ref; if (evidenceRefs.has(key)) fail('Même preuve enregistrée deux fois.'); evidenceRefs.add(key); });
      const learningIds = new Set(); const learningEvidence = new Set();
      op.learning.forEach(function (row) {
        identifier(row.id, 'Apprentissage'); if (learningIds.has(row.id)) fail('Apprentissage dupliqué.'); learningIds.add(row.id);
        if (!LEARNING_SKILLS.concat(SKILLS).includes(row.skill) || !nonempty(text(row.observation, 'Observation')) || !evid.has(row.evidenceId)) fail('Apprentissage non documenté.');
        if (learningEvidence.has(row.evidenceId)) fail('Une preuve ne peut donner plusieurs progressions.'); learningEvidence.add(row.evidenceId);
        instant(row.at);
      });
      const timeIds = new Set(); op.time.forEach(function (row) { identifier(row.id, 'Mesure de temps'); if (timeIds.has(row.id)) fail('Temps dupliqué.'); timeIds.add(row.id); if (!Number.isSafeInteger(row.minutes) || row.minutes < 1 || row.minutes > 1440) fail('Temps mesuré invalide.'); instant(row.at); });
      if (op.forecast !== null) {
        object(op.forecast, 'Prévision'); instant(op.forecast.at); if (!Array.isArray(op.forecastRevisions) || !op.forecastRevisions.length || JSON.stringify(op.forecastRevisions[0]) !== JSON.stringify(op.forecast)) fail('Prévision initiale non conservée.');
      }
      if (op.everOrdered && !op.forecast) fail('Engagement sans prévision initiale.');
      if (op.status === 'settled' && (!op.costsCompleteConfirmed || !op.everOrdered)) fail('Clôture non justifiée.');
    });
    const ledgerIds = new Set(); const ledgerRefs = new Set();
    state.ledger.forEach(function (row) {
      object(row, 'Mouvement'); identifier(row.id, 'Identifiant de mouvement');
      if (ledgerIds.has(row.id)) fail('Mouvement dupliqué.'); ledgerIds.add(row.id);
      if (!ids.has(row.operationId) || !own(CASH_SIGNS, row.kind)) fail('Mouvement non rattaché.');
      cents(row.amountCents, 'Mouvement', true);
      if (!row.amountCents || Math.sign(row.amountCents) !== CASH_SIGNS[row.kind]) fail('Signe de mouvement incohérent.');
      if (!nonempty(text(row.ref, 'Justificatif'))) fail('Justificatif de mouvement manquant.'); instant(row.at);
      if (ledgerRefs.has(row.ref)) fail('Justificatif de mouvement déjà rapproché.'); ledgerRefs.add(row.ref);
    });
    if (state.commands.length !== state.events.length || state.revision !== state.events.length) fail('Journal de commandes incomplet.');
    const commands = new Set();
    state.commands.forEach(function (id, index) { identifier(id, 'Commande'); if (commands.has(id)) fail('Commande dupliquée.'); commands.add(id); const event = state.events[index]; if (!event || event.id !== id || event.revision !== index + 1 || event.previousRevision !== index) fail('Ordre des événements invalide.'); instant(event.at); });
    // Completed bookkeeping must remain complete even after export/import.
    state.operations.filter(function (op) { return op.status === 'settled'; }).forEach(function (op) { const b = blockers(state, op, 'settled', op.updatedAt); if (b.length) fail('Dossier clôturé incohérent : ' + b.join(' ')); });
    metrics(state); return true;
  }
  function eventView(state, operationId) {
    const op = operationId ? state.operations.find(function (x) { return x.id === operationId; }) : null;
    const m = metrics(state);
    return { paused: state.paused, status: op ? op.status : null, suspended: op ? op.suspended : null,
      cashCents: m.cashCents, committedCents: m.committedCents, availableCents: m.availableCents,
      evidenceCount: op ? op.evidence.length : 0, ledgerCount: state.ledger.length, observationCount: m.observations };
  }
  function apply(original, command) {
    validateState(original); object(command, 'Commande');
    const id = identifier(command.id, 'Identifiant de commande');
    if (original.commands.includes(id)) {
      const prior = original.events.find(function (event) { return event.id === id; });
      if (prior.type !== command.type || JSON.stringify(prior.payload) !== JSON.stringify(command.payload || {})) fail('Identifiant de commande réutilisé avec un autre contenu.');
      return clone(original);
    }
    const at = instant(command.at, 'Date de commande');
    if (original.events.length && Date.parse(at) < Date.parse(original.events[original.events.length - 1].at)) fail('La date de commande précède le dernier événement.');
    const type = text(command.type, 'Type de commande', 80); const payload = object(command.payload || {}, 'Contenu de commande');
    const state = clone(original); let operationId = payload.operationId || null;
    const before = eventView(original, operationId);
    if (type === 'SET_SETUP') {
      const patch = payload.patch || payload;
      Object.keys(patch).forEach(function (key) { if (!SETUP_KEYS.includes(key)) fail('Champ de cadre inconnu : ' + key); state.setup[key] = text(patch[key], key); });
    } else if (type === 'SET_FUNDS') {
      const c = state.contributions.find(function (x) { return x.id === payload.contributionId; });
      if (!c) fail('Apporteur inconnu.');
      const amount = cents(payload.confirmedCents, 'Apport confirmé', false);
      if (amount < c.confirmedCents || amount > c.declaredCents) fail('Confirmation limitée à l’apport déclaré, sans retrait implicite.');
      if (!nonempty(text(payload.ref, 'Preuve de disponibilité'))) fail('Référence de disponibilité obligatoire.');
      c.confirmedCents = amount; c.proofRef = payload.ref.trim();
    } else if (type === 'SET_RESERVE') {
      state.reserveCents = cents(payload.reserveCents, 'Réserve', false); state.reserveConfigured = true;
      if (own(payload, 'unavailableCents')) state.unavailableCents = cents(payload.unavailableCents, 'Sommes indisponibles', false);
    } else if (type === 'SET_PAUSED') {
      if (typeof payload.paused !== 'boolean') fail('État d’arrêt invalide.'); state.paused = payload.paused;
    } else if (type === 'CREATE_OPERATION') {
      const opid = identifier(payload.id, 'Identifiant de dossier');
      if (state.operations.some(function (x) { return x.id === opid; })) fail('Identifiant de dossier déjà utilisé.');
      const op = blankOperation(opid, at); const patch = clone(payload); delete patch.id; patchOperation(op, patch);
      state.operations.push(op); operationId = opid;
    } else {
      const op = findOperation(state, payload.operationId); operationId = op.id;
      if (type === 'UPDATE_OPERATION') {
        if (op.status === 'settled') fail('Rouvrir le dossier avant toute correction après clôture.');
        const patch = object(payload.patch, 'Modification');
        const changed = Object.keys(patch).some(function (key) { return CRITICAL_FIELDS.includes(key) && JSON.stringify(op[key]) !== JSON.stringify(patch[key]); });
        const buyerAgreementChanged = op.everOrdered && Object.keys(patch).some(function (key) { return BUYER_AGREEMENT_FIELDS.includes(key) && JSON.stringify(op[key]) !== JSON.stringify(patch[key]); });
        patchOperation(op, patch);
        if (op.forecast && changed) { op.suspended = true; op.suspensionReason = 'Une référence, condition ou somme a changé depuis la prévision. Une nouvelle validation est nécessaire.'; op.costsCompleteConfirmed = false; }
        if (buyerAgreementChanged) { op.orderAmendmentRequired = true; op.orderAmendmentRevision = state.revision + 1; }
      } else if (type === 'ADD_EVIDENCE') {
        const row = { id: identifier(payload.id, 'Identifiant de preuve'), kind: payload.kind, ref: payload.ref, at: payload.at ? instant(payload.at) : at, note: payload.note || '', recordedRevision: state.revision + 1 };
        validateEvidence(row);
        const existing = op.evidence.find(function (x) { return x.id === row.id; });
        if (existing) { if (JSON.stringify([existing.kind, existing.ref, existing.note]) !== JSON.stringify([row.kind, row.ref, row.note])) fail('Identifiant de preuve déjà utilisé.'); return clone(original); }
        if (op.evidence.some(function (x) { return x.kind === row.kind && x.ref === row.ref; })) return clone(original);
        if (Date.parse(row.at) > Date.parse(at)) fail('Une preuve ne peut pas être datée dans le futur.');
        op.evidence.push(row);
      } else if (type === 'TRANSITION') {
        requireHuman(payload); const to = payload.to;
        if (!STAGES.concat(['cancelled', 'returned', 'disputed']).includes(to)) fail('Étape inconnue.');
        const finalizingException = op.status === to && ['cancelled', 'returned'].includes(to) && payload.costsCompleteConfirmed === true;
        if (op.status === to && !(op.suspended && payload.revalidated === true) && !finalizingException) return clone(original);
        if (op.status === to && op.suspended && payload.revalidated === true) {
          // Revalidation records fresh facts and a revised estimate; the initial forecast stays intact.
          op.suspended = false;
          const b = basicBlockers(state, op);
          if (!op.everOrdered || op.status === 'ordered') b.push.apply(b, supplyBlockers(op, at).concat(setupBlockers(state, op)));
          if (op.orderAmendmentRequired && !op.evidence.some(function (row) { return row.kind === 'order' && row.recordedRevision > op.orderAmendmentRevision; })) b.push('Faire accepter et documenter la modification de référence, prix de vente ou délai par l’acheteur (nouvelle preuve order).');
          if (b.length) fail(b.join('\n'));
          freezeForecast(op, at); op.suspensionReason = ''; op.orderAmendmentRequired = false;
        } else {
          if (to === 'cancelled') {
            if (op.status === 'settled') fail('Rouvrir la vente clôturée avant une annulation.');
            if (!hasEvidence(op, 'cancellation')) fail('Ajouter la preuve d’annulation.');
          } else if (to === 'returned') {
            if (!finalizingException && !['purchased', 'shipped', 'delivered', 'disputed'].includes(op.status)) fail('Retour incompatible avec l’étape actuelle.');
            if (!hasEvidence(op, 'return')) fail('Ajouter la preuve du retour.');
          } else if (to === 'disputed') {
            if (!op.everOrdered) fail('Un litige doit concerner une commande engagée.');
            if (!nonempty(payload.reason || '')) fail('Décrire le litige.');
          } else {
            const disputeResolved = op.status === 'disputed' && to === 'delivered';
            if (!disputeResolved && STAGES.indexOf(to) !== STAGES.indexOf(op.status) + 1) fail('Transition non séquentielle : ' + op.status + ' → ' + to + '.');
            const b = blockers(state, op, to, at); if (b.length) fail(b.join('\n'));
            if (to === 'settled' && payload.costsCompleteConfirmed !== true) fail('Confirmer explicitement les coûts réels complets avant clôture.');
            if (to === 'qualified') freezeForecast(op, at);
            if (to === 'ordered') op.everOrdered = true;
            if (to === 'settled') { op.costsCompleteConfirmed = true; op.settledAt = at; }
          }
          op.status = to;
          if (['cancelled', 'returned'].includes(to) && payload.costsCompleteConfirmed === true) {
            if (!hasEvidence(op, 'costs_final') || !hasEvidence(op, 'charges')) fail('Documenter les coûts finaux et les charges.');
            if (operationCash(state, op.id).buyerCents !== 0) fail('Rapprocher le remboursement acheteur avant clôture des coûts.');
            op.costsCompleteConfirmed = true;
          }
        }
      } else if (type === 'RECORD_CASH') {
        const row = { id: identifier(payload.id, 'Identifiant de mouvement'), operationId: op.id, kind: payload.kind,
          amountCents: cents(payload.amountCents, 'Mouvement', true), ref: text(payload.ref, 'Justificatif'), at: at };
        if (!own(CASH_SIGNS, row.kind) || !row.amountCents || Math.sign(row.amountCents) !== CASH_SIGNS[row.kind]) fail('Type ou signe de mouvement invalide.');
        if (!row.ref) fail('Référence du mouvement obligatoire.');
        const previous = state.ledger.find(function (x) { return x.id === row.id; });
        if (previous) { if (cashFingerprint(previous) !== cashFingerprint(row)) fail('Identifiant de mouvement déjà utilisé avec un autre contenu.'); return clone(original); }
        if (state.ledger.some(function (x) { return x.ref === row.ref; })) fail('Ce justificatif est déjà rapproché. Vérifier avant une nouvelle saisie.');
        if (op.status === 'settled') fail('Rouvrir le dossier avant une régularisation.');
        const cash = operationCash(state, op.id);
        if (row.kind === 'REFUND' && -row.amountCents > cash.buyerCents) fail('Le remboursement dépasse l’encaissement acheteur non remboursé.');
        if (row.kind === 'SUPPLIER_REFUND' && row.amountCents > cash.supplierPaidCents - cash.supplierRefundCents) fail('Le remboursement fournisseur dépasse le paiement constaté.');
        state.ledger.push(row);
        // Bookkeeping records facts, including losses or overdrafts; it does not authorize payments.
        if (['cancelled', 'returned'].includes(op.status)) op.costsCompleteConfirmed = false;
      } else if (type === 'REOPEN') {
        requireHuman(payload);
        if (!['settled', 'cancelled', 'returned', 'disputed'].includes(op.status)) fail('Le dossier est déjà ouvert.');
        if (!nonempty(text(payload.reason, 'Motif de réouverture'))) fail('Motif de réouverture obligatoire.');
        op.reopenedFrom = op.status; op.status = 'disputed'; op.reopenedCount += 1; op.costsCompleteConfirmed = false;
      } else if (type === 'ADD_LEARNING') {
        const row = { id: identifier(payload.id, 'Identifiant d’apprentissage'), skill: payload.skill,
          observation: text(payload.observation, 'Observation'), evidenceId: payload.evidenceId, at: at };
        if (!LEARNING_SKILLS.concat(SKILLS).includes(row.skill) || !row.observation || !op.evidence.some(function (x) { return x.id === row.evidenceId; })) fail('Choisir une compétence et rattacher l’observation à une preuve du dossier.');
        if (op.learning.some(function (x) { return x.id === row.id || x.evidenceId === row.evidenceId; })) fail('Cette observation ou preuve a déjà été prise en compte.');
        op.learning.push(row);
      } else if (type === 'RECORD_TIME') {
        const row = { id: identifier(payload.id, 'Identifiant de mesure'), minutes: payload.minutes, at: at };
        if (!Number.isSafeInteger(row.minutes) || row.minutes < 1 || row.minutes > 1440) fail('Saisir un temps mesuré entier entre 1 et 1 440 minutes.');
        if (op.time.some(function (x) { return x.id === row.id; })) fail('Cette mesure de temps existe déjà.'); op.time.push(row);
      } else fail('Commande inconnue : ' + type);
      op.updatedAt = at;
    }
    const event = { id: id, type: type, at: at, operationId: operationId, previousRevision: original.revision,
      revision: original.revision + 1, payload: clone(payload), before: before, after: eventView(state, operationId),
      source: 'USER_RECORDED_SUPERVISED_FACT', externalExecution: false };
    state.commands.push(id); state.events.push(event); state.revision += 1;
    validateState(state); return state;
  }
  return Object.freeze({ schema: SCHEMA, version: 1, stages: STAGES.slice(), evidenceKinds: EVIDENCE_KINDS.slice(), skills: LEARNING_SKILLS.slice(), levels: SKILLS.slice(),
    createState: createState, apply: apply, money: money, format: format, metrics: metrics, estimate: estimate,
    blockers: blockers, validateState: validateState, operationCash: operationCash });
});
