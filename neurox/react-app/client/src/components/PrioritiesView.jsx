import { DECISION_ORDER, downloadCsv, fmt, toCsv } from '../lib/data.js';

export default function PrioritiesView({ ds }) {
  const list = ds.decisions();
  const rules = ds.meta.decision_rules || {};
  const counts = DECISION_ORDER.reduce((acc, k) => {
    acc[k] = list.filter((x) => x.r?.decision_key === k).length;
    return acc;
  }, {});

  const exportCsv = () => {
    downloadCsv(
      `neurox_priorities_${ds.meta.source_year}.csv`,
      toCsv(
        ['District', 'Province', 'Year', 'Suggested focus', 'Why', 'Service-use score', 'Psychiatrists per 100,000'],
        list.map(({ d, r }) => [
          d.name, d.province, ds.meta.source_year, r?.decision_label, r?.decision_reason,
          r?.service_use_score, r?.psychiatrists_per_100k,
        ])
      )
    );
  };

  return (
    <>
      <div className="card">
        <h2>Where to look first</h2>
        <p className="muted">
          Each district is placed in one group by the rules below. The groups show where to look first. They are
          not decisions, and the planner and clinical team make the final call.
        </p>
        <div className="priority-grid">
          {DECISION_ORDER.map((k) => (
            <div key={k} className={`priority-card priority-${k}`}>
              <div className="priority-count">{counts[k]}</div>
              <strong>{rules[k]?.label ?? k}</strong>
              <span className="fine">{rules[k]?.reason ?? ''}</span>
            </div>
          ))}
        </div>
        <div className="card-head" style={{ marginTop: '1rem' }}>
          <p className="fine" style={{ margin: 0 }}>
            "Median" means the middle district on the service-use score ({fmt(ds.meta.national?.median_service_use, 1)}).
            "National rate" is {fmt(ds.meta.national?.psychiatrists_per_100k, 2)} psychiatrists per 100,000 people.
          </p>
          <button className="btn ghost" type="button" onClick={exportCsv}>Download priorities (CSV)</button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">District</th>
                <th scope="col">Suggested focus</th>
                <th scope="col">Why</th>
                <th scope="col">Service-use score</th>
                <th scope="col">Psychiatrists per 100,000</th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ d, r }) => (
                <tr key={d.id}>
                  <th scope="row">{d.name}</th>
                  <td>
                    <span className={`flag flag-${r?.decision_key ?? 'data'}`}>{r?.decision_label ?? 'Data incomplete'}</span>
                  </td>
                  <td className="why">{r?.decision_reason}</td>
                  <td>{fmt(r?.service_use_score, 1)}</td>
                  <td>{fmt(r?.psychiatrists_per_100k, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
