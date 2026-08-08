import { useState, type FormEvent } from "react";

import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Something went wrong. Is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "1rem",
      }}
    >
      <div className="card" style={{ padding: "2.25rem", width: 380, maxWidth: "100%", boxShadow: "var(--shadow-lg)" }}>
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "var(--brand)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 28,
              fontFamily: "'Fraunces', serif",
              margin: "0 auto 0.9rem",
              boxShadow: "var(--shadow-md)",
            }}
          >
            T
          </div>
          <h1 className="wordmark" style={{ fontSize: 24, marginBottom: 2 }}>Ted's Scheduler</h1>
          <p className="muted" style={{ margin: 0 }}>Sign in to continue</p>
        </div>
        <form onSubmit={onSubmit} className="stack">
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <div className="tag-danger" style={{ padding: "8px 10px", borderRadius: 6 }}>
              {error}
            </div>
          )}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
