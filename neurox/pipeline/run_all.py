"""Builds the dataset from the transcribed source tables, then optionally loads the database.

    python run_all.py               build only
    python run_all.py --load-db     build, then load into MariaDB (set NEUROX_DB_* first)
"""
import sys

import build_dataset
import load_db

if __name__ == "__main__":
    build_dataset.main()
    if "--load-db" in sys.argv:
        print("Loading database...")
        load_db.main()
    else:
        print("Database load skipped. Add --load-db once MariaDB is set up.")
