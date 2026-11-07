/**
 * NeuroX API (Node.js + Express).
 *
 * Reads aggregated district data from MariaDB/MySQL. If the database is unavailable, it falls back
 * to public/data/dataset.json, the same file the pipeline writes. Serves the built React app in production.
 *
 *   GET /api/health
 *   GET /api/all                       full dataset used by the dashboard
 *   GET /api/meta
 *   GET /api/districts
 *   GET /api/district-year?district_id=N
 *   GET /api/age-sex?district_id=N
 *   GET /api/alerts
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
  host: process.env.NEUROX_DB_HOST || '127.0.0.1',
  port: Number(process.env.NEUROX_DB_PORT) || 3306,
  user: process.env.NEUROX_DB_USER || 'neurox',
  password: process.env.NEUROX_DB_PASS || '',
  database: process.env.NEUROX_DB_NAME || 'neurox',
  charset: 'utf8mb4',
  decimalNumbers: true, // DECIMAL columns come back as numbers, not strings
  dateStrings: true,    // DATE columns come back as 'YYYY-MM-DD'
  connectionLimit: 5,
});

/** Makes database and file output identical: booleans instead of 0/1 flags. */
function normalise(p) {
  return {
    meta: p.meta || {},
    districts: p.districts || [],
    district_year: p.district_year || [],
    age_sex: (p.age_sex || []).map((r) => ({ ...r, suppressed: Boolean(r.suppressed) })),
    alerts: (p.alerts || []).map((a) => ({ ...a, staffing_changed: Boolean(a.staffing_changed) })),
    sources: (p.sources || []).map((s) => ({ ...s, is_synthetic: Boolean(s.is_synthetic) })),
  };
}

async function fromDatabase() {
  const [settingRows] = await pool.query("SELECT setting_value FROM settings WHERE setting_key = 'meta'");
  const [districts] = await pool.query('SELECT id, name, province, lat, lon FROM districts ORDER BY id');
  const [districtYear] = await pool.query(
    `SELECT district_id, year, outpatient_visits, admissions, referrals, population,
            unemployment_pct, psychiatrists, completeness_pct, out_rate, adm_rate, ref_rate,
            psych_per_100k, visits_per_psychiatrist, need_index
       FROM district_year ORDER BY district_id, year`
  );
  const [ageSex] = await pool.query(
    `SELECT district_id, year, age_group, sex, visits, population, suppressed, rate_per_100k
       FROM age_sex_year ORDER BY district_id, year, age_group, sex`
  );
  const [alerts] = await pool.query(
    `SELECT district_id, first_year, last_year, latest_index, staffing_changed, message
       FROM alerts ORDER BY latest_index DESC`
  );
  const [sources] = await pool.query(
    'SELECT source_name, edition, file_name, downloaded_on, is_synthetic FROM source_files ORDER BY id'
  );
  return normalise({
    meta: settingRows.length ? JSON.parse(settingRows[0].setting_value) : {},
    districts,
    district_year: districtYear,
    age_sex: ageSex,
    alerts,
    sources,
  });
}

async function fromFile() {
  return normalise(JSON.parse(await readFile(DATASET_PATH, 'utf8')));
}

let cache = null;

/** Returns the dataset with its source. Tries the database first, then the file. */
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

app.get('/api/district-year', wrap(async (req, res) => {
  res.json({ district_year: forDistrict((await getDataset()).district_year, req.query) });
}));

app.get('/api/age-sex', wrap(async (req, res) => {
  res.json({ age_sex: forDistrict((await getDataset()).age_sex, req.query) });
}));

app.get('/api/alerts', wrap(async (_req, res) => {
  res.json({ alerts: (await getDataset()).alerts });
}));

if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`NeuroX API running on http://localhost:${PORT}`);
  console.log(`Dataset fallback: ${DATASET_PATH}`);
});
