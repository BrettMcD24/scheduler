import { useCallback, useEffect, useState } from "react";

import SwapRequestDetail from "../components/SwapRequestDetail";
import { api } from "../lib/api";
import type { SwapRequest, TimeOffRequest, User } from "../lib/types";
import { useAuth } from "../lib/auth";

export default function Approvals() {
  const { user } = useAuth();
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffRequest[]>([]);
  const [names, setNames] = useState<Map<number, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [s, t, emps] = await Promise.all([
      api.listSwaps("pending_manager"),
      api.listTimeOff("pending"),
      api.listEmployees(user?.store_id ?? undefined),
    ]);
    setSwaps(s);
    setTimeOff(t);
    setNames(new Map(emps.map((e: User) => [e.id, `${e.first_name} ${e.last_name}`])));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } finally {
      setBusy(false);
    }
  }

  const nameOf = (id: number | null) => (id ? names.get(id) ?? `#${id}` : "—");

  return (
    <div>
      <h2>Approvals</h2>

      <h3 style={{ marginTop: 20 }}>Shift swaps ({swaps.length})</h3>
      {swaps.length === 0 && <p className="muted">No swaps awaiting approval.</p>}
      <div className="stack">
        {swaps.map((s) => (
          <div key={s.id} className="card" style={{ padding: 12 }}>
            <div className="spread">
              <span>
                <strong>{nameOf(s.requesting_employee_id)}</strong>
                {s.target_shift_id ? " ↔ " : " → "}
                <strong>{nameOf(s.target_employee_id)}</strong>{" "}
                <span className="muted">
                  {s.target_shift_id ? "(two-way swap)" : "(takes shift)"}
                </span>
              </span>
              <div className="row">
                <button
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                >
                  {expanded === s.id ? "Hide" : "View Request"}
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => act(() => api.approveSwap(s.id))}
                >
                  Approve
                </button>
                <button disabled={busy} onClick={() => act(() => api.denySwap(s.id))}>
                  Deny
                </button>
              </div>
            </div>
            {expanded === s.id && <SwapRequestDetail swapId={s.id} />}
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: 24 }}>Time off ({timeOff.length})</h3>
      {timeOff.length === 0 && <p className="muted">No time-off requests pending.</p>}
      <div className="stack">
        {timeOff.map((t) => (
          <div key={t.id} className="card spread" style={{ padding: 12 }}>
            <span>
              <strong>{nameOf(t.employee_id)}</strong>{" "}
              {t.start_date === t.end_date
                ? t.start_date
                : `${t.start_date} → ${t.end_date}`}
              {t.reason && <span className="muted"> — {t.reason}</span>}
            </span>
            <div className="row">
              <button
                className="primary"
                disabled={busy}
                onClick={() => act(() => api.approveTimeOff(t.id))}
              >
                Approve
              </button>
              <button disabled={busy} onClick={() => act(() => api.denyTimeOff(t.id))}>
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
