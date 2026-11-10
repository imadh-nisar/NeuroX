import { fmt, hasVal } from '../lib/data.js';

export default function DistrictPanel({ ds, id, onCompare }) {
  const d = id !== null && id !== undefined ? ds.byId.get(id) : null;

  if (!d) {
    return (
      <aside className="panel" aria-live="polite">
        <h2>District details</h2>
        <p className="muted">Select a district on the map, or choose one from the list above, to see its figures for 2024.</p>
      </aside>
    );
  }

  const r = ds.rowFor(d.id) || {};
  const nat = ds.national;
  const rank = ds.rankOf(d.id);
  const decisionClass = r.decision_key ? `flag-${r.decision_key}` : 'flag-data';

  return (
    <aside className="panel" aria-live="polite">
      <p className="eyebrow">{d.province} province · {ds.meta.source_year}</p>
      <h2>{d.name}</h2>

      <div className="decision-card">
        <span className={`flag ${decisionClass}`}>{r.decision_label ?? 'Data incomplete'}</span>
        <p>{r.decision_reason}</p>
      </div>

      {hasVal(r.service_use_score) && (
        <div className="index-card">
          <div className="big">{fmt(r.service_use_score, 1)}</div>
          <div>
            <strong>Service-use score</strong>
            <br />
            <span className="muted">
              {rank ? `Ranked ${rank.pos} of ${rank.total} (1 = highest use)` : 'Not enough data to rank'}
            </span>
          </div>
        </div>
      )}

      {d.name === 'Colombo' && (
        <div className="note warn">
          Colombo's figures include national institutions whose patients come from across the country.
        </div>
      )}

      <dl className="metrics">
        <div><dt>Population (census 2024)</dt><dd>{fmt(r.population)}</dd></div>
        <div><dt>Psychiatric clinic visits</dt><dd>{fmt(r.psych_clinic_visits)}</dd></div>
        <div><dt>Visits per 100,000</dt><dd>{fmt(r.psych_visits_per_100k, 0)}</dd></div>
        <div><dt>Admissions for mental disorders per 100,000</dt><dd>{fmt(r.mh_hosp_per_100k, 0)}</dd></div>
        <div>
          <dt>Psychiatrists</dt>
          <dd>{fmt(r.psychiatrists)}</dd>
        </div>
        <div>
          <dt>Psychiatrists per 100,000</dt>
          <dd>{fmt(r.psychiatrists_per_100k, 2)}<small>National rate {fmt(nat.psychiatrists_per_100k, 2)}</small></dd>
        </div>
        <div>
          <dt>Visits per psychiatrist</dt>
          <dd>{hasVal(r.visits_per_psychiatrist) ? fmt(r.visits_per_psychiatrist, 0) : 'None recorded'}</dd>
        </div>
        <div>
          <dt>Psychiatric beds</dt>
          <dd>{hasVal(r.psych_beds) ? fmt(r.psych_beds) : 'Not split in source'}</dd>
        </div>
        <div>
          <dt>Government facilities listed (Directory {ds.meta.directory_year})</dt>
          <dd>{fmt(r.facilities_listed)}</dd>
        </div>
      </dl>

      <div className="actions">
        <button className="btn" type="button" onClick={() => onCompare(d.id)}>Compare with other districts</button>
      </div>
      <p className="fine">Aggregated figures. Read the Method tab before using these for decisions.</p>
    </aside>
  );
}
