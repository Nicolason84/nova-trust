'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate, formatCents } = require('../../docs/jaime/economics.js');
const resale = (changes = {}) => ({ mode: 'resale', price: '14', purchase: '9', transport: '1.20', commissionRate: '5', variableOther: '0', fixed: '310', units: '100', ...changes });
const intermediary = (changes = {}) => ({ mode: 'commission', price: '5000', transport: '50', commissionRate: '8', variableOther: '0', fixed: '0', units: '1', ...changes });

test('reventa: comisión pagada, contribución y equilibrio exactos', () => {
  const r = calculate(resale());
  assert.equal(r.status, 'complete');
  assert.deepEqual([r.revenueCents, r.costCents, r.commissionCents, r.perUnitCents], [1400, 1090, 70, 310]);
  assert.equal(r.totalContributionCents, 31000);
  assert.equal(r.resultCents, 0);
  assert.equal(r.breakEvenUnits, 100);
  const lower = calculate(resale({price: '12'}));
  assert.equal(lower.perUnitCents, 120);
  assert.equal(lower.breakEvenUnits, 259);
  assert.equal(lower.resultCents, -19000);
});
test('comisión recibida: la facturación del proveedor no es el ingreso de Jaime', () => {
  const r = calculate(intermediary({purchase: 'dato no aplicable'}));
  assert.deepEqual([r.revenueCents, r.costCents, r.perUnitCents, r.resultCents], [40000, 5000, 35000, 35000]);
  assert.equal(r.inputs.purchase, null);
  assert.equal(r.breakEvenUnits, 0);
});
test('un dato desconocido no se convierte en cero; los ceros explícitos sí valen', () => {
  const r = calculate(resale({transport: '', fixed: null}));
  assert.equal(r.status, 'incomplete');
  assert.deepEqual(r.missing, ['Transporte por unidad', 'Gastos fijos del período']);
  assert.equal(r.perUnitCents, null);
  assert.equal(r.resultCents, null);
  assert.equal(r.fixedCents, null);
  const zero = calculate(resale({transport: '0', fixed: '0', units: '0'}));
  assert.equal(zero.status, 'complete');
  assert.equal(zero.resultCents, 0);
  assert.equal(zero.breakEvenUnits, 0);
});
test('contribution nulle ou négative: aucun faux seuil rentable', () => {
  const negative = calculate(resale({price: '9'}));
  assert.ok(negative.perUnitCents < 0);
  assert.equal(negative.breakEvenUnits, null);
  assert.match(negative.breakEvenReason, /negativa/);
  const zero = calculate(resale({price: '9', transport: '0', commissionRate: '0'}));
  assert.equal(zero.perUnitCents, 0);
  assert.equal(zero.breakEvenUnits, null);
  assert.match(zero.breakEvenReason, /cero/);
});
test('arrondi de commission à la demi-unité, virgule décimale et taux à deux décimales', () => {
  const r = calculate(intermediary({price: '0,10', commissionRate: '5', transport: '0'}));
  assert.equal(r.commissionCents, 1);
  assert.equal(r.perUnitCents, 1);
  assert.equal(calculate(intermediary({price:'100', commissionRate:'7,25', transport:'0'})).commissionCents, 725);
  assert.equal(calculate(intermediary({price:'0.09', commissionRate:'5', transport:'0'})).commissionCents, 0);
});
test('données invalides et limites refusées, même en présence d’une inconnue', () => {
  for (const changes of [{price:'-1'},{price:'1.001'},{price:'1e3'},{price:'1,000.00'},{price:1},{commissionRate:'100.01'},{commissionRate:'-1'},{units:'1.5'},{units:'1000001'},{units:'Infinity'},{mode:'other'}]) {
    assert.throws(() => calculate(resale(changes)), Error);
  }
  assert.throws(() => calculate(resale({transport:'', commissionRate:'101'})), /Comisión/);
  assert.throws(() => calculate(resale({price:'1000000000.01'})), /Precio/);
});
test('produits exacts et dépassement détecté avant conversion Number', () => {
  assert.equal(calculate(resale({price:'0.30',purchase:'0.10',transport:'0.10',commissionRate:'0',fixed:'0.30',units:'3'})).resultCents, 0);
  assert.throws(() => calculate(resale({price:'1000000000',purchase:'0',transport:'0',commissionRate:'0',fixed:'0',units:'1000000'})), /límite de cálculo exacto/);
  assert.throws(() => calculate(resale({transport:'1000000000',variableOther:'1'})), /gastos variables juntos/);
  assert.equal(formatCents(-12345), '−123,45 €');
  assert.equal(formatCents(9007199254740991), '90.071.992.547.409,91 €');
});
test('scénario de comparaison indépendant: aucune mutation des hypothèses', () => {
  const base = resale(), before = JSON.stringify(base);
  const a = calculate(base), b = calculate({...base, price:'12'});
  assert.equal(JSON.stringify(base), before);
  assert.equal(a.inputs.price, '14.00');
  assert.equal(b.inputs.price, '12.00');
  assert.equal(a.perUnitCents, 310);
});
