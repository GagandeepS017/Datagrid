# DataGrid — AI-Powered Conversational Analytics

Upload a CSV, ask questions in plain English, get instant SQL-powered answers.

## Stack
- **Backend**: FastAPI + DuckDB + Claude API (Sonnet)
- **Frontend**: React + Vite + Tailwind CSS v4

## Phase 1 Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Start the server:
```bash
uvicorn main:app --reload
```
API runs at http://localhost:8000

### Frontend
```bash
cd frontend
npm install
npm run dev
```
App runs at http://localhost:5173

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload a CSV file |
| GET | `/api/schema/{table_id}` | Get schema + sample rows |
| POST | `/api/query` | Natural language → SQL → results |
| GET | `/health` | Health check |
