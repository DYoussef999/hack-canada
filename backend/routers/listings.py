"""routers/listings.py — POST /listings/match

Matches business requirements to listings using deterministic scoring
and Gemini narrative recommendations.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from gemini_agents import listing_agent
from models.briefings import ListingMatchReport, ListingMatchRequest

log = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/listings/match",
    response_model=ListingMatchReport,
    summary="Listing Optimizer Agent: match listings to budget + size",
    tags=["Listings"],
)
async def match_listings(body: ListingMatchRequest) -> ListingMatchReport:
    try:
        return await listing_agent.match(body)
    except Exception as exc:
        log.exception("listings  match failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Listing optimizer error: {exc}",
        )
