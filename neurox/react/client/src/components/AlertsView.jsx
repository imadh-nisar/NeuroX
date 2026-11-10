import { fmt } from '../lib/data.js';

export default function AlertsView({ ds }) {
  return (
    <div className="card">
      <h2>Rising need</h2>
      <p className="muted">
        Rule: a district is flagged when its need index rises for {ds.meta.rising_periods} periods in a row and stays
        at or above {ds.meta.rising_threshold}.
      </p>

      {ds.alerts.length === 0 ? (
        <div className="empty">No district meets the rule in the current data.</div>
      ) : (
        <div className="alert-list">
          {ds.alerts.map((a) => {
            const d = ds.byId.get(a.district_id);
            return (
              <article key={a.district_id} className="alert-card">
                <header>
                  <h3>{d ? d.name : 'District'}</h3>
                  <span className="pill">{a.first_year}–{a.last_year}</span>
                </header>
                <p>{a.message}</p>
                <p className="fine">Latest index {fmt(a.latest_index, 1)}. Confirm against the source bulletin before acting.</p>
              </article>
            );
          })}
        </div>
      )}

      <p className="fine">Alerts are rule-based, not forecasts. Check each one against the source bulletin before acting on it.</p>
    </div>
  );
}
