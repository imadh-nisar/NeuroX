import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import { buildIndex } from './lib/data.js';

export default function App() {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/all', { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || body.error) throw new Error(body.error || `HTTP ${res.status}`);
        return body;
      })
      .then((body) => {
        if (!cancelled) setState({ status: 'ready', ds: buildIndex(body), source: body.source });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return <p className="note" style={{ margin: '2rem 1.5rem' }}>Loading data…</p>;
  }
  if (state.status === 'error') {
    return (
      <div className="error" role="alert" style={{ margin: '2rem 1.5rem' }}>
        The dashboard could not load its data. Start the API (cd server, npm start) and check the database or run the pipeline.
        <br />
        <small>Details: {state.message}</small>
      </div>
    );
  }
  return <Dashboard ds={state.ds} source={state.source} />;
}
