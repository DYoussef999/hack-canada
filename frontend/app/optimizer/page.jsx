"use client";
import { useState } from "react";
import LocationCard from "@/components/LocationCard";
import ChartComponent from "@/components/ChartComponent";
import { recommendLocations } from "@/services/api";

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
  city: "Toronto",
};

export default function OptimizerPage() {
  const [form, setForm]         = useState(defaultForm);
  const [locations, setLocations] = useState([]);
  const [searched, setSearched]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: ["budget", "rent_limit"].includes(name) ? parseFloat(value) : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await recommendLocations({
        ...form,
        business_type: form.business_type.toLowerCase(),
      });
      setLocations(data.locations);
      setSearched(true);
    } catch {
      setError("Backend error — make sure the API server is running on port 8000.");
    } finally {
      setLoading(false);
    }
  }

  // Build chart data from location scores for comparison
  const chartData = locations.map((l) => ({
    name: l.name.split(" ").slice(0, 2).join(" "), // Shorten long names
    Score: l.score,
    Rent: l.rent,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Location Optimizer</h1>
        <p className="text-gray-500 text-sm mt-1">
          Find the best locations to expand based on rent, foot traffic, and competition.
        </p>
      </div>

      {/* Form card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
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
            {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* City */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Budget ($)</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Rent ($/mo)</label>
          <input
            type="number"
            name="rent_limit"
            value={form.rent_limit}
            min={0}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Submit */}
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition text-sm"
          >
            {loading ? "Searching…" : "Find Locations"}
          </button>
        </div>
      </form>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Results */}
      {searched && locations.length === 0 && (
        <p className="text-gray-500 text-center py-12">
          No locations found within your rent limit. Try increasing your budget or rent cap.
        </p>
      )}

      {locations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Location cards */}
          <div className="lg:col-span-3 space-y-3">
            <h2 className="text-lg font-bold text-gray-900">
              {locations.length} Location{locations.length !== 1 ? "s" : ""} Found
            </h2>
            {locations.map((loc, i) => (
              <LocationCard key={loc.name} location={loc} index={i + 1} />
            ))}
          </div>

          {/* Chart comparison */}
          <div className="lg:col-span-2 space-y-4">
            <ChartComponent
              data={chartData}
              bar1Key="Score"
              title="Location Match Scores"
            />
            <ChartComponent
              data={chartData}
              bar1Key="Rent"
              title="Monthly Rent Comparison"
            />
          </div>
        </div>
      )}

      {!searched && !loading && (
        <div className="flex items-center justify-center min-h-40 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm">
          Enter your criteria above and click &ldquo;Find Locations&rdquo;.
        </div>
      )}
    </div>
  );
}
