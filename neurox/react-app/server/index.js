/**
 * NeuroX API (Node.js + Express). Read-only, aggregated district figures.
 *
 * Reads MariaDB. If the database is unavailable, it falls back to public/data/dataset.json,
 * the file the pipeline writes. Serves the built React app when client/dist exists.
 *
 *   GET /api/health
 *   GET /api/all                       full dataset used by the dashboard
 *   GET /api/meta
 *   GET /api/districts
 *   GET /api/district-2024?district_id=N
 *   GET /api/sources
 */
import express from 'express';
import mysql from 'mysql2/promise';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const DATASET_PATH = process.env.DATASET_PATH || path.resolve(here, '../../public/data/dataset.json');
const CLIENT_DIST = path.resolve(here, '../client/dist');
const CACHE_MS = 60_000;

const pool = mysql.createPool({
  host: process.env.NEUROX_DB_HOST || 'localhost',
  port: Number(process.env.NEUROX_DB_PORT) || 3306,
  user: process.env.NEUROX_DB_USER || 'neurox',
  password: process.env.NEUROX_DB_PASS || '',
  database: process.env.NEUROX_DB_NAME || 'neurox',
  charset: 'utf8mb4',
  decimalNumbers: true,
  dateStrings: true,
  connectionLimit: 5,
});

/** Makes database and file output identical: booleans instead of 0/1 flags. */
function normalise(p) {
  return {
    meta: p.meta || {},
    districts: p.districts || [],
    district_2024: p.district_2024 || [],
    sources: (p.sources || []).map((s) => ({ ...s, is_synthetic: Boolean(s.is_synthetic) })),
  };
}

async function fromDatabase() {
  const [settingRows] = await pool.query("SELECT setting_value FROM settings WHERE setting_key = 'meta'");
  const [districts] = await pool.query('SELECT id, name, province, lat, lon FROM districts ORDER BY id');
  const [district2024] = await pool.query(
    `SELECT district_id, population, psych_clinic_visits, psychiatrists, psych_beds,
            mental_hospitalisations, psych_visits_per_100k, psychiatrists_per_100k, beds_per_100k,
            mh_hosp_per_100k, visits_per_psychiatrist, facilities_listed, service_use_score,
            decision_key, decision_label, decision_reason
       FROM district_2024 ORDER BY district_id`
  );
  const [sources] = await pool.query(
    'SELECT source_name, edition, file_name, downloaded_on, is_synthetic FROM source_files ORDER BY id'
  );
  return normalise({
    meta: settingRows.length ? JSON.parse(settingRows[0].setting_value) : {},
    districts,
    district_2024: district2024,
    sources,
  });
}

async function fromFile() {
  return normalise(JSON.parse(await readFile(DATASET_PATH, 'utf8')));
}

let cache = null;

/** Returns the dataset and where it came from. Tries the database first, then the file. */
async function getDataset() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  let value;
  try {
    value = { ...(await fromDatabase()), source: 'database' };
  } catch (dbErr) {
    console.warn('Database unavailable, using dataset.json:', dbErr.message);
    try {
      value = { ...(await fromFile()), source: 'file' };
    } catch (fileErr) {
      throw new Error('No data available. Run the pipeline (python run_all.py) first.');
    }
  }
  cache = { at: Date.now(), value };
  return value;
}

function forDistrict(rows, query) {
  const id = Number(query.district_id);
  return Number.isInteger(id) ? rows.filter((r) => r.district_id === id) : rows;
}

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const app = express();
app.disable('x-powered-by');

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/all', wrap(async (_req, res) => {
  res.json(await getDataset());
}));

app.get('/api/meta', wrap(async (_req, res) => {
  const { meta, source } = await getDataset();
  res.json({ meta, source });
}));

app.get('/api/districts', wrap(async (_req, res) => {
  res.json({ districts: (await getDataset()).districts });
}));

app.get('/api/district-2024', wrap(async (req, res) => {
  res.json({ district_2024: forDistrict((await getDataset()).district_2024, req.query) });
}));

app.get('/api/sources', wrap(async (_req, res) => {
  res.json({ sources: (await getDataset()).sources });
}));

if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`NeuroX API running on http://localhost:${PORT}`);
  console.log(`Dataset fallback: ${DATASET_PATH}`);
});
