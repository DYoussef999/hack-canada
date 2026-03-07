"""
agents.py — Backboard.io multi-agent system for Compass AI.

Architecture
────────────
AccountantAgent  Ingests React Flow canvas JSON → computes Canadian SMB financials →
                 saves Financial Health markers to Backboard's assistant-level memory
                 (shared across all sessions, enables cross-agent semantic recall).

ScoutAgent       Before recommending anything, reads the Accountant's saved memories
                 to learn budget constraints. Runs a multi-turn tool-call loop using
                 `search_locations` to ground recommendations in real location data.

SheetsIngestor   Separate assistant whose sole purpose is parsing raw spreadsheet rows
                 into typed React Flow nodes via an LLM call.

Model Hot-Swap   add_message(llm_provider=, model_name=) per-call — no re-init needed.
                 Fast path: google/gemini-2.0-flash  (live canvas updates)
                 Deep path: anthropic/claude-3-5-sonnet-20241022  (strategic analysis)

Thread Strategy  One pair of threads per session (accountant + scout). Session state
                 stored in-memory; swap _sessions for Redis in production.
"""

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Union

from dotenv import load_dotenv

from backboard import BackboardClient
from backboard.models import (
    FunctionDefinition,
    ToolDefinition,
    ToolOutput,
    ToolParameterProperties,
    ToolParameters,
)

load_dotenv()  # reads .env before anything touches os.environ

log = logging.getLogger(__name__)

# ── Singleton SDK client ────────────────────────────────────────────────────────
_api_key = os.getenv("BACKBOARD_API_KEY")
if not _api_key:
    raise RuntimeError(
        "BACKBOARD_API_KEY is not set. "
        "Add it to backend/.env or export it in your shell."
    )
client = BackboardClient(api_key=_api_key)


async def _call(fn, *args, **kwargs):
    """Await a Backboard SDK async method. All client methods are coroutines."""
    return await fn(*args, **kwargs)


# ── Tool definitions ────────────────────────────────────────────────────────────

SCOUT_TOOLS = [
    ToolDefinition(
        type="function",
        function=FunctionDefinition(
            name="search_locations",
            description=(
                "Search for commercial real estate and foot-traffic data in Ontario cities. "
                "Returns lease rates, competition density, and viability scores per neighbourhood. "
                "Production: backed by Google Places API. Demo: uses Compass AI dataset."
            ),
            parameters=ToolParameters(
                type="object",
                properties={
                    "city": ToolParameterProperties(
                        type="string",
                        description="Target Ontario city",
                        enum=["Waterloo", "Kitchener", "Toronto", "Hamilton", "London", "Ottawa"],
                    ),
                    "business_type": ToolParameterProperties(
                        type="string",
                        description="Business category (e.g. 'coffee shop', 'restaurant', 'retail')",
                    ),
                    "max_monthly_rent": ToolParameterProperties(
                        type="number",
                        description="Hard ceiling for monthly rent in CAD — sourced from Accountant memory",
                    ),
                },
                required=["city", "business_type", "max_monthly_rent"],
            ),
        ),
    )
]

# ── System prompts ───────────────────────────────────────────────────────────────

_ACCOUNTANT_PROMPT = """
You are The Accountant — a Canadian SMB financial analyst embedded in Compass AI.

When given a React Flow canvas (JSON of nodes + edges) representing a business model:
1. Sum all 'source' nodes → monthly revenue.
2. Sum all 'expense' nodes → monthly expenses, grouped by category (Staff / Overhead / OpEx).
3. Compute: burn_rate (expenses if no revenue), gross_margin_pct, runway_months, health_score (0–100).
4. Flag any expense that exceeds 30% of total revenue (BDC over-reliance warning).
5. Derive max_affordable_rent as revenue × 0.10 (BDC Canadian SMB guideline).

Respond with ONLY valid JSON — no prose, no markdown fences:
{
  "burn_rate": <monthly expenses>,
  "gross_margin_pct": <(revenue - expenses) / revenue * 100 or 0>,
  "runway_months": <null if revenue covers costs, else savings/burn_rate>,
  "health_score": <0-100 integer>,
  "top_cost_drivers": ["<label>: $<amount>"],
  "warnings": ["<flag string>"],
  "financial_markers": {
    "max_affordable_rent": <revenue * 0.10>,
    "monthly_revenue": <total>,
    "monthly_expenses": <total>,
    "net_profit": <revenue - expenses>
  }
}
""".strip()

