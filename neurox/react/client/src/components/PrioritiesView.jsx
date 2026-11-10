import { DECISION_LABELS, DECISION_ORDER, downloadCsv, fmt, toCsv } from '../lib/data.js';

const CATEGORY_HELP = {
  review: 'Need is rising and high. Check capacity and referral routes first.',
  staff: 'Need and workload are both high. Consider moving or adding psychiatrist time.',
  outreach: 'Need is above average but services are not overloaded. Outreach may reach more people.',
  watch: 'Workload is high even though need is average. Keep an eye on it.',
  data: 'The figures are incomplete. Fix reporting before deciding.',
  maintain: 'Nothing in the data calls for a change this year.',
};

export default function PrioritiesView({ ds, year }) {
  const list = ds.decisions(year);
  const counts = DECISION_ORDER.reduce((acc, k) => {
    acc[k] = list.filter((x) => x.decision.key === k).length;
    return acc;
  }, {});

  const exportCsv = () => {
    downloadCsv(
      `neurox_priorities_${year}.csv`,
      toCsv(
        ['District', 'Province', 'Year', 'Action', 'Reason', 'Need score', 'Visits per psychiatrist', 'Reporting completeness %'],
        list.map((x) => [
          x.d.name, x.d.province, year, x.decision.label, x.decision.reason,
          x.r?.need_index, x.r?.visits_per_psychiatrist, x.r?.completeness_pct,
        ])
      )
    );
  };

  return (
    <>
      <div className="card">
        <h2>Where to act first in {year}</h2>
        <p className="muted">
          Each district is placed in one group using simple, visible rules. Use these groups to decide where to look
          first. The final decision stays with the planner and the clinical team.
        </p>

        <div className="priority-grid">
          {DECISION_ORDER.map((k) => (
            <div key={k} className={`priority-card priority-${k}`}>
              <div className="priority-count">{counts[k]}</div>
              <strong>{DECISION_LABELS[k]}</strong>
              <span className="fine">{CATEGORY_HELP[k]}</span>
            </div>
          ))}
        </div>

        <div className="card-head" style={{ marginTop: '1rem' }}>
          <p className="fine" style={{ margin: 0 }}>
            Rules: "above the middle" means above the national median for that year.
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
                <th scope="col">Need score</th>
                <th scope="col">Visits per psychiatrist</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.d.id}>
                  <th scope="row">{x.d.name}</th>
                  <td>
                    <span className={`flag flag-${x.decision.key}`}>{x.decision.label}</span>
                  </td>
                  <td className="why">{x.decision.reason}</td>
                  <td>{fmt(x.r?.need_index, 1)}</td>
                  <td>{fmt(x.r?.visits_per_psychiatrist, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
