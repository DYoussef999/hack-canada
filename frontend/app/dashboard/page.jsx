"use client";
import { useEffect, useState } from "react";
import MetricCard from "@/components/MetricCard";
import ChartComponent from "@/components/ChartComponent";
import LocationCard from "@/components/LocationCard";
import { getDashboardMetrics, recommendLocations } from "@/services/api";

// Profit forecast using a simple month-over-month growth assumption
function buildForecast(baseProfit) {
  return Array.from({ length: 6 }, (_, i) => ({
    name: `Month ${i + 1}`,
    Profit: Math.round(baseProfit * (1 + i * 0.05)),
  }));
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [m, l] = await Promise.all([
          getDashboardMetrics(),
          recommendLocations({
            business_type: "coffee shop",
            budget: 50000,
            rent_limit: 3000,
            city: "Toronto",
          }),
        ]);
        setMetrics(m);
        setLocations(l.locations.slice(0, 3));
      } catch (e) {
        setError("Could not connect to the backend. Is it running on port 8000?");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading)
    return <p className="text-gray-500 text-center mt-20">Loading dashboard…</p>;

  if (error)
    return (
      <div className="mt-20 text-center">
        <p className="text-red-500 font-medium">{error}</p>
      </div>
    );

  const revenueCostData = [
    { name: "Revenue", value: metrics.predicted_revenue },
    { name: "Costs",   value: metrics.predicted_revenue - metrics.predicted_profit },
    { name: "Profit",  value: metrics.predicted_profit },
  ];

  const forecastData = buildForecast(metrics.predicted_profit);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          High-level overview of your expansion analysis.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Predicted Revenue"    value={metrics.predicted_revenue}     prefix="$" color="blue"   />
        <MetricCard title="Predicted Profit"     value={metrics.predicted_profit}      prefix="$" color="green"  />
        <MetricCard title="Feasibility Score"    value={metrics.feasibility_score}     suffix="/100" color="purple" />
        <MetricCard title="Recommended Locations" value={metrics.recommended_locations} color="orange" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartComponent data={revenueCostData} bar1Key="value" title="Revenue vs Costs vs Profit" />
        <ChartComponent data={forecastData}    bar1Key="Profit" title="6-Month Profit Forecast" />
      </div>

      {/* Top locations preview */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">Top Recommended Locations</h2>
        <div className="space-y-3">
          {locations.map((loc, i) => (
            <LocationCard key={loc.name} location={loc} index={i + 1} />
          ))}
        </div>
        <a href="/optimizer" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          See all recommendations →
        </a>
      </div>
    </div>
  );
}
