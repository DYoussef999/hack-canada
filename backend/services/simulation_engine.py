from models.business import SandboxInput

def simulate_business(data: SandboxInput) -> dict:
    """
    Core MVP simulation logic.
    Calculates monthly revenue, costs, profit, and a feasibility score
    based on the user-provided parameters.
    """
    monthly_revenue = data.daily_customers * data.avg_order_value * 30

    # Operating costs are modeled as 40% of revenue (labor, utilities, supplies)
    operating_costs = monthly_revenue * 0.40
    estimated_costs = data.rent_limit + operating_costs

    projected_profit = monthly_revenue - estimated_costs

    # Feasibility score: scales profit margin to 0–100
    if monthly_revenue > 0:
        margin = projected_profit / monthly_revenue
        # Clamp between 0 and 100
        feasibility_score = int(min(max(margin * 100 * 1.5, 0), 100))
    else:
        feasibility_score = 0

    return {
        "monthly_revenue": round(monthly_revenue, 2),
        "estimated_costs": round(estimated_costs, 2),
        "projected_profit": round(projected_profit, 2),
        "feasibility_score": feasibility_score,
    }
