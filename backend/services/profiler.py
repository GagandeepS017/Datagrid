import json
import os
import numpy as np
import pandas as pd
from scipy import stats as scipy_stats
import anthropic

_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

# ── Cramér's V ────────────────────────────────────────────────────────────────

def _cramers_v(x: pd.Series, y: pd.Series) -> float:
    confusion = pd.crosstab(x.astype(str), y.astype(str))
    chi2 = scipy_stats.chi2_contingency(confusion, correction=False)[0]
    n = int(confusion.values.sum())
    r, k = confusion.shape
    denom = n * (min(r, k) - 1)
    return float(np.sqrt(chi2 / denom)) if denom > 0 else 0.0


# ── Claude insights ───────────────────────────────────────────────────────────

_INSIGHTS_PROMPT = """\
You are a senior data analyst reviewing an automated data quality profile.

Dataset: {rows} rows × {columns} columns
Overall null rate: {null_rate_pct}%
Outliers flagged: {outliers_flagged}

Flagged columns (abnormal only):
{flagged_summary}

Strong correlations (|r| > 0.75):
{correlation_summary}

Return ONLY this JSON object — no markdown, no explanation:
{{
  "excellences": ["<what the data does well>", "<another strength>"],
  "major_issues": ["<most critical data quality problem>", "<second problem>"],
  "fixes": ["<one actionable plain-English fix for issue 1>", "<fix for issue 2>"]
}}

Rules:
- excellences: 2–3 items. Be specific — mention column names or concrete properties.
- major_issues: 2–3 items. Most critical problems first. Be concrete, name columns.
- fixes: exactly one fix per major_issue entry, in the same order. Plain English, no SQL.
- If there are no issues, return major_issues and fixes as empty arrays.
- If there are no strong columns, acknowledge the data is clean in excellences."""


def _claude_insights(summary: dict, abnormal: list, correlations: list) -> dict:
    flagged = "\n".join(
        f"  - {c['name']}: {c['issue']}" for c in abnormal
    ) or "  None — all columns look clean."

    corr = "\n".join(
        f"  - {c['col_a']} ↔ {c['col_b']}: {c['correlation']} ({c['method']})"
        for c in correlations
    ) or "  None above threshold."

    prompt = _INSIGHTS_PROMPT.format(
        rows=summary["rows"],
        columns=summary["columns"],
        null_rate_pct=summary["null_rate_pct"],
        outliers_flagged=summary["outliers_flagged"],
        flagged_summary=flagged,
        correlation_summary=corr,
    )

    message = _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()

    # Strip markdown fences if present
    if "```" in raw:
        parts = raw.split("```")
        raw = parts[1].lstrip("json").strip() if len(parts) > 1 else raw

    try:
        result = json.loads(raw)
        return {
            "excellences": result.get("excellences", []),
            "major_issues": result.get("major_issues", []),
            "fixes":        result.get("fixes", []),
        }
    except json.JSONDecodeError:
        return {"excellences": [], "major_issues": [raw], "fixes": []}


# ── Main entry point ──────────────────────────────────────────────────────────

