export default function MetricCard({ title, value, prefix = "", suffix = "", color = "blue" }) {
  const colorMap = {
    blue:   "text-blue-600 bg-blue-50",
    green:  "text-green-600 bg-green-50",
    red:    "text-red-500 bg-red-50",
    purple: "text-purple-600 bg-purple-50",
    orange: "text-orange-500 bg-orange-50",
  };
  const accent = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <p className="text-sm text-gray-500 font-medium mb-2">{title}</p>
      <div className={`inline-block rounded-lg px-3 py-1 text-3xl font-extrabold ${accent}`}>
        {prefix}{typeof value === "number" ? value.toLocaleString() : value}{suffix}
      </div>
    </div>
  );
}
