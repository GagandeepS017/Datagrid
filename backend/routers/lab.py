import json
import os

import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.schema import infer_schema, sample_rows
from services.sql_engine import execute_query, table_exists, _tables
from services.synthesizer import synthesize

router = APIRouter(tags=["lab"])

_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

_WHATIF_PROMPT = """\
You are a data analyst. Given a what-if scenario, produce a DuckDB SELECT query that \
transforms the original table to simulate the scenario.

Table: {table_name}
Columns:
{cols}

Sample rows:
{samples}

Scenario: {scenario}

Return ONLY this JSON — no markdown, no explanation:
{{
  "sql": "<SELECT query applying the transformation — keep all original columns, transform as needed>",
  "narrative": "<1-2 sentences describing what changed and what the result represents>"
}}

Rules:
- Use only SELECT; table name must be exactly: {table_name}
- Keep all original columns in the output (rename with AS if transforming)
- If the scenario is ambiguous, make a reasonable interpretation and note it in narrative
"""


class SyntheticRequest(BaseModel):
    table_id: str
    n_rows:   int = 100


class SyntheticResponse(BaseModel):
    columns: list[str]
    rows:    list[list]


class WhatIfRequest(BaseModel):
    table_id: str
    scenario: str


class WhatIfResponse(BaseModel):
    sql:       str
    narrative: str
    columns:   list[str]
    rows:      list[list]
    row_count: int


@router.post("/lab/synthetic", response_model=SyntheticResponse)
def generate_synthetic(req: SyntheticRequest):
    if not table_exists(req.table_id):
        raise HTTPException(status_code=404, detail="Table not found. Please re-upload your file.")
    if req.n_rows < 1 or req.n_rows > 10_000:
        raise HTTPException(status_code=400, detail="n_rows must be between 1 and 10,000.")

    df         = _tables[req.table_id]
    synthetic  = synthesize(df, req.n_rows)
    columns    = synthetic.columns.tolist()
    rows       = [[r[c] for c in columns] for _, r in synthetic.iterrows()]
    return SyntheticResponse(columns=columns, rows=rows)


@router.post("/lab/whatif", response_model=WhatIfResponse)
def run_whatif(req: WhatIfRequest):
    if not req.scenario.strip():
        raise HTTPException(status_code=400, detail="Scenario cannot be empty.")
    if not table_exists(req.table_id):
        raise HTTPException(status_code=404, detail="Table not found. Please re-upload your file.")

    df         = _tables[req.table_id]
    table_name = f"t_{req.table_id.replace('-', '_')}"
    cols_str   = "\n".join(f"  - {c['name']} ({c['type']})" for c in infer_schema(df))
    samples    = "\n".join(f"  {r}" for r in sample_rows(df, 3))

    prompt = _WHATIF_PROMPT.format(
        table_name=table_name,
        cols=cols_str,
        samples=samples,
        scenario=req.scenario,
    )

    message = _client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    if "```" in raw:
        parts = raw.split("```")
        raw = parts[1].lstrip("json").strip() if len(parts) > 1 else raw

    try:
        parsed    = json.loads(raw)
        sql       = parsed.get("sql", "").strip()
        narrative = parsed.get("narrative", "")
        if not sql:
            raise ValueError("Empty SQL")
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=f"Could not parse Claude response: {e}")

    try:
        columns, rows = execute_query(sql)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Generated SQL failed: {e}")

    return WhatIfResponse(
        sql=sql,
        narrative=narrative,
        columns=columns,
        rows=rows,
        row_count=len(rows),
    )
