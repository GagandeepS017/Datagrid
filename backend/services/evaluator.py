"""Text-to-SQL evaluation harness.

Wraps the production pipeline (generate_sql + execute_query) and scores it
against a labeled benchmark. The primary metric is execution accuracy: whether
the predicted query and the gold query return the same result set, not whether
the SQL strings match. Each run is logged to a local MLflow file store.
"""

import json
import math
import os
import time
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from services.claude_client import generate_sql
from services.ingestion import parse_csv
from services.schema import infer_schema, sample_rows
from services.sql_engine import execute_query, register_temp_table, unregister_table

try:
    import mlflow
except ImportError:
    mlflow = None

_BACKEND_DIR    = Path(__file__).parent.parent
_SAMPLES_DIR    = _BACKEND_DIR / "data" / "samples"
_BENCHMARK_DIR  = _BACKEND_DIR / "data" / "benchmarks"
_EVAL_RUNS_DIR  = _BACKEND_DIR / "data" / "eval_runs"
_MLRUNS_DIR     = _BACKEND_DIR / "mlruns"
_DEFAULT_BENCH  = "nl2sql_benchmark.json"

_EVAL_RUNS_DIR.mkdir(parents=True, exist_ok=True)

# Mirrors the retry loop in routers/query.py.
_MAX_ATTEMPTS = 2
_SQL_MODEL    = "claude-sonnet-4-6"

# Approximate Sonnet pricing per 1M tokens, used for a rough cost estimate only.
_USD_PER_INPUT_MTOK  = 3.0
_USD_PER_OUTPUT_MTOK = 15.0
_CHARS_PER_TOKEN     = 4.0
_PROMPT_OVERHEAD_TOK = 320

# Numeric cells are matched with an absolute tolerance so AVG(x) and
# ROUND(AVG(x), 2) count as equal while genuinely wrong values still fail.
_NUMERIC_EPS = 0.01


def _canon_cell(v: Any):
    if v is None:
        return None
    if isinstance(v, bool):
        return ("b", v)
    if isinstance(v, (int, float)):
        if isinstance(v, float) and math.isnan(v):
            return None
        return ("n", float(v))
    return ("s", str(v).strip())


def _split_row(row: list[Any]):
    """Split a row into sorted numeric values and sorted exact-match keys.

    Cells are sorted within the row so column order does not affect comparison.
    """
    nums: list[float] = []
    exact: list = []
    for c in row:
        cc = _canon_cell(c)
        if isinstance(cc, tuple) and cc[0] == "n":
            nums.append(cc[1])
        else:
            exact.append(cc)
    return sorted(nums), sorted(exact, key=lambda x: str(x))


def _rows_close(r1: list, r2: list, eps: float) -> bool:
    n1, e1 = _split_row(r1)
    n2, e2 = _split_row(r2)
    if e1 != e2 or len(n1) != len(n2):
        return False
    return all(abs(a - b) <= eps + 1e-9 for a, b in zip(n1, n2))


def results_match(pred_rows: list[list], gold_rows: list[list], eps: float = _NUMERIC_EPS) -> bool:
    """Order-insensitive, duplicate-aware result-set equality with numeric tolerance."""
    if len(pred_rows) != len(gold_rows):
        return False
    remaining = list(gold_rows)
    for pr in pred_rows:
        for i, gr in enumerate(remaining):
            if _rows_close(pr, gr, eps):
                remaining.pop(i)
                break
        else:
            return False
    return not remaining


def _estimate_cost(question: str, schema: dict, predicted_sql: str, attempts: int) -> float:
    schema_chars = len(json.dumps(schema, default=str))
    in_tok  = _PROMPT_OVERHEAD_TOK + (len(question) + schema_chars) / _CHARS_PER_TOKEN
    out_tok = (len(predicted_sql) + 40) / _CHARS_PER_TOKEN
    in_tok  *= max(attempts, 1)
    out_tok *= max(attempts, 1)
    return (in_tok / 1e6) * _USD_PER_INPUT_MTOK + (out_tok / 1e6) * _USD_PER_OUTPUT_MTOK


