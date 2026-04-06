import re
import threading
from typing import Any

import duckdb
import pandas as pd

_conn = duckdb.connect(":memory:")
_lock = threading.Lock()
_tables: dict[str, pd.DataFrame] = {}

_FORBIDDEN = re.compile(
    r"\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|EXEC|EXECUTE|TRUNCATE|COPY|ATTACH|DETACH|PRAGMA|VACUUM)\b",
    re.IGNORECASE,
)


def register_table(table_id: str, df: pd.DataFrame) -> str:
    """Register a DataFrame in DuckDB. Returns the table name used."""
    safe_id = table_id.replace("-", "_")
    table_name = f"t_{safe_id}"
    with _lock:
        _tables[table_id] = df
        _conn.register(table_name, df)
    return table_name


_MAX_ROWS = 1000


def execute_query(sql: str) -> tuple[list[str], list[list[Any]]]:
    """Execute a sandboxed SELECT query. Raises ValueError for unsafe queries."""
    stripped = sql.strip()

    if not re.match(r"^\s*SELECT\b", stripped, re.IGNORECASE):
        raise ValueError("Only SELECT queries are permitted.")

    if _FORBIDDEN.search(stripped):
        raise ValueError("Query contains a forbidden keyword.")

    # Wrap in a subquery to enforce row cap without modifying the original SQL
    limited_sql = f"SELECT * FROM ({stripped.rstrip(';')}) AS _q LIMIT {_MAX_ROWS}"

    with _lock:
        result_df = _conn.execute(limited_sql).fetchdf()

    # Make values JSON-serializable
    for col in result_df.columns:
        if result_df[col].dtype.kind == "M":
            result_df[col] = result_df[col].astype(str)

    columns = list(result_df.columns)
    rows = result_df.values.tolist()
    return columns, rows


def table_exists(table_id: str) -> bool:
    return table_id in _tables
