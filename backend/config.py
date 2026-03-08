"""config.py — Typed config loader for Compass AI backend.

Reads all API keys from .env via python-dotenv.
Import `config` anywhere in the backend — it is initialized once at module load.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Config:
    # ── API keys ───────────────────────────────────────────────────────────────
    gemini_api_key: str
    fred_api_key: str
    mapbox_token: str
    besttime_api_key: str
    square_sandbox_token: str

    # ── Base URLs (constants) ──────────────────────────────────────────────────
    boc_base_url: str = "https://www.bankofcanada.ca/valet"
    fred_base_url: str = "https://api.stlouisfed.org/fred"
    statscan_base_url: str = "https://www150.statcan.gc.ca/t1/tbl1/en/dtbl"
    besttime_base_url: str = "https://besttime.app/api/v1"
    mapbox_base_url: str = "https://api.mapbox.com"
    square_sandbox_base_url: str = "https://connect.squareupsandbox.com/v2"
    upc_base_url: str = "https://api.upcitemdb.com/prod/trial/lookup"


config = Config(
    gemini_api_key=os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_GEMINI_API_KEY") or "",
    fred_api_key=os.getenv("FRED_API_KEY") or "",
    mapbox_token=os.getenv("MAPBOX_TOKEN") or "",
    besttime_api_key=os.getenv("BESTTIME_API_KEY") or "",
    square_sandbox_token=(
        os.getenv("SQUARE_SANDBOX_ACCESS_TOKEN") or os.getenv("SQUARE_ACCESS_TOKEN") or ""
    ),
)
