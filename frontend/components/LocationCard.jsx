const trafficColors = {
  "Very High": "bg-green-100 text-green-700",
  High:        "bg-blue-100 text-blue-700",
  Medium:      "bg-yellow-100 text-yellow-700",
  Low:         "bg-red-100 text-red-600",
};

export default function LocationCard({ location, index }) {
  const trafficStyle = trafficColors[location.foot_traffic] || "bg-gray-100 text-gray-600";
  const scoreColor =
    location.score >= 75 ? "text-green-600" : location.score >= 50 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4">
      {/* Rank badge + info */}
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
          {index}
        </div>
        <div>
          <h3 className="font-bold text-gray-900">{location.name}</h3>
          <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
            <span>Rent: <strong>${location.rent.toLocaleString()}/mo</strong></span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${trafficStyle}`}
            >
              {location.foot_traffic} Traffic
            </span>
          </div>
        </div>
      </div>

      {/* Score */}
      <div className="text-right shrink-0">
        <div className={`text-3xl font-extrabold ${scoreColor}`}>{location.score}</div>
        <div className="text-xs text-gray-400 uppercase tracking-wide">Score</div>
      </div>
    </div>
  );
}
