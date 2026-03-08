import os
import httpx
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/locations", tags=["locations"])

BESTTIME_PRIVATE_KEY = os.getenv("BESTTIME_PRIVATE_KEY")
BESTTIME_PUBLIC_KEY = os.getenv("BESTTIME_PUBLIC_KEY")
BESTTIME_FORECAST_URL = "https://besttime.app/api/v1/forecasts"
BESTTIME_QUERY_URL = "https://besttime.app/api/v1/forecasts/week"

# ── Hardcoded base locations (swapped for AI-filtered ones later) ─────────────
BASE_LOCATIONS = [
    {
        "id": 1,
        "name": "Uptown Waterloo",
        "latitude": 43.4668,
        "longitude": -80.5224,
        "opportunity_score": 87,
        "estimated_rent": 3200,
        "projected_profit_margin": 0.24,
        "address": "99 Regina St N, Waterloo, ON",
        "besttime_query": {"name": "Uptown Waterloo", "address": "99 Regina St N Waterloo ON Canada"},
    },
    {
        "id": 2,
        "name": "Downtown Kitchener",
        "latitude": 43.4516,
        "longitude": -80.4925,
        "opportunity_score": 72,
        "estimated_rent": 2750,
        "projected_profit_margin": 0.19,
        "address": "305 King St W, Kitchener, ON",
        "besttime_query": {"name": "Downtown Kitchener", "address": "305 King St W Kitchener ON Canada"},
    },
    {
        "id": 3,
        "name": "University Ave Plaza",
        "latitude": 43.4723,
        "longitude": -80.5449,
        "opportunity_score": 91,
        "estimated_rent": 3800,
        "projected_profit_margin": 0.28,
        "address": "550 University Ave W, Waterloo, ON",
        "besttime_query": {"name": "University Ave Waterloo", "address": "550 University Ave W Waterloo ON Canada"},
    },
    {
        "id": 4,
        "name": "Laurelwood District",
        "latitude": 43.4455,
        "longitude": -80.5612,
        "opportunity_score": 45,
        "estimated_rent": 2100,
        "projected_profit_margin": 0.14,
        "address": "450 Erb St W, Waterloo, ON",
        "besttime_query": {"name": "Laurelwood Waterloo", "address": "450 Erb St W Waterloo ON Canada"},
    },
]

# Fallback hourly data if BestTime fails or credits run out
FALLBACK_HOURLY = {
    1: [5,5,5,5,5,5,10,20,35,45,55,65,70,65,60,65,70,80,90,85,75,60,40,15],
    2: [5,5,5,5,5,10,20,45,70,75,70,65,60,65,70,65,60,55,50,45,35,25,15,8],
    3: [10,8,15,5,10,30,65,80,75,70,60,55,50,60,70,65,55,50,45,40,35,30,20,10],
    4: [2,2,2,2,2,5,10,20,30,40,50,55,60,55,50,45,40,35,30,20,15,10,5,2],
}


async def fetch_besttime_hourly(client: httpx.AsyncClient, location: dict) -> list:
    """
    Call BestTime forecast for a venue and return averaged 24-hour busyness array.
    Averages across all 7 days to get a typical weekly pattern.
    Falls back to hardcoded data if the API call fails.
    """
    if not BESTTIME_PRIVATE_KEY:
        return FALLBACK_HOURLY.get(location["id"], [0] * 24)

    try:
        response = await client.post(
            BESTTIME_FORECAST_URL,
            data={
                "api_key_private": BESTTIME_PRIVATE_KEY,
                "venue_name": location["besttime_query"]["name"],
                "venue_address": location["besttime_query"]["address"],
            },
            timeout=15.0,
        )
        data = response.json()

        if data.get("status") != "OK":
            print(f"BestTime error for {location['name']}: {data.get('message')}")
            return FALLBACK_HOURLY.get(location["id"], [0] * 24)

        # Extract day_raw arrays from each day and average them
        analysis = data.get("analysis", [])
        if not analysis:
            return FALLBACK_HOURLY.get(location["id"], [0] * 24)

        all_days = [day.get("day_raw", []) for day in analysis if day.get("day_raw")]
        if not all_days:
            return FALLBACK_HOURLY.get(location["id"], [0] * 24)

        # Average across all days that returned data
        num_days = len(all_days)
        averaged = [
            round(sum(all_days[d][h] for d in range(num_days)) / num_days)
            for h in range(24)
        ]
        return averaged

    except Exception as e:
        print(f"BestTime fetch failed for {location['name']}: {e}")
        return FALLBACK_HOURLY.get(location["id"], [0] * 24)


class SearchRequest(BaseModel):
    business_type: Optional[str] = None
    location: Optional[str] = None
    budget: Optional[float] = None
    square_footage: Optional[float] = None


@router.post("/search")
async def search_locations(body: SearchRequest):
    """
    Returns shortlisted locations with real BestTime hourly foot traffic.
    Currently uses hardcoded base locations — AI filtering plugs in here later.
    Each location's hourly array is fetched from BestTime in parallel to save time.
    """

    # ── Future: AI filtering goes here ───────────────────────────────────────
    # filtered = ai_filter(BASE_LOCATIONS, body.business_type, body.budget, body.square_footage)
    # For now, just use all locations (optionally filter by budget as a quick demo)
    filtered = BASE_LOCATIONS
    if body.budget:
        filtered = [loc for loc in filtered if loc["estimated_rent"] <= body.budget]

    if not filtered:
        # If budget is too low, return all anyway so map isn't empty
        filtered = BASE_LOCATIONS

    # ── Fetch BestTime data for all filtered locations in parallel ────────────
    async with httpx.AsyncClient() as client:
        hourly_results = await asyncio.gather(*[
            fetch_besttime_hourly(client, loc) for loc in filtered
        ])

    # ── Build response ────────────────────────────────────────────────────────
    results = []
    for loc, hourly in zip(filtered, hourly_results):
        results.append({
            "id": loc["id"],
            "name": loc["name"],
            "latitude": loc["latitude"],
            "longitude": loc["longitude"],
            "opportunity_score": loc["opportunity_score"],
            "estimated_rent": loc["estimated_rent"],
            "projected_profit_margin": loc["projected_profit_margin"],
            "address": loc["address"],
            "hourly": hourly,
        })

    return {"status": "ok", "locations": results}


@router.get("/health")
async def health():
    return {"status": "ok", "besttime_configured": bool(BESTTIME_PRIVATE_KEY)}