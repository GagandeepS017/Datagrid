import os
import uuid

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from services.ingestion import parse_csv, parse_excel, parse_json, parse_image
from services.schema import infer_schema, sample_rows
from services.sql_engine import register_table, table_exists

router = APIRouter(tags=["upload"])

_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

_TABULAR_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json"}
_IMAGE_EXTENSIONS   = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
_ALLOWED_EXTENSIONS = _TABULAR_EXTENSIONS | _IMAGE_EXTENSIONS


class UploadResponse(BaseModel):
    table_id:    str
    table_name:  str
    row_count:   int
    columns:     list[dict]
    sample_rows: list[dict]


class SchemaResponse(BaseModel):
    table_id:    str
    table_name:  str
    row_count:   int
    columns:     list[dict]
    sample_rows: list[dict]


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename.lower())[1]
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Accepted: CSV, Excel (.xlsx), JSON, PNG, JPG, WEBP.",
        )

    raw = await file.read()
    if len(raw) > _MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB limit.")

    try:
        if ext == ".csv":
            df = parse_csv(raw)
        elif ext in (".xlsx", ".xls"):
            df = parse_excel(raw)
        elif ext == ".json":
            df = parse_json(raw)
        else:
            df = parse_image(raw, ext)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse file: {e}")

    if df.empty:
        raise HTTPException(status_code=422, detail="File is empty or contains no tabular data.")

    table_id   = str(uuid.uuid4())
    table_name = register_table(table_id, df, filename=file.filename)
    columns    = infer_schema(df)
    samples    = sample_rows(df)

    return UploadResponse(
        table_id=table_id,
        table_name=table_name,
        row_count=len(df),
        columns=columns,
        sample_rows=samples,
    )


@router.get("/schema/{table_id}", response_model=SchemaResponse)
def get_schema(table_id: str):
    from services.sql_engine import _tables

    if not table_exists(table_id):
        raise HTTPException(status_code=404, detail="Table not found. Please re-upload your file.")

    df         = _tables[table_id]
    columns    = infer_schema(df)
    samples    = sample_rows(df)
    table_name = f"t_{table_id.replace('-', '_')}"

    return SchemaResponse(
        table_id=table_id,
        table_name=table_name,
        row_count=len(df),
        columns=columns,
        sample_rows=samples,
    )
