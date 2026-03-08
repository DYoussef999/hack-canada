import logging
from typing import Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

import agents
from models.business import SandboxInput
from services.simulation_engine import simulate_business

log = logging.getLogger(__name__)
router = APIRouter()

class CanvasSyncRequest(BaseModel):
    session_id: str
    nodes: list[dict[str, Any]] = Field(..., description="React Flow nodes array")
    edges: list[dict[str, Any]] = Field(default_factory=list)

@router.post("/simulate")
def simulate(data: SandboxInput):
    """Run a financial simulation for a proposed business expansion."""
    return simulate_business(data)

@router.post("/sync")
async def sandbox_sync(body: CanvasSyncRequest) -> dict:
    """Legacy Backboard Accountant sync."""
    try:
        return await agents.accountant_sync_canvas(body.session_id, body.nodes, body.edges)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        log.exception("sandbox/sync failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc))
