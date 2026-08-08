import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api";
import type { TimeOffRequest } from "../../lib/types";

const STATUS_CLASS: Record<string, string> = {
  approved: "badge tag-ok",
  denied: "badge tag-danger",
  cancelled: "badge tag-danger",
  pending: "badge tag-warn",
};

export default function TimeOff() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRequests(await api.listTimeOff());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!start || !end) return;
    if (end < start) {
      setMsg("End date can't be before start date.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await api.createTimeOff(start, end, reason);
      setStart("");
      setEnd("");
      setReason("");
      setMsg("Request submitted — your manager will review it.");
      await load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Couldn't submit request");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: number) {
    setBusy(true);
    try {
      await api.cancelTimeOff(id);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Time Off</h2>
      {msg && (
        <div className="tag-ok" style={{ padding: "8px 12px", borderRadius: 6, margin: "8px 0" }}>
          {msg}
        </div>
      )}

      <div className="card" style={{ padding: 16, marginTop: 8 }}>
        <strong>Request time off</strong>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>From</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: "auto" }} />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>To</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ width: "auto" }} />
          </label>
          <label className="stack" style={{ gap: 4, flex: 1, minWidth: 180 }}>
            <span className="muted" style={{ fontSize: 12 }}>Reason (optional)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. family trip" />
          </label>
          <button className="primary" onClick={submit} disabled={busy || !start || !end}>
            Submit
          </button>
        </div>
      </div>

      <h3 style={{ marginTop: 24 }}>My requests</h3>
      {requests.length === 0 ? (
        <p className="muted">No time-off requests yet.</p>
      ) : (
        <div className="stack">
          {requests.map((r) => (
            <div key={r.id} className="card spread" style={{ padding: 12 }}>
              <span>
                {r.start_date === r.end_date ? r.start_date : `${r.start_date} → ${r.end_date}`}
                {r.reason && <span className="muted"> — {r.reason}</span>}
                {r.manager_note && (
                  <span className="muted" style={{ fontStyle: "italic" }}> (note: {r.manager_note})</span>
                )}
              </span>
              <span className="row" style={{ gap: 8 }}>
                <span className={STATUS_CLASS[r.status] ?? "badge"}>{r.status}</span>
                {r.status === "pending" && (
                  <button style={{ padding: "2px 10px", fontSize: 12 }} disabled={busy} onClick={() => cancel(r.id)}>
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
