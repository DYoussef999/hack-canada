"""routers/optimize.py — POST /optimize + GET /macro

POST /optimize
  Runs the Scout Agent 4-phase loop (macro → parallel location fetches → Gemini synthesis).
  Target: < 8 seconds (asyncio.gather across all locations simultaneously).

GET /macro
  Returns current MacroTrendsBriefing (cached 6hr).
  Used by the React frontend Macro Risk Ticker in the AI Insights tab.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from gemini_agents import scout_agent
from gemini_agents.tools import tools
from models.briefings import ExpansionReport, MacroTrendsBriefing, OptimizeRequest

log = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/optimize",
    response_model=ExpansionReport,
    summary="Scout Agent: rank candidate locations by Viability Score",
    tags=["Scout"],
)
async def optimize_locations(body: OptimizeRequest) -> ExpansionReport:
    """
    Run the 4-phase Scout Agent:
      1. Extract budget constraints from FinancialHealthReport.
      2. Fetch BoC + FRED macro data (cached 6hr).
      3. Parallel-fetch foot traffic + competitor density + demographics for ALL locations.
      4. Compute Viability Scores + call Gemini for ranked narrative.

    If BestTime is unavailable, locations are still scored with data_confidence='unavailable'.
    Never returns HTTP 500 due to a single external API being down.
    """
    city_names = [loc.city_name for loc in body.locations]
    log.info("optimize  locations=%s  health=%d", city_names, body.financial_report.health_score)

    try:
        return await scout_agent.optimize(body.financial_report, body.locations)
    except Exception as exc:
        log.exception("optimize  unexpected error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Scout Agent error: {exc}",
        )


@router.get(
    "/macro",
    response_model=MacroTrendsBriefing,
    summary="Current Bank of Canada macro trends (cached 6hr)",
    tags=["Scout"],
)
async def get_macro() -> MacroTrendsBriefing:
    """
    Return the current MacroTrendsBriefing combining BoC Valet + FRED data.
    Result is cached for 6 hours. Used by the frontend Macro Risk Ticker.
    """
    try:
        return await tools.get_market_trends()
    except Exception as exc:
        log.exception("macro  unexpected error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Macro data fetch error: {exc}",
        )