_SCOUT_PROMPT = """
You are The Scout — a strategic expansion advisor for Canadian small business owners.

Before making any recommendation:
1. Read the financial constraints the Accountant saved in your shared memory.
2. Call search_locations for EVERY candidate city the user provides.
3. Apply the Viability formula: Ve = (P_rev × D_demographic) / ((C_rent × S_competition) + O_fixed)
4. NEVER recommend a location where monthly_rent > max_affordable_rent from memory.
5. Write for a coffee shop owner — plain English, no jargon.

Respond with ONLY valid JSON:
{
  "locations": [
    {
      "city": "...", "neighbourhood": "...", "monthly_rent": <number>,
      "viability_score": <0-100>, "rationale": "<2 plain-English sentences>",
      "risk_flag": "<string or null>"
    }
  ],
  "recommendation": "<1-2 sentence winner + reason>"
}
""".strip()

_INGESTOR_PROMPT = """
You are a financial data parser for Canadian small businesses.

Given raw spreadsheet rows, classify each as revenue or expense and return React Flow nodes.

Rules:
- Revenue (positive income) → type: "source"
- Costs/payments → type: "expense", categorize as Staff | Overhead | OpEx
- Mappings: Hydro/Utilities → Overhead, Wages/Salary → Staff,
  COGS/Inventory/Software/Marketing → OpEx, Rent/Insurance → Overhead
- Normalize to monthly CAD (divide annual by 12, weekly by 4.33)
- If amount is ambiguous use 0 and append "?" to the label

Respond with ONLY valid JSON:
{
  "nodes": [
    {
      "id": "imported-<index>",
      "type": "source" | "expense",
      "position": {"x": 160, "y": <120 + index * 150>},
      "data": {
        "label": "<clean display name>",
        "value": <monthly CAD number>,
        "category": "Staff" | "Overhead" | "OpEx"
      }
    }
  ],
  "edges": []
}
""".strip()

# ── Ontario location dataset (demo; replace with Google Places API) ──────────────

_ONTARIO_LOCATIONS: dict[str, list[dict[str, Any]]] = {
    "Waterloo": [
        {"neighbourhood": "Uptown Waterloo",        "avg_rent": 2900, "foot_traffic": 74, "competition": 4, "demo_score": 71},
        {"neighbourhood": "University Ave Corridor", "avg_rent": 2200, "foot_traffic": 88, "competition": 7, "demo_score": 65},
        {"neighbourhood": "Beechwood",               "avg_rent": 1800, "foot_traffic": 55, "competition": 2, "demo_score": 62},
    ],
    "Kitchener": [
        {"neighbourhood": "Downtown Kitchener",      "avg_rent": 2400, "foot_traffic": 68, "competition": 5, "demo_score": 66},
        {"neighbourhood": "Belmont Village",          "avg_rent": 2100, "foot_traffic": 62, "competition": 3, "demo_score": 70},
    ],
    "Toronto": [
        {"neighbourhood": "Kensington Market",       "avg_rent": 5800, "foot_traffic": 91, "competition": 12, "demo_score": 78},
        {"neighbourhood": "Danforth Ave",             "avg_rent": 4200, "foot_traffic": 76, "competition": 8,  "demo_score": 72},
        {"neighbourhood": "Junction Triangle",        "avg_rent": 3600, "foot_traffic": 66, "competition": 4,  "demo_score": 75},
    ],
    "Hamilton": [
        {"neighbourhood": "James Street North",      "avg_rent": 2200, "foot_traffic": 64, "competition": 3, "demo_score": 67},
        {"neighbourhood": "Locke Street",             "avg_rent": 2600, "foot_traffic": 70, "competition": 5, "demo_score": 71},
    ],
    "London": [
        {"neighbourhood": "Old East Village",         "avg_rent": 1900, "foot_traffic": 58, "competition": 2, "demo_score": 64},
        {"neighbourhood": "Richmond Row",             "avg_rent": 2800, "foot_traffic": 73, "competition": 6, "demo_score": 68},
    ],
    "Ottawa": [
        {"neighbourhood": "ByWard Market",            "avg_rent": 4100, "foot_traffic": 82, "competition": 9, "demo_score": 74},
        {"neighbourhood": "Westboro",                 "avg_rent": 3200, "foot_traffic": 70, "competition": 4, "demo_score": 77},
    ],
}


