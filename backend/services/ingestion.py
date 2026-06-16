import base64
import csv
import io
import json
import os

import anthropic
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

_IMAGE_MEDIA_TYPES = {
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif":  "image/gif",
}

_OCR_PROMPT = (
    "Extract the table data from this image and return it as CSV.\n"
    "Rules:\n"
    "- Output ONLY raw CSV — no explanation, no markdown fences.\n"
    "- First row must be the header.\n"
    "- If there are multiple tables, extract the largest one.\n"
    "- Use comma as delimiter. Quote fields that contain commas.\n"
    "- Preserve all cell values exactly as shown."
)


def parse_csv(file_bytes: bytes) -> pd.DataFrame:
    text = None
    for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            text = file_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if text is None:
        raise ValueError("Could not decode file — unsupported encoding")

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

    raise ValueError("Unsupported JSON structure — expected an array or object.")


def parse_image(file_bytes: bytes, ext: str) -> pd.DataFrame:
    media_type = _IMAGE_MEDIA_TYPES.get(ext.lower(), "image/png")
    b64 = base64.standard_b64encode(file_bytes).decode("utf-8")

    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": _OCR_PROMPT},
            ],
        }],
    )

    csv_text = message.content[0].text.strip()
    if "```" in csv_text:
        parts = csv_text.split("```")
        csv_text = parts[1].lstrip("csv").strip() if len(parts) > 1 else csv_text

    return parse_csv(csv_text.encode("utf-8"))
