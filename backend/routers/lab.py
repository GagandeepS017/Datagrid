import json
import os
import uuid

import anthropic
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.schema import infer_schema, sample_rows
from services.sql_engine import execute_query, register_table, table_exists, _tables
from services.synthesizer import (
    correlation_fidelity,
    synthesize_copula,
    synthesize_independent,
    to_jsonable_rows,
)

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

Return ONLY this JSON, no markdown, no explanation:
{{
  "sql": "<SELECT query applying the transformation, keep all original columns, transform as needed>",
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
    method:   str = "copula"   # "copula" (correlation-preserving) | "independent"


class SyntheticResponse(BaseModel):
    columns:  list[str]
    rows:     list[list]
    method:   str                       # method actually used (may differ if fallback)
    fidelity: dict | None = None        # correlation-fidelity score vs original
    note:     str | None = None         # populated when copula fell back to independent


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
    if req.method not in ("copula", "independent"):
        raise HTTPException(status_code=400, detail="method must be 'copula' or 'independent'.")

    df   = _tables[req.table_id]
    note = None

    if req.method == "copula":
        try:
            synthetic   = synthesize_copula(df, req.n_rows)
            used_method = "copula"
        except Exception as exc:
            # Graceful fallback: missing dep, unmodelable column, or fit failure.
            synthetic   = synthesize_independent(df, req.n_rows)
            used_method = "independent"
            note        = f"Copula synthesis unavailable ({exc}); fell back to independent sampling."
    else:
        synthetic   = synthesize_independent(df, req.n_rows)
        used_method = "independent"

    columns, rows = to_jsonable_rows(synthetic)
    fidelity      = correlation_fidelity(df, synthetic)

    return SyntheticResponse(
        columns=columns,
        rows=rows,
        method=used_method,
        fidelity=fidelity,
        note=note,
    )


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


class ApplyWhatIfRequest(BaseModel):
    table_id: str
    sql:      str


class AppendSyntheticRequest(BaseModel):
    table_id: str
    columns:  list[str]
    rows:     list[list]


def _apply_response(df: pd.DataFrame, filename: str) -> dict:
    new_id     = str(uuid.uuid4())
    table_name = register_table(new_id, df, filename=filename)
    return {
        "table_id":    new_id,
        "table_name":  table_name,
        "row_count":   len(df),
        "columns":     infer_schema(df),
        "sample_rows": sample_rows(df),
    }


@router.post("/lab/whatif/apply")
def apply_whatif(req: ApplyWhatIfRequest):
    if not table_exists(req.table_id):
        raise HTTPException(status_code=404, detail="Table not found.")
    try:
        columns, rows = execute_query(req.sql)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"SQL execution failed: {e}")
    df = pd.DataFrame(rows, columns=columns)
    return _apply_response(df, filename=f"whatif_{req.table_id[:8]}.csv")


@router.post("/lab/synthetic/append")
def append_synthetic(req: AppendSyntheticRequest):
    if not table_exists(req.table_id):
        raise HTTPException(status_code=404, detail="Table not found.")
    original_df = _tables[req.table_id]
    synth_df    = pd.DataFrame(req.rows, columns=req.columns)
    combined_df = pd.concat([original_df, synth_df], ignore_index=True)
    return _apply_response(combined_df, filename=f"appended_{req.table_id[:8]}.csv")
