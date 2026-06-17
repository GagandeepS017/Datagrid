import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException

from services.ingestion import parse_csv
from services.schema import infer_schema, sample_rows
from services.sql_engine import register_table

router = APIRouter(tags=["samples"])

_SAMPLES_DIR = Path(__file__).parent.parent / "data" / "samples"

_CATALOG = [
    {
        "id":          "retail_sales",
        "file":        "retail_sales.csv",
        "name":        "Retail Sales",
        "description": "500 rows of multi-region sales across 5 product categories (2022-2024). "
                       "Great for revenue trends, regional breakdowns, and discount analysis.",
        "rows":        500,
        "tags":        ["sales", "time-series", "regional"],
    },
    {
        "id":          "hr_employees",
        "file":        "hr_employees.csv",
        "name":        "HR Employees",
        "description": "250 employees across 7 departments with salary, experience, "
                       "performance scores, and remote status.",
        "rows":        250,
        "tags":        ["HR", "salary", "performance"],
    },
    {
        "id":          "ecommerce_orders",
        "file":        "ecommerce_orders.csv",
        "name":        "E-Commerce Orders",
        "description": "400 orders from 8 European countries across 7 categories "
                       "with ratings, shipping times, and return flags.",
        "rows":        400,
        "tags":        ["e-commerce", "ratings", "Europe"],
    },
]


@router.get("/samples")
def list_samples():
    return _CATALOG


@router.post("/samples/{sample_id}")
def load_sample(sample_id: str):
    entry = next((s for s in _CATALOG if s["id"] == sample_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Sample '{sample_id}' not found.")

    path = _SAMPLES_DIR / entry["file"]
    if not path.exists():
        raise HTTPException(status_code=500, detail="Sample file missing on server.")

    df         = parse_csv(path.read_bytes())
    table_id   = str(uuid.uuid4())
    table_name = register_table(table_id, df)
    columns    = infer_schema(df)
    samples    = sample_rows(df)

    return {
        "table_id":    table_id,
        "table_name":  table_name,
        "row_count":   len(df),
        "columns":     columns,
        "sample_rows": samples,
        "source":      "sample",
        "sample_name": entry["name"],
    }
