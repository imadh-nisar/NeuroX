# NeuroX: Mental Health Services Across Sri Lanka's Districts

Phase 1 prototype (ModelX 2.0, Domain 03, non-clinical). A planning tool for psychiatrists, hospital teams
and planners. It shows where psychiatric services are used heavily and where psychiatrists per person are low.

**Not for diagnosis, treatment advice, or any individual.**

## Data (real sources only)

| Source | Used for | Edition |
|---|---|---|
| Annual Health Bulletin, Ministry of Health and Mass Media | Population (Table 2.1), psychiatric clinic visits (9.4), psychiatrists (6.3), psychiatric beds (5.3), admissions for mental disorders (8.9), national totals | 2024 |
| Directory of Mental Health Service Providers in Sri Lanka, Directorate of Mental Health | Government facilities listed with mental health services (Section 1) | 2023 |

The tables were transcribed into `data/raw/*.csv`. `pipeline/build_dataset.py` checks every total against the
published figure. Four totals match exactly. Psychiatric beds match except for 37 beds in Kilinochchi, Mannar and
Mullaitivu, which the bulletin does not split by division.

**What is not here:** trends over years, age and sex breakdowns, and rising-need alerts. The bulletin gives
district figures for one year only, so these are not shown rather than estimated.

## Run it

```bash
cd pipeline
pip install -r requirements.txt
python run_all.py                 # builds public/data/dataset.json
python run_all.py --load-db       # also loads MariaDB (set NEUROX_DB_* first; see db/schema.sql)
```

Then start the React app (see `react-app/README.md`).

## Method in brief

- **Service-use score (0 to 100):** the average of two indicators per 100,000 people, clinic visits and admissions
  for mental disorders, each scaled across the 25 districts. It measures care used, not illness present.
- **Suggested focus:** a rule applied to the score (median) and psychiatrists per 100,000 (national rate).
  Rules are on the Method tab. They are proposals for a planner to check, not decisions.
- **Kalmunai** is a health division inside Ampara district, so it is counted within Ampara.

## Limits to read before use

Listed on the Method tab. The main ones: Colombo's and Kandy's figures include national institutions; psychiatrist
counts are by health division and may miss teaching-hospital staff; visits per person are affected by patients
travelling between districts; one year of data only.

## Before submission

- [ ] Spot-check 3 transcribed rows against the PDF pages (e.g. Table 9.4 Colombo, Table 6.3 Kandy, Table 5.3 Anuradhapura).
- [ ] Resolve the bulletin's two figures for 2024 psychiatric clinic visits (1,250,232 in Table 9.4 and 1,241,626 in Table 9.3).
- [ ] Confirm the Kandy psychiatrist count (1).
- [ ] Confirm you may use the bulletin and directory in a public demonstration; record the URL and access date in `source_manifest.csv`.
- [ ] Verify helpline numbers (1926 and 119).
- [ ] Psychiatrist or lecturer review of the score and the suggested focus.

## Folder guide

- `pipeline/` builds the dataset. `db/schema.sql` defines the database.
- `public/api/` is the PHP API (read-only). `public/css/` is the shared stylesheet.
- `public/data/dataset.json` is the output the React app falls back to.
- `react-app/` is the React and Node version (the one to submit).
- `archive/plain-html-synthetic-v1/` is the earlier plain HTML version. It was built on synthetic data and is **not** updated.