def profile_dataframe(df: pd.DataFrame) -> dict:
    from services.schema import infer_schema

    schema    = infer_schema(df)
    col_types = {c["name"]: c["type"] for c in schema}

    # ── Dataset-level ─────────────────────────────────────────────────────────
    total_cells = df.size
    total_nulls = int(df.isnull().sum().sum())
    null_rate   = round(total_nulls / total_cells * 100, 2) if total_cells > 0 else 0.0

    # ── Per-column — only flag abnormal ──────────────────────────────────────
    abnormal    = []
    total_flags = 0

    for col_info in schema:
        name     = col_info["name"]
        col      = df[name]
        col_type = col_info["type"]

        null_count   = int(col.isna().sum())
        col_null_pct = round(null_count / len(col) * 100, 2) if len(col) > 0 else 0.0

        issues        = []
        outlier_count = 0

        if col_type == "numeric":
            valid = col.dropna()
            n     = len(valid)

            # IQR outliers
            if n >= 4:
                q1, q3 = float(valid.quantile(0.25)), float(valid.quantile(0.75))
                iqr    = q3 - q1
                if iqr > 0:
                    mask          = (col < q1 - 1.5 * iqr) | (col > q3 + 1.5 * iqr)
                    outlier_count = int(mask.sum())
                    if outlier_count:
                        total_flags += outlier_count
                        issues.append(f"{outlier_count} outlier{'s' if outlier_count != 1 else ''} (IQR)")

            # Distribution shape — only severe flags
            if n >= 8:
                skew = float(scipy_stats.skew(valid))
                kurt = float(scipy_stats.kurtosis(valid))
                if abs(skew) > 2:
                    issues.append("heavily skewed")
                elif kurt > 5:
                    issues.append("heavy-tailed")

        # High null rate
        if col_null_pct > 5:
            issues.append(f"{col_null_pct}% null")

        if issues:
            # Compute histogram only for flagged columns
            histogram = None
            if col_type == "numeric":
                valid = col.dropna()
                if len(valid) > 0:
                    counts, edges = np.histogram(valid, bins=min(10, len(valid)))
                    histogram = {
                        "counts":    counts.tolist(),
                        "bin_edges": [round(float(e), 4) for e in edges],
                    }
            else:
                top = col.dropna().value_counts().head(10)
                histogram = {
                    "counts":    top.values.tolist(),
                    "bin_edges": [str(v)[:14] for v in top.index.tolist()],
                }

            abnormal.append({
                "name":          name,
                "issue":         ", ".join(issues),
                "outlier_count": outlier_count,
                "null_rate_pct": col_null_pct,
                "histogram":     histogram,
            })

    # ── Correlations ─────────────────────────────────────────────────────────
    numeric_cols = [n for n, t in col_types.items() if t == "numeric"]
    cat_cols     = [n for n, t in col_types.items() if t != "numeric"]
    strong_corr  = []

    # Full Pearson matrix for the heatmap
    if len(numeric_cols) >= 2:
        raw_mat = df[numeric_cols].corr(method="pearson").round(3)
        corr_matrix = {
            "columns": numeric_cols,
            "matrix": [
                [None if (isinstance(v, float) and np.isnan(v)) else round(float(v), 3)
                 for v in row]
                for row in raw_mat.values.tolist()
            ],
        }
        # Strong pairs (|r| > 0.75) — kept for Claude insights prompt
        for i, c1 in enumerate(numeric_cols):
            for j, c2 in enumerate(numeric_cols):
                if j <= i:
                    continue
                val = raw_mat.loc[c1, c2]
                if val is not None and not (isinstance(val, float) and np.isnan(val)) and abs(val) > 0.75:
                    strong_corr.append({
                        "col_a": c1, "col_b": c2,
                        "correlation": round(float(val), 3), "method": "pearson",
                    })
    else:
        corr_matrix = {"columns": numeric_cols, "matrix": []}

    if len(cat_cols) >= 2:
        for i, c1 in enumerate(cat_cols):
            for j, c2 in enumerate(cat_cols):
                if j <= i:
                    continue
                try:
                    v = _cramers_v(df[c1], df[c2])
                    if v > 0.75:
                        strong_corr.append({
                            "col_a": c1, "col_b": c2,
                            "correlation": round(v, 3), "method": "cramers_v",
                        })
                except Exception:
                    pass

    # ── Missing value matrix (first 100 rows) ─────────────────────────────────
    sample  = df.head(100)
    missing = {
        "columns": list(sample.columns),
        "rows":    sample.isnull().values.tolist(),
    }

    summary = {
        "rows":             len(df),
        "columns":          len(df.columns),
        "null_rate_pct":    null_rate,
        "outliers_flagged": total_flags,
    }

    insights = _claude_insights(summary, abnormal, strong_corr)

    return {
        "summary":              summary,
        "abnormal_columns":     abnormal,
        "strong_correlations":  strong_corr,
        "correlation_matrix":   corr_matrix,
        "missing_value_matrix": missing,
        "insights":             insights,
    }
