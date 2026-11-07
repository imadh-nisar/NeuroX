import { useEffect, useState } from 'react';
import AlertsView from './AlertsView.jsx';
import CoverageView from './CoverageView.jsx';
import MapView from './MapView.jsx';
import Overview from './Overview.jsx';
import MethodView from './MethodView.jsx';
import PrioritiesView from './PrioritiesView.jsx';
import TrendsView from './TrendsView.jsx';
import { PREFERRED_TREND_NAMES } from '../lib/data.js';
import { onScrollProgress, revealOnScroll, scrollToMain, scrollToTop } from '../lib/scroll.js';

const TABS = [
  ['overview', 'Start'],
  ['map', 'Map'],
  ['trends', 'Trends'],
  ['priorities', 'Priorities'],
  ['coverage', 'Capacity'],
  ['alerts', 'Alerts'],
  ['method', 'Method and data'],
];

export default function Dashboard({ ds, source }) {
  const initialTab = TABS.some(([k]) => k === window.location.hash.slice(1))
    ? window.location.hash.slice(1)
      : 'overview';

  const latestYear = ds.years[ds.years.length - 1];
  const [tab, setTabState] = useState(initialTab);
  const [year, setYear] = useState(latestYear);
  const [selected, setSelected] = useState(null);
  const [trendIds, setTrendIds] = useState(() =>
    PREFERRED_TREND_NAMES.map(ds.idByName).filter((x) => x !== null)
  );
  const [ageDistrict, setAgeDistrict] = useState(ds.districts[0].id);
  const [ageYear, setAgeYear] = useState(latestYear);

  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  // Reading progress bar, header shadow and back-to-top button.
  useEffect(() => {
    const stopProgress = onScrollProgress(setProgress);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      stopProgress();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Fade in cards in the active view. Runs again each time the tab changes.
  useEffect(() => revealOnScroll(), [tab]);

  const setTab = (t) => {
    setTabState(t);
    scrollToMain();
    try {
      window.history.replaceState(null, '', `#${t}`);
    } catch (e) {
      /* some file:// contexts block this; not critical */
    }
  };

  const compareInTrends = (id) => {
    setTrendIds((prev) => {
      if (prev.includes(id)) return prev;
      return prev.length >= 3 ? [...prev.slice(-2), id] : [...prev, id];
    });
    setTab('trends');
  };

  const isSynthetic = Boolean(ds.meta.is_synthetic);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>

      <div className="scroll-progress" aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />

      <header className={`topbar ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="brand">
          <span className="logo" aria-hidden="true">NX</span>
          <div>
            <h1>NeuroX</h1>
            <p className="tagline">Mapping mental health need across Sri Lanka</p>
          </div>
        </div>
        <div className="top-controls">
          {isSynthetic && <span className="badge badge-warn">Demo data · synthetic</span>}
          <label className="year-select">
            <span>Year</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {ds.years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <button className="btn ghost" type="button" onClick={() => window.print()}>
            Print or save as PDF
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Dashboard views">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            id={`tab-${key}`}
            role="tab"
            className="tab"
            aria-selected={tab === key}
            aria-controls={`view-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="notice" role="note">
        <p>
          <strong>Planning tool, not a diagnosis.</strong> It shows district totals and rates, never individual people. Use it to
          decide where to look first, then check the source figures.
        </p>
        <p className="helpline">
          Someone needs to talk now? National Mental Health Helpline <a href="tel:1926">1926</a>. Emergency: <a href="tel:119">119</a>.
        </p>
      </div>

      <main id="main">
        <section id="view-overview" className={`view ${tab === 'overview' ? 'active' : ''}`} role="tabpanel" aria-labelledby="tab-overview">
          {tab === 'overview' && (
            <Overview
              ds={ds}
              year={year}
              onOpenDistrict={(id) => { setSelected(id); setTab('map'); }}
              onGo={setTab}
            />
          )}
        </section>

        <section id="view-map" className={`view ${tab === 'map' ? 'active' : ''}`} role="tabpanel" aria-labelledby="tab-map">
          {tab === 'map' && (
            <MapView
              ds={ds}
              year={year}
              setYear={setYear}
              selected={selected}
              onSelect={setSelected}
              onCompare={compareInTrends}
            />
          )}
        </section>

        <section id="view-trends" className={`view ${tab === 'trends' ? 'active' : ''}`} role="tabpanel" aria-labelledby="tab-trends">
          {tab === 'trends' && (
            <TrendsView
              ds={ds}
              trendIds={trendIds}
              setTrendIds={setTrendIds}
              ageDistrict={ageDistrict}
              setAgeDistrict={setAgeDistrict}
              ageYear={ageYear}
              setAgeYear={setAgeYear}
            />
          )}
        </section>

        <section id="view-priorities" className={`view ${tab === 'priorities' ? 'active' : ''}`} role="tabpanel" aria-labelledby="tab-priorities">
          {tab === 'priorities' && <PrioritiesView ds={ds} year={year} />}
        </section>

        <section id="view-coverage" className={`view ${tab === 'coverage' ? 'active' : ''}`} role="tabpanel" aria-labelledby="tab-coverage">
          {tab === 'coverage' && <CoverageView ds={ds} year={year} />}
        </section>

        <section id="view-alerts" className={`view ${tab === 'alerts' ? 'active' : ''}`} role="tabpanel" aria-labelledby="tab-alerts">
          {tab === 'alerts' && <AlertsView ds={ds} />}
        </section>

        <section id="view-method" className={`view ${tab === 'method' ? 'active' : ''}`} role="tabpanel" aria-labelledby="tab-method">
          {tab === 'method' && <MethodView ds={ds} />}
        </section>
      </main>

      <button
        type="button"
        className={`to-top ${progress > 0.05 ? 'show' : ''}`}
        onClick={scrollToTop}
        aria-label="Back to top"
        tabIndex={progress > 0.05 ? 0 : -1}
      >
        ↑
      </button>

      <footer className="footer">
        <p>
          NeuroX · ModelX 2.0 Phase 1 prototype · {source === 'database' ? 'Live data from the database' : 'Static data file (database offline)'}
        </p>
        <p>Planning and awareness only. Not for diagnosis or treatment.</p>
      </footer>
    </>
  );
}
