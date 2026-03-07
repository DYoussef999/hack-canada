from models.business import OptimizerInput

# Static pool of candidate locations with mock metrics
LOCATION_POOL = [
    {"name": "Downtown Core",       "base_rent": 3200, "foot_traffic_score": 92, "foot_traffic_label": "Very High", "competition_score": 45},
    {"name": "Downtown District",   "base_rent": 2800, "foot_traffic_score": 85, "foot_traffic_label": "High",      "competition_score": 55},
    {"name": "University Area",     "base_rent": 2100, "foot_traffic_score": 78, "foot_traffic_label": "High",      "competition_score": 70},
    {"name": "Arts District",       "base_rent": 2500, "foot_traffic_score": 62, "foot_traffic_label": "Medium",    "competition_score": 75},
    {"name": "Midtown",             "base_rent": 2700, "foot_traffic_score": 70, "foot_traffic_label": "Medium",    "competition_score": 60},
    {"name": "Suburban Strip Mall", "base_rent": 1500, "foot_traffic_score": 40, "foot_traffic_label": "Low",       "competition_score": 88},
    {"name": "Financial District",  "base_rent": 4200, "foot_traffic_score": 88, "foot_traffic_label": "High",      "competition_score": 30},
    {"name": "East Village",        "base_rent": 1900, "foot_traffic_score": 55, "foot_traffic_label": "Medium",    "competition_score": 80},
    {"name": "Harbourfront",        "base_rent": 3000, "foot_traffic_score": 75, "foot_traffic_label": "High",      "competition_score": 50},
    {"name": "Little Italy",        "base_rent": 2200, "foot_traffic_score": 65, "foot_traffic_label": "Medium",    "competition_score": 65},
]

def recommend_locations(data: OptimizerInput) -> list:
    """
    Score and rank candidate locations based on the user's budget and rent limit.
    Score = (foot_traffic * 0.5) + (rent_affordability * 0.3) + (competition_score * 0.2)
    Only locations within the rent_limit are returned.
    """
    results = []

    for loc in LOCATION_POOL:
        if loc["base_rent"] > data.rent_limit:
            continue  # Filter out locations above rent tolerance

        # Rent affordability: lower rent relative to budget = higher score
        rent_ratio = loc["base_rent"] / max(data.budget, 1)
        affordability_score = min(max((1 - rent_ratio) * 100, 0), 100)

        score = (
            loc["foot_traffic_score"] * 0.5
            + affordability_score * 0.3
            + loc["competition_score"] * 0.2
        )

        results.append({
            "name": loc["name"],
            "rent": loc["base_rent"],
            "foot_traffic": loc["foot_traffic_label"],
            "score": int(round(score)),
        })

    # Return locations sorted by score descending
    results.sort(key=lambda x: x["score"], reverse=True)
    return results
