"""accountant_agent.py — Gemini-powered Canadian SMB financial analyst.

Accepts a FinancialProfile (React Flow canvas nodes) and returns a
FinancialHealthReport with health score, break-even, and risk flags.

Model: gemini-2.0-flash (fast for live canvas edits, deterministic at temp=0.1)
Output: application/json — parsed directly into FinancialHealthReport.
"""
from __future__ import annotations

import json
import logging

from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential

from config import config
from models.briefings import FinancialHealthReport, FinancialProfile
from .tools import tools

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """
You are a Canadian SMB financial analyst embedded in Compass AI.

You receive:
1. A JSON FinancialProfile with canvas nodes (type: "source" = revenue, "expense" = cost).
2. A SquareCatalogBriefing (if connected) summarizing the user's Square POS inventory.

Perform these calculations:
1. monthly_revenue = sum of all source node values
2. monthly_expenses = sum of all expense node values
3. net_profit = monthly_revenue - monthly_expenses
4. profit_margin_pct = (net_profit / monthly_revenue) * 100  (0 if revenue=0)
5. break_even_revenue = monthly_expenses  (the minimum revenue to cover all costs)
6. max_affordable_rent = monthly_revenue * 0.10  (BDC Canadian SMB 10% guideline)
7. top_cost_risks = the 2 expense nodes with highest value as "label: $amount (X% of revenue)"
8. health_score (0-100):
   - If revenue = 0, health_score = 0 (explain no revenue entered)
   - profit_margin > 20% → base 85-100
   - profit_margin 10-20% → base 65-85
   - profit_margin 5-10% → base 40-65
   - profit_margin < 5% → base 10-40
   - Adjust based on user-created connections if meaningful relationships exist.
   - Deduct 15 points if any single expense > 40% of monthly_revenue
   - Add 5 points if no warnings
9. warnings: list any expense exceeding 30% of monthly_revenue as BDC over-reliance flag
10. recommendation: 1-2 plain-English sentences for the business owner. Cite actual numbers.
    If Square data is present (item_count > 0), mention how their inventory aligns with their canvas revenue.
11. Functional Dependency Grouping (CRITICAL):
    - IGNORE the original "category" (Fixed/Variable/Labor) for grouping. Instead, analyze the "label" semantically.
    - Create groups based on "Business Segments". 
    - EXAMPLES:
        * "Logistics & Delivery": Group [Delivery Driver Wages, Van Fuel] and link them to [Catering Revenue, Online Revenue].
        * "Bakery Operations": Group [Baker Wages, Bulk Flour] and link them to [In-Store Pastry Sales].
        * "Digital Storefront": Group [Shopify Fees, Instagram Ads, Packaging] and link them to [Online Cake Orders].
        * "Overheads": Group [Rent, Insurance, Utilities].
    - Provide unique group_id, label, and node_ids for each.
    - If a user manually placed a node in a group (indicated by a manualGroup flag or existing parent node in data), RESPECT IT and don't re-group it.
    - Suggested Edges: Create suggested_edges representing the flow of support. E.g., the "Bakery Operations" group "Supports" the "In-Store Pastry Sales" node.
    - Calculate Segment Margins (segment_margins) for these functional segments.

SCHEMA COMPLIANCE:
- layout_groups: list of { "group_id": string, "label": string, "node_ids": string[] }
- suggested_edges: list of { "source": string, "target": string, "label": string }  <-- DO NOT use "from"/"to", use "source"/"target"
- segment_margins: list of { "segment_name": string, "revenue": float, "expenses": float, "margin_pct": float }

RULES:
- Never invent numbers not present in the input
- Return ONLY valid JSON — no prose, no markdown fences
- All monetary values in CAD
""".strip()

_SCHEMA = json.dumps(FinancialHealthReport.model_json_schema(), indent=2)
_RETRY_PREFIX = (
    "You MUST return only valid JSON. Previous attempt failed parsing. "
    f"Here is the required schema:\n{_SCHEMA}\n\nNow analyze this profile:\n"
)


def _client() -> genai.Client:
    return genai.Client(api_key=config.gemini_api_key)


def _is_gemini_retryable(exc: BaseException) -> bool:
    """Retry on Gemini 429 (quota/rate-limit) responses."""
    return "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=5, max=20),
    retry=lambda retry_state: _is_gemini_retryable(retry_state.outcome.exception()),
    reraise=True,
)
async def _generate(client: genai.Client, prompt: str) -> str:
    """Call Gemini with exponential backoff on 429."""
    response = await client.aio.models.generate_content(
        model="gemini-3.1-flash-lite-preview",
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_PROMPT,
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )
    return response.text or ""


async def analyze(profile: FinancialProfile) -> FinancialHealthReport:
    """
    Run the Accountant Agent on a FinancialProfile.
    Enriches analysis with live Square Catalog data if available.
    """
    client = _client()

    # ── Phase 1: Retrieve Square context ──────────────────────────────────────
    square_briefing = await tools.get_square_catalog()
    square_json = square_briefing.model_dump_json(indent=2)

    prompt = (
        f"=== SQUARE POS CONTEXT ===\n{square_json}\n\n"
        f"=== CANVAS PROFILE ===\n{profile.model_dump_json(indent=2)}\n\n"
        "Analyze the financial health of this business based on the canvas and Square data."
    )

    for attempt in range(2):
        full_prompt = (_RETRY_PREFIX + prompt) if attempt == 1 else prompt
        try:
            raw_text = await _generate(client, full_prompt)
            data = json.loads(raw_text)
            report = FinancialHealthReport(**data)
            log.info(
                "accountant  health_score=%d  margin=%.1f%%  attempt=%d",
                report.health_score, report.profit_margin_pct, attempt + 1,
            )
            return report
        except json.JSONDecodeError as exc:
            log.warning("accountant  JSON parse error attempt=%d: %s", attempt + 1, exc)
            if attempt == 1:
                raise ValueError(f"Gemini returned malformed JSON after 2 attempts: {exc}") from exc
        except Exception as exc:
            log.error("accountant  Gemini error: %s", exc)
            raise
