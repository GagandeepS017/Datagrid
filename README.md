# DataGrid — AI-Powered Conversational Analytics

> Upload a dataset, ask questions in plain English, and get instant SQL-powered answers with AI-generated charts, data profiling, and streaming insights.

Built as a portfolio and thesis project (M.Sc. Big Data & AI, SRH Berlin).

---

## What We Built

DataGrid is a full-stack analytics platform that removes the barrier between non-technical users and their data. Instead of writing SQL or using complex BI tools, you simply upload a file and ask questions.

### Core Features

| Feature | Description |
|---|---|
| **Multi-format Upload** | CSV, Excel (.xlsx), JSON, and image files (PNG/JPG via Claude Vision OCR) |
| **Auto Data Profiling** | Null rates, outlier detection, skewness, distributions, and correlation heatmap |
| **Claude AI Insights** | 3–5 plain-English observations generated automatically after upload |
| **Conversational Querying** | Ask anything in natural language — Claude writes the SQL, DuckDB executes it |
| **Streaming Interpretation** | After each query result, Claude streams a 2-3 sentence interpretation in real time |
| **Auto Charts** | Bar, line, and pie charts rendered automatically from query results via Recharts |
| **Data Lab** | Synthetic data generation (matching real distributions) and What-If scenario simulator |
| **Export** | Download query results as CSV or Excel; export the full health report as HTML |
| **Sample Datasets** | 3 built-in demo datasets — no upload required to explore the app |
| **Persistent Storage** | Uploaded tables survive backend restarts (pickle + JSON registry) |
| **Recent Datasets** | Previously uploaded files listed on the home screen for one-click reload |

---

## Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — API framework with auto-router discovery
- [DuckDB](https://duckdb.org/) — In-memory SQL engine (SELECT-only sandboxed)
- [Anthropic Claude API](https://www.anthropic.com/) — SQL generation, chart specs, insights, streaming interpretation, Vision OCR
  - `claude-sonnet-4-6` — SQL + chart generation
  - `claude-haiku-4-5-20251001` — Streaming interpretation + data insights
- [pandas](https://pandas.pydata.org/) — DataFrame processing
- [openpyxl](https://openpyxl.readthedocs.io/) — Excel import/export

**Frontend**
- [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) — Bar, line, pie charts
- [Axios](https://axios-http.com/) — API calls
- Native Fetch `ReadableStream` — SSE token streaming

---

## Project Structure

```
DataGrid/
├── backend/
│   ├── main.py                  # FastAPI app — auto-discovers all routers
│   ├── routers/
│   │   ├── upload.py            # POST /api/upload, GET /api/schema/{id}
│   │   ├── query.py             # POST /api/query, POST /api/query/interpret (SSE)
│   │   ├── profile.py           # POST /api/profile
│   │   ├── lab.py               # POST /api/lab/synthetic, POST /api/lab/whatif
│   │   ├── export.py            # POST /api/export/excel
│   │   ├── samples.py           # GET /api/samples, POST /api/samples/{id}
│   │   └── tables.py            # GET /api/tables, DELETE /api/tables/{id}
│   ├── services/
│   │   ├── claude_client.py     # SQL + chart generation via Claude Sonnet
│   │   ├── sql_engine.py        # DuckDB execution, persistence, table registry
│   │   ├── ingestion.py         # CSV, Excel, JSON, Image (Vision OCR) parsers
│   │   ├── profiler.py          # Statistical profiling + Claude insights
│   │   ├── synthesizer.py       # Synthetic data generation matching distributions
│   │   └── schema.py            # Schema inference + sample row extraction
│   └── data/
│       ├── samples/             # Built-in demo datasets (retail, HR, e-commerce)
│       └── uploads/             # Persisted uploaded tables (.pkl files)
├── frontend/
│   └── src/
│       ├── App.jsx              # Root — state management + routing
│       └── components/
│           ├── FileUpload.jsx   # Upload zone + sample cards + recent datasets
│           ├── HealthDashboard.jsx  # Profiling report with charts and heatmap
│           ├── QueryChat.jsx    # Chat interface with streaming interpretation
│           ├── QueryChart.jsx   # Auto-detecting chart renderer
│           ├── LabPanel.jsx     # Synthetic data + What-If simulator
│           ├── SchemaInfo.jsx   # Column schema sidebar
│           ├── ResultTable.jsx  # Paginated query result table
│           └── Sidebar.jsx      # Navigation
├── start.ps1                    # Windows launcher (kills stale processes, starts both servers)
└── README.md
```

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

Create `backend/.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

### Frontend Setup

```bash
cd frontend
npm install
```

### Running the App

**Windows (recommended):**
```powershell
.\start.ps1
```
This kills any stale processes on port 8000, then starts both servers in separate windows.

**Manual:**
```bash
# Terminal 1
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

- Frontend: http://localhost:5174
- Backend API docs: http://localhost:8000/docs

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Upload CSV, Excel, JSON, or image |
| `GET` | `/api/schema/{table_id}` | Get column schema and sample rows |
| `POST` | `/api/profile` | Run statistical profiling + Claude insights |
| `POST` | `/api/query` | Natural language → SQL → results + chart spec |
| `POST` | `/api/query/interpret` | SSE stream: Claude interprets query results |
| `POST` | `/api/lab/synthetic` | Generate synthetic rows matching data distributions |
| `POST` | `/api/lab/whatif` | Run a What-If scenario in natural language |
| `POST` | `/api/export/excel` | Export query results as .xlsx |
| `GET` | `/api/samples` | List built-in demo datasets |
| `POST` | `/api/samples/{id}` | Load a demo dataset directly |
| `GET` | `/api/tables` | List all persisted uploaded tables |
| `DELETE` | `/api/tables/{table_id}` | Delete a persisted table |

---

## Sample Datasets

No file upload needed — three datasets are built in:

| Dataset | Rows | Use case |
|---|---|---|
| **Retail Sales** | 500 | Revenue trends, regional breakdowns, discount analysis |
| **HR Employees** | 250 | Salary bands, department comparisons, performance scoring |
| **E-Commerce Orders** | 400 | Ratings analysis, return rates, shipping performance |

---

## Development Notes

- New API routes are auto-discovered — just drop a `.py` file with a `router` in `backend/routers/`
- The SQL engine only allows `SELECT` queries; all write operations are blocked
- Uploaded DataFrames persist across restarts via pickle files + `registry.json`
- Vite is pinned to port 5174; CORS allows 5173–5175
