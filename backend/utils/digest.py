"""digest.py — Transform raw API responses into compact Economic Briefing dicts.

Agents never receive raw JSON. Every external API response passes through
a function here before entering any prompt or Pydantic model.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Optional


# ── Bank of Canada ────────────────────────────────────────────────────────────

def digest_boc(raw: dict[str, Any]) -> dict[str, Optional[float]]:
    """Extract overnight rate, CPI, CAD/USD from BoC Valet multi-series response.
    Searches backwards from the end of observations to find the most recent
    available value for each specific series.
    """
    observations = raw.get("observations", [])
    if not observations:
        return {"overnight_rate": None, "cpi": None, "cad_usd": None}

    def _find_latest(key: str) -> Optional[float]:
        # Iterate backwards to find the actual latest value for this specific series
        for obs in reversed(observations):
            if key in obs and "v" in obs[key]:
                try:
                    return float(obs[key]["v"])
                except (TypeError, ValueError):
                    continue
        return None

    cpi_raw = _find_latest("V41690973")
    cpi_rounded = round(cpi_raw, 1) if cpi_raw is not None else None

    return {
        "overnight_rate": _find_latest("V122514"),
        "cpi": cpi_rounded,
        "cad_usd": _find_latest("FXUSDCAD"),
    }


def digest_fred_observation(raw: dict[str, Any]) -> Optional[float]:
    """Extract the latest value from a FRED observations response."""
    obs = raw.get("observations", [])
    if not obs:
        return None
    try:
        val = obs[-1].get("value", ".")
        return None if val == "." else float(val)
    except (TypeError, ValueError):
        return None


def build_macro_summary(overnight_rate: Optional[float], cpi: Optional[float]) -> tuple[str, str]:
    """Return (trend_label, smb_impact_summary) from macro data."""
    if overnight_rate is None:
        return "stable", (
            "Macro data temporarily unavailable — using conservative estimates. "
            "Check Bank of Canada website for current rate guidance before finalizing expansion plans."
        )

    if overnight_rate > 4.5:
        trend = "tightening"
        summary = (
            f"The Bank of Canada overnight rate at {overnight_rate:.2f}% makes business financing expensive. "
            "Delay expansion or seek fixed-rate loans to lock in before further hikes."
        )
    elif overnight_rate < 3.0:
        trend = "easing"
        cpi_str = f"{cpi:.1f}%" if cpi else "within target"
        summary = (
            f"BoC's {overnight_rate:.2f}% overnight rate signals easing — variable-rate business loans are cheaper. "
            f"With CPI at {cpi_str}, input cost pressures are manageable; a good window to negotiate leases."
        )
    else:
        trend = "stable"
        cpi_str = f"{cpi:.1f}%" if cpi else "near target"
        summary = (
            f"The overnight rate at {overnight_rate:.2f}% offers predictable financing costs for SMB expansion loans. "
            f"CPI at {cpi_str} — monitor for any BoC shift before signing multi-year lease commitments."
        )

    return trend, summary


# ── BestTime ──────────────────────────────────────────────────────────────────

_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def digest_foot_traffic(raw: dict[str, Any]) -> dict[str, Any]:
    """Extract peak hours and busy scores from a BestTime forecast response."""
    if raw.get("status") != "OK":
        return {"peak_hours": {}, "best_day": "Saturday", "weekly_avg": 0}

    week_raw: list[dict] = raw.get("analysis", {}).get("week_raw", [])
    if not week_raw:
        # Try alternative response shape
        week_raw = raw.get("analysis", []) if isinstance(raw.get("analysis"), list) else []

    peak_hours: dict[str, dict] = {}
    for day_data in week_raw:
        day_idx = day_data.get("day_int", 0)
        day_name = _DAYS[day_idx % 7]
        hourly: list[int] = day_data.get("day_raw", [])
        if hourly:
            max_val = max(hourly)
            peak_hours[day_name] = {"peak_hour": hourly.index(max_val), "busy_score": max_val}

    best_day = max(peak_hours, key=lambda d: peak_hours[d]["busy_score"]) if peak_hours else "Saturday"
    scores = [v["busy_score"] for v in peak_hours.values()]
    weekly_avg = int(sum(scores) / len(scores) * 15) if scores else 0  # rough visitor estimate

    return {"peak_hours": peak_hours, "best_day": best_day, "weekly_avg": weekly_avg}


# ── Mapbox ────────────────────────────────────────────────────────────────────

def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6_371_000
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + (
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


def digest_competitor_density(
    features: list[dict],
    lat: float,
    lng: float,
    radius_m: int,
) -> dict[str, Any]:
    """Count features within radius and compute density score."""
    within: list[dict] = []
    for f in features:
        center = f.get("center", [0.0, 0.0])
        dist = _haversine_m(lat, lng, center[1], center[0])
        if dist <= radius_m:
            within.append(f)

    count = len(within)
    # Score: 0-2 = low (20-30), 3-6 = medium (40-65), 7+ = high (70-95)
    if count <= 2:
        score = 20.0 + count * 5
    elif count <= 6:
        score = 40.0 + (count - 3) * 8
    else:
        score = min(70.0 + (count - 7) * 5, 95.0)

    label = "underserved" if score < 35 else ("saturated" if score > 65 else "moderate")
    return {"count": count, "density_score": round(score, 1), "opportunity_label": label}


def digest_transit(features: list[dict], lat: float, lng: float) -> dict[str, Any]:
    """Find nearest transit stop from Mapbox POI features."""
    nearest_name: Optional[str] = None
    nearest_dist = float("inf")

    for f in features:
        center = f.get("center", [0.0, 0.0])
        dist = _haversine_m(lat, lng, center[1], center[0])
        name = f.get("text") or f.get("place_name", "")
        if dist < nearest_dist:
            nearest_dist = dist
            nearest_name = name

    if nearest_name is None:
        return {"stop": None, "dist": None, "type": "none"}

    upper = nearest_name.upper()
    if "ION" in upper or "GRT" in upper:
        t_type = "ION"
    elif "GO STATION" in upper or "GO TRAIN" in upper or "GO " in upper:
        t_type = "GO"
    elif "BUS" in upper or "STATION" in upper or "STOP" in upper:
        t_type = "bus"
    else:
        t_type = "none"

    return {"stop": nearest_name, "dist": round(nearest_dist), "type": t_type}


# ── StatsCanada (pre-seeded 2021 Census) ─────────────────────────────────────

_REGIONAL_DATA: dict[str, dict[str, Any]] = {
    "3530": {
        "region_name": "Regional Municipality of Waterloo",
        "total_population": 587000,
        "median_household_income": 97200.0,
        "population_growth_pct_5yr": 8.3,
        "pct_age_25_44": 28.4,
        "dominant_industry": "Professional, Scientific & Technical Services",
    },
    "3521": {
        "region_name": "City of Toronto",
        "total_population": 2930000,
        "median_household_income": 84000.0,
        "population_growth_pct_5yr": 5.2,
        "pct_age_25_44": 31.2,
        "dominant_industry": "Finance & Insurance",
    },
    "3525": {
        "region_name": "City of Hamilton",
        "total_population": 569000,
        "median_household_income": 82500.0,
        "population_growth_pct_5yr": 7.1,
        "pct_age_25_44": 26.8,
        "dominant_industry": "Manufacturing & Logistics",
    },
    "3539": {
        "region_name": "City of London",
        "total_population": 422000,
        "median_household_income": 78000.0,
        "population_growth_pct_5yr": 6.8,
        "pct_age_25_44": 27.3,
        "dominant_industry": "Health Care & Social Assistance",
    },
    "3506": {
        "region_name": "City of Ottawa",
        "total_population": 1017000,
        "median_household_income": 101000.0,
        "population_growth_pct_5yr": 9.5,
        "pct_age_25_44": 29.1,
        "dominant_industry": "Public Administration",
    },
    "3537": {
        "region_name": "City of Kitchener",
        "total_population": 256000,
        "median_household_income": 91000.0,
        "population_growth_pct_5yr": 10.2,
        "pct_age_25_44": 30.1,
        "dominant_industry": "Professional, Scientific & Technical Services",
    },
}

# Alias map for human-readable city names → census division codes
CITY_TO_DIVISION: dict[str, str] = {
    "waterloo": "3530",
    "regional municipality of waterloo": "3530",
    "toronto": "3521",
    "hamilton": "3525",
    "london": "3539",
    "ottawa": "3506",
    "kitchener": "3537",
}


def get_regional_data(census_division: str) -> dict[str, Any]:
    """Return pre-seeded regional data, defaulting to Waterloo Region."""
    return _REGIONAL_DATA.get(census_division, _REGIONAL_DATA["3530"])


def compute_sme_score(income: Optional[float], growth: Optional[float], pct_25_44: Optional[float]) -> float:
    """Compute SME friendliness score 0–100 from demographic inputs."""
    income_score = min((income or 80000) / 120000 * 40, 40.0)
    growth_score = min((growth or 5.0) / 15.0 * 30, 30.0)
    age_score = min((pct_25_44 or 25.0) / 35.0 * 30, 30.0)
    return round(income_score + growth_score + age_score, 1)


# ── Square ────────────────────────────────────────────────────────────────────

def digest_square_catalog(raw: dict[str, Any]) -> dict[str, Any]:
    """Extract catalog summary from Square /v2/catalog/list response."""
    items = [obj for obj in raw.get("objects", []) if obj.get("type") == "ITEM"]
    categories: dict[str, int] = {}
    total_rev = 0.0

    for item in items:
        item_data = item.get("item_data", {})
        cat_name = (item_data.get("category") or {}).get("name", "Uncategorized")
        categories[cat_name] = categories.get(cat_name, 0) + 1
        for var in item_data.get("variations", []):
            price_money = (var.get("item_variation_data") or {}).get("price_money", {})
            amount_cad = (price_money.get("amount") or 0) / 100
            total_rev += amount_cad * 30  # mock: 30 units/month

    top_cats = sorted(categories, key=lambda k: categories[k], reverse=True)[:5]
    return {
        "item_count": len(items),
        "top_categories": top_cats,
        "estimated_monthly_revenue": round(total_rev, 2),
    }


# ── UPC ───────────────────────────────────────────────────────────────────────

def digest_upc_item(raw: dict[str, Any], cad_usd_rate: float = 0.74) -> dict[str, Any]:
    """Extract product details and convert price to CAD."""
    items = raw.get("items", [])
    if not items:
        return {"product_name": None, "brand": None, "category": None, "price_cad": None}

    item = items[0]
    offers = item.get("offers", [])
    price_usd: Optional[float] = None
    if offers:
        try:
            price_usd = float(offers[0].get("price", 0))
        except (TypeError, ValueError):
            pass

    price_cad = round(price_usd / cad_usd_rate, 2) if price_usd else None
    suggested_markup = 45.0 if price_cad and price_cad < 10 else 35.0

    return {
        "product_name": item.get("title"),
        "brand": item.get("brand"),
        "category": item.get("category"),
        "price_cad": price_cad,
        "suggested_markup": suggested_markup,
    }


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
