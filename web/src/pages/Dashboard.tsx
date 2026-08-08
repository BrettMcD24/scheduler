import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../lib/api";

export default function Dashboard() {
  const [pendingSwaps, setPendingSwaps] = useState(0);
  const [pendingTimeOff, setPendingTimeOff] = useState(0);
  const [callOffs, setCallOffs] = useState(0);
  const [recentSwaps, setRecentSwaps] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.listSwaps("pending_manager"),
      api.listTimeOff("pending"),
      api.listCallOffs(),
      api.listSwaps(),
    ])
      .then(([swaps, timeOff, cos, allSwaps]) => {
        setPendingSwaps(swaps.length);
        setPendingTimeOff(timeOff.length);
        setCallOffs(cos.length);
        setRecentSwaps(
          allSwaps.filter((s) => s.status === "approved" || s.status === "denied")
            .length,
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
        <StatCard
          label="Swaps awaiting approval"
          value={loading ? "…" : pendingSwaps}
          to="/approvals"
        />
        <StatCard
          label="Time-off requests pending"
          value={loading ? "…" : pendingTimeOff}
          to="/approvals"
        />
        <StatCard
          label="Call-offs logged"
          value={loading ? "…" : callOffs}
          to="/call-offs"
        />
        <StatCard
          label="Swaps in history"
          value={loading ? "…" : recentSwaps}
          to="/swap-history"
        />
        <StatCard label="Build this week's schedule" value="→" to="/builder" />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  to,
}: {
  label: string;
  value: string | number;
  to: string;
}) {
  return (
    <Link to={to} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        className="card"
        style={{
          padding: "1.25rem 1.4rem",
          transition: "transform 0.12s, box-shadow 0.12s",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "var(--shadow-md)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = "var(--shadow-sm)";
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 700, color: "var(--brand)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          {value}
        </div>
        <div className="muted" style={{ marginTop: 4, fontWeight: 500 }}>{label}</div>
      </div>
    </Link>
  );
}
