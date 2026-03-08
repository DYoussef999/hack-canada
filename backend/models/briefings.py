"""briefings.py — Pydantic v2 models for Compass AI Economic Briefings.

Every model has description= on each field for self-documentation,
and a Config.json_schema_extra with a realistic demo example.
"""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# ── Input models ──────────────────────────────────────────────────────────────

class NodeData(BaseModel):
    label: str = Field(description="Display name shown on the canvas node")
    value: float = Field(0.0, description="Monthly CAD amount")
    category: Optional[str] = Field(None, description="Staff | Overhead | OpEx (expenses only)")


class CanvasNode(BaseModel):
    id: str = Field(description="React Flow node ID")
    type: str = Field(description="node type (source, expense, group, result, etc)")
    data: dict[str, Any] = Field(description="Raw node data — Accountant will filter for relevant fields")


class FinancialProfile(BaseModel):
    nodes: list[CanvasNode] = Field(description="All React Flow canvas nodes")
    edges: list[dict[str, Any]] = Field(default_factory=list)
    session_id: Optional[str] = Field(None, description="Optional session ID for context")

    class Config:
        json_schema_extra = {"example": {
            "nodes": [
                {"id": "src-1", "type": "source", "data": {"label": "Café Sales", "value": 15000}},
                {"id": "exp-1", "type": "expense", "data": {"label": "Staff", "value": 4500, "category": "Staff"}},
                {"id": "exp-2", "type": "expense", "data": {"label": "Rent", "value": 3200, "category": "Overhead"}},
            ],
            "edges": [],
        }}


class CandidateLocation(BaseModel):
    lat: float = Field(description="Latitude")
    lng: float = Field(description="Longitude")
    city_name: str = Field(description="Human-readable city name (e.g. 'Waterloo')")
    business_type: str = Field(description="e.g. 'coffee shop', 'restaurant', 'retail'")
    monthly_rent: float = Field(3500.0, description="Monthly rent ceiling in CAD")
    census_division: str = Field("3530", description="StatsCan census division code (default: Waterloo Region)")


# ── Accountant output ─────────────────────────────────────────────────────────

class LayoutGroup(BaseModel):
    group_id: str = Field(description="Unique ID for the suggested group")
    label: str = Field(description="Functional name of the group, e.g. 'Logistics & Delivery'")
    node_ids: list[str] = Field(description="IDs of nodes belonging to this group")

class SuggestedEdge(BaseModel):
    source: str = Field(..., alias="from", description="Source node or group ID")
    target: str = Field(..., alias="to", description="Target node or group ID")
    label: str = Field("Supports", description="Description of the relationship, e.g. 'Supports'")

    model_config = {
        "populate_by_name": True
    }

class SegmentMargin(BaseModel):
    segment_name: str = Field(description="Name of the business segment")
    revenue: float = Field(description="Total revenue for this segment")
    expenses: float = Field(description="Total expenses directly connected to this segment")
    margin_pct: float = Field(description="(revenue - expenses) / revenue * 100")

class FinancialHealthReport(BaseModel):
    net_profit: float = Field(description="Monthly net profit (revenue − expenses) in CAD")
    profit_margin_pct: float = Field(description="(net_profit / monthly_revenue) × 100")
    break_even_revenue: float = Field(description="Minimum monthly revenue to cover all expenses")
    health_score: int = Field(description="Composite health score 0–100", ge=0, le=100)
    top_cost_risks: list[str] = Field(description="Top 2 cost drivers as 'label: $amount (% of revenue)'")
    warnings: list[str] = Field(default_factory=list, description="BDC risk flags and concentration warnings")
    monthly_revenue: float = Field(description="Sum of all source node values (CAD/mo)")
    monthly_expenses: float = Field(description="Sum of all expense node values (CAD/mo)")
    max_affordable_rent: float = Field(description="monthly_revenue × 0.10 (BDC Canadian SMB guideline)")
    recommendation: str = Field(description="1-2 sentence plain-English summary for the business owner")
    layout_groups: list[LayoutGroup] = Field(default_factory=list, description="AI-suggested functional groupings for nodes")
    suggested_edges: list[SuggestedEdge] = Field(default_factory=list, description="AI-suggested relationships between nodes and groups")
    segment_margins: list[SegmentMargin] = Field(default_factory=list, description="Calculated margins based on connected functional segments")

    class Config:
        json_schema_extra = {"example": {
            "net_profit": 7300.0, "profit_margin_pct": 48.7, "break_even_revenue": 7700.0,
            "health_score": 82, "top_cost_risks": ["Staff: $4,500 (30%)", "Rent: $3,200 (21.3%)"],
            "warnings": [], "monthly_revenue": 15000.0, "monthly_expenses": 7700.0,
            "max_affordable_rent": 1500.0,
            "recommendation": "Strong 48.7% margin. Staff is your primary optimization lever.",
            "layout_groups": [{"group_id": "group-logistics", "label": "Logistics & Delivery", "node_ids": ["exp-1"]}],
            "suggested_edges": [{"source": "group-logistics", "target": "src-1", "label": "Supports"}],
            "segment_margins": [{"segment_name": "Delivery", "revenue": 5000.0, "expenses": 1000.0, "margin_pct": 80.0}]
        }}


