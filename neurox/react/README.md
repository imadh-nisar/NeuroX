# NeuroX · React and Node version

The same dashboard as `public/` (plain HTML and JavaScript), rebuilt with:

- **Frontend:** React 18, Vite, Leaflet via react-leaflet, Chart.js via react-chartjs-2
- **Backend:** Node.js with Express and mysql2, reading MariaDB and falling back to `public/data/dataset.json`

The Python pipeline is unchanged. It still builds the data and loads the database. This folder only
replaces the web layer. The stylesheet is shared with the plain version, so the two look identical.

## Requirements

- Node.js 18.18 or newer
- Data from the pipeline (`python ../pipeline/run_all.py`), either in the database or as `../public/data/dataset.json`

## Run it (development)

Open two terminals.

```bash
# Terminal 1: API on port 3001
cd neurox/react-app/server
npm install
npm run dev          # or: npm start
```

```bash
# Terminal 2: React app on port 5173 (proxies /api to the API)
cd neurox/react-app/client
npm install
npm run dev
```

Open http://localhost:5173.

The API tries MariaDB first, using the same environment variables as the Python pipeline
(`NEUROX_DB_HOST`, `NEUROX_DB_PORT`, `NEUROX_DB_NAME`, `NEUROX_DB_USER`, `NEUROX_DB_PASS`). If the
database is unreachable, it logs a warning and serves `dataset.json`. The footer says which source is in use.

## Run it (production, one server)

```bash
cd neurox/react-app/client && npm run build      # creates client/dist
cd ../server && npm start                         # serves the API and the built app on port 3001
```

Open http://localhost:3001.

## Project structure

```
react-app/
├── server/
│   ├── index.js          Express routes, database access, file fallback, 60-second cache
│   └── package.json
└── client/
    ├── index.html
    ├── vite.config.js    dev proxy /api -> localhost:3001
    ├── package.json
    └── src/
        ├── main.jsx      entry; loads Leaflet CSS and the shared stylesheet
        ├── App.jsx       fetches data once; loading and error states
        ├── lib/data.js   pure helpers: index lookups, colours, coverage flags, medians, CSV
        └── components/
            ├── Dashboard.jsx     header, tabs, notice, footer, shared state
            ├── MapView.jsx       Leaflet map, year slider with play, district picker, legend
            ├── DistrictPanel.jsx side panel: index, rank, metrics, history chart, export
            ├── TrendsView.jsx    up to three districts; age and sex charts
            ├── CoverageView.jsx  sortable table, load chart, CSV export, staffing simulator
            ├── AlertsView.jsx    rising-need alert cards
            ├── MethodView.jsx    weights, thresholds, limits, sources, helplines
            └── Charts.jsx        Chart.js registration and LineChart / BarChart wrappers
```

## API

| Route | Returns |
|---|---|
| `GET /api/health` | `{ ok: true }` |
| `GET /api/all` | everything the dashboard needs, plus `source` (`database` or `file`) |
| `GET /api/meta` | settings: weights, thresholds, demo flag |
| `GET /api/districts` | districts with coordinates |
| `GET /api/district-year?district_id=N` | yearly indicators (filter optional) |
| `GET /api/age-sex?district_id=N` | age and sex cells; suppressed cells have `visits: null` |
| `GET /api/alerts` | rising-need alerts |

## Notes on behaviour

- **Suppression is enforced in the data**, not only in the UI. The API never returns the visit count of a suppressed cell.
- **Gaps stay gaps.** A missing year shows "no data", never an estimate.
- **Same rules as the plain version:** index thresholds, the completeness caveat, and the staffing simulator all use
  the values in `config.py`, passed through the metadata.
- **Caching:** the API caches the dataset for 60 seconds. After a pipeline re-run, wait up to a minute or restart the server.

## Checks performed

- `vite build` completes, so every import and JSX file compiles.
- The API returns all routes from the file fallback, and filtered routes work.
- The database path is written but **not tested here**, because no MariaDB server was available. Run the pipeline
  with `--load-db` and then `curl localhost:3001/api/all`, and check that `"source": "database"` appears.

## Before public use

The same checks apply as for the plain version (see the main README): replace the synthetic data, confirm
the helpline numbers, and get a clinical review of the index.
