import uuid

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from services.ingestion import parse_csv
from services.schema import infer_schema, sample_rows
from services.sql_engine import register_table, table_exists

router = APIRouter(tags=["upload"])

_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


class UploadResponse(BaseModel):
    table_id: str
    table_name: str
    row_count: int
    columns: list[dict]
    sample_rows: list[dict]


class SchemaResponse(BaseModel):
    table_id: str
    table_name: str
    row_count: int
    columns: list[dict]
    sample_rows: list[dict]


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported in Phase 1.")

    raw = await file.read()
    if len(raw) > _MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB limit.")

    try:
        df = parse_csv(raw)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV: {e}")

    if df.empty:
        raise HTTPException(status_code=422, detail="CSV file is empty.")

    table_id = str(uuid.uuid4())
    table_name = register_table(table_id, df)
    columns = infer_schema(df)
    samples = sample_rows(df)

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

    df = _tables[table_id]
    columns = infer_schema(df)
    samples = sample_rows(df)
    table_name = f"t_{table_id.replace('-', '_')}"

    return SchemaResponse(
        table_id=table_id,
        table_name=table_name,
        row_count=len(df),
        columns=columns,
        sample_rows=samples,
    )
