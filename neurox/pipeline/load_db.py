"""Loads the processed 2024 dataset into MariaDB or MySQL.

Recreates every table from db/schema.sql on each run. Run build_dataset.py first.
"""
import json

import pandas as pd

import config as C

SCHEMA_FILE = C.ROOT / "db" / "schema.sql"


def connect():
    import pymysql  # imported here so the pipeline runs without a database driver
    return pymysql.connect(
        host=C.DB["host"],
        port=C.DB["port"],
        user=C.DB["user"],
        password=C.DB["password"],
        database=C.DB["database"],
        charset="utf8mb4",
        autocommit=False,
    )


def _to_rows(df):
    rows = []
    for row in df.itertuples(index=False, name=None):
        clean = []
        for v in row:
            if pd.isna(v):
                clean.append(None)
            elif hasattr(v, "item"):
                clean.append(v.item())
            else:
                clean.append(v)
        rows.append(tuple(clean))
    return rows


def insert(cursor, table, df):
    if df.empty:
        return 0
    cols = list(df.columns)
    sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})"
    cursor.executemany(sql, _to_rows(df))
    return len(df)


def main():
    p = C.PROCESSED_DIR
    districts = pd.read_csv(p / "districts.csv")
    district_2024 = pd.read_csv(p / "district_2024.csv")
    sources = pd.read_csv(p / "sources.csv", dtype={"edition": str})
    meta = json.loads((C.PUBLIC_DATA_DIR / "dataset.json").read_text(encoding="utf-8"))["meta"]

    conn = connect()
    try:
        with conn.cursor() as cur:
            for statement in SCHEMA_FILE.read_text(encoding="utf-8").split(";"):
                if statement.strip():
                    cur.execute(statement)
            counts = {
                "districts": insert(cur, "districts", districts),
                "source_files": insert(cur, "source_files", sources),
                "district_2024": insert(cur, "district_2024", district_2024),
            }
            cur.execute(
                "INSERT INTO settings (setting_key, setting_value) VALUES (%s, %s)",
                ("meta", json.dumps(meta, ensure_ascii=False)),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    print("Loaded into database:", ", ".join(f"{k} {v}" for k, v in counts.items()))


if __name__ == "__main__":
    main()
