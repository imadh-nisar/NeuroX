"""Extract tables from a bulletin or census PDF for review.

Usage:
    python extract_bulletin.py path/to/bulletin.pdf --pages 40-42 --out ../data/raw/extract_2019.csv

What it does:
  - opens the PDF with pdfplumber
  - reads every table on the pages you name
  - writes all tables to one CSV, with a column recording the page and table number

What it does NOT do:
  - it does not map columns to NeuroX fields. Layouts differ between editions, so you
    review the output, then write the final district_year_raw.csv and age_sex_raw.csv by hand
    (or with a short script for that edition).
  - it does not reconcile figures. build_dataset.py does that, using the published totals.

Record the PDF's URL, edition and download date in data/raw/source_manifest.csv.
"""
import argparse
from pathlib import Path

import pandas as pd
import pdfplumber


def parse_pages(text):
    pages = []
    for part in text.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-", 1)
            pages.extend(range(int(start), int(end) + 1))
        elif part:
            pages.append(int(part))
    return pages


def extract_tables(pdf_path, pages):
    frames = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_no in pages:
            if page_no < 1 or page_no > len(pdf.pages):
                print(f"  Skipping page {page_no}: the PDF has {len(pdf.pages)} pages")
                continue
            tables = pdf.pages[page_no - 1].extract_tables()
            for table_no, table in enumerate(tables, start=1):
                if not table or len(table) < 2:
                    continue
                header = [str(c or "").strip() for c in table[0]]
                body = table[1:]
                frame = pd.DataFrame(body, columns=header)
                frame.insert(0, "table_no", table_no)
                frame.insert(0, "page", page_no)
                frames.append(frame)
                print(f"  page {page_no}, table {table_no}: {frame.shape[0]} rows, {frame.shape[1]} columns")
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def main():
    parser = argparse.ArgumentParser(description="Extract tables from a PDF for review")
    parser.add_argument("pdf", type=Path, help="path to the PDF")
    parser.add_argument("--pages", required=True, help="pages, e.g. 40-42 or 3,5,9")
    parser.add_argument("--out", type=Path, required=True, help="output CSV path")
    args = parser.parse_args()

    if not args.pdf.exists():
        raise SystemExit(f"File not found: {args.pdf}")

    pages = parse_pages(args.pages)
    print(f"Reading {args.pdf.name}, pages {pages}")
    result = extract_tables(args.pdf, pages)
    if result.empty:
        raise SystemExit("No tables found. Check the page numbers and try again.")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(args.out, index=False)
    print(f"Wrote {len(result)} rows to {args.out}")


if __name__ == "__main__":
    main()
