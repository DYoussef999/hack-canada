"""routers/wire.py — POST /canvas/auto-wire

Uses Backboard Wire Matcher agent to intelligently connect expenses to revenue streams.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

import agents

log = logging.getLogger(__name__)
router = APIRouter()


class WireMapping(BaseModel):
    """A single expense → revenue connection suggestion."""

    source: str = Field(..., description="Expense node ID")
    target: str = Field(..., description="Revenue node ID")


class AutoWireResponse(BaseModel):
    """Wire matcher agent response."""

    mappings: list[WireMapping] = Field(..., description="List of expense→revenue connections")


@router.post(
    "/canvas/auto-wire",
    response_model=AutoWireResponse,
    summary="Auto-wire unconnected expenses using Gemini Wire Matcher",
    tags=["Canvas"],
)
async def auto_wire(body: dict[str, Any]) -> AutoWireResponse:
    """
    Use Gemini Wire Matcher agent to intelligently wire expenses to revenue streams.

    Takes:
    - revenue_nodes: list of revenue stream nodes with user-defined labels
    - expense_nodes: list of unconnected expense nodes with categories and labels

    Returns:
    - mappings: list of {source: expenseId, target: revenueId} connections
    """
    revenue_nodes = body.get("revenue_nodes", [])
    expense_nodes = body.get("expense_nodes", [])

    log.info(f"auto_wire: Gemini matching with {len(revenue_nodes)} revenue, {len(expense_nodes)} expenses")

    if not expense_nodes:
        log.info("auto_wire: no expense nodes, returning empty")
        return AutoWireResponse(mappings=[])

    if not revenue_nodes:
        log.error("auto_wire: no revenue nodes provided")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one revenue node is required for auto-wiring",
        )

    try:
        result = await agents.auto_wire_nodes(revenue_nodes, expense_nodes)
        mappings = [
            WireMapping(source=m["source"], target=m["target"])
            for m in result.get("mappings", [])
        ]
        log.info(f"auto_wire: ✓ generated {len(mappings)} mappings via Backboard Wire Matcher")
        return AutoWireResponse(mappings=mappings)
    except Exception as e:
        log.exception("auto_wire: Backboard Wire Matcher error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Auto-wire service error: {e}",
        )
