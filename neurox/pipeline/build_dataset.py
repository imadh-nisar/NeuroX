"""Builds the 2024 district dataset from the transcribed bulletin and directory tables.

Inputs : data/raw/*.csv
Outputs: data/processed/*.csv and public/data/dataset.json
"""
import json
import re
from datetime import datetime, timezone

import numpy as np
import pandas as pd

import config as C

COUNT_COLS = ["psych_clinic_visits", "psychiatrists", "psych_beds", "mental_hospitalisations"]
REQUIRED_COLS = ["population", "psych_clinic_visits", "psychiatrists", "mental_hospitalisations"]
OUT_COLS = [
    "district_id", "population", "psych_clinic_visits", "psychiatrists", "psych_beds",
    "mental_hospitalisations", "psych_visits_per_100k", "psychiatrists_per_100k", "beds_per_100k",
    "mh_hosp_per_100k", "visits_per_psychiatrist", "facilities_listed", "service_use_score",
    "decision_key", "decision_label", "decision_reason",
]

# Rules are deliberately simple so a planner can check each one.
DECISIONS = {
    "staff": ("Add psychiatrist time",
              "Service use is at or above the median, and psychiatrists per 100,000 people are below the national rate."),
    "watch": ("Monitor workload",
              "Service use is at or above the median, and psychiatrists per 100,000 people are at or above the national rate."),
    "access": ("Check access",
               "Service use is below the median and psychiatrists per 100,000 people are below the national rate. Low use can reflect barriers to access."),
    "maintain": ("Keep current plan",
                 "Service use is below the median, and psychiatrists per 100,000 people are at or above the national rate."),
    "data": ("Data incomplete",
             "A figure needed for this decision is missing from the source tables."),
}


def norm_key(name):
    """Letters only, lower case, ignoring the word 'district', so spelling variants match."""
    return re.sub(r"[^a-z]", "", str(name).lower().replace("district", ""))


def canonical_names():
    names = {norm_key(d["name"]): d["name"] for d in C.DISTRICTS}
    for alias, canonical in C.DISTRICT_ALIASES.items():
        names[norm_key(alias)] = canonical
    return names


def read_inputs():
    names = canonical_names()
    pop = pd.read_csv(C.RAW_DIR / "census2024_population.csv")
    rdhs = pd.read_csv(C.RAW_DIR / "ahb2024_rdhs_mental.csv")
    fac = pd.read_csv(C.RAW_DIR / "directory2023_facilities.csv")
    man = pd.read_csv(C.RAW_DIR / "source_manifest.csv", dtype={"edition": str})
    for df in (pop, rdhs, fac):
        keys = df["district"].map(norm_key)
        unknown = sorted(set(df.loc[~keys.isin(list(names)), "district"].astype(str)))
        if unknown:
            raise SystemExit(f"Unknown district names {unknown}. Add them to DISTRICT_ALIASES in config.py.")
        df["district"] = keys.map(names)
    if pop["district"].duplicated().any():
        raise SystemExit("Duplicate districts in the census file.")
    pop["population"] = pd.to_numeric(pop["population"], errors="raise")
    for c in COUNT_COLS:
        rdhs[c] = pd.to_numeric(rdhs[c], errors="coerce")
    fac["facilities_listed"] = pd.to_numeric(fac["facilities_listed"], errors="raise")
    return pop, rdhs, fac, man


def reconcile(pop, rdhs):
    """Compares sums of the transcribed tables with the totals printed in the bulletin."""
    pub = C.PUBLISHED_TOTALS
    out = []

    def add(name, computed, published, tol=0):
        out.append({
            "check": name,
            "computed": float(computed),
            "published": float(published),
            "status": "match" if abs(computed - published) <= tol else "check",
            "note": "",
        })

    add("Population, all districts (persons)", pop["population"].sum(), pub["population"], C.POPULATION_TOLERANCE)
    add("Psychiatric clinic visits, all divisions", rdhs["psych_clinic_visits"].sum(), pub["psych_clinic_visits"])
    add("Psychiatrists, all divisions", rdhs["psychiatrists"].sum(), pub["psychiatrists"])
    add("Admissions for mental disorders, all divisions", rdhs["mental_hospitalisations"].sum(), pub["mental_hospitalisations"])

    known = rdhs["psych_beds"].sum()
    missing = rdhs.loc[rdhs["psych_beds"].isna(), "rdhs_division"].tolist()
    out.append({
        "check": "Psychiatric beds, all divisions",
        "computed": float(known),
        "published": float(pub["psych_beds"]),
        "status": "partial",
        "note": f"{pub['psych_beds'] - known:.0f} beds are not split by division for: {', '.join(missing)}.",
    })
    return out


