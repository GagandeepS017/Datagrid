import numpy as np
import pandas as pd

from services.schema import infer_schema


def synthesize(df: pd.DataFrame, n: int) -> pd.DataFrame:
    """Generate n synthetic rows that mirror the statistical profile of df."""
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
