import pandas as pd
from typing import Any


def infer_schema(df: pd.DataFrame) -> list[dict]:
    """Infer column names and semantic types from a DataFrame."""
    columns = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        if "int" in dtype or "float" in dtype:
            col_type = "numeric"
        elif "datetime" in dtype:
            col_type = "datetime"
        elif "bool" in dtype:
            col_type = "boolean"
        else:
            col_type = "text"
        columns.append({"name": col, "type": col_type, "dtype": dtype})
    return columns


def sample_rows(df: pd.DataFrame, n: int = 3) -> list[dict[str, Any]]:
    """Return the first n rows as a list of dicts, JSON-safe."""
    sample = df.head(n).copy()
    # Convert non-serializable types to strings
    for col in sample.columns:
        if sample[col].dtype.kind in ("M",):  # datetime
            sample[col] = sample[col].astype(str)
    return sample.to_dict(orient="records")
