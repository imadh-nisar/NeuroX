import { useState } from 'react';
import { ScatterChart } from './Charts.jsx';
import { downloadCsv, fmt, hasVal, toCsv } from '../lib/data.js';

function perPsychiatrist(visits, psychiatrists) {
  return psychiatrists > 0 ? visits / psychiatrists : null;
}

function Simulator({ ds, from, setFrom, to, setTo, posts, setPosts }) {
  const a = ds.rowFor(from) || {};
  const b = ds.rowFor(to) || {};
  const select = (value, onChange, label) => (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {ds.sorted.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
    </label>
  );

  const controls = (
    <div className="controls stack">
      {select(from, setFrom, 'From')}
      {select(to, setTo, 'To')}
    </div>
  );

  if (from === to) {
    return <>{controls}<p className="note">Choose two different districts.</p></>;
  }
  const ready = hasVal(a.psychiatrists) && hasVal(b.psychiatrists) && hasVal(a.psych_clinic_visits) && hasVal(b.psych_clinic_visits);
  if (!ready) {
    return <>{controls}<p className="note">Not enough data to run this comparison.</p></>;
  }

  const maxK = Math.max(0, a.psychiatrists - 1);
  const k = Math.min(posts, maxK);
  const aAfter = a.psychiatrists - k;
  const bAfter = b.psychiatrists + k;
  const name = (id) => ds.byId.get(id)?.name ?? '';

  return (
    <>
      {controls}
      <label className="slider-label">
        <span>Posts moved: <output>{k}</output></span>
        <input
          type="range"
          min={0}
          max={maxK}
          step={1}
          value={k}
          disabled={maxK === 0}
          onChange={(e) => setPosts(Number(e.target.value))}
        />
      </label>
      <table className="data sim-table">
        <thead>
          <tr>
            <th scope="col">District</th>
            <th scope="col">Psychiatrists</th>
            <th scope="col">Visits per psychiatrist, now</th>
            <th scope="col">After the move</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{name(from)} (from)</th>
            <td>{a.psychiatrists} → {aAfter}</td>
            <td>{fmt(perPsychiatrist(a.psych_clinic_visits, a.psychiatrists), 0)}</td>
            <td>{fmt(perPsychiatrist(a.psych_clinic_visits, aAfter), 0)}</td>
          </tr>
          <tr>
            <th scope="row">{name(to)} (to)</th>
            <td>{b.psychiatrists} → {bAfter}</td>
            <td>{fmt(perPsychiatrist(b.psych_clinic_visits, b.psychiatrists), 0)}</td>
            <td>{fmt(perPsychiatrist(b.psych_clinic_visits, bAfter), 0)}</td>
          </tr>
        </tbody>
      </table>
      <p className="fine">
        Visit volumes are held at their 2024 levels. This shows how staffing ratios change, not clinical impact.
      </p>
    </>
  );
}

export default function CoverageView({ ds }) {
  const [sort, setSort] = useState('psych');
  const [from, setFrom] = useState(ds.idByName('Colombo') ?? ds.districts[0].id);
  const [to, setTo] = useState(ds.idByName('Kegalle') ?? ds.districts[1].id);
  const [posts, setPosts] = useState(1);

  const rows = ds.districts.map((d) => ({ d, r: ds.rowFor(d.id) || {} }));
  const sorted = [...rows].sort((a, b) => {
    if (sort === 'name') return a.d.name.localeCompare(b.d.name);
    if (sort === 'use') return (b.r.service_use_score ?? -1) - (a.r.service_use_score ?? -1);
    return (a.r.psychiatrists_per_100k ?? 1e9) - (b.r.psychiatrists_per_100k ?? 1e9);
  });

  const points = rows
    .filter((x) => hasVal(x.r.service_use_score) && hasVal(x.r.psychiatrists_per_100k))
    .map((x) => ({ x: x.r.service_use_score, y: x.r.psychiatrists_per_100k, name: x.d.name }));

  const exportCsv = () => {
    downloadCsv(
      `neurox_capacity_${ds.meta.source_year}.csv`,
      toCsv(
        ['District', 'Province', 'Population', 'Psychiatrists', 'Psychiatrists per 100,000', 'Psychiatric beds',
          'Beds per 100,000', 'Clinic visits', 'Visits per psychiatrist', 'Mental-disorder admissions per 100,000',
          'Service-use score', 'Facilities listed'],
        sorted.map(({ d, r }) => [
          d.name, d.province, r.population, r.psychiatrists, r.psychiatrists_per_100k, r.psych_beds,
          r.beds_per_100k, r.psych_clinic_visits, r.visits_per_psychiatrist, r.mh_hosp_per_100k,
          r.service_use_score, r.facilities_listed,
        ])
      )
    );
  };

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Capacity against service use</h2>
            <p className="muted">
              Psychiatrists, beds and clinic visits per district for {ds.meta.source_year}. Beds for three districts are not split in the source.
            </p>
          </div>
          <div className="controls">
            <label>
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="psych">Fewest psychiatrists per 100,000</option>
                <option value="use">Highest service use</option>
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
                <th scope="col">Psychiatrists</th>
                <th scope="col">Per 100,000</th>
                <th scope="col">Beds</th>
                <th scope="col">Clinic visits</th>
                <th scope="col">Visits per psychiatrist</th>
                <th scope="col">Service-use score</th>
                <th scope="col">Facilities listed</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ d, r }) => (
                <tr key={d.id}>
                  <th scope="row">{d.name}</th>
                  <td>{fmt(r.psychiatrists)}</td>
                  <td>{fmt(r.psychiatrists_per_100k, 2)}</td>
                  <td>{hasVal(r.psych_beds) ? fmt(r.psych_beds) : 'Not split'}</td>
                  <td>{fmt(r.psych_clinic_visits)}</td>
                  <td>{hasVal(r.visits_per_psychiatrist) ? fmt(r.visits_per_psychiatrist, 0) : 'None recorded'}</td>
                  <td>{fmt(r.service_use_score, 1)}</td>
                  <td>{fmt(r.facilities_listed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Service use against psychiatrists</h2>
          <p className="muted">Each point is a district. Districts in the lower right use a lot of care with few psychiatrists.</p>
          <ScatterChart
            className="chart-tall"
            points={points}
            xTitle="Service-use score (0 to 100)"
            yTitle="Psychiatrists per 100,000 people"
            ariaLabel="Scatter chart of service-use score against psychiatrists per 100,000"
          />
        </div>

        <div className="card">
          <h2>Staffing simulator</h2>
          <p className="muted">
            Move psychiatrist posts between two districts. Visit volumes stay at 2024 levels, so this shows ratios only.
          </p>
          <Simulator
            ds={ds}
            from={from}
            setFrom={setFrom}
            to={to}
            setTo={setTo}
            posts={posts}
            setPosts={setPosts}
          />
        </div>
      </div>
    </>
  );
}
