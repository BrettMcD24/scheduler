import { useCallback, useEffect, useState } from "react";

import AssignModal from "../components/AssignModal";
import AvailablePanel from "../components/AvailablePanel";
import DayGrid from "../components/DayGrid";
import SkillBadge from "../components/SkillBadge";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  formatDateLabel,
  formatShiftRange,
  mondayOf,
  weekDates,
} from "../lib/format";
import type {
  AvailableEmployee,
  Schedule,
  Shift,
  Store,
  User,
  ValidationResult,
} from "../lib/types";

export default function Builder() {
  const { user } = useAuth();
  const storeId = user?.store_id ?? undefined;

  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [activeDate, setActiveDate] = useState<string>("");
  const [available, setAvailable] = useState<AvailableEmployee[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [publishedMsg, setPublishedMsg] = useState("");
  const [showUnscheduled, setShowUnscheduled] = useState(false);

  // assign-by-code modal state
  const [assignTarget, setAssignTarget] = useState<{ id: number; name: string } | null>(null);
  const [modalError, setModalError] = useState("");

  const dates = weekDates(weekStart);
  const empById = new Map(employees.map((e) => [e.id, e]));

  useEffect(() => {
    if (storeId == null) return;
    api.listEmployees(storeId).then((all) =>
      setEmployees(
        all.filter((e) => e.role === "employee" || e.role === "manager"),
      ),
    );
    api.getStore(storeId).then(setStore).catch(() => {});
  }, [storeId]);

  const loadSchedule = useCallback(async () => {
    if (storeId == null) return;
    setError("");
    const all = await api.listSchedules(storeId);
    const found = all.find((s) => s.week_start === weekStart) ?? null;
    setSchedule(found);
    if (found) {
      const sh = await api.listShifts(found.id);
      setShifts(sh);
    } else {
      setShifts([]);
      setValidation(null);
    }
  }, [storeId, weekStart]);

  useEffect(() => {
    loadSchedule();
    setActiveDate(weekDates(weekStart)[0]);
  }, [loadSchedule, weekStart]);

  const refreshDerived = useCallback(async () => {
    if (!schedule) return;
    const [avail, val] = await Promise.all([
      api.availableOnDay(schedule.id, activeDate),
      api.validateSchedule(schedule.id),
    ]);
    setAvailable(avail.employees);
    setValidation(val);
  }, [schedule, activeDate]);

  useEffect(() => {
    refreshDerived();
  }, [refreshDerived]);

  async function createSchedule() {
    if (storeId == null) return;
    setBusy(true);
    try {
      const s = await api.createSchedule(storeId, weekStart);
      setSchedule(s);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create schedule");
    } finally {
      setBusy(false);
    }
  }

  async function reloadShifts() {
    if (!schedule) return;
    const sh = await api.listShifts(schedule.id);
    setShifts(sh);
    await refreshDerived();
  }

  // New flow: clicking Assign opens the modal; confirming creates an
  // assigned shift in one call (employee_id + code together).
  async function confirmAssign(code: string) {
    if (!schedule || !assignTarget) return;
    setBusy(true);
    setModalError("");
    try {
      await api.addShift(schedule.id, {
        on_date: activeDate,
        employee_id: assignTarget.id,
        code,
      });
      setAssignTarget(null);
      await reloadShifts();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : "Failed to assign");
    } finally {
      setBusy(false);
    }
  }

  async function removeShift(shiftId: number) {
    setBusy(true);
    try {
      await api.deleteShift(shiftId);
      await reloadShifts();
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!schedule) return;
    setBusy(true);
    try {
      const s = await api.publishSchedule(schedule.id);
      setSchedule(s);
      setPublishedMsg(
        `Schedule for week of ${weekStart} published — it's now live for employees.`,
      );
      setTimeout(() => setPublishedMsg(""), 6000);
    } finally {
      setBusy(false);
    }
  }

  const dayShifts = shifts
    .filter((s) => s.on_date === activeDate)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const todayStaffing = validation?.staffing.find((d) => d.on_date === activeDate);
  const dayIssues = [
    ...(validation?.violations ?? []),
    ...(validation?.warnings ?? []),
  ].filter(
    (i) =>
      i.code !== "NO_SHIFTS" &&
      (i.on_date === activeDate || i.on_date === null),
  );

  const locked = !schedule || schedule.status === "published";

  // Employees/managers with no shifts the whole week (from NO_SHIFTS warnings).
  const unscheduled = (validation?.warnings ?? []).filter(
    (w) => w.code === "NO_SHIFTS",
  );

  // grid hour bounds from store (fallback 8am-10:45pm -> 8..23)
  const openHour = store ? parseInt(store.open_time.split(":")[0], 10) : 8;
  const closeHour = store
    ? Math.ceil(
        parseInt(store.closer_end_time.split(":")[0], 10) +
          parseInt(store.closer_end_time.split(":")[1], 10) / 60,
      )
    : 23;

  if (storeId == null) {
    return <p>Your account isn't linked to a store. Ask an admin to set this up.</p>;
  }

  return (
    <div>
      <div className="spread" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>Schedule Builder</h2>
          <span className="muted">
            Week of {weekStart}
            {schedule && (
              <span
                className={schedule.status === "published" ? "tag-ok badge" : "badge"}
                style={{ marginLeft: 8 }}
              >
                {schedule.status}
              </span>
            )}
          </span>
        </div>
        <div className="row">
          <label className="muted">Week start (Mon):</label>
          <input
            type="date"
            value={weekStart}
            style={{ width: "auto" }}
            onChange={(e) => setWeekStart(mondayOf(new Date(e.target.value + "T00:00:00")))}
          />
          {schedule && (
            <button className="primary" onClick={publish} disabled={busy}>
              Publish
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="tag-danger" style={{ padding: "8px 12px", borderRadius: 6, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {publishedMsg && (
        <div
          className="tag-ok"
          style={{ padding: "10px 14px", borderRadius: 6, marginBottom: 12, fontWeight: 500 }}
        >
          ✓ {publishedMsg}
        </div>
      )}

      {!schedule ? (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p>No schedule exists for this week yet.</p>
          <button className="primary" onClick={createSchedule} disabled={busy}>
            Create schedule for {weekStart}
          </button>
        </div>
      ) : (
        <>
          {/* Day tabs */}
          <div className="spread" style={{ marginBottom: 12 }}>
            <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
              {dates.map((d) => {
                const staffing = validation?.staffing.find((s) => s.on_date === d);
                const short = staffing && (!staffing.openers_met || !staffing.closers_met);
                return (
                  <button
                    key={d}
                    onClick={() => setActiveDate(d)}
                    className={d === activeDate ? "primary" : ""}
                    style={{ position: "relative" }}
                  >
                    {formatDateLabel(d)}
                    {short && (
                      <span
                        title="Staffing below minimum"
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 4,
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--warn)",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {/* View toggle */}
            <div className="row" style={{ gap: 0 }}>
              <button
                onClick={() => setView("grid")}
                className={view === "grid" ? "primary" : ""}
                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
              >
                Grid
              </button>
              <button
                onClick={() => setView("list")}
                className={view === "list" ? "primary" : ""}
                style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: -1 }}
              >
                List
              </button>
            </div>
          </div>

          {/* Not-scheduled-this-week collapsible */}
          {unscheduled.length > 0 && (
            <div className="card" style={{ padding: "8px 12px", marginBottom: 12 }}>
              <button
                onClick={() => setShowUnscheduled((v) => !v)}
                style={{ border: "none", background: "none", padding: 0, width: "100%" }}
              >
                <div className="spread">
                  <span className="tag-warn badge">
                    {unscheduled.length} not scheduled this week
                  </span>
                  <span className="muted">{showUnscheduled ? "▲ hide" : "▼ show"}</span>
                </div>
              </button>
              {showUnscheduled && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {unscheduled.map((u, idx) => (
                    <span key={idx} className="badge">
                      {u.message.replace(" has no shifts this week", "")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 420px) 1fr 280px", gap: 16 }}>
            {/* Available panel */}
            <AvailablePanel
              dateLabel={formatDateLabel(activeDate)}
              employees={available}
              onAssign={(id, name) => {
                setModalError("");
                setAssignTarget({ id, name });
              }}
              disabled={busy || locked}
            />

            {/* Main view: grid or list */}
            <div>
              {view === "grid" ? (
                <DayGrid
                  shifts={dayShifts}
                  empById={empById}
                  openHour={openHour}
                  closeHour={closeHour}
                  onRemove={removeShift}
                  disabled={busy || locked}
                />
              ) : (
                <div className="card" style={{ padding: 12 }}>
                  <strong>{formatDateLabel(activeDate)} shifts</strong>
                  <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                    {dayShifts.length === 0 && (
                      <p className="muted" style={{ margin: 0 }}>No shifts yet for this day.</p>
                    )}
                    {dayShifts.map((s) => {
                      const emp = s.employee_id ? empById.get(s.employee_id) : null;
                      return (
                        <div
                          key={s.id}
                          className="card"
                          style={{
                            padding: "8px 10px",
                            boxShadow: "none",
                            borderLeft: `3px solid ${s.is_close ? "var(--brand)" : "#378add"}`,
                          }}
                        >
                          <div className="spread">
                            <span style={{ fontWeight: 500 }}>
                              {formatShiftRange(s.start_time, s.end_time)}
                              {s.is_close && (
                                <span className="badge" style={{ marginLeft: 6 }}>close</span>
                              )}
                            </span>
                            <button
                              style={{ padding: "2px 8px", fontSize: 12 }}
                              onClick={() => removeShift(s.id)}
                              disabled={busy || locked}
                            >
                              ✕
                            </button>
                          </div>
                          <div className="row" style={{ marginTop: 4, gap: 8 }}>
                            {emp ? (
                              <>
                                <span>{emp.first_name} {emp.last_name}</span>
                                {emp.role === "manager" && (
                                  <span className="mgr-badge">Mgr</span>
                                )}
                                <SkillBadge level={emp.skill_level} />
                              </>
                            ) : (
                              <span className="muted">Unassigned</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Staffing + flags */}
            <div className="stack">
              <div className="card" style={{ padding: 12 }}>
                <strong>Staffing — {formatDateLabel(activeDate)}</strong>
                {todayStaffing ? (
                  <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                    <StaffingRow
                      label="Openers"
                      count={todayStaffing.openers}
                      min={todayStaffing.min_openers}
                      met={todayStaffing.openers_met}
                    />
                    <StaffingRow
                      label="Closers"
                      count={todayStaffing.closers}
                      min={todayStaffing.min_closers}
                      met={todayStaffing.closers_met}
                    />
                    <div className="spread">
                      <span>Lunch (11–4)</span>
                      <span className="badge">{todayStaffing.lunch} working</span>
                    </div>
                    <div className="spread">
                      <span>Dinner (4–close)</span>
                      <span className="badge">{todayStaffing.dinner} working</span>
                    </div>
                    <div
                      className="spread"
                      style={{ borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 2 }}
                    >
                      <strong>Labor today</strong>
                      <strong>{todayStaffing.daily_labor} hrs</strong>
                    </div>
                  </div>
                ) : (
                  <p className="muted" style={{ marginTop: 8 }}>No data.</p>
                )}
              </div>

              {/* Running weekly labor */}
              {validation && (
                <div className="card" style={{ padding: 12 }}>
                  <strong>Week labor</strong>
                  <div className="stack" style={{ gap: 3, marginTop: 8 }}>
                    {validation.staffing.map((d) => (
                      <div
                        key={d.on_date}
                        className="spread"
                        style={{
                          fontSize: 13,
                          fontWeight: d.on_date === activeDate ? 600 : 400,
                        }}
                      >
                        <span>{formatDateLabel(d.on_date)}</span>
                        <span>{d.daily_labor} h</span>
                      </div>
                    ))}
                    <div
                      className="spread"
                      style={{ borderTop: "1px solid var(--border)", paddingTop: 5, marginTop: 3 }}
                    >
                      <strong>Week total</strong>
                      <strong>
                        {validation.staffing
                          .reduce((sum, d) => sum + d.daily_labor, 0)
                          .toFixed(2)}{" "}
                        h
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Swap notes — shifts changed by an approved swap */}
              {shifts.some((s) => s.was_swapped) && (
                <div className="card" style={{ padding: 12 }}>
                  <strong>Swap notes</strong>
                  <div className="stack" style={{ gap: 4, marginTop: 8 }}>
                    {shifts
                      .filter((s) => s.was_swapped)
                      .sort((a, b) => (a.on_date + a.start_time).localeCompare(b.on_date + b.start_time))
                      .map((s) => {
                        const emp = s.employee_id ? empById.get(s.employee_id) : null;
                        return (
                          <div key={s.id} style={{ fontSize: 12 }}>
                            <span className="badge tag-warn" style={{ marginRight: 6 }}>swapped</span>
                            {formatDateLabel(s.on_date)} {formatShiftRange(s.start_time, s.end_time)}
                            {emp && <span className="muted"> → {emp.first_name} {emp.last_name}</span>}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="card" style={{ padding: 12 }}>
                <strong>Flags</strong>
                {dayIssues.length === 0 ? (
                  <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
                    No issues on this day.
                  </p>
                ) : (
                  <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                    {dayIssues.map((i, idx) => (
                      <div
                        key={idx}
                        className={i.severity === "violation" ? "tag-danger" : "tag-warn"}
                        style={{ padding: "6px 8px", borderRadius: 6, fontSize: 12 }}
                      >
                        {i.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {assignTarget && (
        <AssignModal
          employeeName={assignTarget.name}
          dateLabel={formatDateLabel(activeDate)}
          onConfirm={confirmAssign}
          onCancel={() => setAssignTarget(null)}
          error={modalError}
        />
      )}
    </div>
  );
}

function StaffingRow({
  label,
  count,
  min,
  met,
}: {
  label: string;
  count: number;
  min: number;
  met: boolean;
}) {
  return (
    <div className="spread">
      <span>{label}</span>
      <span className={met ? "tag-ok badge" : "tag-warn badge"}>
        {count} / {min} {met ? "✓" : "needed"}
      </span>
    </div>
  );
}
