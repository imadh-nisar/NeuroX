# NeuroX React and Node version

- Frontend: React 18, Vite, Leaflet (react-leaflet), Chart.js (react-chartjs-2).
- Backend: Node.js, Express, mysql2. Reads MariaDB; if it is unreachable, falls back to `../public/data/dataset.json`.

## Run

```bash
# Terminal 1: API on port 3001 (set NEUROX_DB_* to use the database)
cd server && npm install && npm start

# Terminal 2: app on port 5173 (proxies /api to port 3001)
cd client && npm install && npm run dev
```

Open http://localhost:5173. The footer says whether the data came from the database or the file.

## Pages

Start (findings and search), Map (district detail), Priorities (suggested focus, with rules), Capacity
(table, scatter of service use against psychiatrists, staffing simulator), Compare (up to three districts),
Method and data (formulas, checks against published totals, limitations, sources).

## API

| Route | Returns |
|---|---|
| `/api/all` | everything the app uses, plus `source` |
| `/api/meta` | settings, national figures, rules, reconciliation |
| `/api/districts` | 25 districts with coordinates |
| `/api/district-2024?district_id=N` | one district's figures (optional filter) |
| `/api/sources` | sources and editions |
| `/api/health` | status |

## Production

```bash
cd client && npm run build      # creates client/dist
cd ../server && npm start       # serves the API and the built app on port 3001
```
