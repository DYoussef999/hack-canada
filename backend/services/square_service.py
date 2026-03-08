"""square_service.py — Square Sandbox catalog wrapper.

Fetches /v2/catalog/list from the Square Sandbox.
Any error (401 expired token, network, etc.) returns a safe fallback
so that /sync never crashes due to Square unavailability.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from config import config

log = logging.getLogger(__name__)

_CATALOG_URL = f"{config.square_sandbox_base_url}/catalog/list"
_LOCATIONS_URL = f"{config.square_sandbox_base_url}/locations"
_SQUARE_VERSION = "2024-01-18"


def _auth_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {config.square_sandbox_token}",
        "Square-Version": _SQUARE_VERSION,
        "Content-Type": "application/json",
    }


async def fetch_catalog() -> dict[str, Any]:
    """
    Fetch the Square Sandbox catalog.

    Returns raw response dict on success, or a structured fallback dict
    with 'error' key on any failure (expired token, network error, etc.).
    """
    if not config.square_sandbox_token:
        log.warning("square  SQUARE_SANDBOX_ACCESS_TOKEN not set")
        return {"error": "SQUARE_SANDBOX_ACCESS_TOKEN not configured", "objects": []}

    t0 = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(_CATALOG_URL, headers=_auth_headers())
            ms = int((time.monotonic() - t0) * 1000)

            if resp.status_code == 401:
                msg = (
                    "Square Sandbox token expired (401). Refresh at "
                    "https://developer.squareup.com/apps → Sandbox → Access token."
                )
                log.warning("square  401  %dms  %s", ms, msg)
                return {"error": msg, "objects": []}

            resp.raise_for_status()
            log.info("square  catalog  OK  %dms", ms)
            return resp.json()

    except httpx.HTTPStatusError as exc:
        ms = int((time.monotonic() - t0) * 1000)
        log.warning("square  status=%d  %dms", exc.response.status_code, ms)
        return {"error": f"HTTP {exc.response.status_code}", "objects": []}
    except Exception as exc:
        ms = int((time.monotonic() - t0) * 1000)
        log.warning("square  error=%s  %dms", exc, ms)
        return {"error": str(exc), "objects": []}


async def health_check() -> str:
    """Check Square Sandbox by hitting /v2/locations (lighter than catalog)."""
    if not config.square_sandbox_token:
        return "error: SQUARE_SANDBOX_ACCESS_TOKEN not configured"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(_LOCATIONS_URL, headers=_auth_headers())
        if resp.status_code == 200:
            return "ok"
        if resp.status_code == 401:
            return "error: 401 token expired — refresh at Square Console"
        return f"error: HTTP {resp.status_code}"
    except Exception as exc:
        return f"error: {exc}"
