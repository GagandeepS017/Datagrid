import csv
import io
import pandas as pd


def parse_csv(file_bytes: bytes) -> pd.DataFrame:
    """Parse CSV bytes into a DataFrame with automatic delimiter and encoding detection."""

    # Try common encodings in priority order
    text = None
    for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            text = file_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if text is None:
        raise ValueError("Could not decode file — unsupported encoding")

    # Use csv.Sniffer on a representative sample to detect the actual delimiter.
    # The naive "if delim in sample" approach breaks on files where the text
    # itself contains commas (e.g. a semicolon-separated file with addresses).
    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        delimiter = dialect.delimiter
    except csv.Error:
        # Sniffer failed (e.g. single-column file) — fall back to comma
        delimiter = ","

    df = pd.read_csv(io.StringIO(text), sep=delimiter)

    # Strip BOM artifacts, surrounding whitespace from column names
    df.columns = [str(c).strip().lstrip("\ufeff").strip() for c in df.columns]

    return df
