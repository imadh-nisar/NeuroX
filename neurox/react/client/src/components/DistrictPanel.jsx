import { SERIES_COLOURS, downloadCsv, fmt, hasVal, toCsv } from '../lib/data.js';
import { LineChart } from './Charts.jsx';

function exportHistory(ds, d) {
  const rows = ds.years.map((y) => {
    const r = ds.rowFor(d.id, y) || {};
    return [y, r.need_index, r.outpatient_visits, r.admissions, r.referrals, r.population,
      r.psychiatrists, r.visits_per_psychiatrist, r.completeness_pct];
  });
  downloadCsv(
    `neurox_${d.name.toLowerCase().replace(/\s+/g, '_')}_history.csv`,
    toCsv(
      ['Year', 'Need index', 'Outpatient visits', 'Admissions', 'Referrals', 'Population (reference)',
        'Psychiatrists', 'Visits per psychiatrist', 'Reporting completeness %'],
      rows
    )
  );
}

export default function DistrictPanel({ ds, year, id, onCompare }) {
  const d = id !== null && id !== undefined ? ds.byId.get(id) : null;

  if (!d) {
    return (
      <aside className="panel" aria-live="polite">
        <h2>District details</h2>
        <p className="muted">
          Select a district on the map, or choose one from the list above, to see its need, trend and capacity.
        </p>
      </aside>
    );
  }

  const r = ds.rowFor(d.id, year);
  const rank = ds.rankOf(d.id, year);
  const noData = !r || !hasVal(r.outpatient_visits);
  const lowComp = Boolean(r && hasVal(r.completeness_pct) && r.completeness_pct < ds.meta.low_completeness_pct);

  return (
    <aside className="panel" aria-live="polite">
      <p className="eyebrow">{d.province} province · {year}</p>
      <h2>{d.name}</h2>

      {noData && (
        <div className="note">No outpatient data for {year}. The dashboard shows a gap here rather than an estimate.</div>
      )}

      {hasVal(r?.need_index) && (
        <p className="summary">
          {d.name} is ranked {rank ? rank.pos : '–'} of {rank ? rank.total : '–'} for need in {year}.
          {hasVal(r?.visits_per_psychiatrist)
            ? ` Each psychiatrist there handled about ${fmt(r.visits_per_psychiatrist, 0)} outpatient visits.`
            : ''}
        </p>
      )}

      <div className="index-card">
        <div className="big">{hasVal(r?.need_index) ? fmt(r.need_index, 1) : '–'}</div>
        <div>
          <strong>Need index</strong>
          <br />
          <span className="muted">
            {rank ? `Ranked ${rank.pos} of ${rank.total} for ${year} (1 = highest need)` : `No index value for ${year}`}
          </span>
        </div>
      </div>

      {lowComp && (
        <div className="note warn">
          Reporting completeness is {fmt(r.completeness_pct, 1)}%. A low figure here may reflect under-reporting rather than low need.
        </div>
      )}

      <dl className="metrics">
        <div><dt>Outpatient visits</dt><dd>{fmt(r?.outpatient_visits)}</dd></div>
        <div><dt>Visits per 100,000</dt><dd>{fmt(r?.out_rate, 0)}</dd></div>
        <div><dt>Admissions per 100,000</dt><dd>{fmt(r?.adm_rate, 0)}</dd></div>
        <div><dt>Referrals per 100,000</dt><dd>{fmt(r?.ref_rate, 0)}</dd></div>
        <div><dt>Psychiatrists</dt><dd>{fmt(r?.psychiatrists)}</dd></div>
        <div><dt>Visits per psychiatrist</dt><dd>{fmt(r?.visits_per_psychiatrist, 0)}</dd></div>
        <div><dt>Reporting completeness</dt><dd>{hasVal(r?.completeness_pct) ? `${fmt(r.completeness_pct, 1)}%` : '–'}</dd></div>
        <div><dt>Population (reference)</dt><dd>{fmt(r?.population)}</dd></div>
      </dl>

      <p className="fine">Need index over time</p>
      <LineChart
        className="chart-box small"
        labels={ds.years}
        series={[{ label: d.name, data: ds.series(d.id, 'need_index'), color: SERIES_COLOURS[0] }]}
        yTitle="Index"
        max={100}
        ariaLabel={`Need index over time for ${d.name}`}
      />

      <div className="actions">
        <button className="btn" type="button" onClick={() => onCompare(d.id)}>Compare in Trends</button>
        <button className="btn ghost" type="button" onClick={() => exportHistory(ds, d)}>Download history (CSV)</button>
      </div>
      <p className="fine">Aggregated figures only. See Method for how the index is built.</p>
    </aside>
  );
}
