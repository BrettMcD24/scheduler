import { useState } from "react";

import type { Shift, User } from "../lib/types";
import { formatShiftRange } from "../lib/format";
import SkillBadge from "./SkillBadge";

interface Props {
  myShift: Shift;
  dayShifts: Shift[]; // all shifts on the same day (assigned)
  names: Map<number, User>;
  onConfirm: (targetShiftId: number, reason: string) => void;
  onCancel: () => void;
}

export default function SwapPickerModal({
  myShift,
  dayShifts,
  names,
  onConfirm,
  onCancel,
}: Props) {
  const [picked, setPicked] = useState<Shift | null>(null);
  const [reason, setReason] = useState("");

  // everyone working that day except me / my shift
  const candidates = dayShifts.filter(
    (s) => s.id !== myShift.id && s.employee_id != null,
  );

  function nameFor(s: Shift) {
    const p = s.employee_id ? names.get(s.employee_id) : null;
    return p ? `${p.first_name} ${p.last_name}` : "—";
  }

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 20, width: 460, maxWidth: "92%", maxHeight: "82vh", overflowY: "auto" }}
      >
        <h3 style={{ marginBottom: 2 }}>Swap your shift</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          You're giving up {formatShiftRange(myShift.start_time, myShift.end_time)}.
          {!picked && " Pick a coworker working that day to trade with."}
        </p>

        {!picked ? (
          candidates.length === 0 ? (
            <p className="muted">No one else is scheduled that day to swap with.</p>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              {candidates.map((s) => {
                const p = s.employee_id ? names.get(s.employee_id) : null;
                return (
                  <button
                    key={s.id}
                    onClick={() => setPicked(s)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span className="row" style={{ gap: 8 }}>
                      <strong>{nameFor(s)}</strong>
                      {p?.role === "manager" && <span className="mgr-badge">Mgr</span>}
                      <SkillBadge level={p?.skill_level ?? null} />
                    </span>
                    <span>{formatShiftRange(s.start_time, s.end_time)}</span>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <>
            {/* Confirmation step */}
            <div className="card" style={{ padding: 12, boxShadow: "none", marginBottom: 12 }}>
              <div style={{ fontSize: 14 }}>
                <strong>You</strong> give up{" "}
                {formatShiftRange(myShift.start_time, myShift.end_time)}
              </div>
              <div style={{ fontSize: 14, marginTop: 4 }}>
                <strong>{nameFor(picked)}</strong> gives up{" "}
                {formatShiftRange(picked.start_time, picked.end_time)}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                If approved, you'll take their shift and they'll take yours.
              </div>
            </div>

            <label className="stack" style={{ gap: 4 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Reason for the swap (visible to your manager)
              </span>
              <input
                autoFocus
                placeholder="e.g. schedule conflict, prefer earlier shift"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>

            <div className="row" style={{ justifyContent: "space-between", marginTop: 16 }}>
              <button onClick={() => setPicked(null)}>← Back</button>
              <button
                className="primary"
                onClick={() => onConfirm(picked.id, reason)}
              >
                Confirm swap request
              </button>
            </div>
          </>
        )}

        {!picked && (
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
            <button onClick={onCancel}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