def build_table(pop, rdhs, fac, ids):
    def total(s):
        return s.sum() if s.notna().all() else np.nan

    agg = rdhs.groupby("district").agg({c: total for c in COUNT_COLS}).reset_index()
    d = pop.merge(agg, on="district", how="left").merge(fac, on="district", how="left")
    d["district_id"] = d["district"].map(ids)
    if d["district_id"].isna().any():
        raise SystemExit("A district has no id.")
    d["district_id"] = d["district_id"].astype(int)

    p = d["population"]
    d["psych_visits_per_100k"] = d["psych_clinic_visits"] / p * 1e5
    d["psychiatrists_per_100k"] = d["psychiatrists"] / p * 1e5
    d["beds_per_100k"] = d["psych_beds"] / p * 1e5
    d["mh_hosp_per_100k"] = d["mental_hospitalisations"] / p * 1e5
    d["visits_per_psychiatrist"] = d["psych_clinic_visits"] / d["psychiatrists"].replace(0, np.nan)

    weights = C.SERVICE_USE_WEIGHTS

    def minmax(s):
        lo, hi = s.min(), s.max()
        return (s - lo) / (hi - lo) if hi > lo else s * 0.0

    usable = d[list(weights)].notna().all(axis=1)
    raw = sum(w * minmax(d[col]) for col, w in weights.items())
    d["service_use_score"] = (100 * raw / sum(weights.values())).where(usable).round(1)
    return d


def assign_decisions(d, nat_rate, median_use):
    def decide(r):
        if r[REQUIRED_COLS].isna().any():
            return "data"
        high_use = pd.notna(r["service_use_score"]) and r["service_use_score"] >= median_use
        low_staff = r["psychiatrists_per_100k"] < nat_rate
        if high_use and low_staff:
            return "staff"
        if high_use:
            return "watch"
        if low_staff:
            return "access"
        return "maintain"

    d["decision_key"] = d.apply(decide, axis=1)
    d["decision_label"] = d["decision_key"].map(lambda k: DECISIONS[k][0])
    d["decision_reason"] = d["decision_key"].map(lambda k: DECISIONS[k][1])
    return d


def finish(d):
    for c in ["psych_visits_per_100k", "psychiatrists_per_100k", "beds_per_100k", "mh_hosp_per_100k"]:
        d[c] = d[c].round(2)
    d["visits_per_psychiatrist"] = d["visits_per_psychiatrist"].round(0)
    for c in ["population", "psych_clinic_visits", "psychiatrists", "psych_beds",
              "mental_hospitalisations", "facilities_listed", "district_id"]:
        d[c] = d[c].round().astype("Int64")
    return d.sort_values("district_id")[OUT_COLS].reset_index(drop=True)


def records(df):
    """DataFrame to list of dicts. NaN and NA become null."""
    return json.loads(df.to_json(orient="records", force_ascii=False))


