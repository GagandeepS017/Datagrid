import importlib
import os
import pkgutil
from collections import defaultdict
from threading import Lock

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv

load_dotenv()

import routers as _routers_pkg

app = FastAPI(
    title="DataGrid API",
    version="1.0.0",
    description=(
        "AI-powered analytics platform. Upload a CSV, then ask questions in plain English. "
        "Claude generates the SQL, DuckDB runs it, and results come back as structured data.\n\n"
        "**Workflow:** `POST /api/upload` -> get `table_id` -> `POST /api/query`\n\n"
        "**Schema inspection:** `GET /api/schema/{table_id}`"
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# Demo backstop: cap requests per IP on the expensive (Claude-calling) endpoints
# so a public demo can't drain the Anthropic account. Off by default; set
# DEMO_MAX_REQUESTS to a positive integer to enable. This is a safety net, not auth.
_DEMO_MAX = int(os.environ.get("DEMO_MAX_REQUESTS", "0") or "0")
_RATE_PREFIXES = ("/api/query", "/api/profile", "/api/lab", "/api/upload")
_request_counts: dict[str, int] = defaultdict(int)
_count_lock = Lock()


async def _demo_rate_limit(request, call_next):
    if _DEMO_MAX > 0 and request.url.path.startswith(_RATE_PREFIXES):
        ip = request.client.host if request.client else "unknown"
        with _count_lock:
            _request_counts[ip] += 1
            over_limit = _request_counts[ip] > _DEMO_MAX
        if over_limit:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Demo request limit reached ({_DEMO_MAX}). "
                                   "This public demo caps requests to protect API costs."},
            )
    return await call_next(request)


# Allowed CORS origins: localhost for dev plus the production frontend, read from
# FRONTEND_ORIGIN (comma-separated values supported) so nothing is hardcoded.
_origins = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:5174", "http://127.0.0.1:5174",
    "http://localhost:5175", "http://127.0.0.1:5175",
]
_frontend_origin = os.environ.get("FRONTEND_ORIGIN", "")
_origins += [o.strip() for o in _frontend_origin.split(",") if o.strip()]

# Order matters: add the rate limiter first and CORS last so CORS is the
# outermost layer and even a 429 response carries the right CORS headers.
app.add_middleware(BaseHTTPMiddleware, dispatch=_demo_rate_limit)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auto-discover every module in routers/ that exposes a `router` attribute.
# Adding a new router file requires no changes here, just create the file.
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
