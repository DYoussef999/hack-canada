"""statscan_service.py — Statistics Canada WDS demographic data.

Primary source: pre-seeded 2021 Canadian Census data (fast, reliable).
Secondary: attempts a lightweight StatsCanada WDS ping for health checks.
Data is cached per census_division for 24 hours.

Census division alias mapping:
  "waterloo" / "3530"  → Regional Municipality of Waterloo
  "toronto"  / "3521"  → City of Toronto
  "hamilton" / "3525"  → City of Hamilton
  "london"   / "3539"  → City of London
  "ottawa"   / "3506"  → City of Ottawa
  "kitchener"/ "3537"  → City of Kitchener
"""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from config import config
from utils.cache import TTL_24H, cache
from utils.digest import CITY_TO_DIVISION, compute_sme_score, get_regional_data

log = logging.getLogger(__name__)

# StatsCanada WDS lightweight endpoint (no auth required)
_WDS_BASE = config.statscan_base_url


def resolve_census_division(input_str: str) -> str:
    """Map city alias or numeric code to a StatsCan census division code."""
    normalized = input_str.strip().lower()
    return CITY_TO_DIVISION.get(normalized, normalized if normalized.isdigit() else "3530")


async def get_demographic_profile(census_division: str) -> dict[str, Any]:
    """
    Return demographic data for a census division.

    Checks the TTL cache first. Falls back to pre-seeded 2021 Census data.
    Attempting a live WDS call is skipped here to keep latency under 5s
    (the WDS bulk tables are too large to parse in real-time).
    """
    cache_key = f"statscan:{census_division}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    division = resolve_census_division(census_division)
    data = get_regional_data(division)
    score = compute_sme_score(
        data.get("median_household_income"),
        data.get("population_growth_pct_5yr"),
        data.get("pct_age_25_44"),
    )
    result: dict[str, Any] = {**data, "census_division": division, "sme_friendliness_score": score}
    cache.set(cache_key, result, TTL_24H)
    log.info("statscan  division=%s  sme_score=%.1f  (pre-seeded)", division, score)
    return result


async def health_check() -> str:
    """Ping the StatsCanada WDS base URL to confirm reachability."""
    t0 = time.monotonic()
    try:
        # Use a lightweight metadata endpoint (no auth required)
        url = "https://www150.statcan.gc.ca/t1/tbl1/en/dtbl/getSeriesInfoFromVector/v41690973"
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            ms = int((time.monotonic() - t0) * 1000)
            if resp.status_code in (200, 404):  # 404 = endpoint exists but series not found = API up
                log.info("statscan  health  OK  %dms", ms)
                return "ok"
            return f"error: HTTP {resp.status_code}"
    except Exception as exc:
        ms = int((time.monotonic() - t0) * 1000)
        log.warning("statscan  health  error=%s  %dms", exc, ms)
        return f"error: {exc}"
