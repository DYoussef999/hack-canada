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

export default function ChartComponent({ data = [], bar1Key = "value", bar2Key, title }) {
  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #ddd8cf",
      borderRadius: "14px",
      padding: "24px",
    }}>
      {title && (
        <h3 style={{
          fontSize: "14px", fontWeight: "600",
          color: "#1a2e12", marginBottom: "16px",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ddd8cf" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#3e6b2a" }} stroke="#ddd8cf" />
          <YAxis tick={{ fontSize: 12, fill: "#3e6b2a" }} stroke="#ddd8cf" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(v) => `$${v.toLocaleString()}`}
            contentStyle={{ background: "#faf8f4", border: "1px solid #ddd8cf", borderRadius: "8px", color: "#1a2e12" }}
            labelStyle={{ color: "#3e6b2a" }}
          />
          <Legend wrapperStyle={{ color: "#1a2e12", fontSize: "12px" }} />
          <Bar dataKey={bar1Key} fill="#3d8b24" radius={[4, 4, 0, 0]} />
          {bar2Key && <Bar dataKey={bar2Key} fill="#c49530" radius={[4, 4, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
