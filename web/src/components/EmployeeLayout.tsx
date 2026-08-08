import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../lib/auth";

const TABS = [
  { to: "/my-shifts", label: "My Shifts" },
  { to: "/schedule", label: "Store Schedule" },
  { to: "/swaps", label: "Swaps" },
  { to: "/time-off", label: "Time Off" },
  { to: "/availability", label: "Availability" },
];

export default function EmployeeLayout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "0 1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "2rem",
          height: 60,
          boxShadow: "var(--shadow-sm)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div className="row" style={{ gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--brand)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 16,
              fontFamily: "'Fraunces', serif",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            T
          </div>
          <span className="wordmark" style={{ fontSize: 18, color: "var(--ink)" }}>
            Ted's Scheduler
          </span>
        </div>
        <nav style={{ display: "flex", gap: 2, flex: 1, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              style={({ isActive }) => ({
                padding: "7px 13px",
                borderRadius: 999,
                textDecoration: "none",
                fontSize: 14,
                color: isActive ? "var(--brand)" : "var(--text-muted)",
                background: isActive ? "var(--brand-tint)" : "transparent",
                fontWeight: isActive ? 600 : 500,
                transition: "background 0.13s, color 0.13s",
              })}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="row" style={{ gap: 12 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            {user.first_name} {user.last_name}
          </span>
          <button onClick={logout}>Sign out</button>
        </div>
      </header>
      <main style={{ padding: "1.75rem 1.5rem", flex: 1, maxWidth: 1100, width: "100%", margin: "0 auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
