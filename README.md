# DataGrid

An end-to-end AI analytics platform. Upload a dataset, ask questions in plain English, and get SQL-powered answers with auto-generated charts, data profiling, and streaming AI insights.

**Live demo: [datagrid-eta.vercel.app](https://datagrid-eta.vercel.app)**

> The backend runs on Render's free tier and may take up to a minute to wake up after a period of inactivity.

---

## What Was Built

DataGrid covers the full analytics workflow from raw file to insight, with no SQL or code required from the user.

**Upload and profile** — Drop a CSV, Excel, or JSON file. The backend detects schema, computes null rates, outlier counts, skewness, and a correlation matrix automatically. Claude generates 3-5 plain-English observations about the data quality and structure.

**Conversational querying** — Ask a question in natural language. Claude (Sonnet) writes the SQL, DuckDB executes it in a sandboxed SELECT-only engine, and the result comes back with an auto-selected chart (bar, line, or pie via Recharts). Claude (Haiku) then streams a short interpretation of the result in real time via SSE.

**Data Lab** — Generate synthetic rows using either independent per-column sampling or a Gaussian Copula (SDV) that preserves correlations between columns. Fidelity metrics (correlation MAE, similarity score) are shown alongside the synthetic preview. Append generated rows back to the source table and export the result.

**Scenario simulator** — Describe a what-if change in natural language ("increase all salaries in engineering by 10%"). Claude translates it to a SQL transformation, previews the diff, and lets you save it as a new table.

**Eval harness** — A text-to-SQL benchmark that runs the full production pipeline against labeled gold queries and measures execution accuracy (result-set comparison, not SQL string matching). Results are logged to MLflow with per-question metadata.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Backend | FastAPI, DuckDB, pandas, scipy, SDV, MLflow |
| AI | Anthropic Claude API (Sonnet 4.6 for SQL/charts, Haiku 4.5 for insights/streaming) |
| Frontend | React 18, Vite 5, Tailwind CSS v4, Recharts |
| Deployment | Render (backend), Vercel (frontend) |

---

## Features

| Feature | Description |
|---|---|
| Multi-format upload | CSV, Excel (.xlsx), and JSON |
| Auto data profiling | Null rates, outlier detection, skewness, distributions, correlation heatmap |
| Claude insights | Plain-English observations on data quality generated after upload |
| Conversational querying | Natural language to SQL to results and chart |
| Streaming interpretation | Claude streams a result interpretation in real time after each query |
| Auto charts | Bar, line, and pie charts rendered from query results |
| Synthetic data | Independent sampling or Gaussian Copula with correlation fidelity metrics |
| Scenario simulator | Natural language what-if transformations with diff preview |
| Export | Query results as CSV or Excel; health report as HTML |
| Sample datasets | 3 built-in datasets, no upload needed |
| Eval harness | Text-to-SQL benchmark with execution accuracy, tracked in MLflow |

---

## Project Structure

```
DataGrid/
├── backend/
│   ├── main.py                  FastAPI app, auto-discovers all routers
│   ├── routers/
│   │   ├── upload.py            POST /api/upload, GET /api/schema/{id}
│   │   ├── query.py             POST /api/query, POST /api/query/interpret (SSE)
│   │   ├── profile.py           POST /api/profile
│   │   ├── lab.py               synthetic data and scenario endpoints
│   │   ├── export.py            POST /api/export/excel
│   │   ├── samples.py           GET /api/samples, POST /api/samples/{id}
│   │   ├── tables.py            GET /api/tables, DELETE /api/tables/{id}
│   │   └── eval.py              POST /api/eval/run, GET /api/eval/results
│   └── services/
│       ├── claude_client.py     SQL and chart generation
│       ├── sql_engine.py        DuckDB execution, persistence, table registry
│       ├── ingestion.py         CSV, Excel, JSON parsers
│       ├── profiler.py          statistical profiling and Claude insights
│       ├── synthesizer.py       independent and Gaussian copula synthesis
│       ├── evaluator.py         text-to-SQL benchmark harness
│       └── schema.py            schema inference and sample rows
├── frontend/
│   └── src/
│       ├── App.jsx              state management and routing
│       └── components/          upload, dashboard, chat, charts, lab, sidebar
├── start.ps1                    launches backend and frontend locally
├── mlflow-ui.ps1                launches the MLflow eval dashboard
└── render.yaml                  Render deployment blueprint
```

---

## Running Locally

Prerequisites: Python 3.10+, Node.js 18+, an Anthropic API key.

**Backend:**

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

**Frontend:**

```bash
cd frontend
npm install
```

**Start both servers (Windows):**

```powershell
.\start.ps1
```

Or manually:

```bash
# Terminal 1
cd backend && uvicorn main:app --reload --port 8000
# Terminal 2
cd frontend && npm run dev
```

- Frontend: http://localhost:5174
- API docs: http://localhost:8000/docs

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload CSV, Excel, or JSON |
| GET | `/api/schema/{table_id}` | Column schema and sample rows |
| POST | `/api/profile` | Statistical profiling and Claude insights |
| POST | `/api/query` | Natural language to SQL to results and chart spec |
| POST | `/api/query/interpret` | SSE stream of Claude's result interpretation |
| POST | `/api/lab/synthetic` | Generate synthetic rows (copula or independent) |
| POST | `/api/lab/synthetic/append` | Append synthetic rows to the source table |
| POST | `/api/lab/whatif` | Run a scenario in natural language |
| POST | `/api/lab/whatif/apply` | Save a scenario result as a new table |
| POST | `/api/export/excel` | Export query results as .xlsx |
| GET | `/api/samples` | List built-in demo datasets |
| POST | `/api/samples/{id}` | Load a demo dataset |
| GET | `/api/tables` | List persisted tables |
| DELETE | `/api/tables/{table_id}` | Delete a persisted table |
| POST | `/api/eval/run` | Run the text-to-SQL benchmark |
| GET | `/api/eval/results` | Return the most recent eval run |

---

## Sample Datasets

Three datasets are built in, no upload needed:

| Dataset | Rows | Use case |
|---|---|---|
| Retail Sales | 500 | Revenue trends, regional breakdowns, discount analysis |
| HR Employees | 250 | Salary bands, department comparisons, performance scoring |
| E-Commerce Orders | 400 | Ratings, return rates, shipping performance |

---

## Eval Harness

The harness benchmarks the natural-language-to-SQL pipeline against a labeled set of questions. For each question it runs the production pipeline, runs the gold SQL, and compares the two result sets (execution accuracy), not the SQL text. Numeric results are compared with a tolerance of 0.01 to account for rounding differences.

Run it from the API docs at `/api/eval/run`. Results are saved to `backend/data/eval_runs/` and logged to MLflow.

View the MLflow dashboard:

```powershell
.\mlflow-ui.ps1
```

Then open http://localhost:5000 and select the `datagrid-nl2sql` experiment.

---

## Deployment

The app is split across two free-tier services:

- **Backend:** Render — uses `render.yaml` and `requirements-deploy.txt` (slim build without SDV/MLflow to fit free-tier memory limits)
- **Frontend:** Vercel — uses `frontend/vercel.json`; `VITE_API_BASE_URL` is set to the Render backend URL at build time

See `DEPLOYMENT.md` for step-by-step instructions.
