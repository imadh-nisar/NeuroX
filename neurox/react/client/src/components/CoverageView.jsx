import { useState } from 'react';
import { BarChart } from './Charts.jsx';
import { downloadCsv, fmt, hasVal, toCsv } from '../lib/data.js';

function Simulator({ ds, year, from, setFrom, to, setTo, fte, setFte }) {
  if (from === to) {
    return <p className="note">Choose two different districts to compare.</p>;
  }
  const a = ds.rowFor(from, year);
  const b = ds.rowFor(to, year);
  const ready = a && b && hasVal(a.psychiatrists) && hasVal(b.psychiatrists) &&
    hasVal(a.outpatient_visits) && hasVal(b.outpatient_visits);

  const maxK = ready ? Math.max(0, a.psychiatrists - 1) : 0;
  const k = Math.min(fte, maxK);

  let result = null;
  if (ready) {
    const fromAfter = a.psychiatrists - k;
    const toAfter = b.psychiatrists + k;
    result = {
      fromAfter,
      toAfter,
      fromBefore: a.outpatient_visits / a.psychiatrists,
      toBefore: b.outpatient_visits / b.psychiatrists,
      fromNew: a.outpatient_visits / fromAfter,
      toNew: b.outpatient_visits / toAfter,
    };
  }

  return (
    <>
      <div className="controls stack">
        <label>
          From
          <select value={from} onChange={(e) => setFrom(Number(e.target.value))}>
            {ds.sorted.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label>
          To
          <select value={to} onChange={(e) => setTo(Number(e.target.value))}>
            {ds.sorted.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="slider-label">
          <span>Posts moved: <output>{k}</output></span>
          <input
            type="range"
            min={0}
            max={Math.max(maxK, 0)}
            step={1}
            value={k}
            disabled={!ready || maxK === 0}
            onChange={(e) => setFte(Number(e.target.value))}
          />
        </label>
      </div>

      {!ready && <p className="note">Not enough data for {year} to run the simulation.</p>}

      {result && (
        <>
          <table className="data sim-table">
            <thead>
              <tr>
                <th scope="col">District</th>
                <th scope="col">Psychiatrists</th>
                <th scope="col">Visits per psychiatrist, before</th>
                <th scope="col">After</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{ds.byId.get(from).name} (from)</th>
                <td>{a.psychiatrists} → {result.fromAfter}</td>
                <td>{fmt(result.fromBefore, 0)}</td>
                <td>{fmt(result.fromNew, 0)}</td>
              </tr>
              <tr>
                <th scope="row">{ds.byId.get(to).name} (to)</th>
                <td>{b.psychiatrists} → {result.toAfter}</td>
                <td>{fmt(result.toBefore, 0)}</td>
                <td>{fmt(result.toNew, 0)}</td>
              </tr>
            </tbody>
          </table>
          <p className="fine">Visit volumes are assumed unchanged. The result shows staffing ratios, not clinical impact.</p>
        </>
      )}
    </>
  );
}

export default function CoverageView({ ds, year }) {
  const [sort, setSort] = useState('vpp');
  const [from, setFrom] = useState(ds.districts[0].id);
  const [to, setTo] = useState((ds.districts[1] ?? ds.districts[0]).id);
  const [fte, setFte] = useState(1);

  const { list } = ds.coverage(year);
  const field = sort === 'index' ? 'need_index' : 'visits_per_psychiatrist';
  const value = (x) => (x.r && hasVal(x.r[field]) ? x.r[field] : -1);
  const sorted = [...list].sort((a, b) =>
    sort === 'name' ? a.d.name.localeCompare(b.d.name) : value(b) - value(a)
  );
  const withVpp = sorted.filter((x) => x.r && hasVal(x.r.visits_per_psychiatrist));

  const exportCsv = () => {
    const rows = sorted.map((x) => {
      const r = x.r || {};
      return [x.d.name, x.d.province, year, r.psychiatrists, r.psych_per_100k, r.outpatient_visits,
        r.visits_per_psychiatrist, r.need_index, r.completeness_pct, x.flag.text];
    });
    downloadCsv(
      `neurox_coverage_${year}.csv`,
      toCsv(['District', 'Province', 'Year', 'Psychiatrists', 'Psychiatrists per 100,000', 'Outpatient visits',
        'Visits per psychiatrist', 'Need index', 'Reporting completeness %', 'Flag'], rows)
    );
  };

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Need against psychiatric capacity</h2>
            <p className="muted">
              Outpatient visits per psychiatrist for {year}. Flags compare each district with the national median.
            </p>
          </div>
          <div className="controls">
            <label>
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="vpp">Visits per psychiatrist</option>
                <option value="index">Need index</option>
                <option value="name">Name</option>
              </select>
            </label>
            <button className="btn ghost" type="button" onClick={exportCsv}>Download table (CSV)</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">District</th>
                <th scope="col">Province</th>
                <th scope="col">Psychiatrists</th>
                <th scope="col">Per 100,000</th>
                <th scope="col">Outpatient visits</th>
                <th scope="col">Visits per psychiatrist</th>
                <th scope="col">Need index</th>
                <th scope="col">Flag</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((x) => (
                <tr key={x.d.id}>
                  <th scope="row">{x.d.name}</th>
                  <td>{x.d.province}</td>
                  <td>{fmt(x.r?.psychiatrists)}</td>
                  <td>{fmt(x.r?.psych_per_100k, 2)}</td>
                  <td>{fmt(x.r?.outpatient_visits)}</td>
                  <td>{fmt(x.r?.visits_per_psychiatrist, 0)}</td>
                  <td>{fmt(x.r?.need_index, 1)}</td>
                  <td>{x.flag.text && <span className={`flag ${x.flag.cls}`}>{x.flag.text}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Load per psychiatrist</h2>
          <p className="muted">Red bars mark high need with above-median load.</p>
          <BarChart
            className="chart-tall"
            horizontal
            labels={withVpp.map((x) => x.d.name)}
            datasets={[{
              label: 'Outpatient visits per psychiatrist',
              data: withVpp.map((x) => x.r.visits_per_psychiatrist),
              backgroundColor: withVpp.map((x) => (x.flag.cls === 'flag-high' ? '#d9573b' : '#3ddc97')),
            }]}
            valueTitle="Visits per psychiatrist"
            ariaLabel="Horizontal bar chart of outpatient visits per psychiatrist by district"
          />
        </div>

        <div className="card">
          <h2>Staffing simulator</h2>
          <p className="muted">
            Move psychiatrist posts from one district to another for {year}. Visit volumes are held constant, so this
            shows staffing ratios only, not clinical outcomes.
          </p>
          <Simulator
            ds={ds}
            year={year}
            from={from}
            setFrom={setFrom}
            to={to}
            setTo={setTo}
            fte={fte}
            setFte={setFte}
          />
        </div>
      </div>
    </>
  );
}