# ── Briefing models (Tools outputs) ──────────────────────────────────────────

class FootTrafficBriefing(BaseModel):
    venue_name: str = Field(description="Venue name searched")
    lat: float = Field(description="Latitude queried")
    lng: float = Field(description="Longitude queried")
    peak_hours: dict[str, Any] = Field(default_factory=dict, description="day → {peak_hour, busy_score 0-100}")
    best_day_to_open: str = Field(default="Saturday", description="Day with highest expected busy score")
    weekly_avg_visitors_estimate: int = Field(default=0, description="Rough weekly visitor estimate")
    data_confidence: Literal["high", "medium", "low", "unavailable"] = Field(
        description="Confidence level in foot traffic data"
    )
    fallback_note: Optional[str] = Field(None, description="Reason real data is unavailable, if applicable")

    class Config:
        json_schema_extra = {"example": {
            "venue_name": "Uptown Coffee", "lat": 43.4643, "lng": -80.5204,
            "peak_hours": {"Saturday": {"peak_hour": 10, "busy_score": 85}},
            "best_day_to_open": "Saturday", "weekly_avg_visitors_estimate": 350,
            "data_confidence": "medium", "fallback_note": None,
        }}


class MacroTrendsBriefing(BaseModel):
    current_overnight_rate: Optional[float] = Field(None, description="BoC overnight rate (%)")
    current_cpi: Optional[float] = Field(None, description="Canada CPI all-items (% change YoY)")
    cad_usd_rate: Optional[float] = Field(None, description="CAD per 1 USD exchange rate")
    trend_label: Literal["tightening", "easing", "stable"] = Field(
        description="Current BoC monetary policy direction"
    )
    smb_impact_summary: str = Field(description="2-sentence plain-English SMB impact summary")
    last_updated: str = Field(description="ISO 8601 timestamp of data retrieval")

    class Config:
        json_schema_extra = {"example": {
            "current_overnight_rate": 3.25, "current_cpi": 2.8, "cad_usd_rate": 0.74,
            "trend_label": "easing",
            "smb_impact_summary": "BoC reduced rates to 3.25%, improving expansion loan viability. Inflation at 2.8% remains manageable but watch labour cost pressures.",
            "last_updated": "2026-03-07T12:00:00Z",
        }}


class CompetitorDensityBriefing(BaseModel):
    lat: float = Field(description="Latitude queried")
    lng: float = Field(description="Longitude queried")
    radius_meters: int = Field(description="Search radius in metres")
    competitor_count: int = Field(description="Similar businesses found within radius")
    complementary_business_count: int = Field(0, description="Complementary businesses (foot-traffic generators)")
    nearest_transit_stop: Optional[str] = Field(None, description="Name of nearest transit stop")
    nearest_transit_distance_m: Optional[float] = Field(None, description="Distance to nearest transit (metres)")
    nearest_transit_type: Literal["ION", "GO", "bus", "none"] = Field("none")
    density_score: float = Field(description="Competition density 0–100 (higher = more saturated)")
    opportunity_label: Literal["saturated", "moderate", "underserved"] = Field(
        description="Market opportunity assessment for this location"
    )

    class Config:
        json_schema_extra = {"example": {
            "lat": 43.4643, "lng": -80.5204, "radius_meters": 1000,
            "competitor_count": 4, "complementary_business_count": 12,
            "nearest_transit_stop": "Willis Way Station", "nearest_transit_distance_m": 180.0,
            "nearest_transit_type": "ION", "density_score": 40.0, "opportunity_label": "moderate",
        }}


class DemographicBriefing(BaseModel):
    region_name: str = Field(description="Census division name (e.g. 'Regional Municipality of Waterloo')")
    census_division: str = Field(description="StatsCan numeric census division code")
    total_population: Optional[int] = Field(None, description="Total population (2021 Census)")
    median_household_income: Optional[float] = Field(None, description="Median household income (CAD)")
    population_growth_pct_5yr: Optional[float] = Field(None, description="5-year population growth (%)")
    pct_age_25_44: Optional[float] = Field(None, description="% of population aged 25–44 (prime consumer cohort)")
    dominant_industry: Optional[str] = Field(None, description="Top employment sector for this region")
    sme_friendliness_score: float = Field(description="Composite SME viability score 0–100")

    class Config:
        json_schema_extra = {"example": {
            "region_name": "Regional Municipality of Waterloo", "census_division": "3530",
            "total_population": 587000, "median_household_income": 97200.0,
            "population_growth_pct_5yr": 8.3, "pct_age_25_44": 28.4,
            "dominant_industry": "Professional, Scientific & Technical Services",
            "sme_friendliness_score": 74.0,
        }}


