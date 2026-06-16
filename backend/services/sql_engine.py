import json
import pickle
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import duckdb
import pandas as pd

_DATA_DIR    = Path(__file__).parent.parent / "data" / "uploads"
_REGISTRY    = _DATA_DIR.parent / "registry.json"
_DATA_DIR.mkdir(parents=True, exist_ok=True)

_conn  = duckdb.connect(":memory:")
_lock  = threading.Lock()
_tables: dict[str, pd.DataFrame] = {}

_FORBIDDEN = re.compile(
    r"\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|EXEC|EXECUTE|TRUNCATE|COPY|ATTACH|DETACH|PRAGMA|VACUUM)\b",
    re.IGNORECASE,
)

# ── Registry helpers ──────────────────────────────────────────────────────────

def _load_registry() -> dict:
    if _REGISTRY.exists():
        try:
            return json.loads(_REGISTRY.read_text())
        except Exception:
            pass
    return {"tables": {}}


def _save_registry(reg: dict) -> None:
    _REGISTRY.write_text(json.dumps(reg, indent=2))


# ── Startup: restore persisted tables ────────────────────────────────────────

def _restore_tables() -> None:
    reg = _load_registry()
    stale = []
    for table_id, meta in reg.get("tables", {}).items():
        path = _DATA_DIR / f"{table_id}.pkl"
        if not path.exists():
            stale.append(table_id)
            continue
        try:
            with open(path, "rb") as fh:
                df = pickle.load(fh)
            table_name = f"t_{table_id.replace('-', '_')}"
            _conn.register(table_name, df)
            _tables[table_id] = df
        except Exception:
            stale.append(table_id)
    if stale:
        for tid in stale:
            reg["tables"].pop(tid, None)
        _save_registry(reg)


_restore_tables()


# ── Public API ────────────────────────────────────────────────────────────────

def register_table(table_id: str, df: pd.DataFrame, filename: str = "") -> str:
    safe_id    = table_id.replace("-", "_")
    table_name = f"t_{safe_id}"

    with _lock:
        _tables[table_id] = df
        _conn.register(table_name, df)

        # Persist to disk
        pkl_path = _DATA_DIR / f"{table_id}.pkl"
        with open(pkl_path, "wb") as fh:
            pickle.dump(df, fh)

        reg = _load_registry()
        reg["tables"][table_id] = {
            "table_id":    table_id,
            "table_name":  table_name,
            "filename":    filename or table_id,
            "row_count":   len(df),
            "columns":     [{"name": c["name"], "type": c["type"]} for c in _schema_lite(df)],
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
        _save_registry(reg)

    return table_name


def table_exists(table_id: str) -> bool:
    return table_id in _tables


def list_tables() -> list[dict]:
    reg = _load_registry()
    return list(reg.get("tables", {}).values())


def delete_table(table_id: str) -> None:
    with _lock:
        if table_id in _tables:
            table_name = f"t_{table_id.replace('-', '_')}"
            try:
                _conn.execute(f"DROP VIEW IF EXISTS {table_name}")
            except Exception:
                pass
            del _tables[table_id]

        pkl_path = _DATA_DIR / f"{table_id}.pkl"
        if pkl_path.exists():
            pkl_path.unlink()

        reg = _load_registry()
        reg["tables"].pop(table_id, None)
        _save_registry(reg)


_MAX_ROWS = 1000


def execute_query(sql: str) -> tuple[list[str], list[list[Any]]]:
    stripped = sql.strip()
    if not re.match(r"^\s*SELECT\b", stripped, re.IGNORECASE):
        raise ValueError("Only SELECT queries are permitted.")
    if _FORBIDDEN.search(stripped):
        raise ValueError("Query contains a forbidden keyword.")

    limited_sql = f"SELECT * FROM ({stripped.rstrip(';')}) AS _q LIMIT {_MAX_ROWS}"
    with _lock:
        result_df = _conn.execute(limited_sql).fetchdf()

    for col in result_df.columns:
        if result_df[col].dtype.kind == "M":
            result_df[col] = result_df[col].astype(str)

    return list(result_df.columns), result_df.values.tolist()


# ── Internal ──────────────────────────────────────────────────────────────────

def _schema_lite(df: pd.DataFrame) -> list[dict]:
    from services.schema import infer_schema
    return infer_schema(df)
