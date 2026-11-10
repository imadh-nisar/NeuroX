"""Clean, reconcile, index and suppress district data.

Inputs:  data/raw/*.csv
Outputs: data/processed/*.csv
         public/data/dataset.json  (used by the dashboard when the API is offline)
"""
import json
import re
from datetime import datetime, timezone

import numpy as np
import pandas as pd

import config as C

DY_COLS = [
    "district_id", "year", "outpatient_visits", "admissions", "referrals", "population",
    "unemployment_pct", "psychiatrists", "completeness_pct", "out_rate", "adm_rate", "ref_rate",
    "psych_per_100k", "visits_per_psychiatrist", "need_index",
]
AS_COLS = ["district_id", "year", "age_group", "sex", "visits", "population", "suppressed", "rate_per_100k"]
ALERT_COLS = ["district_id", "first_year", "last_year", "latest_index", "staffing_changed", "message"]
NUMERIC_RAW = [
    "year", "outpatient_visits", "admissions", "referrals", "population",
    "unemployment_pct", "psychiatrists", "completeness_pct",
]


def norm_key(name):
    """Lower-case letters only, ignoring the word 'district', so spelling variants match."""
    return re.sub(r"[^a-z]", "", str(name).lower().replace("district", ""))


def build_name_map():
    mapping = {norm_key(d["name"]): d["name"] for d in C.DISTRICTS}
    for alias, canonical in C.DISTRICT_ALIASES.items():
        mapping[norm_key(alias)] = canonical
    return mapping


def harmonise(df, column, mapping):
    keys = df[column].map(norm_key)
    unknown = sorted(set(df.loc[~keys.isin(list(mapping)), column].astype(str)))
    if unknown:
        raise SystemExit(f"Unrecognised district names {unknown}. Add them to DISTRICT_ALIASES in config.py.")
    df[column] = keys.map(mapping)
    return df


def minmax(series):
    lo, hi = series.min(), series.max()
    if hi == lo:
        return series * 0.0
    return (series - lo) / (hi - lo)


def load_raw():
    dy = pd.read_csv(C.RAW_DIR / "district_year_raw.csv")
    asx = pd.read_csv(C.RAW_DIR / "age_sex_raw.csv")
    manifest = pd.read_csv(C.RAW_DIR / "source_manifest.csv")

    mapping = build_name_map()
    dy = harmonise(dy, "district_name", mapping)
    asx = harmonise(asx, "district_name", mapping)

    for col in NUMERIC_RAW:
        dy[col] = pd.to_numeric(dy[col], errors="coerce")
    for col in ["year", "visits", "population"]:
        asx[col] = pd.to_numeric(asx[col], errors="coerce")

    dy = dy.dropna(subset=["year"])
    dy["year"] = dy["year"].astype(int)
    asx = asx.dropna(subset=["year", "visits", "population"])  # missing cells are not shown
    asx["year"] = asx["year"].astype(int)

    if dy.duplicated(["district_name", "year"]).any():
        raise SystemExit("Duplicate district-year rows in the raw data. Remove them and re-run.")
    return dy, asx, manifest


def reconcile(dy, asx):
    """District totals must match the sum of their age and sex cells, within tolerance."""
    by_age = (
        asx.groupby(["district_name", "year"], as_index=False)["visits"].sum()
        .rename(columns={"visits": "visits_by_age_sex"})
    )
    rec = dy[["district_name", "year", "outpatient_visits"]].merge(
        by_age, on=["district_name", "year"], how="inner"
    )
    rec["difference"] = rec["visits_by_age_sex"] - rec["outpatient_visits"]
    tolerance = np.maximum(1.0, 0.005 * rec["outpatient_visits"])
    rec["within_tolerance"] = rec["difference"].abs() <= tolerance
    return rec


def build_alerts(d):
    alerts = []
    usable = d.dropna(subset=["need_index"]).sort_values(["district_id", "year"])
    for district_id, group in usable.groupby("district_id"):
        if len(group) < C.RISING_PERIODS:
            continue
        window = group.tail(C.RISING_PERIODS)
        years = [int(y) for y in window["year"].tolist()]
        idx = [float(v) for v in window["need_index"].tolist()]
        staff = [int(s) for s in window["psychiatrists"].tolist() if pd.notna(s)]

        consecutive = all(b - a == 1 for a, b in zip(years, years[1:]))
        rising = all(b > a for a, b in zip(idx, idx[1:]))
        above = all(v >= C.RISING_THRESHOLD for v in idx)
        if not (consecutive and rising and above):
            continue

        name = window["district_name"].iloc[0]
        changed = len(set(staff)) > 1 if staff else False
        if changed:
            staffing = f"psychiatric staffing moved from {staff[0]} to {staff[-1]}"
        else:
            staffing = f"psychiatric staffing stayed at {staff[-1]}" if staff else "staffing data is missing"
        message = (
            f"Need index in {name} has risen for {len(years)} periods in a row "
            f"({years[0]}–{years[-1]}), reaching {idx[-1]:.0f}, while {staffing}."
        )
        alerts.append({
            "district_id": int(district_id),
            "first_year": years[0],
            "last_year": years[-1],
            "latest_index": round(idx[-1], 1),
            "staffing_changed": int(changed),
            "message": message,
        })
    alerts.sort(key=lambda a: a["latest_index"], reverse=True)
    return alerts


def records(df):
    """DataFrame to list of dicts. NaN and NA become null, numpy types become plain types."""
    return json.loads(df.to_json(orient="records", force_ascii=False))


