"use client";
import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDashboardMetrics, recommendLocations } from "@/services/api";

function buildActivity(metrics, locations) {
  const items = [];
  if (locations.length > 0) {
    locations.forEach((loc, i) => {
      items.push({
        name: `Expansion analysis — ${loc.name}`,
        status: i === 0 ? "complete" : i === locations.length - 1 ? "pending" : "complete",
      });
    });
  }
  if (metrics) {
    items.push({ name: "Financial forecast simulation", status: "complete" });
    items.push({ name: "Rent-to-revenue ratio check", status: "pending" });
  }
  return items;
}

const TABS = [
  { key: "home", label: "Home" },
  { key: "sandbox", label: "Sandbox", href: "/sandbox" },
  { key: "expansion", label: "Expansion", href: "/expansion" },
];

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useUser();
  const router = useRouter();
  const [metrics, setMetrics] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("home");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !user) return;
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
  }, [authLoading, user]);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

  if (authLoading || !user) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--moss)", fontFamily: "'DM Sans', sans-serif", fontSize: "14px" }}>Loading...</p>
      </div>
    );
  }

  const stats = metrics
    ? [
        { label: "Simulations", value: String(locations.length + 3), highlight: false },
        { label: "Avg. Improvement", value: `${metrics.feasibility_score}%`, highlight: true },
        { label: "Savings Found", value: `$${Math.round(metrics.predicted_profit * 0.12).toLocaleString()}`, highlight: false },
        { label: "Top Scenario", value: locations[0]?.name || "—", highlight: false, small: true },
        { label: "Locations Analyzed", value: String(metrics.recommended_locations), highlight: false },
        { label: "Cities Covered", value: "3", highlight: false },
      ]
    : [];

  const activities = buildActivity(metrics, locations);

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Fixed Navbar ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0,
        height: "64px", zIndex: 50,
        background: "rgba(250, 248, 244, 0.88)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--forest-rim)",
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <span style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "20px", fontWeight: "700",
            color: "var(--forest)", letterSpacing: "-0.02em",
          }}>
            LaunchPad <span style={{ color: "var(--sage)" }}>AI</span>
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {TABS.map((t) =>
            t.href ? (
              <Link
                key={t.key}
                href={t.href}
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "var(--moss)",
                  background: "none",
                  border: "1px solid transparent",
                  padding: "6px 16px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  transition: "all 0.2s",
                }}
              >
                {t.label}
              </Link>
            ) : (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--forest)",
                  background: "var(--white)",
                  border: "1px solid var(--forest-rim)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  cursor: "pointer",
                  padding: "6px 16px",
                  borderRadius: "8px",
                  transition: "all 0.2s",
                }}
              >
                {t.label}
              </button>
            )
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ color: "var(--moss)", fontSize: "13px", fontWeight: "500" }}>
            {user.name || user.email}
          </span>
          <a
            href="/api/auth/logout"
            style={{
              fontSize: "13px", color: "var(--forest)",
              border: "1px solid var(--forest-rim)",
              padding: "5px 14px", borderRadius: "8px",
              textDecoration: "none", transition: "all 0.2s",
            }}
          >
            Sign out
          </a>
        </div>
      </nav>

      {/* ── Tab Content ── */}
      <div style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
        {tab === "home" && (
          <div style={{
            paddingTop: "88px",
            paddingLeft: "40px",
            paddingRight: "40px",
            paddingBottom: "48px",
            background: "var(--cream)",
            minHeight: "100vh",
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {loading ? (
              <p style={{ color: "var(--moss)", fontSize: "14px", textAlign: "center", paddingTop: "80px" }}>Loading dashboard...</p>
            ) : error ? (
              <div style={{ textAlign: "center", paddingTop: "80px" }}>
                <p style={{ color: "var(--amber)", fontWeight: "500", fontSize: "15px" }}>{error}</p>
              </div>
            ) : (
              <>
                <h2 style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "28px", fontWeight: "700",
                  color: "var(--forest)", marginBottom: "8px",
                }}>
                  Your Activity
                </h2>
                <p style={{ color: "var(--moss)", fontSize: "14px", marginBottom: "32px" }}>
                  Track your simulations, savings, and expansion progress.
                </p>

                {/* Stats Grid */}
                <div
                  className="hide-scrollbar"
                  style={{
                    display: "flex", gap: "16px",
                    overflowX: "auto", paddingBottom: "16px",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  {stats.map((s, i) => (
                    <StatCard key={i} label={s.label} value={s.value} highlight={s.highlight} small={s.small} />
                  ))}
                </div>
                <p style={{ fontSize: "11px", color: "var(--moss)", opacity: 0.5, marginTop: "8px", marginLeft: "4px" }}>
                  ← Scroll for more stats
                </p>

                {/* Recent Activity */}
                <h3 style={{
                  fontSize: "16px", fontWeight: "600",
                  color: "var(--forest)", marginBottom: "16px",
                  marginTop: "40px",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  Recent Activity
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {activities.map((a, i) => (
                    <ActivityCard key={i} name={a.name} status={a.status} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ label, value, highlight, small }) {
  return (
    <div
      style={{
        minWidth: "200px", flexShrink: 0,
        background: "var(--white)",
        border: "1px solid var(--forest-rim)",
        borderRadius: "14px",
        padding: "24px",
        transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--sage)";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--forest-rim)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <p style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "12px", fontWeight: "600",
        color: "var(--moss)", textTransform: "uppercase",
        letterSpacing: "0.08em", marginBottom: "10px",
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: small ? "24px" : "36px",
        fontWeight: "700",
        color: highlight ? "var(--sage)" : "var(--forest)",
        lineHeight: 1,
      }}>
        {value || "—"}
      </p>
    </div>
  );
}

/* ── Activity Card ── */
function ActivityCard({ name, status }) {
  const isComplete = status === "complete";
  return (
    <div
      style={{
        background: "var(--white)",
        border: "1px solid var(--forest-rim)",
        borderRadius: "12px",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--sage)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--forest-rim)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <span style={{ fontSize: "14px", color: "var(--forest)", fontWeight: "500" }}>
        {name}
      </span>
      {isComplete ? (
        <span style={{
          fontSize: "12px", fontWeight: "600",
          color: "var(--sage)",
          background: "rgba(61, 139, 36, 0.08)",
          border: "1px solid rgba(61, 139, 36, 0.2)",
          padding: "3px 10px", borderRadius: "20px",
        }}>
          Complete
        </span>
      ) : (
        <span style={{
          fontSize: "12px", fontWeight: "600",
          color: "var(--amber)",
          background: "rgba(196, 149, 48, 0.08)",
          border: "1px solid rgba(196, 149, 48, 0.2)",
          padding: "3px 10px", borderRadius: "20px",
        }}>
          Pending
        </span>
      )}
    </div>
  );
}

