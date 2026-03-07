from pydantic import BaseModel

class SandboxInput(BaseModel):
    business_type: str
    budget: float
    rent_limit: float
    daily_customers: int
    avg_order_value: float
    city: str = "Toronto"

class OptimizerInput(BaseModel):
    business_type: str
    budget: float
    rent_limit: float
    city: str
