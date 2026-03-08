"""fred_service.py — FRED (Federal Reserve Bank of St. Louis) API wrapper.

Fetches CAD-relevant macro series as cross-reference to BoC data.
Series used:
  CPALCY01CAM661N  Canada CPI (% change from year ago)
  INTDSRCAM193N    Canada discount rate (central bank)
"""
from __future__ import annotations

import logging
import time
from typing import Any, Optional

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from config import config

log = logging.getLogger(__name__)


def _is_retryable(exc: BaseException) -> bool:
    return isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code in (429, 503)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception(_is_retryable),
    reraise=True,
)
async def fetch_series(series_id: str) -> Optional[dict[str, Any]]:
    """Fetch the latest observation for a FRED series. Returns raw response."""
    if not config.fred_api_key:
        log.warning("FRED_API_KEY not set — skipping FRED fetch")
        return None

    url = f"{config.fred_base_url}/series/observations"
    params = {
        "series_id": series_id,
        "api_key": config.fred_api_key,
        "limit": 5,
        "sort_order": "desc",
        "file_type": "json",
    }
    t0 = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            ms = int((time.monotonic() - t0) * 1000)
            log.info("fred  series=%s  OK  %dms", series_id, ms)
            return resp.json()
    except httpx.HTTPStatusError as exc:
        ms = int((time.monotonic() - t0) * 1000)
        log.warning("fred  series=%s  status=%d  %dms", series_id, exc.response.status_code, ms)
        raise
    except Exception as exc:
        ms = int((time.monotonic() - t0) * 1000)
        log.warning("fred  series=%s  error=%s  %dms", series_id, exc, ms)
        return None


async def fetch_canada_cpi() -> Optional[dict[str, Any]]:
    return await fetch_series("CPALCY01CAM661N")


async def fetch_canada_rate() -> Optional[dict[str, Any]]:
    return await fetch_series("INTDSRCAM193N")


async def health_check() -> str:
    """Lightweight FRED connectivity check."""
    if not config.fred_api_key:
        return "error: FRED_API_KEY not configured"
    try:
        url = f"{config.fred_base_url}/series"
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params={
                "series_id": "CPALCY01CAM661N",
                "api_key": config.fred_api_key,
                "file_type": "json",
            })
            resp.raise_for_status()
        return "ok"
    except Exception as exc:
        return f"error: {exc}"
