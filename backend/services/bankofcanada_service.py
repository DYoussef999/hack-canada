"""bankofcanada_service.py — Bank of Canada Valet API wrapper.

Fetches overnight rate (V122514), CPI (V41690973), and CAD/USD (V37426)
in a single request. Caches result for 6 hours.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Optional

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from config import config

log = logging.getLogger(__name__)

_BOC_SERIES = "V122514,V41690973,FXUSDCAD"


def _is_retryable(exc: BaseException) -> bool:
    return isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code in (429, 503)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception(_is_retryable),
    reraise=True,
)
async def fetch_boc_observations() -> Optional[dict[str, Any]]:
    """Fetch latest observations for the three BoC series. Returns raw response dict."""
    url = f"{config.boc_base_url}/observations/{_BOC_SERIES}/json"
    params = {"recent": 5}
    t0 = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            ms = int((time.monotonic() - t0) * 1000)
            log.info("bank_of_canada OK  %dms", ms)
            return resp.json()
    except httpx.HTTPStatusError as exc:
        ms = int((time.monotonic() - t0) * 1000)
        log.warning("bank_of_canada  status=%d  %dms", exc.response.status_code, ms)
        raise
    except Exception as exc:
        ms = int((time.monotonic() - t0) * 1000)
        log.warning("bank_of_canada  error=%s  %dms", exc, ms)
        return None


async def health_check() -> str:
    """Lightweight ping — returns 'ok' or 'error: ...'"""
    try:
        url = f"{config.boc_base_url}/observations/V122514/json"
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params={"recent": 1})
            resp.raise_for_status()
        return "ok"
    except Exception as exc:
        return f"error: {exc}"
