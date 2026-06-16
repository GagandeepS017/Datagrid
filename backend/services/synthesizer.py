import math

import numpy as np
import pandas as pd

from services.schema import infer_schema


# ── Independent (per-column) sampling ─────────────────────────────────────────

def synthesize_independent(df: pd.DataFrame, n: int) -> pd.DataFrame:
    """Generate n synthetic rows by sampling each column INDEPENDENTLY.

    Preserves every column's marginal distribution but NOT the relationships
    between columns (all inter-column correlations collapse to ~0). Fast, no
    heavy dependencies. Kept as a baseline/fallback for the copula method.
    """
    if n < 1 or n > 10_000:
        raise ValueError("n must be between 1 and 10,000")

    schema = infer_schema(df)
    rng = np.random.default_rng()
    result = {}

    for col_info in schema:
        name  = col_info["name"]
        type_ = col_info["type"]
        col   = df[name].dropna()

        if len(col) == 0:
            result[name] = [None] * n
            continue

        if type_ == "numeric":
            lo, hi = float(col.min()), float(col.max())
            mean   = float(col.mean())
            std    = float(col.std()) or 1.0
            vals   = rng.normal(mean, std, n)
            vals   = np.clip(vals, lo, hi)
            if pd.api.types.is_integer_dtype(df[name]):
                vals = np.round(vals).astype(int)
            result[name] = vals.tolist()

        elif type_ == "boolean":
            rate = float(col.mean())
            result[name] = rng.binomial(1, rate, n).astype(bool).tolist()

        elif type_ == "datetime":
            ts_min = col.min().timestamp()
            ts_max = col.max().timestamp()
            spans  = rng.random(n) * (ts_max - ts_min) + ts_min
            result[name] = [pd.Timestamp(s, unit="s").isoformat() for s in spans]

        else:  # text / categorical
            freqs = col.value_counts(normalize=True)
            result[name] = rng.choice(freqs.index.tolist(), size=n, p=freqs.values.tolist()).tolist()

    return pd.DataFrame(result)


# Backwards-compatible alias (was the original public name).
synthesize = synthesize_independent


# ── Gaussian Copula sampling (SDV) ────────────────────────────────────────────

def _build_metadata(df: pd.DataFrame):
    """Detect SDV metadata, down-typing any auto-detected 'id' columns to
    categorical so high-cardinality/unique columns don't break sampling."""
    try:
        from sdv.metadata import SingleTableMetadata
        md = SingleTableMetadata()
        md.detect_from_dataframe(df)
    except ImportError:  # very new SDV that dropped SingleTableMetadata
        from sdv.metadata import Metadata
        md = Metadata.detect_from_dataframe(df)

    # Re-type id columns: GaussianCopula enforces uniqueness on 'id' sdtype,
    # which fails when sampling more rows than the column's value space allows.
    columns = getattr(md, "columns", {}) or {}
    for col_name, spec in list(columns.items()):
        sdtype = spec.get("sdtype") if isinstance(spec, dict) else None
        if sdtype == "id":
            try:
                md.update_column(column_name=col_name, sdtype="categorical")
            except Exception:
                pass
    return md


def synthesize_copula(df: pd.DataFrame, n: int) -> pd.DataFrame:
    """Generate n synthetic rows with SDV's GaussianCopulaSynthesizer.

    Fits a Gaussian copula over the source DataFrame — preserving each column's
    marginal AND the joint correlation structure between columns. Raises on any
    failure (missing dependency, unmodelable column, fit error); the caller is
    expected to fall back to synthesize_independent.
    """
    if n < 1 or n > 10_000:
        raise ValueError("n must be between 1 and 10,000")

    from sdv.single_table import GaussianCopulaSynthesizer

    metadata  = _build_metadata(df)
    synth     = GaussianCopulaSynthesizer(metadata)
    synth.fit(df)
    return synth.sample(num_rows=n)


# ── Quality metric ────────────────────────────────────────────────────────────

def correlation_fidelity(original: pd.DataFrame, synthetic: pd.DataFrame) -> dict | None:
    """Compare the Pearson correlation matrices of the original vs synthetic data.

    Returns the mean absolute difference of the off-diagonal correlations
    (corr_mae, lower is better) plus a 0..1 similarity convenience score.
    None if there are fewer than 2 shared numeric columns to correlate.
    """
    num_cols = original.select_dtypes(include=[np.number]).columns
    common   = [c for c in num_cols if c in synthetic.columns]
    if len(common) < 2:
        return None

    orig = original[common].apply(pd.to_numeric, errors="coerce")
    synth = synthetic[common].apply(pd.to_numeric, errors="coerce")

    corr_o = orig.corr()
    corr_s = synth.corr().reindex(index=corr_o.index, columns=corr_o.columns)

    diff = (corr_o - corr_s).abs().to_numpy()
    off_diag = ~np.eye(len(common), dtype=bool)
    vals = diff[off_diag]
    vals = vals[~np.isnan(vals)]
    if vals.size == 0:
        return None

    mae = float(vals.mean())
    return {
        "corr_mae":        round(mae, 4),
        "corr_similarity": round(max(0.0, 1.0 - mae), 4),
        "n_numeric_cols":  len(common),
    }


# ── Serialization helper ──────────────────────────────────────────────────────

def to_jsonable_rows(df: pd.DataFrame) -> tuple[list[str], list[list]]:
    """Convert a DataFrame to (columns, rows) with JSON-safe Python scalars.

    Handles numpy scalars, pandas Timestamps, and NaN/NaT -> None so both the
    independent and copula outputs serialize cleanly through FastAPI.
    """
    safe = df.copy()
    for col in safe.columns:
        if pd.api.types.is_datetime64_any_dtype(safe[col]):
            safe[col] = safe[col].apply(lambda v: v.isoformat() if pd.notnull(v) else None)

    rows: list[list] = []
    for record in safe.itertuples(index=False, name=None):
        row = []
        for v in record:
            if v is None:
                row.append(None)
            elif isinstance(v, float) and math.isnan(v):
                row.append(None)
            elif isinstance(v, pd.Timestamp):
                row.append(v.isoformat() if pd.notnull(v) else None)
            elif hasattr(v, "item"):       # numpy scalar -> python native
                row.append(v.item())
            else:
                row.append(v)
        rows.append(row)
    return list(safe.columns), rows
