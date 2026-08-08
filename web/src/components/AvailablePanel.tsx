import type { AvailableEmployee } from "../lib/types";
import { flagLabel } from "../lib/format";
import SkillBadge from "./SkillBadge";

interface Props {
  dateLabel: string;
  employees: AvailableEmployee[];
  onAssign: (employeeId: number, name: string) => void;
  disabled: boolean;
}

function hoursColor(emp: AvailableEmployee): string {
  if (emp.hours_this_week === 0) return "var(--text-muted)";
  if (emp.desired_hours_max && emp.hours_this_week >= emp.desired_hours_max)
    return "var(--danger)";
  return "var(--ok)";
}

export default function AvailablePanel({
  dateLabel,
  employees,
  onAssign,
  disabled,
}: Props) {
  return (
    <div className="card" style={{ padding: 12, alignSelf: "start" }}>
      <div className="spread" style={{ marginBottom: 10 }}>
        <strong>Available {dateLabel}</strong>
        <span className="muted">{employees.filter((e) => e.windows.length).length} available</span>
      </div>
      <div className="stack" style={{ gap: 6 }} data-cols="2">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
        {employees.map((emp) => {
          const isMinor = emp.flags.some((f) => f.startsWith("minor_age_"));
          const flags = emp.flags.filter(
            (f) => f !== "no_shifts_yet" && f !== "approved_time_off",
          );
          const canSchedule = emp.can_schedule;
          return (
            <div
              key={emp.employee_id}
              className={`card sched-card ${
                emp.on_time_off
                  ? "sched-timeoff"
                  : canSchedule
                  ? "sched-yes"
                  : "sched-no"
              }`}
              style={{
                padding: "8px 10px",
                boxShadow: "none",
              }}
            >
              {emp.on_time_off && (
                <div className="tag-warn badge" style={{ marginBottom: 4 }}>
                  Requested off
                </div>
              )}
              <div className="spread">
                <span style={{ fontWeight: 500 }}>{emp.name}</span>
                <div className="row" style={{ gap: 4 }}>
                  {emp.is_manager && <span className="mgr-badge">Mgr</span>}
                  {isMinor && <span className="tag-warn badge">Minor</span>}
                  <SkillBadge level={emp.skill_level} />
                </div>
              </div>
              <div className="muted" style={{ fontSize: 12, margin: "2px 0" }}>
                {emp.windows.length === 0
                  ? "No availability this day"
                  : emp.windows
                      .map((w) => `${w.start.slice(0, 5)}–${w.end.slice(0, 5)}`)
                      .join(", ")}
              </div>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: hoursColor(emp), fontWeight: 500 }}>
                  {emp.hours_this_week} hrs
                </span>
                <span className="muted">
                  {emp.desired_hours_min != null && emp.desired_hours_max != null
                    ? ` / ${emp.desired_hours_min}–${emp.desired_hours_max} wk`
                    : ""}
                </span>
              </div>
              {flags.length > 0 && (
                <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {flags.map((f) => (
                    <span
                      key={f}
                      className={
                        f.startsWith("minor_age_") || f === "approved_time_off"
                          ? "tag-warn badge"
                          : "badge"
                      }
                    >
                      {flagLabel(f)}
                    </span>
                  ))}
                </div>
              )}
              <button
                style={{ marginTop: 6, width: "100%", padding: "4px 8px", fontSize: 13 }}
                disabled={disabled}
                onClick={() => onAssign(emp.employee_id, emp.name)}
              >
                Assign →
              </button>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
