import os
import json
import httpx
import asyncio
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/locations", tags=["locations"])

# Also accepts BESTTIME_API_KEY as a fallback (e.g. if the private key was stored under that name)
BESTTIME_PRIVATE_KEY = os.getenv("BESTTIME_PRIVATE_KEY") or os.getenv("BESTTIME_API_KEY")
BESTTIME_PUBLIC_KEY = os.getenv("BESTTIME_PUBLIC_KEY")
BESTTIME_FORECAST_URL = "https://besttime.app/api/v1/forecasts"
BESTTIME_QUERY_URL = "https://besttime.app/api/v1/forecasts/week"

# BASE_LOCATIONS deprecated — data now sourced from mock-data.json
BASE_LOCATIONS = []

# ── Geocoded coordinates for mock-data.json addresses ─────────────────────────
# Approximate lat/lng for known Waterloo, ON addresses.
_ADDRESS_COORDS = {
    "144 King St N, Waterloo, ON N2J 2X6":   (43.4698, -80.5228),
    "187 King St N, Waterloo, ON N2J 2X8":   (43.4712, -80.5222),
    "75 King St S, Waterloo, ON N2J 1P2":    (43.4605, -80.5242),
    "51 Erb St E, Waterloo, ON N2J 1L7":     (43.4642, -80.5185),
    "270 King St N, Waterloo, ON N2J 2Y9":   (43.4732, -80.5215),
    "232 King St N, Waterloo, ON N2J 2Y6":   (43.4718, -80.5218),
    "152 University Ave W, Waterloo, ON N2L 3E9": (43.4712, -80.5350),
    "89 Bridgeport Rd E, Waterloo, ON N2J 2K4":  (43.4780, -80.5170),
    "450 King St N, Waterloo, ON N2J 3A1":   (43.4790, -80.5188),
    "18 William St W, Waterloo, ON N2L 1J6": (43.4735, -80.5265),
    "44 Noecker St, Waterloo, ON N2J 2R3":   (43.4660, -80.5195),
    "11 Willow St W, Waterloo, ON N2J 1V4":  (43.4675, -80.5248),
    "320 Albert St, Waterloo, ON N2L 3V2":   (43.4745, -80.5320),
    "88 Regina St N, Waterloo, ON N2J 3A5":  (43.4668, -80.5224),
}

# ── Neighbourhood quality scores (for opportunity_score derivation) ───────────
_NEIGHBOURHOOD_SCORES = {
    "Uptown Waterloo": 85,
    "Near Wilfrid Laurier University": 78,
    "University Corridor": 75,
    "Bridgeport": 60,
    "North King": 68,
    "Uptown Fringe": 62,
}

# ── Fallback hourly traffic patterns by neighbourhood type ────────────────────
# Seeded patterns for different area types when BestTime is unavailable
_FALLBACK_HOURLY_PATTERNS = {
    "high_traffic":   [5,5,5,5,5,5,10,20,35,45,55,65,70,65,60,65,70,80,90,85,75,60,40,15],
    "university":     [10,8,15,5,10,30,65,80,75,70,60,55,50,60,70,65,55,50,45,40,35,30,20,10],
    "moderate":       [5,5,5,5,5,10,20,45,70,75,70,65,60,65,70,65,60,55,50,45,35,25,15,8],
    "low_traffic":    [2,2,2,2,2,5,10,20,30,40,50,55,60,55,50,45,40,35,30,20,15,10,5,2],
    "residential":    [3,3,3,3,3,5,15,25,35,40,45,50,55,50,45,50,55,60,55,45,35,20,10,5],
}

_NEIGHBOURHOOD_TRAFFIC = {
    "Uptown Waterloo": "high_traffic",
    "Near Wilfrid Laurier University": "university",
    "University Corridor": "university",
    "Bridgeport": "low_traffic",
    "North King": "moderate",
    "Uptown Fringe": "residential",
}


def _get_fallback_hourly(location: dict) -> list:
    """Return a fallback hourly pattern based on neighbourhood."""
    pattern_key = _NEIGHBOURHOOD_TRAFFIC.get(location.get("neighbourhood", ""), "moderate")
    base = list(_FALLBACK_HOURLY_PATTERNS[pattern_key])
    # Add slight variance per location to avoid identical charts
    import random
    rng = random.Random(location.get("id", 0))
    return [max(0, min(100, v + rng.randint(-5, 5))) for v in base]


