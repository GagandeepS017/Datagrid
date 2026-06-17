import csv
import io
import json

import pandas as pd


def parse_csv(file_bytes: bytes) -> pd.DataFrame:
    text = None
    for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            text = file_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if text is None:
        raise ValueError("Could not decode file, unsupported encoding")

    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        delimiter = dialect.delimiter
    except csv.Error:
        delimiter = ","

    df = pd.read_csv(io.StringIO(text), sep=delimiter)
    df.columns = [str(c).strip().lstrip("﻿").strip() for c in df.columns]
    return df


def parse_excel(file_bytes: bytes) -> pd.DataFrame:
    df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
    df.columns = [str(c).strip() for c in df.columns]
    return df


def parse_json(file_bytes: bytes) -> pd.DataFrame:
    text = file_bytes.decode("utf-8-sig")
    data = json.loads(text)

    if isinstance(data, list):
        return pd.json_normalize(data)

    if isinstance(data, dict):
        # Try top-level array values first (e.g. {"records": [...]})
        for v in data.values():
            if isinstance(v, list) and v:
                return pd.json_normalize(v)
        # Fallback: treat the dict itself as a single-row table
        return pd.DataFrame([data])

    raise ValueError("Unsupported JSON structure, expected an array or object.")
