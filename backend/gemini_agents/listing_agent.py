"""listing_agent.py — Deterministic listing scorer + Gemini narrative.

Loads static listings, filters and scores them in Python, then asks Gemini
for business-type-specific recommendations per listing.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

from config import config
from models.briefings import ListingMatchReport, ListingMatchRequest, ScoredListing

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """
You are a Canadian commercial leasing advisor.

You will receive:
- business_type (string)
- listings (array) each with id, address, neighbourhood, monthly_cost, square_footage, fit_score, explanation

Task:
- Write a 1-sentence recommendation for each listing, tailored to the business_type.
- Keep it grounded in the provided facts. Do not invent foot traffic or demographics.

Return ONLY valid JSON with this schema:
{ "recommendations": [ {"id": number, "recommendation": string} ] }
""".strip()


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _load_listings() -> list[dict[str, Any]]:
    data_path = _repo_root() / "frontend" / "mock-data.json"
    with data_path.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    return raw.get("listings", [])


def _rent_score(cost: float, budget: float) -> float:
    if budget <= 0:
        return 0.0
    ratio = cost / budget
    if ratio <= 0.7:
        return 100.0
    if ratio <= 1.0:
        return 100.0 - ((ratio - 0.7) / 0.3) * 30.0
    if ratio <= 1.3:
        return 70.0 - ((ratio - 1.0) / 0.3) * 70.0
    return 0.0


def _size_score(sqft: float, desired: float) -> float:
    if desired <= 0:
        return 0.0
    ratio = sqft / desired
    diff = abs(1.0 - ratio)
    if diff <= 0.1:
        return 100.0
    if diff <= 0.3:
        return 100.0 - ((diff - 0.1) / 0.2) * 40.0
    if diff <= 0.5:
        return 60.0 - ((diff - 0.3) / 0.2) * 60.0
    return 0.0


def _score_listing(cost: float, sqft: float, budget: float, desired: float) -> tuple[int, str, dict[str, float]]:
    rent = _rent_score(cost, budget)
    size = _size_score(sqft, desired)
    fit = round(rent * 0.6 + size * 0.4)

    rent_pct = (cost / budget * 100.0) if budget > 0 else 0.0
    size_pct = (sqft / desired * 100.0) if desired > 0 else 0.0
    explanation = (
        f"Rent at {rent_pct:.0f}% of max budget and size at {size_pct:.0f}% of target."
    )
    return fit, explanation, {"rent": rent, "size": size}


def _filter_listing(cost: float, sqft: float, budget: float, desired: float) -> bool:
    if budget <= 0 or desired <= 0:
        return False
    if cost > budget:
        return False
    ratio = sqft / desired
    return 0.5 <= ratio <= 1.5


async def _recommendations(business_type: str, listings: list[dict[str, Any]]) -> dict[int, str]:
    client = genai.Client(api_key=config.gemini_api_key)
    payload = {
        "business_type": business_type,
        "listings": listings,
    }

    response = await client.aio.models.generate_content(
        model="gemini-3.1-flash-lite-preview",
        contents=json.dumps(payload),
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_PROMPT,
            temperature=0.3,
            response_mime_type="application/json",
        ),
    )

    data = json.loads(response.text or "{}")
    recs = {}
    for item in data.get("recommendations", []):
        if isinstance(item, dict) and "id" in item and "recommendation" in item:
            recs[int(item["id"]) ] = str(item["recommendation"])
    return recs


async def match(request: ListingMatchRequest) -> ListingMatchReport:
    listings = _load_listings()

    filtered = []
    for listing in listings:
        cost = float(listing.get("monthly_cost", 0))
        sqft = float(listing.get("square_footage", 0))
        if _filter_listing(cost, sqft, request.max_affordable_rent, request.desired_sqft):
            filtered.append(listing)

    scored: list[ScoredListing] = []
    for listing in filtered:
        cost = float(listing.get("monthly_cost", 0))
        sqft = float(listing.get("square_footage", 0))
        fit, explanation, _ = _score_listing(cost, sqft, request.max_affordable_rent, request.desired_sqft)

        scored.append(ScoredListing(
            id=int(listing.get("id")),
            address=str(listing.get("address")),
            neighbourhood=str(listing.get("neighbourhood")),
            monthly_cost=cost,
            square_footage=sqft,
            fit_score=int(fit),
            explanation=explanation,
            recommendation="",
        ))

    scored.sort(key=lambda s: s.fit_score, reverse=True)

    rec_map: dict[int, str] = {}
    try:
        if scored:
            rec_payload = [
                {
                    "id": s.id,
                    "address": s.address,
                    "neighbourhood": s.neighbourhood,
                    "monthly_cost": s.monthly_cost,
                    "square_footage": s.square_footage,
                    "fit_score": s.fit_score,
                    "explanation": s.explanation,
                }
                for s in scored
            ]
            rec_map = await _recommendations(request.business_type, rec_payload)
    except Exception as exc:
        log.warning("listing  Gemini recommendation error: %s", exc)

    final = []
    for s in scored:
        s.recommendation = rec_map.get(s.id) or (
            f"Strong fit for a {request.business_type} with rent and size aligned to your targets."
        )
        final.append(s)

    return ListingMatchReport(
        ranked_listings=final,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
