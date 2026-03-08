"""cache.py — Simple in-memory TTL cache (no Redis required).

Usage:
    from utils.cache import cache

    cache.set("macro_trends", briefing, ttl_seconds=21600)  # 6 hours
    result = cache.get("macro_trends")  # None if expired
"""
from __future__ import annotations

import time
from typing import Any, Optional


class TTLCache:
    """Thread-safe-enough in-memory cache for a single-process FastAPI app."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float]] = {}  # key → (value, expire_at)

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expire_at = entry
        if time.monotonic() < expire_at:
            return value
        del self._store[key]
        return None

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        self._store[key] = (value, time.monotonic() + ttl_seconds)

    def delete(self, key: str) -> None:
        self._store.pop(key, None)

    def clear(self) -> None:
        self._store.clear()


# Singleton — import this everywhere
cache = TTLCache()

# TTL constants
TTL_6H = 6 * 3600
TTL_24H = 24 * 3600
