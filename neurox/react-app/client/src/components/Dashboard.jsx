import { useEffect, useState } from 'react';
import CompareView from './CompareView.jsx';
import CoverageView from './CoverageView.jsx';
import MapView from './MapView.jsx';
import MethodView from './MethodView.jsx';
import Overview from './Overview.jsx';
import PrioritiesView from './PrioritiesView.jsx';
import { onScrollProgress, revealOnScroll, scrollToMain, scrollToTop } from '../lib/scroll.js';

const TABS = [
  ['overview', 'Start'],
  ['map', 'Map'],
  ['priorities', 'Priorities'],
  ['coverage', 'Capacity'],
  ['compare', 'Compare'],
  ['method', 'Method and data'],
];

export default function Dashboard({ ds, source }) {
  const hash = window.location.hash.slice(1);
  const [tab, setTabState] = useState(TABS.some(([k]) => k === hash) ? hash : 'overview');
  const [selected, setSelected] = useState(null);
  const [compareIds, setCompareIds] = useState(() =>
    ['Colombo', 'Kandy', 'Jaffna'].map((n) => ds.idByName(n)).filter((x) => x !== null)
  );
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const stop = onScrollProgress(setProgress);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      stop();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

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

  const openDistrict = (id) => {
    setSelected(id);
    setTab('map');
  };

  const compareWith = (id) => {
    setCompareIds((prev) => (prev.includes(id) ? prev : prev.length >= 3 ? [...prev.slice(-2), id] : [...prev, id]));
    setTab('compare');
  };

  const active = (key) => tab === key;

  return (
    <>
      <div className="scroll-progress" aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />
      <a className="skip-link" href="#main">Skip to content</a>

      <header className={`topbar ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="brand">
          <span className="logo" aria-hidden="true">NX</span>
          <div>
            <h1>NeuroX</h1>
            <p className="tagline">Mental health services across Sri Lanka's districts</p>
          </div>
        </div>
        <div className="top-controls">
          <span className="badge">
            Data: Annual Health Bulletin {ds.meta.source_year} · Directory {ds.meta.directory_year}
          </span>
          <button className="btn ghost" type="button" onClick={() => window.print()}>Print or save as PDF</button>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Dashboard views">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            id={`tab-${key}`}
            role="tab"
            className="tab"
            aria-selected={active(key)}
            aria-controls={`view-${key}`}
            tabIndex={active(key) ? 0 : -1}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="notice" role="note">
        <p>
          <strong>Planning tool, not a diagnosis.</strong> It shows district totals and rates, never individual people.
          Use it to decide where to look first, then check the source figures.
        </p>
        <p className="helpline">
          Someone needs to talk now? National Mental Health Helpline <a href="tel:1926">1926</a>. Emergency: <a href="tel:119">119</a>.
        </p>
      </div>

      <main id="main">
        <section id="view-overview" className={`view ${active('overview') ? 'active' : ''}`} role="tabpanel" aria-labelledby="tab-overview">
          {active('overview') && <Overview ds={ds} onOpenDistrict={openDistrict} onGo={setTab} />}
        </section>
        <section id="view-map" className={`view ${active('map') ? 'active' : ''}`} role="tabpanel" aria-labelledby="tab-map">
          {active('map') && (
            <MapView ds={ds} selected={selected} onSelect={setSelected} onCompare={compareWith} />
          )}
        </section>
        <section id="view-priorities" className={`view ${active('priorities') ? 'active' : ''}`} role="tabpanel" aria-labelledby="tab-priorities">
          {active('priorities') && <PrioritiesView ds={ds} />}
        </section>
        <section id="view-coverage" className={`view ${active('coverage') ? 'active' : ''}`} role="tabpanel" aria-labelledby="tab-coverage">
          {active('coverage') && <CoverageView ds={ds} />}
        </section>
        <section id="view-compare" className={`view ${active('compare') ? 'active' : ''}`} role="tabpanel" aria-labelledby="tab-compare">
          {active('compare') && <CompareView ds={ds} ids={compareIds} setIds={setCompareIds} />}
        </section>
        <section id="view-method" className={`view ${active('method') ? 'active' : ''}`} role="tabpanel" aria-labelledby="tab-method">
          {active('method') && <MethodView ds={ds} />}
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
          NeuroX · Phase 1 prototype · {source === 'database' ? 'Live data from the database' : 'Static data file (database offline)'}
        </p>
        <p>Planning and awareness only. Not for diagnosis or treatment.</p>
      </footer>
    </>
  );
}
