import { useEffect, useMemo, useRef, useState } from 'react';
import { buildInsights } from '../lib/insights.js';
import { BIN_COLOURS, colourFor, fmt, hasVal } from '../lib/data.js';
import { prefersReducedMotion } from '../lib/scroll.js';

/** Counts up to a number once, when it first appears. */
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

export default function Overview({ ds, year, onOpenDistrict, onGo }) {
  const [query, setQuery] = useState('');
  const [barsReady, setBarsReady] = useState(false);
  const searchRef = useRef(null);

  // Let people press "/" anywhere to jump to search.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT') {
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

  const national = ds.meta.national_context || [];
  const find = (word) => national.find((n) => n.label.toLowerCase().includes(word));
  const visits = find('visits');
  const beds = find('beds');
  const clinics = find('outpatient clinics');

  const insights = useMemo(() => buildInsights(ds, year), [ds, year]);

  const leaderboard = useMemo(
    () =>
      ds.rows
        .filter((r) => r.year === year && hasVal(r.need_index))
        .sort((a, b) => b.need_index - a.need_index)
        .slice(0, 8)
        .map((r) => ({ ...ds.byId.get(r.district_id), r })),
    [ds, year]
  );

  const results = query.trim()
    ? ds.sorted.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : [];

  return (
    <div className="overview">
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <p className="eyebrow">Mental health need across Sri Lanka</p>
        <h2 className="hero-title">Where need is growing, and where care is stretched thin.</h2>
        <p className="hero-sub">
          Explore every district, its trend and its capacity. Start with a finding below, or search for your district.
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
            <span className="stat-num"><CountUp value={visits?.value} /></span>
            <span className="stat-label">Psychiatric clinic visits nationally ({visits?.year || 'year not stated'})</span>
          </div>
          <div className="stat-card">
            <span className="stat-num"><CountUp value={beds?.value} /></span>
            <span className="stat-label">Dedicated psychiatric beds ({beds?.year || 'year not stated'})</span>
          </div>
          <div className="stat-card">
            <span className="stat-num"><CountUp value={clinics?.value} /></span>
            <span className="stat-label">Psychiatric outpatient clinics in public hospitals</span>
          </div>
          <div className="stat-card">
            <span className="stat-num"><CountUp value={ds.districts.length} /></span>
            <span className="stat-label">Districts followed, {ds.years[0]} to {ds.years[ds.years.length - 1]}</span>
          </div>
        </div>
        <p className="fine hero-fine">
          National figures come from public documents and give context only. District figures are demonstration data until the bulletin tables are loaded.
        </p>
      </section>

      <section className="insight-section" aria-labelledby="insights-title">
        <h3 id="insights-title" className="section-title">Findings for {year}</h3>
        <div className="insight-grid">
          {insights.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className="insight-card reveal-now"
              style={{ animationDelay: `${i * 90}ms` }}
              onClick={() => onOpenDistrict(item.districtId)}
            >
              <span className="insight-icon" aria-hidden="true">{item.icon}</span>
              <strong>{item.title}</strong>
              <span className="muted">{item.body}</span>
              <span className="insight-go">Open on the map →</span>
            </button>
          ))}
        </div>
      </section>

      <section className="leader-section" aria-labelledby="leader-title">
        <div className="card-head">
          <h3 id="leader-title" className="section-title">Highest need, {year}</h3>
          <div className="quick-links">
            <button type="button" className="btn ghost" onClick={() => onGo('priorities')}>See priorities</button>
            <button type="button" className="btn ghost" onClick={() => onGo('trends')}>Compare trends</button>
          </div>
        </div>
        <ol className="leaderboard">
          {leaderboard.map((x, i) => (
            <li key={x.id}>
              <button type="button" className="leader-row" onClick={() => onOpenDistrict(x.id)}>
                <span className="leader-rank">{i + 1}</span>
                <span className="leader-name">{x.name}</span>
                <span className="leader-track">
                  <span
                    className="leader-fill"
                    style={{
                      width: barsReady ? `${x.r.need_index}%` : '0%',
                      background: `linear-gradient(90deg, ${BIN_COLOURS[1]}, ${colourFor(x.r.need_index)})`,
                      transitionDelay: `${i * 70}ms`,
                    }}
                  />
                </span>
                <span className="leader-score">{fmt(x.r.need_index, 1)}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
