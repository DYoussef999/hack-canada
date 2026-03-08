"""scout_agent.py — Gemini-powered Canadian market intelligence analyst.

Strategist Agent. In transition: currently focused on financial readiness
and general expansion advice while real-world location data sources are merged.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from google import genai
from google.genai import types

from config import config
from models.briefings import (
    CandidateLocation,
    ExpansionReport,
    FinancialHealthReport,
    MacroTrendsBriefing,
)
from .tools import tools

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """
You are a Canadian expansion strategist. 

IMPORTANT: Your real-time location database (neighborhood rents, foot traffic) 
is currently offline for a data source merge. 

Your task:
1. Acknowledge the user's target business and cities.
2. Analyze their financial health (from the provided report) to see if they are ready for expansion.
3. If segment margins are provided, compare them! (e.g. "Your Logistics segment has a 12% margin, which is lower than In-Store at 18%, consider expanding physical retail instead of delivery.")
4. Provide general strategic advice for expanding in the target cities.
5. Explicitly state that neighborhood-level scoring and specific rent comparisons are coming soon.

Return ONLY valid JSON matching the ExpansionReport schema.
Keep 'ranked_locations' as an EMPTY list [].
""".strip()


async def optimize(
    report: FinancialHealthReport,
    locations: list[CandidateLocation],
) -> ExpansionReport:
    """
    Expansion strategy analysis. 
    Currently returns an empty location list while data sources are being merged.
    """
    macro = await tools.get_market_trends()
    
    client = genai.Client(api_key=config.gemini_api_key)
    
    prompt = (
        f"Financial Health: {report.model_dump_json()}\n\n"
        f"Macro context: {macro.model_dump_json()}\n\n"
        f"Target cities: {[loc.city_name for loc in locations]}\n\n"
        "Provide an expansion readiness strategy."
    )

    try:
        response = await client.aio.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                temperature=0.2,
                response_mime_type="application/json",
            ),
        )
        data = json.loads(response.text or "{}")

        return ExpansionReport(
            ranked_locations=[],
            top_macro_risk=data.get("top_macro_risk", macro.trend_label),
            macro_context=macro,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as exc:
        log.error("scout  Gemini strategy error: %s", exc)
        return ExpansionReport(
            ranked_locations=[],
            top_macro_risk=macro.trend_label,
            macro_context=macro,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
