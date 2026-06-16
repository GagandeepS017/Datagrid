from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude_client import generate_sql
from services.schema import infer_schema, sample_rows
from services.sql_engine import execute_query, table_exists, _tables

router = APIRouter(tags=["query"])


class QueryRequest(BaseModel):
    table_id: str
    question: str


class QueryResponse(BaseModel):
    question:  str
    sql:       str
    columns:   list[str]
    rows:      list[list]
    row_count: int
    chart:     dict | None = None


def _build_schema_context(table_id: str) -> dict:
    df = _tables[table_id]
    return {
        "table_name": f"t_{table_id.replace('-', '_')}",
        "columns":    infer_schema(df),
        "sample_rows": sample_rows(df),
    }


@router.post("/query", response_model=QueryResponse)
def run_query(req: QueryRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    if not table_exists(req.table_id):
        raise HTTPException(status_code=404, detail="Table not found. Please re-upload your file.")

    schema = _build_schema_context(req.table_id)

    error_feedback = None
    for _ in range(2):
        try:
            result = generate_sql(req.question, schema, error_feedback=error_feedback)
            sql    = result["sql"]
            chart  = result.get("chart")
            columns, rows = execute_query(sql)
            return QueryResponse(
                question=req.question,
                sql=sql,
                columns=columns,
                rows=rows,
                row_count=len(rows),
                chart=chart,
            )
        except Exception as exc:
            error_feedback = str(exc)

    raise HTTPException(
        status_code=422,
        detail=f"Could not generate a valid query after 2 attempts. Last error: {error_feedback}",
    )
