import { useState } from 'react';
import { AGE_COLOURS, SERIES_COLOURS, SEX_COLOURS, fmt, hasVal } from '../lib/data.js';
import { BarChart, LineChart } from './Charts.jsx';

export default function TrendsView({ ds, trendIds, setTrendIds, ageDistrict, setAgeDistrict, ageYear, setAgeYear }) {
  const [note, setNote] = useState('');

  const toggle = (id) => {
    if (trendIds.includes(id)) {
      setTrendIds(trendIds.filter((x) => x !== id));
      setNote('');
      return;
    }
    if (trendIds.length >= 3) {
      setNote('You can compare up to three districts. Untick one to add another.');
      return;
    }
    setTrendIds([...trendIds, id]);
    setNote('');
  };

  const selectedDistricts = trendIds.map((id) => ds.byId.get(id));
  const cells = ds.cellsFor(ageDistrict, ageYear);
  const hidden = cells.filter((c) => c.suppressed).length;
  const ageName = ds.byId.get(ageDistrict)?.name ?? '';

  const barsFor = (sex) =>
    ds.meta.age_groups.map((a) => {
      const c = cells.find((x) => x.age_group === a && x.sex === sex);
      return c && hasVal(c.visits) ? c.visits : null;
    });

  return (
    <>
      <div className="card">
        <h2>Need over time</h2>
        <p className="muted">Compare up to three districts. The need index runs from 0 to 100 across all districts and years.</p>

        <div className="chips" role="group" aria-label="Choose up to three districts to compare">
          {ds.sorted.map((d) => (
            <label key={d.id} className="chip">
              <input type="checkbox" checked={trendIds.includes(d.id)} onChange={() => toggle(d.id)} />
              <span>{d.name}</span>
            </label>
          ))}
        </div>

        <p className="note" aria-live="polite">
          {note || (trendIds.length ? '' : 'Select one to three districts above to compare their need over time.')}
        </p>

        {trendIds.length > 0 && (
          <>
            <LineChart
              labels={ds.years}
              series={selectedDistricts.map((d, i) => ({
                label: d.name,
                data: ds.series(d.id, 'need_index'),
                color: SERIES_COLOURS[i % SERIES_COLOURS.length],
              }))}
              yTitle="Need index (0–100)"
              max={100}
              legend
              ariaLabel="Line chart of need index over time for the selected districts"
            />
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">District</th>
                    {ds.years.map((y) => <th key={y} scope="col">{y}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {selectedDistricts.map((d) => (
                    <tr key={d.id}>
                      <th scope="row">{d.name}</th>
                      {ds.series(d.id, 'need_index').map((v, i) => <td key={i}>{fmt(v, 1)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Age and sex breakdown</h2>
        <p className="muted">Cells with fewer than the minimum number of visits are hidden, so small numbers are never shown.</p>
        <div className="controls">
          <label>
            District
            <select value={ageDistrict} onChange={(e) => setAgeDistrict(Number(e.target.value))}>
              {ds.sorted.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label>
            Year
            <select value={ageYear} onChange={(e) => setAgeYear(Number(e.target.value))}>
              {ds.years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>

        <p className="note" aria-live="polite">
          {cells.length === 0
            ? `No age and sex data for ${ageName} in ${ageYear}. The dashboard shows a gap rather than an estimate.`
            : hidden
              ? `${hidden} cell${hidden === 1 ? '' : 's'} hidden: fewer than ${ds.meta.min_cell_count} visits.`
              : 'No cells hidden for this district and year.'}
        </p>

        <div className="grid-2">
          <div>
            <h3>Visits by age and sex</h3>
            <BarChart
              labels={ds.meta.age_groups}
              datasets={[
                { label: 'Male', data: barsFor('Male'), backgroundColor: SEX_COLOURS.Male },
                { label: 'Female', data: barsFor('Female'), backgroundColor: SEX_COLOURS.Female },
              ]}
              valueTitle="Outpatient visits"
              categoryTitle="Age group"
              legend
              ariaLabel="Bar chart of visits by age group and sex"
            />
          </div>
          <div>
            <h3>Rate per 100,000 by age group</h3>
            <LineChart
              labels={ds.years}
              series={ds.meta.age_groups.map((a, i) => ({
                label: a,
                data: ds.years.map((y) => ds.combinedRate(ageDistrict, y, a)),
                color: AGE_COLOURS[i % AGE_COLOURS.length],
              }))}
              yTitle="Visits per 100,000 (both sexes)"
              legend
              ariaLabel="Line chart of rate per 100,000 by age group over time"
            />
          </div>
        </div>
      </div>
    </>
  );
}
