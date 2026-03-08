"""
ARCHITECTURE PLAN
=================
1. STATIC vs LIVE APIs
   Static (cache at startup, slow-changing):
     - StatsCanada WDS: census demographics — cache 24hr per census_division
     - Bank of Canada Valet + FRED: macro rates/CPI — cache 6hr combined result
   Live (on-demand, per request):
     - BestTime: foot traffic forecast (per lat/lng/venue)
     - Mapbox Places: competitor geo-density (per lat/lng/query)
     - Square Sandbox: catalog data (per session, try/except always)
     - UPC Item DB: product lookup (per barcode, 100/day limit handled)

2. ECONOMIC BRIEFING DATA FLOW
   Raw API JSON
     → service layer (httpx.AsyncClient, timeout=5s, tenacity retry)
     → utils/digest.py (extract key fields, discard noise)
     → Pydantic Briefing model (typed, validated, no raw JSON)
     → Tools class method returns typed Briefing
     → Agent formats .model_dump() as plain-text context string
     → Gemini receives ONLY pre-digested context — never raw JSON
     → Gemini returns valid JSON matching output Pydantic model

3. TOP 3 FAILURE POINTS + MITIGATIONS
   a) BestTime quota/rate-limit (402/429):
      Mitigation: besttime_service returns {"status": "UNAVAILABLE", "reason": ...}
      → FootTrafficBriefing(data_confidence="unavailable") returned
      → Scout continues with reduced data; no HTTP 500 raised.
   b) StatsCanada WDS slow/unreliable:
      Mitigation: pre-seeded 2021 Census regional dict as primary source.
      5s timeout + tenacity retry(2). 24hr TTL cache per division.
   c) Square Sandbox token expiry (401):
      Mitigation: entire Square call in try/except.
      Returns SquareCatalogBriefing(data_source="square_unavailable").
      /sync still completes; operator sees a clear token-refresh note.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from models.briefings import (
    CompetitorDensityBriefing,
    DemographicBriefing,
    FootTrafficBriefing,
    MacroTrendsBriefing,
    ProductBriefing,
    SquareCatalogBriefing,
)
from services import (
    bankofcanada_service,
    fred_service,
    square_service,
    statscan_service,
    upc_service,
)
# besttime_service and mapbox_service intentionally omitted —
# foot traffic and map features are owned by a separate team.
# Plug their service modules in here when ready to merge.
from utils.cache import TTL_6H, cache
from utils.digest import (
    build_macro_summary,
    digest_boc,
    digest_fred_observation,
    digest_square_catalog,
    digest_upc_item,
    now_iso,
)

log = logging.getLogger(__name__)


class Tools:
    """Six async methods that fetch, digest, and return typed Economic Briefings."""

    # ── 1. Foot traffic ───────────────────────────────────────────────────────
    # TODO: plug in besttime_service here when the foot-traffic team is ready to merge.
    # Expected interface:
    #   from services import besttime_service
    #   raw = await besttime_service.fetch_forecast(venue_name, f"{lat},{lng}")
    #   digested = digest_foot_traffic(raw)  # util already written in utils/digest.py

    async def get_foot_traffic(
        self,
        lat: float,
        lng: float,
        venue_name: str,
    ) -> FootTrafficBriefing:
        """Stub — returns unavailable until foot-traffic service is merged in."""
        log.info("foot_traffic stub  venue=%r  (pending merge)", venue_name)
        return FootTrafficBriefing(
            venue_name=venue_name,
            lat=lat,
            lng=lng,
            data_confidence="unavailable",
            fallback_note="Foot traffic service pending merge from map team.",
        )

    # ── 2. Macro trends ───────────────────────────────────────────────────────

    async def get_market_trends(self) -> MacroTrendsBriefing:
        """BoC Valet + FRED → MacroTrendsBriefing. Cached 6 hours."""
        cached = cache.get("macro_trends")
        if cached is not None:
            return cached

        # Fetch BoC and FRED in parallel
        boc_raw, fred_cpi_raw = await asyncio.gather(
            bankofcanada_service.fetch_boc_observations(),
            fred_service.fetch_canada_cpi(),
            return_exceptions=True,
        )

        boc_data = digest_boc(boc_raw if isinstance(boc_raw, dict) else {})
        fred_cpi: Optional[float] = None
        if isinstance(fred_cpi_raw, dict):
            fred_cpi = digest_fred_observation(fred_cpi_raw)

        overnight_rate = boc_data.get("overnight_rate")
        cpi = boc_data.get("cpi") or fred_cpi
        cad_usd = boc_data.get("cad_usd")

        trend, summary = build_macro_summary(overnight_rate, cpi)

        briefing = MacroTrendsBriefing(
            current_overnight_rate=overnight_rate,
            current_cpi=cpi,
            cad_usd_rate=cad_usd,
            trend_label=trend,
            smb_impact_summary=summary,
            last_updated=now_iso(),
        )
        cache.set("macro_trends", briefing, TTL_6H)
        log.info("macro_trends  rate=%s  cpi=%s  trend=%s", overnight_rate, cpi, trend)
        return briefing

    # ── 3. Competitor density ─────────────────────────────────────────────────
    # TODO: plug in mapbox_service here when the map team is ready to merge.
    # Expected interface:
    #   from services import mapbox_service
    #   competitor_features = await mapbox_service.search_competitors(business_type, lat, lng)
    #   transit_features    = await mapbox_service.search_transit(lat, lng)
    #   density = digest_competitor_density(competitor_features, lat, lng, radius_meters)
    #   transit = digest_transit(transit_features, lat, lng)
    # Both digest helpers are already written in utils/digest.py.

    async def get_competitor_density(
        self,
        lat: float,
        lng: float,
        business_type: str,
        radius_meters: int = 1000,
    ) -> CompetitorDensityBriefing:
        """Stub — returns neutral mid-range density until map service is merged in."""
        log.info("competitor_density stub  lat=%s lng=%s  (pending merge)", lat, lng)
        return CompetitorDensityBriefing(
            lat=lat,
            lng=lng,
            radius_meters=radius_meters,
            competitor_count=0,
            density_score=50.0,
            opportunity_label="moderate",
        )

    # ── 4. Demographic profile ────────────────────────────────────────────────

    async def get_demographic_profile(
        self,
        census_division: str = "3530",
    ) -> DemographicBriefing:
        """StatsCanada WDS (pre-seeded + cached 24hr) → DemographicBriefing."""
        data = await statscan_service.get_demographic_profile(census_division)
        return DemographicBriefing(
            region_name=data.get("region_name", "Unknown Region"),
            census_division=data.get("census_division", census_division),
            total_population=data.get("total_population"),
            median_household_income=data.get("median_household_income"),
            population_growth_pct_5yr=data.get("population_growth_pct_5yr"),
            pct_age_25_44=data.get("pct_age_25_44"),
            dominant_industry=data.get("dominant_industry"),
            sme_friendliness_score=data.get("sme_friendliness_score", 60.0),
        )

    # ── 5. Product lookup ─────────────────────────────────────────────────────

    async def lookup_product(self, upc_code: str) -> ProductBriefing:
        """UPC Item DB → ProductBriefing. CAD price converted using live BoC rate."""
        # Get current CAD/USD rate (from cache if available)
        macro = cache.get("macro_trends")
        cad_usd = 0.74  # fallback rate
        if isinstance(macro, MacroTrendsBriefing) and macro.cad_usd_rate:
            cad_usd = macro.cad_usd_rate

        raw = await upc_service.lookup_upc(upc_code)

        if raw.get("code") in ("LIMIT_REACHED", "ERROR") or not raw.get("items"):
            reason = raw.get("reason", "Product not found in UPC Item DB.")
            return ProductBriefing(
                upc_code=upc_code,
                is_fallback=True,
                fallback_note=reason,
            )

        digested = digest_upc_item(raw, cad_usd)
        return ProductBriefing(
            upc_code=upc_code,
            product_name=digested.get("product_name"),
            brand=digested.get("brand"),
            category=digested.get("category"),
            avg_retail_price_cad=digested.get("price_cad"),
            suggested_markup_pct=digested.get("suggested_markup"),
        )

    # ── 6. Square catalog ─────────────────────────────────────────────────────

    async def get_square_catalog(self) -> SquareCatalogBriefing:
        """Square Sandbox /v2/catalog/list → SquareCatalogBriefing. Always returns."""
        try:
            raw = await square_service.fetch_catalog()
            if "error" in raw:
                return SquareCatalogBriefing(
                    item_count=0,
                    data_source="square_unavailable",
                    estimated_monthly_revenue=0.0,
                )
            digested = digest_square_catalog(raw)
            return SquareCatalogBriefing(
                item_count=digested["item_count"],
                top_categories=digested["top_categories"],
                estimated_monthly_revenue=digested["estimated_monthly_revenue"],
                data_source="square_sandbox",
            )
        except Exception as exc:
            log.warning("get_square_catalog  unexpected error: %s", exc)
            return SquareCatalogBriefing(
                item_count=0,
                data_source="square_unavailable",
                estimated_monthly_revenue=0.0,
            )


# Singleton for import
tools = Tools()