def _build_schema_context(table_id: str, df: pd.DataFrame) -> dict:
    return {
        "table_name":  f"t_{table_id.replace('-', '_')}",
        "columns":     infer_schema(df),
        "sample_rows": sample_rows(df),
    }


def _load_datasets(dataset_files: dict[str, str]) -> dict[str, dict]:
    """Register each benchmark dataset once. Returns name -> {table_id, table_name, df}."""
    registered: dict[str, dict] = {}
    for logical_name, filename in dataset_files.items():
        path = _SAMPLES_DIR / filename
        if not path.exists():
            raise FileNotFoundError(f"Benchmark dataset file missing: {filename}")
        df         = parse_csv(path.read_bytes())
        table_id   = f"eval_{uuid.uuid4().hex[:12]}"
        table_name = register_temp_table(table_id, df)
        registered[logical_name] = {"table_id": table_id, "table_name": table_name, "df": df}
    return registered


def _evaluate_item(item: dict, ctx: dict) -> dict:
    table_name = ctx["table_name"]
    schema     = _build_schema_context(ctx["table_id"], ctx["df"])

    result = {
        "id":            item["id"],
        "dataset":       item["dataset"],
        "difficulty":    item.get("difficulty", "unknown"),
        "question":      item["question"],
        "gold_sql":      item["gold_sql"].replace("{table}", table_name),
        "predicted_sql": None,
        "attempts":      0,
        "retry_fired":   False,
        "latency_s":     0.0,
        "correct":       False,
        "category":      None,
        "pred_row_count": None,
        "gold_row_count": None,
        "error":         None,
        "est_cost_usd":  0.0,
    }

    start          = time.perf_counter()
    error_feedback = None
    pred_rows      = None
    predicted_sql  = None
    gen_error      = None
    exec_error     = None

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        result["attempts"] = attempt
        try:
            gen           = generate_sql(item["question"], schema, error_feedback=error_feedback)
            predicted_sql = gen["sql"]
        except Exception as exc:
            gen_error      = str(exc)
            error_feedback = gen_error
            continue
        try:
            _, pred_rows = execute_query(predicted_sql)
            exec_error   = None
            break
        except Exception as exc:
            exec_error     = str(exc)
            error_feedback = exec_error

    result["latency_s"]     = round(time.perf_counter() - start, 3)
    result["predicted_sql"] = predicted_sql
    result["retry_fired"]   = result["attempts"] > 1
    result["est_cost_usd"]  = round(_estimate_cost(item["question"], schema, predicted_sql or "", result["attempts"]), 6)

    try:
        _, gold_rows = execute_query(result["gold_sql"])
        result["gold_row_count"] = len(gold_rows)
    except Exception as exc:
        result["category"] = "gold_failed"
        result["error"]    = f"gold SQL failed: {exc}"
        return result

    if pred_rows is None:
        if predicted_sql is None and gen_error:
            result["category"] = "exception"
            result["error"]    = gen_error
        else:
            result["category"] = "syntax_error"
            result["error"]    = exec_error
        return result

    result["pred_row_count"] = len(pred_rows)

    if results_match(pred_rows, gold_rows):
        result["correct"]  = True
        result["category"] = None
    elif len(pred_rows) == 0 and len(gold_rows) > 0:
        result["category"] = "empty_result"
    else:
        result["category"] = "wrong_result"

    return result


