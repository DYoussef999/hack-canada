from fastapi import APIRouter
from models.business import OptimizerInput
from services.location_optimizer import recommend_locations

router = APIRouter()

@router.post("/recommend")
def recommend(data: OptimizerInput):
    """Return a ranked list of recommended expansion locations."""
    locations = recommend_locations(data)
    return {"locations": locations}
