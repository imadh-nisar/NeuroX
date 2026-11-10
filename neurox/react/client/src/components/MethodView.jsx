import { WEIGHT_LABELS, fmt } from '../lib/data.js';

export default function MethodView({ ds }) {
  const weights = ds.meta.index_weights || {};
  const total = Object.values(weights).reduce((s, v) => s + v, 0) || 1;

  return (
    <div className="card prose">
      <h2>How the figures are made</h2>
      <p>{ds.meta.index_method}</p>

      <h3>National figures from public sources</h3>
      <p className="fine">
        These are whole-country numbers, found in public documents. They give context only. They are not district data,
        and the district figures in this tool are still demonstration data until the bulletin tables are loaded.
      </p>
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
            {(ds.meta.national_context || []).map((n, i) => (
              <tr key={i}>
                <td>{n.label}</td>
                <td>{fmt(n.value)}</td>
                <td>{n.year || 'Not stated'}</td>
                <td>{n.source}<br /><span className="fine">{n.note}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Index weights</h3>
      <ul className="plain-list">
        {Object.entries(weights).map(([k, v]) => (
          <li key={k}><strong>{fmt((100 * v) / total, 0)}%</strong>, {WEIGHT_LABELS[k] || k}</li>
        ))}
      </ul>

      <h3>Thresholds and suppression</h3>
      <p>
        Age and sex cells with fewer than {ds.meta.min_cell_count} visits are hidden. Districts with reporting completeness
        below {ds.meta.low_completeness_pct}% are flagged. Alerts need {ds.meta.rising_periods} consecutive periods of rising
        need, all at or above {ds.meta.rising_threshold}.
      </p>

      <h3>What the dashboard does not show</h3>
      <p>{(ds.meta.excluded_indicators || []).join(' ')}</p>

      <h3>Limits of the data</h3>
      <ul className="plain-list">
        <li>Under-reporting in rural clinics can make need look lower than it is. Reporting completeness is shown beside each index value.</li>
        <li>Years and districts with no reported data are shown as a gap, never filled with an estimate.</li>
        <li>Districts are placed at approximate centres. Official boundaries need a licensed GeoJSON file.</li>
        <li>Alerts depend on a short history, so they are prompts to check the source, not conclusions.</li>
      </ul>

      <h3>Sources</h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Edition</th>
              <th scope="col">File</th>
              <th scope="col">Downloaded</th>
            </tr>
          </thead>
          <tbody>
            {ds.sources.length === 0 && (
              <tr><td colSpan={4}>No sources recorded.</td></tr>
            )}
            {ds.sources.map((s, i) => (
              <tr key={i}>
                <td>
                  {s.source_name}
                  {s.is_synthetic && <> <span className="flag flag-warn">Synthetic</span></>}
                </td>
                <td>{s.edition}</td>
                <td>{s.file_name}</td>
                <td>{s.downloaded_on || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Helplines</h3>
      <p>
        National Mental Health Helpline: <a href="tel:1926">1926</a>. Emergency: <a href="tel:119">119</a>.
        Please check these numbers before any public launch.
      </p>
    </div>
  );
}