class ProductBriefing(BaseModel):
    upc_code: str = Field(description="UPC barcode queried")
    product_name: Optional[str] = Field(None, description="Product title from UPC DB")
    brand: Optional[str] = Field(None, description="Brand name")
    category: Optional[str] = Field(None, description="Product category")
    avg_retail_price_cad: Optional[float] = Field(None, description="Average retail price in CAD")
    suggested_markup_pct: Optional[float] = Field(None, description="Suggested retail markup (%)")
    is_fallback: bool = Field(False, description="True when UPC DB was unavailable")
    fallback_note: Optional[str] = Field(None, description="Reason data is estimated, if applicable")

    class Config:
        json_schema_extra = {"example": {
            "upc_code": "012000002732", "product_name": "Pepsi 355mL", "brand": "Pepsi",
            "category": "Beverages", "avg_retail_price_cad": 2.19, "suggested_markup_pct": 45.0,
            "is_fallback": False, "fallback_note": None,
        }}


class SquareCatalogBriefing(BaseModel):
    item_count: int = Field(description="Total catalog items found")
    top_categories: list[str] = Field(default_factory=list, description="Top 5 categories by item count")
    estimated_monthly_revenue: float = Field(0.0, description="price × mock quantity sum (CAD)")
    data_source: str = Field(description="'square_sandbox' or 'square_unavailable'")

    class Config:
        json_schema_extra = {"example": {
            "item_count": 12, "top_categories": ["Coffee", "Pastries", "Merchandise"],
            "estimated_monthly_revenue": 18500.0, "data_source": "square_sandbox",
        }}


# ── Expansion report models ───────────────────────────────────────────────────

class ViabilityScore(BaseModel):
    p_rev: float = Field(description="Projected monthly revenue input (CAD)")
    d_demographic: float = Field(description="sme_friendliness_score ÷ 100")
    c_rent: float = Field(description="Monthly rent input (CAD)")
    s_competition: float = Field(description="density_score ÷ 100")
    o_fixed: float = Field(description="Total monthly fixed costs (CAD)")
    computed_score: float = Field(
        description="Ve = (P_rev × D_demo) / ((C_rent × S_comp) + O_fixed), scaled 0–100"
    )


class RankedLocation(BaseModel):
    city_name: str = Field(description="City name")
    lat: float
    lng: float
    business_type: str
    monthly_rent: float = Field(description="Monthly rent ceiling used in scoring (CAD)")
    viability_score: ViabilityScore
    recommendation: str = Field(description="3-sentence plain-English recommendation")
    macro_risk_flag: str = Field(description="Primary macro risk for this location")
    vulnerability_note: str = Field(description="Single external event most threatening this location")
    foot_traffic: Optional[FootTrafficBriefing] = None
    competitor_density: Optional[CompetitorDensityBriefing] = None
    demographics: Optional[DemographicBriefing] = None


class ExpansionReport(BaseModel):
    ranked_locations: list[RankedLocation] = Field(description="Locations ranked highest Ve first")
    top_macro_risk: str = Field(description="Biggest macro risk across all evaluated locations")
    macro_context: MacroTrendsBriefing
    generated_at: str = Field(description="ISO 8601 generation timestamp")

    class Config:
        json_schema_extra = {"example": {
            "ranked_locations": [], "top_macro_risk": "BoC rate hike sensitivity",
            "generated_at": "2026-03-07T12:00:00Z",
        }}


# ── Route request model ───────────────────────────────────────────────────────

class OptimizeRequest(BaseModel):
    financial_report: FinancialHealthReport
    locations: list[CandidateLocation] = Field(min_length=1)

    class Config:
        json_schema_extra = {"example": {
            "financial_report": {"health_score": 82, "monthly_revenue": 15000.0, "monthly_expenses": 7700.0,
                                 "net_profit": 7300.0, "profit_margin_pct": 48.7, "break_even_revenue": 7700.0,
                                 "top_cost_risks": [], "warnings": [], "max_affordable_rent": 1500.0,
                                 "recommendation": "Strong margin."},
            "locations": [
                {"lat": 43.4643, "lng": -80.5204, "city_name": "Waterloo",
                 "business_type": "coffee shop", "monthly_rent": 2900.0, "census_division": "3530"},
            ],
        }}
