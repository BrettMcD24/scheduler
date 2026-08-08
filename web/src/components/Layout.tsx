import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../lib/auth";

export default function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const isManager = user.role === "manager" || user.role === "super_admin";

  const navItems = isManager
    ? [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/builder", label: "Schedule Builder" },
        { to: "/employees", label: "Employees" },
        { to: "/approvals", label: "Approvals" },
        { to: "/call-offs", label: "Call-Offs" },
        { to: "/swap-history", label: "Swap History" },
      ]
    : [
        { to: "/my-shifts", label: "My Shifts" },
        { to: "/schedule", label: "Store Schedule" },
        { to: "/swaps", label: "Swaps" },
        { to: "/time-off", label: "Time Off" },
      ];

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
        <nav style={{ display: "flex", gap: 2, flex: 1 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="row" style={{ gap: 12 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            {user.first_name} {user.last_name}
            <span className="badge" style={{ marginLeft: 8 }}>
              {user.role === "super_admin" ? "admin" : user.role}
            </span>
          </span>
          <button onClick={logout}>Sign out</button>
        </div>
      </header>
      <main style={{ padding: "1.75rem 1.5rem", flex: 1, width: "100%" }}>
        <Outlet />
      </main>
    </div>
  );
}