def _exec_search_locations(city: str, business_type: str, max_monthly_rent: float) -> dict:
    """
    Tool implementation for the Scout's search_locations call.
    Applies hard rent filter then scores each neighbourhood with the Viability formula.

    Production upgrade path:
        Replace _ONTARIO_LOCATIONS lookup with:
        >>> places = httpx.get("https://maps.googleapis.com/maps/api/place/textsearch/json",
        ...     params={"query": f"{business_type} {city}", "key": GOOGLE_MAPS_KEY})
        Then enrich with the Maps Traffic Layer API for foot_traffic.
    """
    candidates = [loc for loc in _ONTARIO_LOCATIONS.get(city, []) if loc["avg_rent"] <= max_monthly_rent]
    results = []
    for loc in candidates:
        o_fixed = 500  # baseline fixed overhead (CAD)
        ve_raw = (loc["foot_traffic"] * loc["demo_score"]) / (
            (loc["avg_rent"] * max(loc["competition"], 1)) + o_fixed
        )
        results.append({
            "neighbourhood":      loc["neighbourhood"],
            "avg_monthly_rent":   loc["avg_rent"],
            "foot_traffic_score": loc["foot_traffic"],
            "competition_density":loc["competition"],
            "demographic_score":  loc["demo_score"],
            "viability_score":    round(min(ve_raw * 10, 100), 1),
            "source":             "Compass AI Demo Dataset — connect Google Places API for live data",
        })
    return {"city": city, "business_type": business_type, "locations": results}


# ── Tool call normalizer ─────────────────────────────────────────────────────────

def _unpack_tool_call(tc: Union[dict, Any]) -> tuple[str, str, str]:
    """
    Normalize a tool call from either:
      - MessageResponse.tool_calls  → List[ToolCall]  (typed Pydantic objects)
      - ToolOutputsResponse.tool_calls → List[Dict]   (raw dicts from SDK v1.5)
    Returns (call_id, function_name, arguments_json).
    """
    if isinstance(tc, dict):
        return tc["id"], tc["function"]["name"], tc["function"]["arguments"]
    return tc.id, tc.function.name, tc.function.arguments


# ── Session state ────────────────────────────────────────────────────────────────

@dataclass
class _Session:
    accountant_thread_id: str
    scout_thread_id:      str
    last_markers:         dict = field(default_factory=dict)


_sessions:       dict[str, _Session] = {}
_accountant_id:  str | None = None
_scout_id:       str | None = None
_ingestor_id:    str | None = None


# ── Startup initializer ──────────────────────────────────────────────────────────

async def initialize_agents() -> None:
    """
    Called once at FastAPI startup. Creates Backboard assistants if they don't
    exist yet; reuses them by name otherwise (fully idempotent).
    """
    global _accountant_id, _scout_id, _ingestor_id

    existing = await _call(client.list_assistants)
    by_name  = {a.name: a for a in existing}

    async def _get_or_create(name: str, prompt: str, tools=None) -> str:
        if name in by_name:
            aid = str(by_name[name].assistant_id)
            log.info("Reusing assistant '%s' → %s", name, aid)
            return aid
        kwargs = dict(name=name, system_prompt=prompt)
        if tools:
            kwargs["tools"] = tools
        a = await _call(client.create_assistant, **kwargs)
        aid = str(a.assistant_id)
        log.info("Created assistant '%s' → %s", name, aid)
        return aid

    _accountant_id, _scout_id, _ingestor_id = await asyncio.gather(
        _get_or_create("Compass-Accountant", _ACCOUNTANT_PROMPT),
        _get_or_create("Compass-Scout",      _SCOUT_PROMPT, tools=SCOUT_TOOLS),
        _get_or_create("Compass-Ingestor",   _INGESTOR_PROMPT),
    )


