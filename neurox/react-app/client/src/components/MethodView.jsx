import { WEIGHT_LABELS, fmt } from '../lib/data.js';

export default function MethodView({ ds }) {
  const meta = ds.meta;
  const weights = meta.index_weights || {};
  const total = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
  const rules = meta.decision_rules || {};
  const rec = meta.reconciliation || [];

  return (
    <div className="card prose">
      <h2>How the figures are made</h2>
      <p>{meta.index_method}</p>

      <h3>Service-use score weights</h3>
      <ul className="plain-list">
        {Object.entries(weights).map(([k, v]) => (
          <li key={k}><strong>{fmt((100 * v) / total, 0)}%</strong>, {WEIGHT_LABELS[k] || k}</li>
        ))}
      </ul>

      <h3>How the suggested focus is chosen</h3>
      <ul className="plain-list">
        {['staff', 'watch', 'access', 'maintain', 'data'].map((k) => (
          <li key={k}><strong>{rules[k]?.label}.</strong> {rules[k]?.reason}</li>
        ))}
      </ul>
      <p className="fine">
        Median service-use score: {fmt(meta.national?.median_service_use, 1)}. National rate: {fmt(meta.national?.psychiatrists_per_100k, 3)} psychiatrists per 100,000 people.
        The World Health Organization benchmark is one psychiatrist per 100,000 people, which almost every district falls short of.
      </p>

      <h3>National figures from the source documents</h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Figure</th>
              <th scope="col">Value</th>
              <th scope="col">Year</th>
              <th scope="col">Where it comes from</th>
            </tr>
          </thead>
          <tbody>
            {(meta.national_context || []).map((n, i) => (
              <tr key={i}>
                <td>{n.label}</td>
                <td>{fmt(n.value)}</td>
                <td>{n.year}</td>
                <td>{n.source}<br /><span className="fine">{n.note}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Checks against published totals</h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Check</th>
              <th scope="col">Computed from the tables</th>
              <th scope="col">Published</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {rec.map((c, i) => (
              <tr key={i}>
                <td>{c.check}{c.note && <><br /><span className="fine">{c.note}</span></>}</td>
                <td>{fmt(c.computed)}</td>
                <td>{fmt(c.published)}</td>
                <td className={`check-status check-${c.status}`}>{c.status === 'match' ? 'Matches' : c.status === 'partial' ? 'Partly checked' : 'Does not match'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Limits of the data</h3>
      <ul className="plain-list">
        {(meta.limitations || []).map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>

      <h3>Excluded</h3>
      <p>{(meta.excluded_indicators || []).join(' ')}</p>

      <h3>Sources</h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Edition</th>
              <th scope="col">File</th>
            </tr>
          </thead>
          <tbody>
            {ds.sources.map((s, i) => (
              <tr key={i}>
                <td>{s.source_name}</td>
                <td>{s.edition}</td>
                <td>{s.file_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Helplines</h3>
      <p>
        National Mental Health Helpline: <a href="tel:1926">1926</a>. Emergency: <a href="tel:119">119</a>.
        Confirm these numbers before any public launch.
      </p>
    </div>
  );
}
