from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv

load_dotenv()

from routers import upload, query, profile

tags_metadata = [
    {
        "name": "upload",
        "description": "Upload CSV files and inspect their schema. Files are stored in-memory as DuckDB tables.",
    },
    {
        "name": "query",
        "description": "Ask natural language questions about uploaded data. Claude converts the question to SQL and runs it.",
    },
    {
        "name": "profile",
        "description": "Automatic statistical profiling: distributions, outliers, correlations, and Claude-generated insights.",
    },
    {
        "name": "health",
        "description": "Service health check.",
    },
]

app = FastAPI(
    title="DataGrid API",
    version="1.0.0",
    description=(
        "AI-powered analytics platform. Upload a CSV, then ask questions in plain English — "
        "Claude generates the SQL, DuckDB runs it, and results come back as structured data.\n\n"
        "**Workflow:** `POST /api/upload` → get `table_id` → `POST /api/query`\n\n"
        "**Schema inspection:** `GET /api/schema/{table_id}`"
    ),
    openapi_tags=tags_metadata,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(query.router, prefix="/api")
app.include_router(profile.router, prefix="/api")


@app.get("/", include_in_schema=False)
def root():
    """Redirect root to Swagger UI."""
    return RedirectResponse(url="/docs")


@app.get("/health", tags=["health"], summary="Health check")
def health():
    """Returns 200 if the service is running."""
    return {"status": "ok"}