# ── Session management ───────────────────────────────────────────────────────────

async def start_session(session_id: str) -> dict:
    """
    Create or resume a session. Each session gets two threads — one per agent.
    Thread IDs are returned to the frontend for optional persistence (localStorage).
    """
    if session_id in _sessions:
        s = _sessions[session_id]
        return {
            "session_id":            session_id,
            "accountant_thread_id":  s.accountant_thread_id,
            "scout_thread_id":       s.scout_thread_id,
            "resumed":               True,
        }

    a_thread, s_thread = await asyncio.gather(
        _call(client.create_thread, _accountant_id),
        _call(client.create_thread, _scout_id),
    )
    _sessions[session_id] = _Session(
        accountant_thread_id=str(a_thread.thread_id),
        scout_thread_id=str(s_thread.thread_id),
    )
    return {
        "session_id":           session_id,
        "accountant_thread_id": str(a_thread.thread_id),
        "scout_thread_id":      str(s_thread.thread_id),
        "resumed":              False,
    }


# ── Accountant agent ─────────────────────────────────────────────────────────────

async def accountant_sync_canvas(
    session_id: str,
    nodes:      list[dict],
    edges:      list[dict],
) -> dict:
    """
    Send the current React Flow canvas state to the Accountant for analysis.

    Memory strategy:
    - memory="Auto"  → Backboard auto-extracts constraints from the conversation
    - add_memory()   → we also push a structured Financial Health snapshot so the
                       Scout can query it by key (cross-agent semantic recall).
    Model: gemini-2.0-flash — fast enough for live canvas sync on every node edit.
    """
    session = _sessions.get(session_id)
    if not session:
        raise ValueError(f"Session '{session_id}' not found — call /session/start first.")

    canvas_json = json.dumps({"nodes": nodes, "edges": edges}, indent=2)
    prompt = f"Analyze this Compass AI financial canvas:\n\n{canvas_json}"

    response = await _call(
        client.add_message,
        thread_id=session.accountant_thread_id,
        content=prompt,
        llm_provider="google",
        model_name="gemini-2.0-flash",
        memory="Auto",
    )

    analysis = _parse_json(response.content or "")

    # Persist structured markers to assistant-level memory for Scout cross-referencing
    markers = analysis.get("financial_markers", {})
    if markers:
        session.last_markers = markers
        memory_text = (
            f"Financial Health: revenue=${markers.get('monthly_revenue', 0):.0f}/mo, "
            f"expenses=${markers.get('monthly_expenses', 0):.0f}/mo, "
            f"net_profit=${markers.get('net_profit', 0):.0f}/mo, "
            f"max_affordable_rent=${markers.get('max_affordable_rent', 0):.0f}/mo "
            f"(BDC 10%-of-revenue guideline)"
        )
        await _call(
            client.add_memory,
            assistant_id=_accountant_id,
            content=memory_text,
            metadata={"type": "financial_health", "session": session_id, **{
                k: str(v) for k, v in markers.items()
            }},
        )

    return {
        "analysis":           analysis,
        "tokens_used":        response.total_tokens,
        "retrieved_memories": response.retrieved_memories or [],
    }


# ── Scout agent ──────────────────────────────────────────────────────────────────