def load_mock_locations() -> list:
    """
    Load location data from mock-data.json. This is the single point of entry
    for all location data loading — replaces the deprecated BASE_LOCATIONS.

    Reads frontend/mock-data.json, geocodes addresses, and generates derived
    fields (opportunity_score, projected_profit_margin) to match the expected
    response shape.
    """
    # Try multiple paths to find mock-data.json
    candidates = [
        Path(__file__).resolve().parent.parent.parent / "frontend" / "mock-data.json",
        Path(__file__).resolve().parent.parent / "mock-data.json",
        Path("frontend") / "mock-data.json",
        Path("../frontend") / "mock-data.json",
    ]

    raw = None
    for path in candidates:
        if path.exists():
            try:
                raw = json.loads(path.read_text())
                break
            except (json.JSONDecodeError, OSError) as e:
                logger.warning(f"Failed to parse {path}: {e}")

    if raw is None:
        logger.warning("mock-data.json unavailable — no base locations loaded")
        return []

    listings = raw.get("listings", [])
    if not listings:
        logger.warning("mock-data.json has no listings")
        return []

    locations = []
    for listing in listings:
        address = listing.get("address", "")
        neighbourhood = listing.get("neighbourhood", "Unknown")
        monthly_cost = listing.get("monthly_cost", 0)
        sqft = listing.get("square_footage", 500)

        # Geocode from lookup table
        coords = _ADDRESS_COORDS.get(address)
        if not coords:
            logger.warning(f"No coordinates for address: {address} — skipping")
            continue

        lat, lng = coords

        # Derive opportunity_score from neighbourhood quality + value factors
        base_score = _NEIGHBOURHOOD_SCORES.get(neighbourhood, 55)
        # Adjust for value: lower rent per sqft = better value
        rent_per_sqft = monthly_cost / max(sqft, 1)
        value_bonus = max(-10, min(10, 5 - rent_per_sqft))
        # Adjust for size: larger spaces score slightly higher
        size_bonus = min(5, (sqft - 500) / 200)
        opportunity_score = max(10, min(98, int(base_score + value_bonus + size_bonus)))

        # Derive projected_profit_margin from rent burden
        # Lower rent = higher potential margin
        if monthly_cost <= 2500:
            margin = 0.26
        elif monthly_cost <= 3500:
            margin = 0.22
        elif monthly_cost <= 5000:
            margin = 0.18
        else:
            margin = 0.14

        # Slight variance based on neighbourhood desirability
        margin += (base_score - 65) * 0.001

        # Clean address for BestTime query (remove postal code for better matching)
        addr_parts = address.rsplit(",", 1)
        clean_addr = addr_parts[0].strip() if addr_parts else address
        city_part = "Waterloo ON Canada"

        locations.append({
            "id": listing["id"],
            "name": neighbourhood,
            "latitude": lat,
            "longitude": lng,
            "opportunity_score": opportunity_score,
            "estimated_rent": monthly_cost,
            "projected_profit_margin": round(margin, 3),
            "address": address,
            "square_footage": sqft,
            "neighbourhood": neighbourhood,
            "besttime_query": {
                "name": f"{neighbourhood} {clean_addr}",
                "address": f"{clean_addr} {city_part}",
            },
        })

    logger.info(f"Loaded {len(locations)} locations from mock-data.json")
    return locations


# ── Load locations once at module level ───────────────────────────────────────
MOCK_LOCATIONS = load_mock_locations()


async def fetch_besttime_hourly(client: httpx.AsyncClient, location: dict):
    """
    Calls BestTime POST /forecasts and returns an averaged 24-hour busyness array.
    Falls back to neighbourhood-based pattern if API unavailable.
    """
    if not BESTTIME_PRIVATE_KEY:
        return _get_fallback_hourly(location), "fallback"

    besttime_query = location.get("besttime_query")
    if not besttime_query:
        return _get_fallback_hourly(location), "fallback"

    try:
        response = await client.post(
            BESTTIME_FORECAST_URL,
            data={
                "api_key_private": BESTTIME_PRIVATE_KEY,
                "venue_name": besttime_query["name"],
                "venue_address": besttime_query["address"],
            },
            timeout=15.0,
        )
        data = response.json()

        if data.get("status") != "OK":
            print(f"BestTime error for {location['name']}: {data.get('message')}")
            return _get_fallback_hourly(location), "fallback"

        analysis = data.get("analysis", [])
        if not analysis:
            return _get_fallback_hourly(location), "fallback"

        all_days = [day.get("day_raw", []) for day in analysis if day.get("day_raw")]
        if not all_days:
            return _get_fallback_hourly(location), "fallback"

        num_days = len(all_days)
        averaged = [
            round(sum(all_days[d][h] for d in range(num_days)) / num_days)
            for h in range(24)
        ]
        return averaged, "live"

    except Exception as e:
        print(f"BestTime fetch failed for {location['name']}: {e}")
        return _get_fallback_hourly(location), "fallback"


class SearchRequest(BaseModel):
    business_type: Optional[str] = None
    location: Optional[str] = None
    budget: Optional[float] = None
    square_footage: Optional[float] = None


@router.post("/search")
async def search_locations(body: SearchRequest):
    """
    Returns shortlisted locations with real BestTime hourly foot traffic.
    Data sourced from mock-data.json via load_mock_locations().
    """
    all_locations = MOCK_LOCATIONS if MOCK_LOCATIONS else load_mock_locations()

    if not all_locations:
        return {"status": "ok", "locations": [], "data_source": "fallback"}

    # Filter by budget
    filtered = all_locations
    if body.budget:
        filtered = [loc for loc in filtered if loc["estimated_rent"] <= body.budget]

    if not filtered:
        # If budget is too low, return all anyway so map isn't empty
        filtered = all_locations

    # Fetch BestTime data for all filtered locations in parallel
    async with httpx.AsyncClient() as client:
        fetch_results = await asyncio.gather(*[
            fetch_besttime_hourly(client, loc) for loc in filtered
        ])

    # Build response
    results = []
    sources = []
    for loc, (hourly, source) in zip(filtered, fetch_results):
        sources.append(source)
        results.append({
            "id": loc["id"],
            "name": loc["name"],
            "latitude": loc["latitude"],
            "longitude": loc["longitude"],
            "opportunity_score": loc["opportunity_score"],
            "estimated_rent": loc["estimated_rent"],
            "projected_profit_margin": loc["projected_profit_margin"],
            "address": loc["address"],
            "square_footage": loc.get("square_footage"),
            "neighbourhood": loc.get("neighbourhood"),
            "hourly": hourly,
        })

    data_source = "live" if any(s == "live" for s in sources) else "fallback"
    if data_source == "fallback":
        print("BestTime API unavailable — using fallback traffic data")
    else:
        print(f"BestTime API: live foot traffic data loaded for {sum(s == 'live' for s in sources)} location(s)")

    return {"status": "ok", "locations": results, "data_source": data_source}


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "besttime_configured": bool(BESTTIME_PRIVATE_KEY),
        "locations_loaded": len(MOCK_LOCATIONS),
    }