def main():
    C.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    C.PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)

    dy, asx, manifest = load_raw()
    ids = {d["name"]: i + 1 for i, d in enumerate(C.DISTRICTS)}

    # 1. Reconciliation
    rec = reconcile(dy, asx)
    rec.to_csv(C.PROCESSED_FILES["reconciliation"], index=False)
    ok = int(rec["within_tolerance"].sum()) if len(rec) else 0
    print(f"Reconciliation: {ok} of {len(rec)} district-years within tolerance")
    if len(rec) and ok < len(rec):
        print("  Check data/processed/reconciliation.csv before using these figures.")

    # 2. Age and sex cells with suppression
    asx = asx.copy()
    asx["district_id"] = asx["district_name"].map(ids).astype(int)
    asx["suppressed"] = (asx["visits"] < C.MIN_CELL_COUNT).astype(int)
    asx["rate_per_100k"] = np.where(
        asx["suppressed"] == 1, np.nan, asx["visits"] / asx["population"] * 1e5
    )
    asx["visits"] = asx["visits"].where(asx["suppressed"] == 0)  # hide suppressed counts
    asx["rate_per_100k"] = pd.Series(asx["rate_per_100k"]).round(2)
    asx_out = asx[AS_COLS].sort_values(["district_id", "year", "age_group", "sex"]).copy()
    asx_out["visits"] = asx_out["visits"].round().astype("Int64")
    asx_out["population"] = asx_out["population"].round().astype("Int64")
    asx_out["year"] = asx_out["year"].astype("Int64")
    asx_out["district_id"] = asx_out["district_id"].astype("Int64")
    asx_out["suppressed"] = asx_out["suppressed"].astype("Int64")

    # 3. District-year indicators and the need index
    d = dy.copy()
    d["district_id"] = d["district_name"].map(ids).astype(int)
    d["psychiatrists"] = d["psychiatrists"].replace(0, np.nan)
    d["out_rate"] = d["outpatient_visits"] / d["population"] * 1e5
    d["adm_rate"] = d["admissions"] / d["population"] * 1e5
    d["ref_rate"] = d["referrals"] / d["population"] * 1e5
    d["psych_per_100k"] = d["psychiatrists"] / d["population"] * 1e5
    d["visits_per_psychiatrist"] = d["outpatient_visits"] / d["psychiatrists"]

    # Scaling runs across all districts AND all years, so values compare over time.
    score = sum(w * minmax(d[col]) for col, w in C.INDEX_WEIGHTS.items())
    d["need_index"] = 100 * score / sum(C.INDEX_WEIGHTS.values())

    d = d.sort_values(["district_id", "year"]).reset_index(drop=True)
    for col in ["out_rate", "adm_rate", "ref_rate", "unemployment_pct"]:
        d[col] = d[col].round(2)
    d["psych_per_100k"] = d["psych_per_100k"].round(3)
    d["visits_per_psychiatrist"] = d["visits_per_psychiatrist"].round(1)
    d["need_index"] = d["need_index"].round(1)
    for col in ["year", "district_id", "outpatient_visits", "admissions", "referrals",
                "population", "psychiatrists"]:
        d[col] = d[col].round().astype("Int64")

    dy_out = d[DY_COLS].copy()

    # 4. Alerts (uses the full frame, including district names)
    alerts = build_alerts(d)

    # 5. Reference tables
    districts_df = pd.DataFrame([
        {"id": i + 1, "name": x["name"], "province": x["province"], "lat": x["lat"], "lon": x["lon"]}
        for i, x in enumerate(C.DISTRICTS)
    ])
    alerts_df = pd.DataFrame(alerts, columns=ALERT_COLS)
    sources_df = manifest.copy()

    # 6. Write processed CSVs
    dy_out.to_csv(C.PROCESSED_FILES["district_year"], index=False)
    asx_out.to_csv(C.PROCESSED_FILES["age_sex"], index=False)
    alerts_df.to_csv(C.PROCESSED_FILES["alerts"], index=False)
    districts_df.to_csv(C.PROCESSED_FILES["districts"], index=False)
    sources_df.to_csv(C.PROCESSED_FILES["sources"], index=False)

    # 7. Dataset for the dashboard fallback
    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "is_synthetic": bool(sources_df["is_synthetic"].astype(int).max() == 1),
        "years": sorted(int(y) for y in dy_out["year"].dropna().unique()),
        "age_groups": C.AGE_GROUPS,
        "sexes": C.SEXES,
        "index_weights": C.INDEX_WEIGHTS,
        "min_cell_count": C.MIN_CELL_COUNT,
        "low_completeness_pct": C.LOW_COMPLETENESS_PCT,
        "rising_periods": C.RISING_PERIODS,
        "rising_threshold": C.RISING_THRESHOLD,
        "reconciliation": {"checked": int(len(rec)), "within_tolerance": ok},
        "index_method": (
            "Four indicators: outpatient visits, admissions and referrals per 100,000 population, "
            "and the unemployment rate. Each is min-max scaled across all districts and years, "
            "combined with the weights above, and rescaled to 0-100."
        ),
        "national_context": C.NATIONAL_CONTEXT,
        "excluded_indicators": [
            "Suicide and self-harm indicators are excluded until reviewed with a clinician."
        ],
    }
    payload = {
        "meta": meta,
        "districts": records(districts_df),
        "district_year": records(dy_out),
        "age_sex": records(asx_out),
        "alerts": alerts,
        "sources": records(sources_df),
    }
    (C.PUBLIC_DATA_DIR / "dataset.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"Processed: {len(dy_out)} district-years, {len(asx_out)} age-sex cells, {len(alerts)} alerts")
    print(f"Dataset written to {C.PUBLIC_DATA_DIR / 'dataset.json'}")


if __name__ == "__main__":
    main()
