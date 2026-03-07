"""
main.py — Compass AI FastAPI backend.

Endpoints
─────────
POST /session/start         Initialize a Backboard thread pair (accountant + scout).
POST /sandbox/sync          Send React Flow canvas to the Accountant agent for analysis.
POST /optimize/expansion    Run the Scout's multi-turn location optimization loop.
POST /import/sheets         Parse raw spreadsheet rows into React Flow nodes via LLM.

Legacy routes (/sandbox/simulate, /optimizer, /dashboard) are preserved so the
existing frontend doesn't break during this transition.
"""

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import agents
from routes import dashboard, optimizer
from routes import sandbox as legacy_sandbox

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
log = logging.getLogger(__name__)


# ── Lifespan: create/reuse Backboard assistants once at startup ──────────────────

@asynccontextmanager
async def lifespan(_: FastAPI):
    log.info("Initializing Backboard agents…")
    await agents.initialize_agents()
    log.info("Agents ready.")
    yield


# ── App ──────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Compass AI API",
    description="Multi-agent financial sandbox backend for Hack Canada 2026",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Legacy routes — keep /sandbox/simulate, /optimizer, /dashboard working
app.include_router(legacy_sandbox.router, prefix="/sandbox",   tags=["Legacy"])
app.include_router(optimizer.router,      prefix="/optimizer", tags=["Legacy"])
app.include_router(dashboard.router,      prefix="/dashboard", tags=["Legacy"])


# ── Request models ───────────────────────────────────────────────────────────────

class SessionStartRequest(BaseModel):
    session_id: str = Field(..., description="Unique session identifier (UUID from frontend)")


class CanvasSyncRequest(BaseModel):
    session_id: str
    nodes: list[dict[str, Any]] = Field(..., description="React Flow nodes array")
    edges: list[dict[str, Any]] = Field(default_factory=list)


class ExpansionRequest(BaseModel):
    session_id:    str
    target_cities: list[str] = Field(..., min_length=1, description="Ontario cities to evaluate")
    business_type: str       = Field(..., description="e.g. 'coffee shop', 'restaurant'")
    deep_analysis: bool      = Field(False, description="True → claude-3-5-sonnet | False → gemini-2.0-flash")


class SheetsImportRequest(BaseModel):
    rows:     list[dict[str, Any]] = Field(..., description="Raw spreadsheet rows as list of dicts")
    sheet_id: str | None           = Field(None, description="Google Sheet ID (reserved for server-side fetch)")


# ── AI endpoints ─────────────────────────────────────────────────────────────────

@app.post("/session/start", tags=["Session"])
async def session_start(body: SessionStartRequest) -> dict:
    """
    Initialize a Backboard thread pair for a new user session.
    Returns accountant_thread_id and scout_thread_id.
    If the session_id already exists, the existing threads are returned (resume).
    """
    try:
        return await agents.start_session(body.session_id)
    except Exception as exc:
        log.exception("session/start failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@app.post("/sandbox/sync", tags=["Accountant"])
async def sandbox_sync(body: CanvasSyncRequest) -> dict:
    """
    Send the current React Flow canvas state to the Accountant agent.

    - Computes burn rate, gross margin, health score for the canvas snapshot.
    - Auto-saves Financial Health markers to Backboard memory (Scout reads these).
    - Model: gemini-2.0-flash — fast enough for live canvas edits.
    """
    try:
        return await agents.accountant_sync_canvas(body.session_id, body.nodes, body.edges)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        log.exception("sandbox/sync failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@app.post("/optimize/expansion", tags=["Scout"])
async def optimize_expansion(body: ExpansionRequest) -> dict:
    """
    Trigger the Scout's multi-turn location optimization loop.

    1. Scout reads Accountant's shared memory for budget constraints (semantic recall).
    2. Scout calls search_locations tool for each target city.
    3. Scout ranks by Viability Score: Ve = (P_rev × D_demo) / ((C_rent × S_comp) + O_fixed).

    deep_analysis=True hot-swaps to claude-3-5-sonnet for strategic narrative depth.
    """
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
    """
    Convert raw spreadsheet rows into typed React Flow nodes via LLM.

    - Classifies each row as revenue source or expense.
    - Applies Canadian SMB categorization (Staff / Overhead / OpEx).
    - Normalizes amounts to monthly CAD values.
    - Returns nodes[] + edges[] ready to hydrate the canvas.
    """
    if not body.rows:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="rows must not be empty")
    try:
        return await agents.ingest_sheet_rows(body.rows)
    except Exception as exc:
        log.exception("import/sheets failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc))


# ── Health ───────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "Compass AI API v2.0"}
