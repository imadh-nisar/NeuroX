
import sys

import build_dataset
import generate_sample_data
import load_db


def main():
    args = set(sys.argv[1:])
    unknown = args - {"--load-db", "--real", "--skip-generate"}
    if unknown:
        raise SystemExit(f"Unknown option(s): {sorted(unknown)}")

    if "--real" in args or "--skip-generate" in args:
        print("Using existing files in data/raw/ (no demo data generated).")
    else:
        print("Generating SYNTHETIC demo data...")
        generate_sample_data.main()

    print("Building dataset...")
    build_dataset.main()

    if "--load-db" in args:
        print("Loading database...")
        load_db.main()
    else:
        print("Database load skipped. Add --load-db once MariaDB is set up.")


if __name__ == "__main__":
    main()
