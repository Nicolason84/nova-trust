(function (root, factory) {
  'use strict';
  const core = typeof module === 'object' && module.exports ? require('./core.js') : root.FreightCore;
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.JaimeEconomics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';
  if (!core || typeof core.money !== 'function' || typeof core.margin !== 'function') {
    throw new Error('Carga FreightCore antes de los escenarios de Jaime.');
  }
  // Business-specific adapter. Monetary parsing and the margin primitive remain
  // owned by the existing FreightCore component; no storage or network here.
  const MAX_UNITS = 1000000;
  const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
  const LABELS = Object.freeze({
    price: 'Precio o venta comisionable por unidad', purchase: 'Compra por unidad',
    transport: 'Transporte por unidad', commissionRate: 'Comisión (%)',
    variableOther: 'Otros gastos por unidad', fixed: 'Gastos fijos del período', units: 'Unidades del período'
  });
  const absent = value => value == null || (typeof value === 'string' && !value.trim());
  function integer(value, label) {
    if (value < -MAX_SAFE || value > MAX_SAFE) throw new Error(label + ': el resultado supera el límite de cálculo exacto.');
    return Number(value);
  }
  function canonicalMoney(cents) {
    return String(Math.floor(cents / 100)) + '.' + String(cents % 100).padStart(2, '0');
  }
  function formatCents(value) {
    if (!Number.isSafeInteger(value)) throw new Error('Importe: se necesitan céntimos enteros exactos.');
    const big = BigInt(value), absolute = big < 0n ? -big : big;
    return (big < 0n ? '−' : '') + (absolute / 100n).toLocaleString('es-ES') + ',' + String(absolute % 100n).padStart(2, '0') + ' €';
  }
  function calculate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Introduce un escenario válido.');
    if (!['resale', 'commission'].includes(input.mode)) throw new Error('Elige venta propia o comisión recibida.');
    const mode = input.mode, missing = [], values = {};
    const inputs = { mode, currency: 'EUR', taxBasis: 'sin IVA', commissionDirection: mode === 'resale' ? 'pagada' : 'recibida' };
    const fields = ['price', ...(mode === 'resale' ? ['purchase'] : []), 'transport', 'commissionRate', 'variableOther', 'fixed', 'units'];
    for (const field of fields) {
      const value = input[field], label = LABELS[field];
      if (absent(value)) { missing.push(label); values[field] = null; inputs[field] = null; continue; }
      if (typeof value !== 'string' || value.length > 80) throw new Error(label + ': introduce texto numérico válido.');
      const text = value.trim();
      if (field === 'units') {
        if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) > MAX_UNITS) {
          throw new Error(label + ': introduce un entero de 0 a 1.000.000.');
        }
        values[field] = Number(text); inputs[field] = String(values[field]);
      } else {
        try { values[field] = core.money(text); }
        catch (error) { throw new Error(label + ': utiliza una cantidad de 0 a 1.000.000.000,00, con hasta dos decimales y sin separador de miles.'); }
        if (field === 'commissionRate' && values[field] > 10000) throw new Error('Comisión (%): introduce un valor de 0 a 100, con hasta dos decimales.');
        inputs[field] = canonicalMoney(values[field]);
      }
    }
    // Purchase has no meaning in the intermediary model; it is never silently
    // counted as Jaime's cost or inferred from the supplier's product margin.
    if (mode === 'commission') inputs.purchase = null;
    const formula = mode === 'resale'
      ? 'Contribución por unidad = precio − compra − transporte − otros gastos − comisión pagada. Resultado del período = contribución × unidades − gastos fijos.'
      : 'Ingreso de Jaime por unidad = venta comisionable × comisión recibida. Contribución = ingreso − transporte − otros gastos. Resultado del período = contribución × unidades − gastos fijos.';
    const warnings = [
      'Hipótesis en EUR sin IVA. Resultado antes de impuestos y de los costes no incluidos.',
      'La comisión se redondea al céntimo más próximo por unidad; medio céntimo se redondea hacia arriba. El contrato puede usar otra base o redondeo.'
    ];
    const result = {
      status: missing.length ? 'incomplete' : 'complete', missing, mode,
      perUnitCents: null, revenueCents: null, costCents: null, commissionCents: null,
      totalContributionCents: null, fixedCents: values.fixed, resultCents: null,
      breakEvenUnits: null, breakEvenReason: null, formula, inputs, warnings
    };
    if (missing.length) return result;
    const commission = integer((BigInt(values.price) * BigInt(values.commissionRate) + 5000n) / 10000n, 'Comisión');
    const extras = integer(BigInt(values.transport) + BigInt(values.variableOther) + (mode === 'resale' ? BigInt(commission) : 0n), 'Gastos variables');
    if (extras > core.MAX_CENTS) throw new Error('Los gastos variables juntos superan el límite de 1.000.000.000,00 € por unidad.');
    const revenue = mode === 'resale' ? values.price : commission;
    const margin = core.margin({ purchase: mode === 'resale' ? values.purchase : 0, sale: revenue, extras });
    const total = integer(BigInt(margin.gross) * BigInt(values.units), 'Contribución del período');
    const net = integer(BigInt(total) - BigInt(values.fixed), 'Resultado del período');
    result.perUnitCents = margin.gross;
    result.revenueCents = revenue;
    result.costCents = margin.cost;
    result.commissionCents = commission;
    result.totalContributionCents = total;
    result.resultCents = net;
    if (margin.gross > 0) {
      result.breakEvenUnits = integer((BigInt(values.fixed) + BigInt(margin.gross) - 1n) / BigInt(margin.gross), 'Punto de equilibrio');
    } else {
      result.breakEvenReason = margin.gross === 0
        ? 'La contribución por unidad es cero: aumentar las ventas no cubre los gastos fijos.'
        : 'La contribución por unidad es negativa: cada unidad aumenta la pérdida antes de gastos fijos.';
      warnings.push(result.breakEvenReason);
    }
    return result;
  }
  return Object.freeze({ calculate, formatCents, MAX_UNITS, MAX_CENTS: core.MAX_CENTS });
});
