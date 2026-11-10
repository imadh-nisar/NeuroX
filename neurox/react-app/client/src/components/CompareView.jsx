import { useState } from 'react';
import { BarChart } from './Charts.jsx';
import { fmt, hasVal } from '../lib/data.js';

const METRICS = [
  ['Population (census 2024)', (r) => fmt(r.population)],
  ['Service-use score (0 to 100)', (r) => fmt(r.service_use_score, 1)],
  ['Psychiatric clinic visits', (r) => fmt(r.psych_clinic_visits)],
  ['Visits per 100,000', (r) => fmt(r.psych_visits_per_100k, 0)],
  ['Psychiatrists', (r) => fmt(r.psychiatrists)],
  ['Psychiatrists per 100,000', (r) => fmt(r.psychiatrists_per_100k, 2)],
  ['Visits per psychiatrist', (r) => (hasVal(r.visits_per_psychiatrist) ? fmt(r.visits_per_psychiatrist, 0) : 'None recorded')],
  ['Psychiatric beds', (r) => (hasVal(r.psych_beds) ? fmt(r.psych_beds) : 'Not split')],
  ['Admissions for mental disorders per 100,000', (r) => fmt(r.mh_hosp_per_100k, 0)],
  ['Government facilities listed (Directory 2023)', (r) => fmt(r.facilities_listed)],
  ['Suggested focus', (r) => r.decision_label ?? 'Data incomplete'],
];

export default function CompareView({ ds, ids, setIds }) {
  const [note, setNote] = useState('');

  const toggle = (id) => {
    if (ids.includes(id)) {
      setIds(ids.filter((x) => x !== id));
      setNote('');
      return;
    }
    if (ids.length >= 3) {
      setNote('You can compare up to three districts. Untick one to add another.');
      return;
    }
    setIds([...ids, id]);
    setNote('');
  };

  const chosen = ids.map((id) => ({ d: ds.byId.get(id), r: ds.rowFor(id) || {} })).filter((x) => x.d);

  return (
    <>
      <div className="card">
        <h2>Compare districts</h2>
        <p className="muted">Choose up to three districts to see their 2024 figures side by side.</p>
        <div className="chips" role="group" aria-label="Choose up to three districts to compare">
          {ds.sorted.map((d) => (
            <label key={d.id} className="chip">
              <input type="checkbox" checked={ids.includes(d.id)} onChange={() => toggle(d.id)} />
              <span>{d.name}</span>
            </label>
          ))}
        </div>
        <p className="note" aria-live="polite">
          {note || (chosen.length ? '' : 'Select one to three districts above.')}
        </p>

        {chosen.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  {chosen.map(({ d }) => (
                    <th key={d.id} scope="col">{d.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map(([label, get]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {chosen.map(({ d, r }) => (
                      <td key={d.id}>{get(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {chosen.length > 0 && (
        <div className="grid-2">
          <div className="card">
            <h2>Psychiatrists per 100,000</h2>
            <BarChart
              labels={chosen.map(({ d }) => d.name)}
              values={chosen.map(({ r }) => r.psychiatrists_per_100k ?? null)}
              valueTitle="Psychiatrists per 100,000 people"
              ariaLabel="Bar chart of psychiatrists per 100,000 for the chosen districts"
            />
            <p className="fine">National rate: {fmt(ds.meta.national?.psychiatrists_per_100k, 2)}.</p>
          </div>
          <div className="card">
            <h2>Service-use score</h2>
            <BarChart
              labels={chosen.map(({ d }) => d.name)}
              values={chosen.map(({ r }) => r.service_use_score ?? null)}
              valueTitle="Score (0 to 100)"
              colour="#7aa7ff"
              ariaLabel="Bar chart of service-use score for the chosen districts"
            />
          </div>
        </div>
      )}
    </>
  );
}