def _aggregate(items: list[dict]) -> dict:
    n = len(items)
    scorable = [r for r in items if r["category"] != "gold_failed"]
    n_scorable = len(scorable) or 1
    n_correct  = sum(1 for r in scorable if r["correct"])
    cats: Counter = Counter(r["category"] or "correct" for r in items)
    by_diff: dict[str, dict] = {}
    for r in scorable:
        d = by_diff.setdefault(r["difficulty"], {"total": 0, "correct": 0})
        d["total"]   += 1
        d["correct"] += int(r["correct"])
    for d in by_diff.values():
        d["accuracy"] = round(d["correct"] / d["total"], 4) if d["total"] else 0.0

    return {
        "n_items":            n,
        "n_scored":           len(scorable),
        "n_correct":          n_correct,
        "execution_accuracy": round(n_correct / n_scorable, 4),
        "mean_latency_s":     round(sum(r["latency_s"] for r in items) / (n or 1), 3),
        "retry_rate":         round(sum(1 for r in items if r["retry_fired"]) / (n or 1), 4),
        "total_cost_usd":     round(sum(r["est_cost_usd"] for r in items), 6),
        "failure_breakdown":  dict(cats),
        "accuracy_by_difficulty": by_diff,
    }


def _log_to_mlflow(run: dict) -> str | None:
    if mlflow is None:
        return None
    try:
        # MLflow 3+ requires this opt-in to use the local file store.
        os.environ.setdefault("MLFLOW_ALLOW_FILE_STORE", "true")
        mlflow.set_tracking_uri(f"file:{_MLRUNS_DIR.as_posix()}")
        mlflow.set_experiment("datagrid-nl2sql")
        agg = run["aggregate"]
        with mlflow.start_run(run_name=run["run_id"]) as active:
            mlflow.log_params({
                "model_sql":     _SQL_MODEL,
                "benchmark":     run["benchmark"],
                "n_items":       agg["n_items"],
                "max_attempts":  _MAX_ATTEMPTS,
            })
            mlflow.log_metrics({
                "execution_accuracy": agg["execution_accuracy"],
                "mean_latency_s":     agg["mean_latency_s"],
                "retry_rate":         agg["retry_rate"],
                "total_cost_usd":     agg["total_cost_usd"],
                "n_correct":          agg["n_correct"],
            })
            for diff, d in agg["accuracy_by_difficulty"].items():
                mlflow.log_metric(f"accuracy_{diff}", d["accuracy"])
            mlflow.log_dict(run, "eval_run.json")
            return active.info.run_id
    except Exception as exc:
        run.setdefault("warnings", []).append(f"MLflow logging failed: {exc}")
        return None


def run_benchmark(benchmark_file: str = _DEFAULT_BENCH) -> dict:
    """Run the full benchmark, persist and log the run, and return the result."""
    bench_path = _BENCHMARK_DIR / benchmark_file
    if not bench_path.exists():
        raise FileNotFoundError(f"Benchmark not found: {benchmark_file}")

    benchmark = json.loads(bench_path.read_text(encoding="utf-8"))
    items     = benchmark["items"]
    datasets  = benchmark["datasets"]

    registered = _load_datasets(datasets)
    try:
        per_item = [_evaluate_item(it, registered[it["dataset"]]) for it in items]
    finally:
        for ctx in registered.values():
            unregister_table(ctx["table_id"])

    timestamp = datetime.now(timezone.utc)
    run = {
        "run_id":     timestamp.strftime("run_%Y%m%d_%H%M%S"),
        "timestamp":  timestamp.isoformat(),
        "benchmark":  benchmark.get("name", benchmark_file),
        "model_sql":  _SQL_MODEL,
        "aggregate":  _aggregate(per_item),
        "items":      per_item,
    }

    mlflow_run_id = _log_to_mlflow(run)
    if mlflow_run_id:
        run["mlflow_run_id"] = mlflow_run_id

    out_path = _EVAL_RUNS_DIR / f"{run['run_id']}.json"
    out_path.write_text(json.dumps(run, indent=2, default=str), encoding="utf-8")
    run["saved_to"] = out_path.name

    return run


def latest_run() -> dict | None:
    """Return the most recent saved eval run, or None if there are none."""
    runs = sorted(_EVAL_RUNS_DIR.glob("run_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not runs:
        return None
    return json.loads(runs[0].read_text(encoding="utf-8"))
