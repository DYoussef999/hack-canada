import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      {/* Hero */}
      <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
        Hackathon MVP
      </div>
      <h1 className="text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
        Expand Your Business <br />
        <span className="text-blue-600">With Confidence</span>
      </h1>
      <p className="text-lg text-gray-500 max-w-xl mb-10">
        LaunchPad AI helps small businesses simulate expansion decisions, estimate
        revenue &amp; costs, and find the best locations to grow — all in one place.
      </p>

      {/* CTA buttons */}
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/dashboard"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition"
        >
          View Dashboard
        </Link>
        <Link
          href="/sandbox"
          className="border border-gray-300 hover:border-blue-400 text-gray-700 font-semibold px-6 py-3 rounded-lg transition"
        >
          Run Simulation
        </Link>
        <Link
          href="/optimizer"
          className="border border-gray-300 hover:border-blue-400 text-gray-700 font-semibold px-6 py-3 rounded-lg transition"
        >
          Find Locations
        </Link>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-20 w-full max-w-3xl text-left">
        {[
          {
            icon: "📊",
            title: "Expansion Sandbox",
            desc: "Simulate the financial impact of opening a new location with custom inputs.",
          },
          {
            icon: "📍",
            title: "Location Optimizer",
            desc: "Get ranked location recommendations based on rent, foot traffic, and competition.",
          },
          {
            icon: "🏠",
            title: "Business Dashboard",
            desc: "View predicted revenue, profit, and expansion feasibility at a glance.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
          >
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-bold text-gray-900 mb-1">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
