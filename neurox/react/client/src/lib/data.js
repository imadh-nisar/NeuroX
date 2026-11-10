/* Pure helpers for the NeuroX dataset. No React here, so they are easy to test. */

export const BIN_EDGES = [20, 40, 60, 80];
export const BIN_COLOURS = ['#cfe8df', '#8fc9b0', '#e8b04b', '#d9573b', '#8c2d19'];
export const BIN_LABELS = ['Below 20', '20 to 40', '40 to 60', '60 to 80', '80 and above'];
export const NO_DATA_COLOUR = '#7d8c86';
export const SERIES_COLOURS = ['#3ddc97', '#f2b84b', '#7aa7ff'];
export const AGE_COLOURS = ['#3ddc97', '#7aa7ff', '#f2b84b', '#ff8a70', '#c58af9', '#5fd3e6'];
export const SEX_COLOURS = { Male: '#7aa7ff', Female: '#f2b84b' };
export const PREFERRED_TREND_NAMES = ['Colombo', 'Kandy', 'Jaffna'];
export const WEIGHT_LABELS = {
  out_rate: 'Outpatient visits per 100,000 population',
  adm_rate: 'Admissions per 100,000 population',
  ref_rate: 'Referrals per 100,000 population',
  unemployment_pct: 'Unemployment rate (district stress factor)',
};

export const hasVal = (v) => v !== null && v !== undefined && !Number.isNaN(v);

