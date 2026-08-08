import { useCallback, useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { formatDateLabel, formatShiftRange } from "../../lib/format";
import { usePublishedSchedule } from "../../hooks/usePublishedSchedule";
import type { SwapRequest, User } from "../../lib/types";

const STATUS_LABEL: Record<string, string> = {
  open: "Open (in pool)",
  pending_coworker: "Waiting on coworker",
  pending_manager: "Waiting on manager",
  approved: "Approved",
  denied: "Denied",
  cancelled: "Cancelled",
};

export default function Swaps() {
  const { user } = useAuth();
  const { shifts, names } = usePublishedSchedule();
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // form state for requesting a swap
  const [shiftId, setShiftId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");

  const loadSwaps = useCallback(async () => {
    setSwaps(await api.listSwaps());
  }, []);

  useEffect(() => {
    loadSwaps();
  }, [loadSwaps]);

  const myShifts = useMemo(
    () => shifts.filter((s) => s.employee_id === user?.id),
    [shifts, user],
  );

  const coworkers = useMemo(
    () =>
      [...names.values()].filter(
        (p: User) => p.id !== user?.id && (p.role === "employee" || p.role === "manager"),
      ),
    [names, user],
  );

  function shiftLabel(id: number): string {
    const s = shifts.find((x) => x.id === id);
    if (!s) return `Shift #${id}`;
    return `${formatDateLabel(s.on_date)} ${formatShiftRange(s.start_time, s.end_time)}`;
  }
  const nameOf = (id: number | null) =>
    id ? (names.get(id) ? `${names.get(id)!.first_name} ${names.get(id)!.last_name}` : `#${id}`) : "—";

  async function act(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      await loadSwaps();
      setMsg(okMsg);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function requestSwap() {
    if (!shiftId) return;
    await act(
      () => api.createSwap(Number(shiftId), targetId ? Number(targetId) : null),
      targetId
        ? "Swap requested — your coworker will be asked to accept."
        : "Shift dropped to the pool.",
    );
    setShiftId("");
    setTargetId("");
  }

  // incoming swaps addressed to me, awaiting my acceptance
  const incoming = swaps.filter(
    (s) => s.target_employee_id === user?.id && s.status === "pending_coworker",
  );
  // open pool shifts I could claim (not mine)
  const pool = swaps.filter(
    (s) => s.status === "open" && s.requesting_employee_id !== user?.id,
  );
  // my own requests
  const mine = swaps.filter((s) => s.requesting_employee_id === user?.id);

  return (
    <div>
      <h2>Swaps and Drops</h2>
      {msg && (
        <div className="tag-ok" style={{ padding: "8px 12px", borderRadius: 6, margin: "8px 0" }}>
          {msg}
        </div>
      )}

      {/* Request a swap */}
      <div className="card" style={{ padding: 16, marginTop: 8 }}>
        <strong>Request a swap</strong>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} style={{ width: "auto", minWidth: 220 }}>
            <option value="">— pick your shift —</option>
            {myShifts.map((s) => (
              <option key={s.id} value={s.id}>
                {shiftLabel(s.id)}
              </option>
            ))}
          </select>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={{ width: "auto", minWidth: 200 }}>
            <option value="">Drop to pool (anyone)</option>
            {coworkers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </option>
            ))}
          </select>
          <button className="primary" onClick={requestSwap} disabled={busy || !shiftId}>
            Request
          </button>
        </div>
        {myShifts.length === 0 && (
          <p className="muted" style={{ fontSize: 12, marginBottom: 0, marginTop: 8 }}>
            You have no shifts in the loaded week to swap.
          </p>
        )}
      </div>

      {/* Incoming requests for me */}
      {incoming.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Coworkers asking you to take a shift</h3>
          <div className="stack">
            {incoming.map((s) => (
              <div key={s.id} className="card spread" style={{ padding: 12 }}>
                <span>
                  <strong>{nameOf(s.requesting_employee_id)}</strong> wants you to take{" "}
                  {shiftLabel(s.shift_id)}
                  {s.target_shift_id && (
                    <>, and they take your {shiftLabel(s.target_shift_id)}</>
                  )}
                </span>
                <div className="row">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => act(() => api.acceptSwap(s.id), "Accepted — pending manager approval.")}
                  >
                    Accept
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => act(() => api.declineSwap(s.id), "Declined.")}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Open pool */}
      {pool.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Open shifts you can claim</h3>
          <div className="stack">
            {pool.map((s) => (
              <div key={s.id} className="card spread" style={{ padding: 12 }}>
                <span>
                  <strong>{nameOf(s.requesting_employee_id)}</strong> dropped{" "}
                  {shiftLabel(s.shift_id)}
                </span>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => act(() => api.claimSwap(s.id), "Claimed — pending manager approval.")}
                >
                  Claim
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* My requests */}
      <h3 style={{ marginTop: 24 }}>My swap requests</h3>
      {mine.length === 0 ? (
        <p className="muted">No swap requests yet.</p>
      ) : (
        <div className="stack">
          {mine.map((s) => (
            <div key={s.id} className="card spread" style={{ padding: 12 }}>
              <span>
                {shiftLabel(s.shift_id)}
                {s.target_shift_id ? (
                  <span className="muted">
                    {" "}↔ {nameOf(s.target_employee_id)}'s {shiftLabel(s.target_shift_id)}
                  </span>
                ) : s.target_employee_id ? (
                  <span className="muted"> → {nameOf(s.target_employee_id)}</span>
                ) : (
                  <span className="muted"> (dropped to pool)</span>
                )}
              </span>
              <span className="row" style={{ gap: 8 }}>
                <span
                  className={
                    s.status === "approved"
                      ? "badge tag-ok"
                      : s.status === "denied" || s.status === "cancelled"
                      ? "badge tag-danger"
                      : "badge tag-warn"
                  }
                >
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
                {(s.status === "open" ||
                  s.status === "pending_coworker" ||
                  s.status === "pending_manager") && (
                  <button
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    disabled={busy}
                    onClick={() => act(() => api.cancelSwap(s.id), "Request cancelled.")}
                  >
                    Cancel
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
