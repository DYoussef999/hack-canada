"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * Reusable bar chart for comparing two metrics (e.g. Revenue vs Costs).
 * Props:
 *   data      – array of objects, e.g. [{ name: "Revenue", value: 28800 }, ...]
 *   bar1Key   – key for first bar (default "value")
 *   bar2Key   – key for second bar (optional)
 *   title     – chart heading
 */
export default function ChartComponent({ data = [], bar1Key = "value", bar2Key, title }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
          <Legend />
          <Bar dataKey={bar1Key} fill="#3b82f6" radius={[4, 4, 0, 0]} />
          {bar2Key && <Bar dataKey={bar2Key} fill="#10b981" radius={[4, 4, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
