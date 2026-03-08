export default function MetricCard({ title, value, prefix = "", suffix = "", color = "blue" }) {
  const accentMap = {
    blue:   "var(--sage)",
    green:  "var(--sage)",
    red:    "var(--amber)",
    purple: "var(--sage)",
    orange: "var(--amber)",
  };
  const accent = accentMap[color] || "var(--sage)";

  return (
    <div style={{
      background: "var(--white)",
      border: "1px solid var(--forest-rim)",
      borderRadius: "14px",
      padding: "24px",
    }}>
      <p style={{
        fontSize: "12px", fontWeight: "600",
        color: "var(--moss)", textTransform: "uppercase",
        letterSpacing: "0.08em", marginBottom: "10px",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {title}
      </p>
      <span style={{
        display: "inline-block",
        fontFamily: "'Playfair Display', serif",
        fontSize: "32px", fontWeight: "700",
        color: accent, lineHeight: 1,
      }}>
        {prefix}{typeof value === "number" ? value.toLocaleString() : value}{suffix}
      </span>
    </div>
  );
}
