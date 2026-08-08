import { useCallback, useEffect, useMemo, useState } from "react";

import DropReasonModal from "../../components/DropReasonModal";
import SwapPickerModal from "../../components/SwapPickerModal";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { formatDateLabel, formatShiftRange, weekDates } from "../../lib/format";
import { usePublishedSchedule } from "../../hooks/usePublishedSchedule";
import type { Shift, SwapRequest } from "../../lib/types";

export default function MyShifts() {
  const { user } = useAuth();
  const { schedules, weekStart, setWeekStart, shifts, names, loading } =
    usePublishedSchedule();
  const [swapMsg, setSwapMsg] = useState("");
  const [swapShift, setSwapShift] = useState<Shift | null>(null);
  const [dropShift, setDropShift] = useState<Shift | null>(null);
  const [incoming, setIncoming] = useState<SwapRequest[]>([]);
  const [busy, setBusy] = useState(false);

  const loadSwaps = useCallback(async () => {
    const all = await api.listSwaps();
    setIncoming(
      all.filter(
        (s) => s.target_employee_id === user?.id && s.status === "pending_coworker",
      ),
    );
  }, [user]);

  useEffect(() => {
    loadSwaps();
  }, [loadSwaps]);

  const myShifts = useMemo(
    () =>
      shifts
        .filter((s) => s.employee_id === user?.id)
        .sort((a, b) =>
          (a.on_date + a.start_time).localeCompare(b.on_date + b.start_time),
        ),
    [shifts, user],
  );

  const totalHours = myShifts.reduce((sum, s) => sum + s.hours, 0);

  const nameOf = (id: number | null) =>
    id ? (names.get(id) ? `${names.get(id)!.first_name} ${names.get(id)!.last_name}` : `#${id}`) : "—";
  function shiftLabel(id: number): string {
    const s = shifts.find((x) => x.id === id);
    if (!s) return `shift #${id}`;
    return `${formatDateLabel(s.on_date)} ${formatShiftRange(s.start_time, s.end_time)}`;
  }

  async function confirmDrop(reason: string) {
    if (!dropShift) return;
    setSwapMsg("");
    try {
      await api.createSwap(dropShift.id, null, null, reason);
      setSwapMsg("Shift dropped to the pool — a coworker can claim it, then your manager approves.");
      setDropShift(null);
    } catch (err) {
      setSwapMsg(err instanceof ApiError ? err.message : "Couldn't drop shift");
    }
  }

  async function requestSwap(targetShiftId: number, reason: string) {
    if (!swapShift) return;
    setSwapMsg("");
    try {
      await api.createSwap(swapShift.id, null, targetShiftId, reason);
      setSwapMsg("Swap requested — your coworker will be asked to accept, then your manager approves.");
      setSwapShift(null);
    } catch (err) {
      setSwapMsg(err instanceof ApiError ? err.message : "Couldn't request swap");
    }
  }

  async function respondToSwap(id: number, accept: boolean) {
    setBusy(true);
    setSwapMsg("");
    try {
      await (accept ? api.acceptSwap(id) : api.declineSwap(id));
      await loadSwaps();
      setSwapMsg(accept ? "Accepted — pending manager approval." : "Declined.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <div className="spread" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>My Shifts</h2>
        {schedules.length > 0 && (
          <select
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            style={{ width: "auto" }}
          >
            {schedules.map((s) => (
              <option key={s.id} value={s.week_start}>
                Week of {s.week_start}
              </option>
            ))}
          </select>
        )}
      </div>

      {swapMsg && (
        <div className="tag-ok" style={{ padding: "8px 12px", borderRadius: 6, marginBottom: 12 }}>
          {swapMsg}
        </div>
      )}

      {incoming.length > 0 && (
        <div className="stack" style={{ gap: 8, marginBottom: 16 }}>
          {incoming.map((s) => (
            <div
              key={s.id}
              className="card spread"
              style={{
                padding: 12,
                background: "#eef3ff",
                borderLeft: "4px solid #3b5bdb",
              }}
            >
              <span>
                <strong>{nameOf(s.requesting_employee_id)}</strong> wants to swap shifts —
                you'd take {shiftLabel(s.shift_id)}
                {s.target_shift_id && <>, and they take your {shiftLabel(s.target_shift_id)}</>}
              </span>
              <div className="row">
                <button className="primary" disabled={busy} onClick={() => respondToSwap(s.id, true)}>
                  Accept
                </button>
                <button disabled={busy} onClick={() => respondToSwap(s.id, false)}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {schedules.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>
            No published schedules yet. Check back once your manager posts one.
          </p>
        </div>
      ) : myShifts.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>
            You're not scheduled this week.
          </p>
        </div>
      ) : (
        <>
          <p className="muted">
            {myShifts.length} shift{myShifts.length === 1 ? "" : "s"} · {totalHours} hrs
            this week
          </p>
          <div className="stack">
            {weekDates(weekStart).map((d) => {
              const dayShifts = myShifts.filter((s) => s.on_date === d);
              if (dayShifts.length === 0) return null;
              return (
                <div key={d} className="card" style={{ padding: 12 }}>
                  <strong>{formatDateLabel(d)}</strong>
                  <div className="stack" style={{ gap: 6, marginTop: 6 }}>
                    {dayShifts.map((s) => (
                      <div
                        key={s.id}
                        className="card spread"
                        style={{
                          padding: "8px 10px",
                          boxShadow: "none",
                          borderLeft: `3px solid ${s.is_close ? "var(--brand)" : "#378add"}`,
                        }}
                      >
                        <span>
                          {formatShiftRange(s.start_time, s.end_time)}
                          {s.is_close && <span className="badge" style={{ marginLeft: 6 }}>close</span>}
                          {s.position && <span className="muted"> · {s.position}</span>}
                        </span>
                        <span className="row" style={{ gap: 6 }}>
                          <button
                            style={{ padding: "3px 10px", fontSize: 13 }}
                            onClick={() => setDropShift(s)}
                          >
                            Drop
                          </button>
                          <button
                            style={{ padding: "3px 10px", fontSize: 13 }}
                            onClick={() => setSwapShift(s)}
                          >
                            Swap
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            Tip: "Drop" releases the shift to the pool for anyone to claim.
            "Swap" lets you trade with a specific coworker working that day.
          </p>
        </>
      )}

      {swapShift && (
        <SwapPickerModal
          myShift={swapShift}
          dayShifts={shifts.filter((s) => s.on_date === swapShift.on_date)}
          names={names}
          onConfirm={requestSwap}
          onCancel={() => setSwapShift(null)}
        />
      )}

      {dropShift && (
        <DropReasonModal
          shiftLabel={formatShiftRange(dropShift.start_time, dropShift.end_time)}
          onConfirm={confirmDrop}
          onCancel={() => setDropShift(null)}
        />
      )}
    </div>
  );
}
