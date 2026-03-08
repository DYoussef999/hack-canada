"""upc_service.py — UPC Item DB trial endpoint wrapper.

Trial tier: 100 lookups/day. On 429, returns a fallback ProductBriefing
with is_fallback=True — does NOT crash the import flow.
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
    return isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 503


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_exception(_is_retryable),
    reraise=False,
)
async def lookup_upc(upc_code: str) -> dict[str, Any]:
    """
    Fetch product details from UPC Item DB.

    Returns raw response dict on success.
    Returns {"code": "LIMIT_REACHED", "items": []} on 429.
    Returns {"code": "ERROR", "items": [], "reason": ...} on other errors.
    """
    t0 = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(config.upc_base_url, params={"upc": upc_code})
            ms = int((time.monotonic() - t0) * 1000)

            if resp.status_code == 429:
                log.warning("upc_itemdb  429 daily limit  %dms", ms)
                return {
                    "code": "LIMIT_REACHED",
                    "items": [],
                    "reason": "UPC Item DB daily limit (100/day) reached. Try again tomorrow.",
                }

            resp.raise_for_status()
            log.info("upc_itemdb  upc=%s  OK  %dms", upc_code, ms)
            return resp.json()

    except httpx.HTTPStatusError as exc:
        ms = int((time.monotonic() - t0) * 1000)
        log.warning("upc_itemdb  status=%d  %dms", exc.response.status_code, ms)
        return {"code": "ERROR", "items": [], "reason": f"HTTP {exc.response.status_code}"}
    except Exception as exc:
        ms = int((time.monotonic() - t0) * 1000)
        log.warning("upc_itemdb  error=%s  %dms", exc, ms)
        return {"code": "ERROR", "items": [], "reason": str(exc)}


async def health_check() -> str:
    """Lightweight UPC endpoint check with a known UPC."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(config.upc_base_url, params={"upc": "000000000000"})
        # 404 = not found (item doesn't exist) but API is reachable
        if resp.status_code in (200, 404, 400):
            return "ok"
        if resp.status_code == 429:
            return "error: daily limit reached"
        return f"error: HTTP {resp.status_code}"
    except Exception as exc:
        return f"error: {exc}"
