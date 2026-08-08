import { useEffect, useState } from "react";

import SwapRequestDetail from "../components/SwapRequestDetail";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { SwapRequest, User } from "../lib/types";

export default function SwapHistory() {
  const { user } = useAuth();
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [names, setNames] = useState<Map<number, string>>(new Map());
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.listSwaps(),
      api.listEmployees(user?.store_id ?? undefined),
    ]).then(([s, emps]) => {
      setSwaps(s.filter((x) => x.status === "approved" || x.status === "denied"));
      setNames(new Map(emps.map((e: User) => [e.id, `${e.first_name} ${e.last_name}`])));
    });
  }, [user]);

  const nameOf = (id: number | null) => (id ? names.get(id) ?? `#${id}` : "—");

  return (
    <div>
      <h2>Swap History</h2>
      {swaps.length === 0 ? (
        <p className="muted">No decided swaps yet.</p>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          {swaps.map((s) => (
            <div key={s.id} className="card" style={{ padding: 12 }}>
              <div className="spread">
                <span>
                  <strong>{nameOf(s.requesting_employee_id)}</strong>
                  {s.target_shift_id ? " ↔ " : " → "}
                  <strong>{nameOf(s.target_employee_id)}</strong>{" "}
                  <span className="muted">
                    {s.target_shift_id ? "(two-way)" : "(drop/claim)"}
                  </span>
                </span>
                <span className="row" style={{ gap: 8 }}>
                  <span className={s.status === "approved" ? "badge tag-ok" : "badge tag-danger"}>
                    {s.status}
                  </span>
                  <button
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  >
                    {expanded === s.id ? "Hide" : "View shifts"}
                  </button>
                </span>
              </div>
              {s.manager_note && (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Note: {s.manager_note}
                </div>
              )}
              {expanded === s.id && <SwapRequestDetail swapId={s.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
