"""Central configuration. Real data only.

Sources:
  Annual Health Bulletin 2024, Ministry of Health and Mass Media (Medical Statistics Unit)
  Directory of Mental Health Service Providers in Sri Lanka 2023, Directorate of Mental Health

Change settings here, then re-run run_all.py.
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
PUBLIC_DATA_DIR = ROOT / "public" / "data"

SOURCE_YEAR = 2024
DIRECTORY_YEAR = 2023

# Service-use score (0 to 100): weighted average of these two indicators,
# each scaled from 0 to 1 across the 25 districts.
SERVICE_USE_WEIGHTS = {"psych_visits_per_100k": 0.5, "mh_hosp_per_100k": 0.5}

# Totals published in the Annual Health Bulletin 2024. Used to check the transcribed tables.
PUBLISHED_TOTALS = {
    "population": 21781800,            # Key Health Indicators (census 2024)
    "psych_clinic_visits": 1250232,    # Table 9.4 (2024 psychiatric clinic column)
    "psychiatrists": 101,              # Table 6.3
    "psych_beds": 3194,                # Table 5.3
    "mental_hospitalisations": 61397,  # Table 8.9
}
POPULATION_TOLERANCE = 1000

NATIONAL_CONTEXT = [
    {"label": "Psychiatric clinic visits, 2024", "value": 1250232, "year": "2024",
     "source": "Annual Health Bulletin 2024, Table 9.4",
     "note": "Table 9.3 prints 1,241,626 for the same year. Check the PDF before citing either figure."},
    {"label": "Psychiatrists, 2024", "value": 101, "year": "2024",
     "source": "Annual Health Bulletin 2024, Table 6.3",
     "note": "Counted by health division (RDHS)."},
    {"label": "Psychiatric beds, 2024", "value": 3194, "year": "2024",
     "source": "Annual Health Bulletin 2024, Table 5.3",
     "note": "Kilinochchi, Mannar and Mullaitivu are not split by division in the source."},
    {"label": "Admissions for mental disorders, 2024", "value": 61397, "year": "2024",
     "source": "Annual Health Bulletin 2024, Table 8.9",
     "note": "Government hospitals only."},
    {"label": "Psychiatric clinic visits, 2021", "value": 800356, "year": "2021",
     "source": "Annual Health Bulletin 2024, Table 9.3",
     "note": "Earlier year, shown for context only."},
]

# The bulletin reports Kalmunai as its own health division. It lies within Ampara district.
DISTRICT_ALIASES = {"Mulaitivu": "Mullaitivu"}

DISTRICTS = [
    {"name": "Colombo", "province": "Western", "lat": 6.9271, "lon": 79.8612},
    {"name": "Gampaha", "province": "Western", "lat": 7.0917, "lon": 80.0144},
    {"name": "Kalutara", "province": "Western", "lat": 6.5854, "lon": 79.9607},
    {"name": "Kandy", "province": "Central", "lat": 7.2906, "lon": 80.6337},
    {"name": "Matale", "province": "Central", "lat": 7.4675, "lon": 80.6234},
    {"name": "Nuwara Eliya", "province": "Central", "lat": 6.9497, "lon": 80.7891},
    {"name": "Galle", "province": "Southern", "lat": 6.0535, "lon": 80.2210},
    {"name": "Matara", "province": "Southern", "lat": 5.9549, "lon": 80.5550},
    {"name": "Hambantota", "province": "Southern", "lat": 6.1429, "lon": 81.1212},
    {"name": "Jaffna", "province": "Northern", "lat": 9.6615, "lon": 80.0255},
    {"name": "Kilinochchi", "province": "Northern", "lat": 9.3803, "lon": 80.3770},
    {"name": "Mannar", "province": "Northern", "lat": 8.9810, "lon": 79.9044},
    {"name": "Vavuniya", "province": "Northern", "lat": 8.7542, "lon": 80.4982},
    {"name": "Mullaitivu", "province": "Northern", "lat": 9.2671, "lon": 80.8142},
    {"name": "Batticaloa", "province": "Eastern", "lat": 7.7102, "lon": 81.6924},
    {"name": "Ampara", "province": "Eastern", "lat": 7.3014, "lon": 81.6747},
    {"name": "Trincomalee", "province": "Eastern", "lat": 8.5874, "lon": 81.2152},
    {"name": "Kurunegala", "province": "North Western", "lat": 7.4863, "lon": 80.3647},
    {"name": "Puttalam", "province": "North Western", "lat": 8.0408, "lon": 79.8394},
    {"name": "Anuradhapura", "province": "North Central", "lat": 8.3114, "lon": 80.4037},
    {"name": "Polonnaruwa", "province": "North Central", "lat": 7.9403, "lon": 81.0188},
    {"name": "Badulla", "province": "Uva", "lat": 6.9934, "lon": 81.0550},
    {"name": "Monaragala", "province": "Uva", "lat": 6.8728, "lon": 81.3507},
    {"name": "Ratnapura", "province": "Sabaragamuwa", "lat": 6.7056, "lon": 80.3847},
    {"name": "Kegalle", "province": "Sabaragamuwa", "lat": 7.2513, "lon": 80.3464},
]

DB = {
    "host": os.getenv("NEUROX_DB_HOST", "localhost"),
    "port": int(os.getenv("NEUROX_DB_PORT", "3306")),
    "user": os.getenv("NEUROX_DB_USER", "neurox"),
    "password": os.getenv("NEUROX_DB_PASS", ""),
    "database": os.getenv("NEUROX_DB_NAME", "neurox"),
}
