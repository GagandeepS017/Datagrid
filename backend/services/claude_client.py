import json
import os
import anthropic

_api_key = os.environ.get("ANTHROPIC_API_KEY")
if not _api_key:
    raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set. Copy .env.example to .env and add your key.")

_client = anthropic.Anthropic(api_key=_api_key)


def _build_prompt(question: str, schema: dict, error_feedback: str | None = None) -> str:
    table_name = schema["table_name"]
    cols = "\n".join(f"  - {c['name']} ({c['type']})" for c in schema["columns"])
    samples = "\n".join(f"  {r}" for r in schema["sample_rows"][:3])

    prompt = f"""You are a SQL expert. Generate a DuckDB SQL query for the question below and suggest a chart if appropriate.

Table name: {table_name}
Columns:
{cols}

Sample rows:
{samples}

Return ONLY this JSON object — no markdown, no explanation:
{{
  "sql": "<the SELECT query>",
  "chart": {{"type": "bar"|"line"|"pie", "x": "<col>", "y": "<col>"}} or null
}}

SQL rules:
- Use only SELECT statements
- The table name must be exactly: {table_name}

Chart rules:
- "bar": grouping/counting/summing by a categorical column (x = category, y = numeric)
- "line": x-axis is a date, time, or sequential number
- "pie": proportions or share — only when result will have ≤ 10 rows
- null: raw data dumps, multi-column results, or anything that doesn't suit a chart

Question: {question}"""

    if error_feedback:
        prompt += f"\n\nYour previous SQL failed with: {error_feedback}\nFix the SQL and return the same JSON format."

    return prompt


def generate_sql(question: str, schema: dict, error_feedback: str | None = None) -> dict:
    """Return {sql: str, chart: dict|None} for the given question."""
    prompt = _build_prompt(question, schema, error_feedback)
    message = _client.messages.create(
        model="claude-sonnet-4-6",
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
        sql = result.get("sql", "").strip()
        chart = result.get("chart")
        if not sql:
            raise ValueError("Empty SQL in response")
        return {"sql": sql, "chart": chart}
    except (json.JSONDecodeError, ValueError):
        # Fallback: treat whole response as raw SQL (no chart)
        sql = raw
        if "```sql" in sql:
            sql = sql.split("```sql", 1)[1].split("```", 1)[0]
        elif "```" in sql:
            sql = sql.split("```", 1)[1].split("```", 1)[0]
        return {"sql": sql.strip(), "chart": None}
