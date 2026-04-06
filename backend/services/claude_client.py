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

    prompt = f"""You are a SQL expert. Generate a DuckDB SQL query for the question below.

Table name: {table_name}
Columns:
{cols}

Sample rows:
{samples}

Rules:
- Return ONLY the raw SQL query — no markdown, no explanation, no code fences
- Use only SELECT statements
- The table name must be exactly: {table_name}

Question: {question}"""

    if error_feedback:
        prompt += f"\n\nYour previous query failed with: {error_feedback}\nFix it and return only the corrected SQL."

    return prompt


def _extract_sql(response: str) -> str:
    """Strip markdown fences from Claude's response if present."""
    text = response.strip()
    if "```sql" in text:
        text = text.split("```sql", 1)[1].split("```", 1)[0]
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0]
    return text.strip()


def generate_sql(question: str, schema: dict, error_feedback: str | None = None) -> str:
    """Ask Claude to convert a natural language question to SQL."""
    prompt = _build_prompt(question, schema, error_feedback)
    message = _client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text
    return _extract_sql(raw)