async def scout_optimize_expansion(
    session_id:    str,
    target_cities: list[str],
    business_type: str,
    deep_analysis: bool = False,
) -> dict:
    """
    Multi-turn Scout reasoning loop:
      1. Semantic Recall — reads Accountant's assistant-level memories for budget limits.
      2. Sends initial prompt + city list to Scout.
      3. Processes tool_calls loop (Scout calls search_locations per city).
      4. Returns structured location rankings once the Scout produces final JSON.

    Hot-swap logic:
      deep_analysis=False → google / gemini-2.0-flash   (fast, good for most cases)
      deep_analysis=True  → anthropic / claude-3-5-sonnet-20241022  (strategic depth)
    """
    session = _sessions.get(session_id)
    if not session:
        raise ValueError(f"Session '{session_id}' not found — call /session/start first.")

    # ── 1. Cross-agent semantic recall ──────────────────────────────────────────
    mem_response = await _call(client.get_memories, assistant_id=_accountant_id)
    memories     = mem_response.memories or []
    memory_block = (
        "\n".join(f"  • {m.content}" for m in memories)
        or "  • No financial history yet — apply conservative budgets."
    )

    # ── 2. Model selection ───────────────────────────────────────────────────────
    provider = "anthropic" if deep_analysis else "google"
    model    = "claude-3-5-sonnet-20241022" if deep_analysis else "gemini-2.0-flash"
    log.info("Scout → %s/%s  deep=%s  cities=%s", provider, model, deep_analysis, target_cities)

    # ── 3. Initial message ───────────────────────────────────────────────────────
    cities_str = ", ".join(target_cities)
    prompt = (
        f"Accountant memory constraints:\n{memory_block}\n\n"
        f"Search these Ontario cities for viable {business_type} locations: {cities_str}. "
        f"Call search_locations for each city before ranking."
    )

    response = await _call(
        client.add_message,
        thread_id=session.scout_thread_id,
        content=prompt,
        llm_provider=provider,
        model_name=model,
        memory="Auto",
    )

    # ── 4. Tool-call loop ────────────────────────────────────────────────────────
    tool_turns = 0
    max_turns  = 8  # safety ceiling

    while response.tool_calls and tool_turns < max_turns:
        tool_turns += 1
        outputs = []

        for tc in response.tool_calls:
            call_id, fn_name, args_json = _unpack_tool_call(tc)
            if fn_name == "search_locations":
                try:
                    result = _exec_search_locations(**json.loads(args_json))
                except Exception as exc:
                    result = {"error": str(exc)}
            else:
                result = {"error": f"unknown tool: {fn_name}"}

            outputs.append(ToolOutput(tool_call_id=call_id, output=json.dumps(result)))
            log.debug("Tool %s → %d locations returned", fn_name, len(result.get("locations", [])))

        response = await _call(
            client.submit_tool_outputs,
            thread_id=session.scout_thread_id,
            run_id=response.run_id,
            tool_outputs=outputs,
        )

    # ── 5. Parse final answer ────────────────────────────────────────────────────
    return {
        "result":      _parse_json(response.content or ""),
        "model_used":  f"{provider}/{model}",
        "tool_turns":  tool_turns,
        "tokens_used": response.total_tokens,
    }


# ── Sheets ingestor ──────────────────────────────────────────────────────────────

async def ingest_sheet_rows(raw_rows: list[dict]) -> dict:
    """
    One-shot LLM parse: raw spreadsheet rows → typed React Flow nodes.
    Uses a dedicated Ingestor assistant (separate system prompt, no tool calls).
    A temporary thread is created and immediately deleted after use.
    """
    tmp_thread = await _call(client.create_thread, _ingestor_id)
    thread_id  = str(tmp_thread.thread_id)

    try:
        response = await _call(
            client.add_message,
            thread_id=thread_id,
            content=f"Parse these {len(raw_rows)} rows:\n\n{json.dumps(raw_rows, indent=2)}",
            llm_provider="google",
            model_name="gemini-2.0-flash",
        )
        parsed = _parse_json(response.content or "")
    finally:
        await _call(client.delete_thread, thread_id)

    return {
        "nodes":          parsed.get("nodes", []),
        "edges":          parsed.get("edges", []),
        "rows_processed": len(raw_rows),
        "tokens_used":    response.total_tokens,
    }


# ── Helpers ──────────────────────────────────────────────────────────────────────

def _parse_json(text: str) -> dict:
    """Extract and parse the first JSON object from an LLM response string."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass
    log.warning("Could not parse JSON from response: %.200s", text)
    return {}
