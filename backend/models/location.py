from pydantic import BaseModel

class LocationRecommendation(BaseModel):
    name: str
    rent: float
    foot_traffic: str
    score: int
