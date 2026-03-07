from fastapi import APIRouter

router = APIRouter()

@router.get("/metrics")
def get_metrics():
    """Return high-level dashboard metrics (mocked for MVP)."""
    return {
        "predicted_revenue": 30000,
        "predicted_profit": 12000,
        "recommended_locations": 5,
        "feasibility_score": 76,
        "estimated_costs": 18000,
    }
