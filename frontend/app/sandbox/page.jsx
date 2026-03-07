"use client";
import { useState } from "react";
import MetricCard from "@/components/MetricCard";
import ChartComponent from "@/components/ChartComponent";
import { simulateSandbox } from "@/services/api";

const BUSINESS_TYPES = [
  "Coffee Shop",
  "Restaurant",
  "Retail Store",
  "Fitness Studio",
  "Bakery",
  "Bar / Nightclub",
  "Franchise",
];

const defaultForm = {
  business_type: "Coffee Shop",
  budget: 50000,
  rent_limit: 3000,
  daily_customers: 120,
  avg_order_value: 8,
  city: "Toronto",
};

function ScoreGauge({ score }) {
  const color =
    score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <p className="text-sm text-gray-500 font-medium mb-3">Feasibility Score</p>
      <div className="flex items-center gap-4">
        <div className="flex-1 bg-gray-100 rounded-full h-4">
          <div
            className={`h-4 rounded-full ${color} transition-all duration-700`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="font-extrabold text-xl">{score}<span className="text-sm text-gray-400">/100</span></span>
      </div>
    </div>
  );
}

export default function SandboxPage() {
  const [form, setForm]       = useState(defaultForm);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: ["budget", "rent_limit", "avg_order_value"].includes(name)
        ? parseFloat(value)
        : name === "daily_customers"
        ? parseInt(value, 10)
        : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await simulateSandbox({
        ...form,
        business_type: form.business_type.toLowerCase(),
      });
      setResult(data);
    } catch {
      setError("Backend error — make sure the API server is running on port 8000.");
    } finally {
      setLoading(false);
    }
  }

  const chartData = result
    ? [
        { name: "Revenue", value: result.monthly_revenue },
        { name: "Costs",   value: result.estimated_costs },
        { name: "Profit",  value: Math.max(result.projected_profit, 0) },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Expansion Sandbox</h1>
        <p className="text-gray-500 text-sm mt-1">
          Simulate the financial outcome of opening a new location.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Input form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5"
        >
          {/* Business type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
            <select
              name="business_type"
              value={form.business_type}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {BUSINESS_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target City</label>
            <input
              type="text"
              name="city"
              value={form.city}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expansion Budget ($)
            </label>
            <input
              type="number"
              name="budget"
              value={form.budget}
              min={0}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Max rent */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Monthly Rent ($)
            </label>
            <input
              type="number"
              name="rent_limit"
              value={form.rent_limit}
              min={0}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Daily customers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Daily Customers
            </label>
            <input
              type="number"
              name="daily_customers"
              value={form.daily_customers}
              min={1}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Average order value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Average Order Value ($)
            </label>
            <input
              type="number"
              name="avg_order_value"
              value={form.avg_order_value}
              min={0}
              step={0.5}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition text-sm"
          >
            {loading ? "Running simulation…" : "Run Simulation"}
          </button>

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </form>

        {/* Results */}
        <div className="lg:col-span-3 space-y-5">
          {!result && !loading && (
            <div className="flex items-center justify-center h-full min-h-48 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm">
              Fill in the form and click &ldquo;Run Simulation&rdquo; to see results.
            </div>
          )}

          {result && (
            <>
              {/* Metric cards */}
              <div className="grid grid-cols-2 gap-4">
                <MetricCard title="Monthly Revenue"   value={result.monthly_revenue}   prefix="$" color="blue"  />
                <MetricCard title="Estimated Costs"   value={result.estimated_costs}   prefix="$" color="red"   />
                <MetricCard title="Projected Profit"  value={result.projected_profit}  prefix="$" color="green" />
                <MetricCard title="Feasibility Score" value={result.feasibility_score} suffix="/100" color="purple" />
              </div>

              {/* Score gauge */}
              <ScoreGauge score={result.feasibility_score} />

              {/* Revenue vs Costs chart */}
              <ChartComponent
                data={chartData}
                bar1Key="value"
                title="Monthly Revenue vs Costs vs Profit"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
