import importlib
import pkgutil

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv

load_dotenv()

import routers as _routers_pkg

app = FastAPI(
    title="DataGrid API",
    version="1.0.0",
    description=(
        "AI-powered analytics platform. Upload a CSV, then ask questions in plain English — "
        "Claude generates the SQL, DuckDB runs it, and results come back as structured data.\n\n"
        "**Workflow:** `POST /api/upload` → get `table_id` → `POST /api/query`\n\n"
        "**Schema inspection:** `GET /api/schema/{table_id}`"
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:5175", "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auto-discover every module in routers/ that exposes a `router` attribute.
# Adding a new router file requires no changes here — just create the file.
for _mod_info in pkgutil.iter_modules(_routers_pkg.__path__):
    _mod = importlib.import_module(f"routers.{_mod_info.name}")
    if hasattr(_mod, "router"):
        app.include_router(_mod.router, prefix="/api")


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health", tags=["health"], summary="Health check")
def health():
    return {"status": "ok"}
