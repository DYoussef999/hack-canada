from fastapi import APIRouter
from models.business import OptimizerInput

router = APIRouter()

@router.post("/recommend")
def recommend(data: OptimizerInput):
    """
    Return a ranked list of recommended expansion locations.
    Currently returns an empty list as real-world data sources are being merged.
    """
    return {
        "locations": [],
        "note": "Real-world commercial location analysis is currently pending a data source merge."
    }
