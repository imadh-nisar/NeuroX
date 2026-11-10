import { useEffect, useMemo, useRef, useState } from 'react';
import { BIN_COLOURS, colourFor, fmt, hasVal } from '../lib/data.js';
import { buildInsights } from '../lib/insights.js';
import { prefersReducedMotion } from '../lib/scroll.js';

/** Counts up to the value once, when it first appears. */
function CountUp({ value, duration = 1300 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!hasVal(value)) return undefined;
    if (prefersReducedMotion()) {
      setN(value);
      return undefined;
    }
    let start = 0;
    let frame = 0;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return hasVal(value) ? n.toLocaleString('en-GB') : '–';
}

export default function Overview({ ds, onOpenDistrict, onGo }) {
  const [query, setQuery] = useState('');
  const [barsReady, setBarsReady] = useState(false);
  const searchRef = useRef(null);
  const nat = ds.national;

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'SELECT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setBarsReady(true), 150);
    return () => clearTimeout(t);
  }, []);

  const insights = useMemo(() => buildInsights(ds), [ds]);
  const leaderboard = useMemo(
    () =>
      ds.rows
        .filter((r) => hasVal(r.service_use_score))
        .sort((a, b) => b.service_use_score - a.service_use_score)
        .slice(0, 8)
        .map((r) => ({ d: ds.byId.get(r.district_id), r })),
    [ds]
  );

  const results = query.trim()
    ? ds.sorted.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : [];

  return (
    <div className="overview">
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <p className="eyebrow">Mental health services across Sri Lanka · {ds.meta.source_year}</p>
        <h2 className="hero-title">Where psychiatric care is used, and where psychiatrists are thin.</h2>
        <p className="hero-sub">
          Figures for all 25 districts from the Annual Health Bulletin {ds.meta.source_year}. Start with a finding below,
          or search for a district.
        </p>

        <div className="search-wrap">
          <label className="sr-only" htmlFor="districtSearch">Search for a district</label>
          <input
            id="districtSearch"
            ref={searchRef}
            className="search"
            type="search"
            placeholder="Search a district…  (press / )"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {results.length > 0 && (
            <ul className="search-results" role="listbox">
              {results.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => { setQuery(''); onOpenDistrict(d.id); }}>
                    <span>{d.name}</span>
                    <span className="muted">{d.province}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-num"><CountUp value={nat.psych_clinic_visits} /></span>
            <span className="stat-label">Psychiatric clinic visits nationally, {ds.meta.source_year}</span>
          </div>
          <div className="stat-card">
            <span className="stat-num"><CountUp value={nat.psychiatrists} /></span>
            <span className="stat-label">Psychiatrists recorded, {ds.meta.source_year}</span>
          </div>
          <div className="stat-card">
            <span className="stat-num"><CountUp value={nat.psych_beds} /></span>
            <span className="stat-label">Psychiatric beds, {ds.meta.source_year}</span>
          </div>
          <div className="stat-card">
            <span className="stat-num"><CountUp value={nat.mental_hospitalisations} /></span>
            <span className="stat-label">Admissions for mental disorders, {ds.meta.source_year}</span>
          </div>
        </div>
        <p className="fine hero-fine">
          National figures come from the bulletin. District figures are by health division, mapped to districts
          (Kalmunai is counted within Ampara).
        </p>
      </section>

      <section className="insight-section" aria-labelledby="insights-title">
        <h3 id="insights-title" className="section-title">Findings for {ds.meta.source_year}</h3>
        <div className="insight-grid">
          {insights.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className="insight-card"
              style={{ animationDelay: `${i * 90}ms` }}
              onClick={() => item.districtId && onOpenDistrict(item.districtId)}
            >
              <span className="insight-icon" aria-hidden="true">{item.icon}</span>
              <strong>{item.title}</strong>
              <span className="muted">{item.body}</span>
              {item.districtId && <span className="insight-go">Open on the map →</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="leader-section" aria-labelledby="leader-title">
        <div className="card-head">
          <h3 id="leader-title" className="section-title">Highest service use, {ds.meta.source_year}</h3>
          <div className="quick-links">
            <button type="button" className="btn ghost" onClick={() => onGo('priorities')}>See priorities</button>
            <button type="button" className="btn ghost" onClick={() => onGo('coverage')}>See capacity</button>
          </div>
        </div>
        <ol className="leaderboard">
          {leaderboard.map(({ d, r }, i) => (
            <li key={d.id}>
              <button type="button" className="leader-row" onClick={() => onOpenDistrict(d.id)}>
                <span className="leader-rank">{i + 1}</span>
                <span className="leader-name">{d.name}</span>
                <span className="leader-track">
                  <span
                    className="leader-fill"
                    style={{
                      width: barsReady ? `${r.service_use_score}%` : '0%',
                      background: `linear-gradient(90deg, ${BIN_COLOURS[1]}, ${colourFor(r.service_use_score)})`,
                      transitionDelay: `${i * 70}ms`,
                    }}
                  />
                </span>
                <span className="leader-score">{fmt(r.service_use_score, 1)}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
