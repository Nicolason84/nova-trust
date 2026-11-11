import test from 'node:test';
import assert from 'node:assert/strict';
import { finite, selectLatestMeasured, selectLatestRegions, describeFlow, simulateUsage } from '../docs/maison-des-preuves/episode-04-model.mjs';

const NOW = Date.parse('2026-11-11T14:00:00Z');
const row = (date_heure, consommation, extra = {}) => ({ date_heure, consommation, ...extra });
const scenario = { fossilMWh: 1000, electricMWh: 300, importSharePct: 80, fossilPrice: 90, electricPrice: 150, investment: 180000 };

test('Only actual finite numbers are observations; absent values never become zero', () => {
  for (const value of [null, undefined, '', '0', false, true, NaN, Infinity, -Infinity, {}, []]) assert.equal(finite(value), null);
  assert.equal(finite(0), 0);
  assert.equal(finite(-12.5), -12.5);
});

test('Latest measured row excludes forecast-only, future, invalid and negative observations', () => {
  const good = row('2026-11-11T13:45:00Z', 42000);
  const old = row('2026-11-11T13:30:00Z', 41000);
  const rows = [old, row('2026-11-11T14:15:00Z', 44000), row('2026-11-11T14:00:00Z', null),
    row('2026-02-30T13:00:00Z', 1), row('2026-11-11T13:59:00Z', '43000'),
    row('2026-11-11T13:58:00Z', -1), good];
  const before = [...rows];
  assert.equal(selectLatestMeasured(rows, NOW), good);
  assert.deepEqual(rows, before);
  assert.equal(selectLatestMeasured([row('2026-11-11T14:01:00Z', 1), row('2026-11-11T13:00:00Z', null)], NOW), null);
});

test('Zero remains valid and ISO offsets refer to the same instant', () => {
  const zero = row('2026-11-11T15:00:00+01:00', 0);
  assert.equal(selectLatestMeasured([zero], NOW), zero);
  assert.equal(selectLatestMeasured([row('11/11/2026 14:00', 1)], NOW), null);
  assert.throws(() => selectLatestMeasured([], NaN), TypeError);
  assert.throws(() => selectLatestMeasured(null, NOW), TypeError);
});

test('Regional selection preserves each region own latest measured date and sorts labels', () => {
  const bretagne = row('2026-11-11T13:00:00Z', 100, { code_insee_region: '53', libelle_region: 'Bretagne' });
  const haut = row('2026-11-11T13:45:00Z', 300, { code_insee_region: '32', libelle_region: 'Hauts-de-France' });
  const rows = [haut, bretagne, row('2026-11-11T13:30:00Z', null, { code_insee_region: '53', libelle_region: 'Bretagne' }),
    row('2026-11-11T14:15:00Z', 400, { code_insee_region: '32', libelle_region: 'Hauts-de-France' }),
    row('2026-11-11T12:45:00Z', 200, { code_insee_region: '32', libelle_region: 'Hauts-de-France' }),
    row('2026-11-11T13:45:00Z', 1, { code_insee_region: null })];
  assert.deepEqual(selectLatestRegions(rows, NOW), [bretagne, haut]);
});

test('Physical flow signs distinguish imports, exports, balanced and missing', () => {
  assert.deepEqual(describeFlow(125), { direction: 'import', mw: 125 });
  assert.deepEqual(describeFlow(-125), { direction: 'export', mw: 125 });
  assert.deepEqual(describeFlow(-0), { direction: 'balanced', mw: 0 });
  for (const value of [null, '0', NaN]) assert.deepEqual(describeFlow(value), { direction: 'missing', mw: null });
});

test('Usage substitution computes quantities, operating costs and simple payback', () => {
  assert.deepEqual(simulateUsage(scenario), {
    avoidedImportedMWh: 800, netEnergyMWh: 700, annualOperatingSaving: 45000, simplePaybackYears: 4,
  });
  const adverse = simulateUsage({ ...scenario, electricPrice: 400 });
  assert.equal(adverse.annualOperatingSaving, -30000);
  assert.equal(adverse.simplePaybackYears, null);
  const neutral = simulateUsage({ ...scenario, electricPrice: 300 });
  assert.equal(neutral.annualOperatingSaving, 0);
  assert.equal(neutral.simplePaybackYears, null);
});

test('Scenario boundaries reject coercion, invalid shares, negatives and overflow', () => {
  assert.equal(simulateUsage({ ...scenario, importSharePct: 0 }).avoidedImportedMWh, 0);
  assert.equal(simulateUsage({ ...scenario, importSharePct: 100 }).avoidedImportedMWh, 1000);
  assert.equal(simulateUsage({ ...scenario, investment: 0 }).simplePaybackYears, 0);
  for (const field of Object.keys(scenario)) {
    for (const value of [null, '0', NaN, Infinity]) assert.throws(() => simulateUsage({ ...scenario, [field]: value }), TypeError);
    assert.throws(() => simulateUsage({ ...scenario, [field]: -1 }), RangeError);
  }
  assert.throws(() => simulateUsage({ ...scenario, importSharePct: 101 }), RangeError);
  assert.throws(() => simulateUsage({ ...scenario, fossilMWh: Number.MAX_VALUE }), RangeError);
  assert.throws(() => simulateUsage(null), TypeError);
});
