# DataGrid

Upload a dataset, ask questions in plain English, and get SQL-powered answers with auto-generated charts, data profiling, and streaming insights.

## What It Does

DataGrid lets non-technical users work with their data without writing SQL. You upload a file, it profiles the data automatically, and you ask questions in natural language. Claude writes the SQL, DuckDB runs it, and results come back with charts and a plain-English interpretation.

### Features

| Feature | Description |
|---|---|
| Multi-format upload | CSV, Excel (.xlsx), JSON, and images (PNG/JPG via Claude Vision OCR) |
| Auto data profiling | Null rates, outlier detection, skewness, distributions, correlation heatmap |
| Claude insights | 3-5 plain-English observations generated after upload |
| Conversational querying | Ask in natural language; Claude writes the SQL, DuckDB executes it |
| Streaming interpretation | After each result, Claude streams a short interpretation in real time |
| Auto charts | Bar, line, and pie charts rendered from query results via Recharts |
| Data Lab | Synthetic data generation (independent or Gaussian copula) and a what-if simulator |
| Export | Download query results as CSV or Excel; export the health report as HTML |
| Sample datasets | 3 built-in datasets, no upload required to explore the app |
| Persistent storage | Uploaded tables survive backend restarts (pickle and JSON registry) |
| Recent datasets | Previously uploaded files listed on the home screen for one-click reload |
| Eval harness | Text-to-SQL benchmark measuring execution accuracy, tracked in MLflow |

## Tech Stack

Backend

- FastAPI with auto-router discovery
- DuckDB as an in-memory SQL engine (SELECT-only sandbox)
- Anthropic Claude API (Sonnet for SQL and charts, Haiku for insights and streaming)
- pandas for data processing, openpyxl for Excel
- scipy for statistical profiling
- SDV for correlation-preserving synthetic data
- MLflow for eval experiment tracking

Frontend

- React 18 with Vite 5
- Tailwind CSS v4
- Recharts for charts
- Axios for API calls, native Fetch ReadableStream for SSE

## Project Structure

```
DataGrid/
├── backend/
│   ├── main.py                  FastAPI app, auto-discovers all routers
│   ├── routers/
│   │   ├── upload.py            POST /api/upload, GET /api/schema/{id}
│   │   ├── query.py             POST /api/query, POST /api/query/interpret (SSE)
│   │   ├── profile.py           POST /api/profile
│   │   ├── lab.py               synthetic data and what-if endpoints
│   │   ├── export.py            POST /api/export/excel
│   │   ├── samples.py           GET /api/samples, POST /api/samples/{id}
│   │   ├── tables.py            GET /api/tables, DELETE /api/tables/{id}
│   │   └── eval.py              POST /api/eval/run, GET /api/eval/results
│   ├── services/
│   │   ├── claude_client.py     SQL and chart generation
│   │   ├── sql_engine.py        DuckDB execution, persistence, table registry
│   │   ├── ingestion.py         CSV, Excel, JSON, image parsers
│   │   ├── profiler.py          statistical profiling and Claude insights
│   │   ├── synthesizer.py       independent and Gaussian copula synthesis
│   │   ├── evaluator.py         text-to-SQL benchmark harness
│   │   └── schema.py            schema inference and sample rows
│   └── data/
│       ├── samples/             built-in demo datasets
│       ├── benchmarks/          labeled text-to-SQL benchmark
│       ├── eval_runs/           saved eval run results
│       └── uploads/             persisted uploaded tables
├── frontend/
│   └── src/
│       ├── App.jsx              state management and routing
│       └── components/          upload, dashboard, chat, charts, lab, sidebar
├── start.ps1                    launches backend and frontend
├── mlflow-ui.ps1                launches the MLflow eval dashboard
└── README.md
```

## Getting Started

Prerequisites: Python 3.10+, Node.js 18+, and an Anthropic API key.

Backend:

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

Frontend:

```bash
cd frontend
npm install
```

Run the app (Windows):

```powershell
.\start.ps1
```

This clears port 8000, then starts both servers. Or run them manually:

```bash
# Terminal 1
cd backend && uvicorn main:app --reload --port 8000
# Terminal 2
cd frontend && npm run dev
```

- Frontend: http://localhost:5174
- API docs: http://localhost:8000/docs

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload CSV, Excel, JSON, or image |
| GET | `/api/schema/{table_id}` | Column schema and sample rows |
| POST | `/api/profile` | Statistical profiling and Claude insights |
| POST | `/api/query` | Natural language to SQL to results and chart spec |
| POST | `/api/query/interpret` | SSE stream of Claude's result interpretation |
| POST | `/api/lab/synthetic` | Generate synthetic rows (copula or independent) |
| POST | `/api/lab/synthetic/append` | Append synthetic rows to the source table |
| POST | `/api/lab/whatif` | Run a what-if scenario in natural language |
| POST | `/api/lab/whatif/apply` | Save a what-if result as a new table |
| POST | `/api/export/excel` | Export query results as .xlsx |
| GET | `/api/samples` | List built-in demo datasets |
| POST | `/api/samples/{id}` | Load a demo dataset |
| GET | `/api/tables` | List persisted tables |
| DELETE | `/api/tables/{table_id}` | Delete a persisted table |
| POST | `/api/eval/run` | Run the text-to-SQL benchmark |
| GET | `/api/eval/results` | Return the most recent eval run |

## Sample Datasets

Three datasets are built in, no upload needed:

| Dataset | Rows | Use case |
|---|---|---|
| Retail Sales | 500 | Revenue trends, regional breakdowns, discount analysis |
| HR Employees | 250 | Salary bands, department comparisons, performance scoring |
| E-Commerce Orders | 400 | Ratings, return rates, shipping performance |

## Eval Harness

The harness benchmarks the natural-language-to-SQL pipeline against a labeled set of questions. For each question it runs the production pipeline, runs the gold SQL, and compares the two result sets (execution accuracy), not the SQL text. Run it with `POST /api/eval/run`. Results are saved to `backend/data/eval_runs/` and logged to MLflow.

View the MLflow dashboard:

```powershell
.\mlflow-ui.ps1
```

Then open http://localhost:5000 and select the `datagrid-nl2sql` experiment.

## Development Notes

- New API routes are auto-discovered; drop a `.py` file with a `router` into `backend/routers/`.
- The SQL engine only allows `SELECT`; all write operations are blocked.
- Uploaded DataFrames persist across restarts via pickle files and `registry.json`.
- Vite is pinned to port 5174; CORS allows ports 5173 to 5175.
