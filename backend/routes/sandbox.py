from fastapi import APIRouter
from models.business import SandboxInput
from services.simulation_engine import simulate_business

router = APIRouter()

@router.post("/simulate")
def simulate(data: SandboxInput):
    """Run a financial simulation for a proposed business expansion."""
    return simulate_business(data)
