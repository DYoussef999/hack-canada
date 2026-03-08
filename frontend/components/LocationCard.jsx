export default function LocationCard({ location, index }) {
  const scoreColor =
    location.score >= 75 ? "var(--sage)" : location.score >= 50 ? "var(--amber)" : "var(--amber)";

  const trafficColorMap = {
    "Very High": { color: "#3d8b24", bg: "rgba(61,139,36,0.08)", border: "rgba(61,139,36,0.2)" },
    High:        { color: "#3d8b24", bg: "rgba(61,139,36,0.08)", border: "rgba(61,139,36,0.2)" },
    Medium:      { color: "#c49530", bg: "rgba(196,149,48,0.08)", border: "rgba(196,149,48,0.2)" },
    Low:         { color: "#c49530", bg: "rgba(196,149,48,0.08)", border: "rgba(196,149,48,0.2)" },
  };
  const tc = trafficColorMap[location.foot_traffic] || trafficColorMap.Medium;

  return (
    <div style={{
      background: "var(--white)",
      border: "1px solid var(--forest-rim)",
      borderRadius: "14px",
      padding: "20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "50%",
          background: "var(--forest)", color: "#FFFFFF",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: "700", fontSize: "14px", flexShrink: 0,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {index}
        </div>
        <div>
          <h3 style={{ fontWeight: "700", color: "var(--forest)", fontSize: "15px", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>
            {location.name}
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "4px", fontSize: "13px", color: "var(--moss)" }}>
            <span>Rent: <strong style={{ color: "var(--forest)" }}>${location.rent.toLocaleString()}/mo</strong></span>
            <span style={{
              padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: "600",
              color: tc.color, background: tc.bg, border: `1px solid ${tc.border}`,
            }}>
              {location.foot_traffic} Traffic
            </span>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "30px", fontWeight: "700", color: scoreColor, lineHeight: 1,
        }}>
          {location.score}
        </div>
        <div style={{ fontSize: "10px", color: "var(--moss)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "2px", opacity: 0.6 }}>
          Score
        </div>
      </div>
    </div>
  );
}
