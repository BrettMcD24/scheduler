import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDateLabel } from "../lib/format";
import type { CallOff, User } from "../lib/types";

export default function CallOffs() {
  const { user } = useAuth();
  const [callOffs, setCallOffs] = useState<CallOff[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [onDate, setOnDate] = useState("");
  const [shiftLabel, setShiftLabel] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [cos, emps] = await Promise.all([
      api.listCallOffs(),
      api.listEmployees(user?.store_id ?? undefined),
    ]);
    setCallOffs(cos);
    setEmployees(emps.filter((e) => e.role === "employee" || e.role === "manager"));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!employeeId || !onDate) {
      setMsg("Pick an employee and a date.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await api.createCallOff({
        employee_id: Number(employeeId),
        on_date: onDate,
        shift_label: shiftLabel,
        reason,
      });
      setEmployeeId("");
      setOnDate("");
      setShiftLabel("");
      setReason("");
      setMsg("Call-off logged.");
      await load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Couldn't log call-off");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    try {
      await api.deleteCallOff(id);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Call-Offs</h2>
      <p className="muted">
        Log when an employee calls in unable to work. These are kept for tracking
        and any disciplinary follow-up.
      </p>
      {msg && (
        <div className="tag-ok" style={{ padding: "8px 12px", borderRadius: 6, margin: "8px 0" }}>
          {msg}
        </div>
      )}

      <div className="card" style={{ padding: 16, marginTop: 8 }}>
        <strong>Log a call-off</strong>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>Employee</span>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ width: 200 }}>
              <option value="">— pick —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name}
                </option>
              ))}
            </select>
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>Date</span>
            <input type="date" value={onDate} onChange={(e) => setOnDate(e.target.value)} style={{ width: "auto" }} />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>Shift (optional)</span>
            <input value={shiftLabel} onChange={(e) => setShiftLabel(e.target.value)} placeholder="e.g. 8-4" style={{ width: 110 }} />
          </label>
          <label className="stack" style={{ gap: 4, flex: 1, minWidth: 160 }}>
            <span className="muted" style={{ fontSize: 12 }}>Reason</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. sick, no-show" />
          </label>
          <button className="primary" onClick={submit} disabled={busy}>
            Log
          </button>
        </div>
      </div>

      <h3 style={{ marginTop: 24 }}>Logged call-offs</h3>
      {callOffs.length === 0 ? (
        <p className="muted">No call-offs logged.</p>
      ) : (
        <div className="stack">
          {callOffs.map((c) => (
            <div key={c.id} className="card spread" style={{ padding: 12 }}>
              <span>
                <strong>{c.employee_name ?? `#${c.employee_id}`}</strong>{" "}
                <span className="muted">{formatDateLabel(c.on_date)}</span>
                {c.shift_label && <span className="muted"> · {c.shift_label}</span>}
                {c.reason && <span> — {c.reason}</span>}
              </span>
              <button style={{ padding: "2px 10px", fontSize: 12 }} disabled={busy} onClick={() => remove(c.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
