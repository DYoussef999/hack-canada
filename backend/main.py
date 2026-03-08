"""
main.py — Compass AI FastAPI backend.

Endpoints (new Gemini intelligence layer)
──────────────────────────────────────────
GET  /health               Ping all 8 external APIs and report status.
POST /sync                 Accountant Agent: analyze React Flow canvas.
POST /optimize             Scout Agent: rank candidate locations by Viability Score.
GET  /macro                Current BoC + FRED macro briefing (cached 6hr).

Legacy Backboard endpoints (preserved — frontend still works during transition)
──────────────────────────────────────────────────────────────────────────────
POST /session/start        Initialize Backboard thread pair.
POST /sandbox/sync         Backboard Accountant sync.
POST /optimize/expansion   Backboard Scout location optimization.
POST /import/sheets        Backboard CSV ingestor.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import agents  # existing Backboard agents
from routes import dashboard, optimizer
from routes import sandbox as legacy_sandbox

# New Gemini intelligence layer routers
from routers import sync as sync_router
from routers import optimize as optimize_router

# Health-check services
from services import (
    bankofcanada_service,
    fred_service,
    square_service,
    statscan_service,
    upc_service,
)
# besttime_service / mapbox_service excluded — owned by map/foot-traffic team

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
log = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(_: FastAPI):
    log.info("Initializing Backboard agents…")
    await agents.initialize_agents()
    log.info("Agents ready.")
    yield


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Compass AI API",
    description="Multi-agent financial sandbox backend for Hack Canada 2026",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",   # Vite dev server
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── New Gemini intelligence routes ────────────────────────────────────────────
app.include_router(sync_router.router,     tags=["Accountant"])
app.include_router(optimize_router.router, tags=["Scout"])

# ── Legacy Backboard routes ───────────────────────────────────────────────────
app.include_router(legacy_sandbox.router, prefix="/sandbox",   tags=["Legacy"])
app.include_router(optimizer.router,      prefix="/optimizer", tags=["Legacy"])
app.include_router(dashboard.router,      prefix="/dashboard", tags=["Legacy"])


# ── Legacy Backboard request models + endpoints ───────────────────────────────

class SessionStartRequest(BaseModel):
    session_id: str = Field(..., description="Unique session identifier (UUID from frontend)")


class ExpansionRequest(BaseModel):
    session_id:    str
    target_cities: list[str] = Field(..., min_length=1)
    business_type: str
    deep_analysis: bool = Field(False)


class SheetsImportRequest(BaseModel):
    rows:     list[dict[str, Any]] = Field(...)
    sheet_id: str | None = Field(None)


@app.post("/session/start", tags=["Session"])
async def session_start(body: SessionStartRequest) -> dict:
    try:
        return await agents.start_session(body.session_id)
    except Exception as exc:
        log.exception("session/start failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@app.post("/optimize/expansion", tags=["Scout"])
async def optimize_expansion(body: ExpansionRequest) -> dict:
    try:
        return await agents.scout_optimize_expansion(
            body.session_id, body.target_cities, body.business_type, body.deep_analysis
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        log.exception("optimize/expansion failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@app.post("/import/sheets", tags=["Ingestor"])
async def import_sheets(body: SheetsImportRequest) -> dict:
    if not body.rows:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="rows must not be empty")
    try:
        return await agents.ingest_sheet_rows(body.rows)
    except Exception as exc:
        log.exception("import/sheets failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc))


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health() -> dict[str, str]:
    """
    Ping all 8 external APIs and return their status.
    A result of "ok" means the API responded successfully.
    Partial failures are acceptable — at least 5/8 should be ok in demo mode.
    """
    results = await asyncio.gather(
        _check_gemini(),
        statscan_service.health_check(),
        bankofcanada_service.health_check(),
        fred_service.health_check(),
        square_service.health_check(),
        upc_service.health_check(),
        return_exceptions=True,
    )
    keys = ["gemini", "statscanada", "bank_of_canada", "fred", "square_sandbox", "upc_itemdb"]
    return {
        key: (str(r) if isinstance(r, Exception) else r)
        for key, r in zip(keys, results)
    }


async def _check_gemini() -> str:
    """Verify Gemini API key is configured and the SDK can list models."""
    from config import config
    if not config.gemini_api_key:
        return "error: GEMINI_API_KEY not configured"
    try:
        from google import genai
        client = genai.Client(api_key=config.gemini_api_key)
        # list_models is a lightweight call that validates the key
        models = [m async for m in await client.aio.models.list()]
        return "ok" if models else "error: no models returned"
    except Exception as exc:
        return f"error: {exc}"


# ── Root ──────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "Compass AI API v2.1", "docs": "/docs"}

 
