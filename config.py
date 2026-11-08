"""Central configuration for the NeuroX pipeline.

Change settings here, not inside the scripts. After any change, re-run run_all.py.
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
PUBLIC_DATA_DIR = ROOT / "public" / "data"

# Periods covered by the demo data. Replace with the editions you actually extract.
YEARS = list(range(2016, 2024))
RANDOM_SEED = 2026  # used only by the synthetic demo generator

AGE_GROUPS = ["10-14", "15-19", "20-24", "25-39", "40-59", "60+"]
SEXES = ["Male", "Female"]

# Need index: weights for each scaled indicator. They are rescaled so the index runs 0-100.
INDEX_WEIGHTS = {
    "out_rate": 0.40,           # outpatient visits per 100,000
    "adm_rate": 0.30,           # admissions per 100,000
    "ref_rate": 0.10,           # referrals per 100,000
    "unemployment_pct": 0.20,   # district stress factor
}

MIN_CELL_COUNT = 10           # age-by-sex cells with fewer visits are suppressed (hidden)
LOW_COMPLETENESS_PCT = 80.0   # reporting completeness below this is flagged
RISING_PERIODS = 3            # consecutive periods of rising need needed for an alert
RISING_THRESHOLD = 60.0      # every index value in that run must be at or above this

# Alternative spellings found in source tables -> canonical district name.
# Matching ignores case, spaces, hyphens, punctuation and the word "district".
DISTRICT_ALIASES = {
    "Mulaitivu": "Mullaitivu",
}

# Name, province, approximate centre (lat, lon), illustrative population.
# Populations are rounded and for orientation only. They are NOT census figures.
DISTRICTS = [
    {"name": "Colombo", "province": "Western", "lat": 6.9271, "lon": 79.8612, "population": 2400000},
    {"name": "Gampaha", "province": "Western", "lat": 7.0917, "lon": 80.0144, "population": 2400000},
    {"name": "Kalutara", "province": "Western", "lat": 6.5854, "lon": 79.9607, "population": 1300000},
    {"name": "Kandy", "province": "Central", "lat": 7.2906, "lon": 80.6337, "population": 1500000},
    {"name": "Matale", "province": "Central", "lat": 7.4675, "lon": 80.6234, "population": 500000},
    {"name": "Nuwara Eliya", "province": "Central", "lat": 6.9497, "lon": 80.7891, "population": 700000},
    {"name": "Galle", "province": "Southern", "lat": 6.0535, "lon": 80.2210, "population": 1100000},
    {"name": "Matara", "province": "Southern", "lat": 5.9549, "lon": 80.5550, "population": 850000},
    {"name": "Hambantota", "province": "Southern", "lat": 6.1429, "lon": 81.1212, "population": 600000},
    {"name": "Jaffna", "province": "Northern", "lat": 9.6615, "lon": 80.0255, "population": 600000},
    {"name": "Kilinochchi", "province": "Northern", "lat": 9.3803, "lon": 80.3770, "population": 100000},
    {"name": "Mannar", "province": "Northern", "lat": 8.9810, "lon": 79.9044, "population": 100000},
    {"name": "Vavuniya", "province": "Northern", "lat": 8.7542, "lon": 80.4982, "population": 200000},
    {"name": "Mullaitivu", "province": "Northern", "lat": 9.2671, "lon": 80.8142, "population": 100000},
    {"name": "Batticaloa", "province": "Eastern", "lat": 7.7102, "lon": 81.6924, "population": 600000},
    {"name": "Ampara", "province": "Eastern", "lat": 7.3014, "lon": 81.6747, "population": 700000},
    {"name": "Trincomalee", "province": "Eastern", "lat": 8.5874, "lon": 81.2152, "population": 400000},
    {"name": "Kurunegala", "province": "North Western", "lat": 7.4863, "lon": 80.3647, "population": 1600000},
    {"name": "Puttalam", "province": "North Western", "lat": 8.0408, "lon": 79.8394, "population": 800000},
    {"name": "Anuradhapura", "province": "North Central", "lat": 8.3114, "lon": 80.4037, "population": 900000},
    {"name": "Polonnaruwa", "province": "North Central", "lat": 7.9403, "lon": 81.0188, "population": 400000},
    {"name": "Badulla", "province": "Uva", "lat": 6.9934, "lon": 81.0550, "population": 900000},
    {"name": "Monaragala", "province": "Uva", "lat": 6.8728, "lon": 81.3507, "population": 500000},
    {"name": "Ratnapura", "province": "Sabaragamuwa", "lat": 6.7056, "lon": 80.3847, "population": 1100000},
    {"name": "Kegalle", "province": "Sabaragamuwa", "lat": 7.2513, "lon": 80.3464, "population": 800000},
]

PROCESSED_FILES = {
    "district_year": PROCESSED_DIR / "district_year.csv",
    "age_sex": PROCESSED_DIR / "age_sex_year.csv",
    "alerts": PROCESSED_DIR / "alerts.csv",
    "districts": PROCESSED_DIR / "districts.csv",
    "sources": PROCESSED_DIR / "sources.csv",
    "reconciliation": PROCESSED_DIR / "reconciliation.csv",
}

# Database settings. Override with environment variables.
DB = {
    "host": os.getenv("NEUROX_DB_HOST", "localhost"),
    "port": int(os.getenv("NEUROX_DB_PORT", "3306")),
    "user": os.getenv("NEUROX_DB_USER", "neurox"),
    "password": os.getenv("NEUROX_DB_PASS", ""),
    "database": os.getenv("NEUROX_DB_NAME", "neurox"),
}

# National figures found in public sources. These are NOT district data.
# Each is reported second-hand from the source named. Check against the original bulletin before citing.
NATIONAL_CONTEXT = [
    {"label": "Visits to psychiatric clinics (whole country)", "value": 800356, "year": "2021",
     "source": "Ministry of Health Annual Health Bulletin, as reported in a UK government country information note",
     "note": "Second-hand. Verify against the bulletin."},
    {"label": "Dedicated psychiatric beds (whole country)", "value": 3084, "year": "2021",
     "source": "Ministry of Health Annual Health Bulletin, as reported in a UK government country information note",
     "note": "Excludes psychiatric patients in other wards."},
    {"label": "Psychiatric outpatient clinics in public hospitals", "value": 126, "year": None,
     "source": "WHO, as reported in a Swiss government country note",
     "note": "Year not stated in the source."},
    {"label": "Psychiatric outreach clinics in local health centres", "value": 320, "year": None,
     "source": "WHO, as reported in a Swiss government country note",
     "note": "Year not stated in the source."},
]
