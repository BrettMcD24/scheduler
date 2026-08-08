import { useState } from "react";

import { useAuth } from "../../lib/auth";
import { formatDateLabel, formatShiftRange, weekDates } from "../../lib/format";
import { usePublishedSchedule } from "../../hooks/usePublishedSchedule";
import SkillBadge from "../../components/SkillBadge";

export default function StoreSchedule() {
  const { user } = useAuth();
  const { schedules, weekStart, setWeekStart, shifts, names, loading } =
    usePublishedSchedule();
  const dates = weekDates(weekStart);
  const [activeDate, setActiveDate] = useState(dates[0]);

  if (loading) return <p>Loading…</p>;

  const dayShifts = shifts
    .filter((s) => s.on_date === activeDate && s.employee_id != null)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div>
      <div className="spread" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Store Schedule</h2>
        {schedules.length > 0 && (
          <select
            value={weekStart}
            onChange={(e) => {
              setWeekStart(e.target.value);
              setActiveDate(weekDates(e.target.value)[0]);
            }}
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

      {schedules.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>No published schedules yet.</p>
        </div>
      ) : (
        <>
          <div className="row" style={{ gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
            {dates.map((d) => (
              <button
                key={d}
                onClick={() => setActiveDate(d)}
                className={d === activeDate ? "primary" : ""}
              >
                {formatDateLabel(d)}
              </button>
            ))}
          </div>

          {dayShifts.length === 0 ? (
            <div className="card" style={{ padding: 24 }}>
              <p className="muted" style={{ margin: 0 }}>No one scheduled this day.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 12 }}>
              <strong>{formatDateLabel(activeDate)} — who's working</strong>
              <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                {dayShifts.map((s) => {
                  const person = s.employee_id ? names.get(s.employee_id) : null;
                  const isMe = s.employee_id === user?.id;
                  return (
                    <div
                      key={s.id}
                      className="card spread"
                      style={{
                        padding: "8px 10px",
                        boxShadow: "none",
                        background: isMe ? "var(--bg)" : "var(--surface)",
                        borderLeft: `3px solid ${s.is_close ? "var(--brand)" : "#378add"}`,
                      }}
                    >
                      <span className="row" style={{ gap: 8 }}>
                        <strong>
                          {person ? `${person.first_name} ${person.last_name}` : "—"}
                        </strong>
                        {isMe && <span className="badge tag-ok">You</span>}
                        {person?.role === "manager" && <span className="mgr-badge">Mgr</span>}
                        <SkillBadge level={person?.skill_level ?? null} />
                      </span>
                      <span>
                        {formatShiftRange(s.start_time, s.end_time)}
                        {s.is_close && <span className="badge" style={{ marginLeft: 6 }}>close</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
