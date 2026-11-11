/** Pure helpers for dated energy observations and explicit usage scenarios. */
export function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function timestamp(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0', , offsetHour = '0', offsetMinute = '0'] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > monthDays[month - 1]
      || Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59
      || Number(offsetHour) > 23 || Number(offsetMinute) > 59) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function measured(rows, nowMs) {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
  if (finite(nowMs) === null) throw new TypeError('nowMs must be a finite number');
  return rows.flatMap((row, index) => {
    if (!row || typeof row !== 'object') return [];
    const time = timestamp(row.date_heure);
    const consumption = finite(row.consommation);
    return time !== null && time <= nowMs && consumption !== null && consumption >= 0
      ? [{ row, time, index }] : [];
  }).sort((a, b) => b.time - a.time || a.index - b.index);
}

/** The most recent eligible original row, or null; never mutates its inputs. */
export function selectLatestMeasured(rows, nowMs = Date.now()) {
  return measured(rows, nowMs)[0]?.row ?? null;
}

/** Latest eligible original row for each region, sorted by French display label. */
export function selectLatestRegions(rows, nowMs = Date.now()) {
  const regions = new Map();
  for (const { row } of measured(rows, nowMs)) {
    const code = row.code_insee_region;
    if ((typeof code !== 'string' || !code.trim())
        && (typeof code !== 'number' || !Number.isFinite(code))) continue;
    const key = String(code).trim();
    if (!regions.has(key)) regions.set(key, row);
  }
  return [...regions.values()].sort((a, b) => {
    const aLabel = typeof a.libelle_region === 'string' ? a.libelle_region : String(a.code_insee_region);
    const bLabel = typeof b.libelle_region === 'string' ? b.libelle_region : String(b.code_insee_region);
    return aLabel.localeCompare(bLabel, 'fr')
      || String(a.code_insee_region).localeCompare(String(b.code_insee_region), 'fr');
  });
}

/** ODRÉ convention: positive imports, negative exports. */
export function describeFlow(value) {
  const number = finite(value);
  if (number === null) return { direction: 'missing', mw: null };
  return {
    direction: number > 0 ? 'import' : number < 0 ? 'export' : 'balanced',
    mw: Math.abs(number),
  };
}

/**
 * A completely substituted hypothetical usage, in MWh/year and EUR/MWh.
 * No national trade balance, tax, CO2 or network effect is inferred.
 * Simple payback excludes financing, maintenance and equipment lifetime.
 */
export function simulateUsage(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('A scenario object is required');
  }
  const fields = ['fossilMWh', 'electricMWh', 'importSharePct', 'fossilPrice', 'electricPrice', 'investment'];
  for (const field of fields) {
    if (finite(input[field]) === null) throw new TypeError(`${field} must be a finite number`);
    if (input[field] < 0) throw new RangeError(`${field} must be nonnegative`);
  }
  if (input.importSharePct > 100) throw new RangeError('importSharePct must be at most 100');
  const { fossilMWh, electricMWh, importSharePct, fossilPrice, electricPrice, investment } = input;
  const avoidedImportedMWh = fossilMWh * (importSharePct / 100);
  const netEnergyMWh = fossilMWh - electricMWh;
  const annualOperatingSaving = fossilMWh * fossilPrice - electricMWh * electricPrice;
  const simplePaybackYears = annualOperatingSaving > 0 ? investment / annualOperatingSaving : null;
  for (const value of [avoidedImportedMWh, netEnergyMWh, annualOperatingSaving, simplePaybackYears]) {
    if (value !== null && !Number.isFinite(value)) throw new RangeError('Scenario arithmetic overflow');
  }
  return { avoidedImportedMWh, netEnergyMWh, annualOperatingSaving, simplePaybackYears };
}
