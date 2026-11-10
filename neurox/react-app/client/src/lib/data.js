/* Helpers for the 2024 district dataset. Pure functions, no React. */

export const BIN_EDGES = [20, 40, 60, 80];
export const BIN_COLOURS = ['#cfe8df', '#8fc9b0', '#e8b04b', '#d9573b', '#8c2d19'];
export const BIN_LABELS = ['Below 20', '20 to 40', '40 to 60', '60 to 80', '80 and above'];
export const NO_DATA_COLOUR = '#7d8c86';
export const DECISION_ORDER = ['staff', 'watch', 'access', 'maintain', 'data'];

export const WEIGHT_LABELS = {
  psych_visits_per_100k: 'Psychiatric clinic visits per 100,000 people',
  mh_hosp_per_100k: 'Admissions for mental disorders per 100,000 people',
};

export const hasVal = (v) => v !== null && v !== undefined && !Number.isNaN(v);

export function fmt(v, digits = 0) {
  if (!hasVal(v)) return '–';
  return Number(v).toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
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

/** Turns the API payload into lookups used by the components. */
export function buildIndex(payload) {
  const meta = payload.meta || {};
  const districts = payload.districts || [];
  const rows = payload.district_2024 || [];
  const rowById = new Map(rows.map((r) => [r.district_id, r]));
  const byId = new Map(districts.map((d) => [d.id, d]));
  const sorted = [...districts].sort((a, b) => a.name.localeCompare(b.name));

  const idByName = (name) => districts.find((d) => d.name === name)?.id ?? null;
  const rowFor = (id) => rowById.get(id) || null;

  const rankOf = (id) => {
    const list = rows
      .filter((r) => hasVal(r.service_use_score))
      .sort((a, b) => b.service_use_score - a.service_use_score);
    const pos = list.findIndex((r) => r.district_id === id);
    return pos < 0 ? null : { pos: pos + 1, total: list.length };
  };

  const decisions = () => {
    const order = (x) => DECISION_ORDER.indexOf(x.r?.decision_key ?? 'data');
    return districts
      .map((d) => ({ d, r: rowFor(d.id) }))
      .sort((a, b) => order(a) - order(b) || (b.r?.service_use_score ?? -1) - (a.r?.service_use_score ?? -1));
  };

  return {
    meta,
    districts,
    byId,
    sorted,
    rows,
    rowFor,
    rankOf,
    decisions,
    idByName,
    national: meta.national || {},
  };
}
