"""routers/sync.py — POST /sync

Accepts a FinancialProfile from the React sandbox canvas and returns
a FinancialHealthReport produced by the Gemini Accountant Agent.

Target response time: < 3 seconds (gemini-2.0-flash at temp=0.1).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from gemini_agents import accountant_agent
from models.briefings import FinancialHealthReport, FinancialProfile

log = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/sync",
    response_model=FinancialHealthReport,
    summary="Analyze financial canvas with Accountant Agent",
    tags=["Accountant"],
)
async def sync_canvas(body: FinancialProfile) -> FinancialHealthReport:
    """
    Run the Gemini Accountant Agent on a React Flow canvas snapshot.

    Retries once with a stricter schema prompt on malformed JSON.
    Returns HTTP 422 if two consecutive attempts both fail to parse.
    """
    source_count = sum(1 for n in body.nodes if n.type == "source")
    expense_count = sum(1 for n in body.nodes if n.type == "expense")
    log.info("sync  nodes=%d (src=%d, exp=%d)", len(body.nodes), source_count, expense_count)

    try:
        return await accountant_agent.analyze(body)
    except ValueError as exc:
        # Gemini returned unparseable JSON after 2 attempts
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        log.exception("sync  unexpected error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Accountant Agent error: {exc}",
        )
