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