def main():
    C.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    C.PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)

    pop, rdhs, fac, man = read_inputs()
    ids = {d["name"]: i + 1 for i, d in enumerate(C.DISTRICTS)}

    checks = reconcile(pop, rdhs)
    print("Reconciliation against published totals:")
    for c in checks:
        print(f"  [{c['status']}] {c['check']}: computed {c['computed']:,.0f}, published {c['published']:,.0f}"
              + (f". {c['note']}" if c["note"] else ""))
    if any(c["status"] == "check" for c in checks):
        print("  WARNING: a total does not match. Check the transcribed tables before using the figures.")

    nat_pop = pop["population"].sum()
    nat_psych = rdhs["psychiatrists"].sum()
    nat_rate = nat_psych / nat_pop * 1e5

    d = build_table(pop, rdhs, fac, ids)
    median_use = d["service_use_score"].median()
    d = assign_decisions(d, nat_rate, median_use)
    out = finish(d)

    districts_df = pd.DataFrame([
        {"id": i + 1, "name": x["name"], "province": x["province"], "lat": x["lat"], "lon": x["lon"]}
        for i, x in enumerate(C.DISTRICTS)
    ])
    sources_df = man.copy()

    out.to_csv(C.PROCESSED_DIR / "district_2024.csv", index=False)
    districts_df.to_csv(C.PROCESSED_DIR / "districts.csv", index=False)
    sources_df.to_csv(C.PROCESSED_DIR / "sources.csv", index=False)
    pd.DataFrame(checks).to_csv(C.PROCESSED_DIR / "reconciliation.csv", index=False)

    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "is_synthetic": False,
        "source_year": C.SOURCE_YEAR,
        "directory_year": C.DIRECTORY_YEAR,
        "national": {
            "population": int(nat_pop),
            "psych_clinic_visits": int(rdhs["psych_clinic_visits"].sum()),
            "psychiatrists": int(nat_psych),
            "psych_beds": int(C.PUBLISHED_TOTALS["psych_beds"]),
            "mental_hospitalisations": int(rdhs["mental_hospitalisations"].sum()),
            "psychiatrists_per_100k": round(nat_rate, 3),
            "median_service_use": float(median_use),
        },
        "index_weights": C.SERVICE_USE_WEIGHTS,
        "index_method": (
            "The service-use score combines two 2024 indicators per 100,000 people: psychiatric clinic visits "
            "and admissions for mental disorders. Each is scaled from 0 to 1 across the 25 districts, averaged "
            "with equal weight, and rescaled to 0 to 100. It measures how much care is used, not how much "
            "illness exists."
        ),
        "decision_rules": {k: {"label": v[0], "reason": v[1]} for k, v in DECISIONS.items()},
        "reconciliation": checks,
        "national_context": C.NATIONAL_CONTEXT,
        "limitations": [
            "District figures come from health divisions (RDHS). Kalmunai is counted within Ampara district.",
            "Colombo's clinic visits, beds and admissions include national institutions whose patients come from across the country.",
            "Psychiatrist counts are by division. Psychiatrists attached to teaching hospitals may be counted elsewhere, so some districts may look thinner than they are.",
            "Clinics are often run by medical officers, not psychiatrists. Visits per psychiatrist measures workload, not caseloads.",
            "Low service use can mean low need or poor access. The score cannot tell these apart.",
            "Bed counts for Kilinochchi, Mannar and Mullaitivu are not split in the bulletin (37 beds in total).",
            "Directory counts are government facilities listed with mental health services. They are not staff or bed counts, and the directory is not a complete inventory.",
            "Patients often travel into a district for care. Vavuniya, for example, has high visits per person because it serves neighbouring districts.",
            "Some psychiatrist counts look low for the district they are in. Kandy shows 1 psychiatrist despite its teaching hospital. Verify flagged districts against the PDF before acting on them.",
            "The data covers one year only, so trends cannot be assessed.",
        ],
        "excluded_indicators": [
            "Suicide and self-harm indicators are excluded until they are reviewed with a clinician."
        ],
    }

    payload = {
        "meta": meta,
        "districts": records(districts_df),
        "district_2024": records(out),
        "sources": records(sources_df),
    }
    (C.PUBLIC_DATA_DIR / "dataset.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Districts: {len(out)}. Median service-use score: {median_use:.1f}. National rate: {nat_rate:.3f} psychiatrists per 100,000.")
    print("Decisions:", out["decision_key"].value_counts().to_dict())
    print(f"Dataset written to {C.PUBLIC_DATA_DIR / 'dataset.json'}")


if __name__ == "__main__":
    main()