export function fmt(v, digits = 0) {
  if (!hasVal(v)) return '–';
  return Number(v).toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function median(values) {
  const a = values.filter(hasVal).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function colourFor(v) {
  if (!hasVal(v)) return NO_DATA_COLOUR;
  let i = 0;
  while (i < BIN_EDGES.length && v >= BIN_EDGES[i]) i++;
  return BIN_COLOURS[i];
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header, rows) {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

export function downloadCsv(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

/** Flags a district for the coverage table, relative to the national median. */
export function flagFor(r, medVpp, medIdx, lowCompletenessPct) {
  if (!r || !hasVal(r.outpatient_visits) || !hasVal(r.psychiatrists)) {
    return { text: 'No data', cls: 'flag-none' };
  }
  if (hasVal(r.need_index) && r.need_index >= medIdx && r.visits_per_psychiatrist >= medVpp) {
    return { text: 'High need, high load per psychiatrist', cls: 'flag-high' };
  }
  if (hasVal(r.completeness_pct) && r.completeness_pct < lowCompletenessPct) {
    return { text: 'Low reporting completeness', cls: 'flag-warn' };
  }
  return { text: '', cls: '' };
}

/** Plain-language action for a district. Rules are simple and visible, so anyone can check them. */
export function decisionFor(r, medVpp, medIdx, alertedIds, lowPct) {
  if (!r || !hasVal(r.outpatient_visits)) {
    return { key: 'data', label: 'Fill data gap', reason: 'There are no outpatient figures for this year, so no decision can be made from the data.' };
  }
  if (alertedIds.has(r.district_id)) {
    return { key: 'review', label: 'Review first', reason: 'Need has risen for several periods in a row and is above the alert level.' };
  }
  if (hasVal(r.completeness_pct) && r.completeness_pct < lowPct) {
    return { key: 'data', label: 'Check reporting', reason: `Only ${fmt(r.completeness_pct, 0)}% of expected reporting arrived, so true need may be higher than shown.` };
  }
  const highNeed = hasVal(r.need_index) && r.need_index >= medIdx;
  const highLoad = hasVal(r.visits_per_psychiatrist) && r.visits_per_psychiatrist >= medVpp;
  if (highNeed && highLoad) {
    return { key: 'staff', label: 'Add psychiatrist time', reason: 'Need and the load on each psychiatrist are both above the national middle.' };
  }
  if (highLoad) {
    return { key: 'watch', label: 'Watch staffing', reason: 'Each psychiatrist carries a heavier load than most districts, though need is average or lower.' };
  }
  if (highNeed) {
    return { key: 'outreach', label: 'Consider outreach', reason: 'Need is above the middle, but psychiatrists are not overloaded. Outreach or awareness work may reach more people.' };
  }
  return { key: 'maintain', label: 'Keep current plan', reason: 'Need and load are both at or below the national middle.' };
}

export const DECISION_ORDER = ['review', 'staff', 'outreach', 'watch', 'data', 'maintain'];
export const DECISION_LABELS = {
  review: 'Review first',
  staff: 'Add psychiatrist time',
  outreach: 'Consider outreach',
  watch: 'Watch staffing',
  data: 'Fix data first',
  maintain: 'Keep current plan',
};

/**
 * Turns the API payload into lookups and computed views.
 * Everything the components need comes from this object.
 */
export function buildIndex(payload) {
  const meta = {
    age_groups: ['10-14', '15-19', '20-24', '25-39', '40-59', '60+'],
    sexes: ['Male', 'Female'],
    ...payload.meta,
  };
  const districts = payload.districts;
  const byId = new Map(districts.map((d) => [d.id, d]));
  const sorted = [...districts].sort((a, b) => a.name.localeCompare(b.name));
  const rows = payload.district_year;
  const dy = new Map(rows.map((r) => [`${r.district_id}-${r.year}`, r]));
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  const ageRows = payload.age_sex;

  const rowFor = (id, year) => dy.get(`${id}-${year}`) || null;
  const series = (id, field) =>
    years.map((y) => {
      const r = rowFor(id, y);
      return r && hasVal(r[field]) ? r[field] : null;
    });
  const cellsFor = (id, year) => ageRows.filter((r) => r.district_id === id && r.year === year);
  const idByName = (name) => districts.find((d) => d.name === name)?.id ?? null;

  const rankOf = (id, year) => {
    const list = rows
      .filter((r) => r.year === year && hasVal(r.need_index))
      .sort((a, b) => b.need_index - a.need_index);
    const pos = list.findIndex((r) => r.district_id === id);
    return pos < 0 ? null : { pos: pos + 1, total: list.length };
  };

  /** Rate per 100,000 for one age group, both sexes. Null if any cell is hidden. */
  const combinedRate = (id, year, age) => {
    const cells = cellsFor(id, year).filter((c) => c.age_group === age);
    if (cells.length < meta.sexes.length) return null;
    if (cells.some((c) => !hasVal(c.visits))) return null;
    const visits = cells.reduce((s, c) => s + c.visits, 0);
    const pop = cells.reduce((s, c) => s + c.population, 0);
    return pop ? (visits / pop) * 100000 : null;
  };

  const coverage = (year) => {
    const entries = districts.map((d) => ({ d, r: rowFor(d.id, year) }));
    const complete = entries.filter((x) => x.r && hasVal(x.r.outpatient_visits) && hasVal(x.r.psychiatrists));
    const medVpp = median(complete.map((x) => x.r.visits_per_psychiatrist));
    const medIdx = median(complete.map((x) => x.r.need_index));
    const list = entries.map((x) => ({
      ...x,
      flag: flagFor(x.r, medVpp, medIdx, meta.low_completeness_pct),
    }));
    return { list, medVpp, medIdx };
  };

  const decisions = (year) => {
    const cov = coverage(year);
    const alerted = new Set(payload.alerts.map((a) => a.district_id));
    const list = cov.list.map((x) => ({
      ...x,
      decision: decisionFor(x.r, cov.medVpp, cov.medIdx, alerted, meta.low_completeness_pct),
    }));
    list.sort((a, b) => DECISION_ORDER.indexOf(a.decision.key) - DECISION_ORDER.indexOf(b.decision.key)
      || (b.r?.need_index ?? -1) - (a.r?.need_index ?? -1));
    return list;
  };

  return {
    meta,
    decisions,
    districts,
    sorted,
    byId,
    rows,
    years,
    alerts: payload.alerts || [],
    sources: payload.sources || [],
    ageRows,
    rowFor,
    series,
    cellsFor,
    idByName,
    rankOf,
    combinedRate,
    coverage,
  };
}
