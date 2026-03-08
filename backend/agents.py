"""
agents.py — Backboard.io multi-agent system for Compass AI.

Architecture
────────────
AccountantAgent  Ingests React Flow canvas JSON → computes Canadian SMB financials →
                 saves Financial Health markers to Backboard's assistant-level memory.

ScoutAgent       Strategy advisor. In transition — pending real-world location data merge.

SheetsIngestor   Separate assistant for parsing raw spreadsheet rows into typed React Flow nodes.
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
    ToolOutput,
)

load_dotenv()

log = logging.getLogger(__name__)

# ── Singleton SDK client ────────────────────────────────────────────────────────
_api_key = os.getenv("BACKBOARD_API_KEY")
if not _api_key:
    raise RuntimeError("BACKBOARD_API_KEY is not set.")
client = BackboardClient(api_key=_api_key)


async def _call(fn, *args, **kwargs):
    return await fn(*args, **kwargs)


# ── Tool definitions ────────────────────────────────────────────────────────────

# SCOUT_TOOLS is empty — location search services are pending a merge from the map team.
SCOUT_TOOLS = []

# ── System prompts ───────────────────────────────────────────────────────────────

_ACCOUNTANT_PROMPT = """
You are The Accountant — a Canadian SMB financial analyst embedded in Compass AI.

When given a React Flow canvas (JSON of nodes + edges) representing a business model:
1. Sum all 'source' nodes → monthly revenue.
2. Sum all 'expense' nodes → monthly expenses, grouped by category (Staff / Overhead / OpEx).
3. Compute: burn_rate, gross_margin_pct, health_score (0–100).
4. Flag any expense that exceeds 30% of total revenue.
5. Derive max_affordable_rent as revenue × 0.10.

Respond with ONLY valid JSON.
""".strip()

_SCOUT_PROMPT = """
You are The Scout — a strategic expansion advisor.

NOTE: Real-time location intelligence (rents, foot traffic) is currently being merged.
For now, provide general expansion strategy based on the financial constraints
provided by the Accountant. Explain that location-specific scoring is coming soon.

Respond with ONLY valid JSON:
{
  "locations": [],
  "recommendation": "Location-specific analysis is pending a data merge. Based on your current margins..."
}
""".strip()

_INGESTOR_PROMPT = """
You are a financial data parser. Convert raw spreadsheet rows into React Flow nodes.
Respond with ONLY valid JSON.
""".strip()


# ── Tool call normalizer ─────────────────────────────────────────────────────────

def _unpack_tool_call(tc: Union[dict, Any]) -> tuple[str, str, str]:
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
    global _accountant_id, _scout_id, _ingestor_id
    existing = await _call(client.list_assistants)
    by_name  = {a.name: a for a in existing}

    async def _get_or_create(name: str, prompt: str, tools=None) -> str:
        if name in by_name:
            return str(by_name[name].assistant_id)
        kwargs = dict(name=name, system_prompt=prompt)
        if tools: kwargs["tools"] = tools
        a = await _call(client.create_assistant, **kwargs)
        return str(a.assistant_id)

    _accountant_id, _scout_id, _ingestor_id = await asyncio.gather(
        _get_or_create("Compass-Accountant", _ACCOUNTANT_PROMPT),
        _get_or_create("Compass-Scout",      _SCOUT_PROMPT, tools=SCOUT_TOOLS),
        _get_or_create("Compass-Ingestor",   _INGESTOR_PROMPT),
    )


# ── Session management ───────────────────────────────────────────────────────────

async def start_session(session_id: str) -> dict:
    if session_id in _sessions:
        s = _sessions[session_id]
        return {
            "session_id": session_id,
            "accountant_thread_id": s.accountant_thread_id,
            "scout_thread_id": s.scout_thread_id,
            "resumed": True,
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
        "session_id": session_id,
        "accountant_thread_id": str(a_thread.thread_id),
        "scout_thread_id": str(s_thread.thread_id),
        "resumed": False,
    }


# ── Accountant agent ─────────────────────────────────────────────────────────────

async def accountant_sync_canvas(session_id: str, nodes: list[dict], edges: list[dict]) -> dict:
    session = _sessions.get(session_id)
    if not session: raise ValueError(f"Session '{session_id}' not found.")

    canvas_json = json.dumps({"nodes": nodes, "edges": edges}, indent=2)
    response = await _call(
        client.add_message,
        thread_id=session.accountant_thread_id,
        content=f"Analyze this canvas:\n\n{canvas_json}",
        llm_provider="google",
        model_name="gemini-3.1-flash-lite-preview",
        memory="Auto",
    )

    analysis = _parse_json(response.content or "")
    markers = analysis.get("financial_markers", {})
    if markers:
        session.last_markers = markers
        await _call(
            client.add_memory,
            assistant_id=_accountant_id,
            content=f"Financial markers: {markers}",
            metadata={"type": "financial_health", "session": session_id},
        )

    return {"analysis": analysis, "tokens_used": response.total_tokens}


# ── Scout agent ──────────────────────────────────────────────────────────────────

async def scout_optimize_expansion(
    session_id:    str,
    target_cities: list[str],
    business_type: str,
    deep_analysis: bool = False,
) -> dict:
    session = _sessions.get(session_id)
    if not session: raise ValueError(f"Session '{session_id}' not found.")

    model = "claude-3-5-sonnet-20241022" if deep_analysis else "gemini-3.1-flash-lite-preview"
    response = await _call(
        client.add_message,
        thread_id=session.scout_thread_id,
        content=f"Expansion strategy for {business_type} in {target_cities}. Focus on financial readiness.",
        llm_provider="google" if not deep_analysis else "anthropic",
        model_name=model,
    )

    return {
        "result": _parse_json(response.content or ""),
        "model_used": model,
        "tokens_used": response.total_tokens,
    }


# ── Sheets ingestor ──────────────────────────────────────────────────────────────

async def ingest_sheet_rows(raw_rows: list[dict]) -> dict:
    tmp_thread = await _call(client.create_thread, _ingestor_id)
    thread_id  = str(tmp_thread.thread_id)
    try:
        response = await _call(
            client.add_message,
            thread_id=thread_id,
            content=f"Parse these rows: {json.dumps(raw_rows)}",
            llm_provider="google",
            model_name="gemini-3.1-flash-lite-preview",
        )
        parsed = _parse_json(response.content or "")
    finally:
        await _call(client.delete_thread, thread_id)
    return {"nodes": parsed.get("nodes", []), "edges": parsed.get("edges", [])}


# ── Helpers ──────────────────────────────────────────────────────────────────────

def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}") + 1
        if start >= 0 and end > start:
            try: return json.loads(text[start:end])
            except: pass
    return {}
