import json
import os

import anthropic
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.claude_client import generate_sql
from services.schema import infer_schema, sample_rows
from services.sql_engine import execute_query, table_exists, _tables

router = APIRouter(tags=["query"])

_async_client = anthropic.AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

_INTERPRET_PROMPT = """\
You are a concise data analyst. The user asked: "{question}"

The query returned {row_count} row(s) with columns: {columns}.
First few rows: {preview}

Write 2-3 sentences interpreting what this result means. Be specific, mention \
actual values, trends, or standout figures from the data. No preamble, no lists."""


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


class InterpretRequest(BaseModel):
    question:  str
    columns:   list[str]
    rows:      list[list]


def _build_schema_context(table_id: str) -> dict:
    df = _tables[table_id]
    return {
        "table_name":  f"t_{table_id.replace('-', '_')}",
        "columns":     infer_schema(df),
        "sample_rows": sample_rows(df),
    }


@router.post("/query", response_model=QueryResponse)
def run_query(req: QueryRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    if not table_exists(req.table_id):
        raise HTTPException(status_code=404, detail="Table not found. Please re-upload your file.")

    schema         = _build_schema_context(req.table_id)
    error_feedback = None
    for _ in range(2):
        try:
            result  = generate_sql(req.question, schema, error_feedback=error_feedback)
            sql     = result["sql"]
            chart   = result.get("chart")
            columns, rows = execute_query(sql)
            return QueryResponse(
                question=req.question, sql=sql,
                columns=columns, rows=rows,
                row_count=len(rows), chart=chart,
            )
        except Exception as exc:
            error_feedback = str(exc)

    raise HTTPException(
        status_code=422,
        detail=f"Could not generate a valid query after 2 attempts. Last error: {error_feedback}",
    )


@router.post("/query/interpret")
async def stream_interpret(req: InterpretRequest):
    preview = req.rows[:5]
    prompt  = _INTERPRET_PROMPT.format(
        question=req.question,
        row_count=len(req.rows),
        columns=", ".join(req.columns),
        preview=preview,
    )

    async def generate():
        try:
            async with _async_client.messages.stream(
                model="claude-haiku-4-5-20251001",
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                async for token in stream.text_stream:
                    yield f"data: {json.dumps({'token': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
