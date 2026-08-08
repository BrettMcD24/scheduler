import { useState } from "react";

import type { Shift, User } from "../lib/types";
import { formatShiftRange } from "../lib/format";
import SkillBadge from "./SkillBadge";

interface Props {
  shifts: Shift[];
  empById: Map<number, User>;
  openHour: number; // e.g. 8
  closeHour: number; // e.g. 23 (covers the 10:45pm closer)
  onRemove: (shiftId: number) => void;
  disabled: boolean;
}

const ROW_HEIGHT = 38; // px per hour row
const HEADER_HEIGHT = 56;
const TIME_COL_WIDTH = 56;

function hourLabel(h: number): string {
  const ampm = h >= 12 ? "p" : "a";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}${ampm}`;
}

/** Fractional hour for a "HH:MM:SS" time string. */
function toHours(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m ?? 0) / 60;
}

export default function DayGrid({
  shifts,
  empById,
  openHour,
  closeHour,
  onRemove,
  disabled,
}: Props) {
  const assigned = shifts.filter((s) => s.employee_id != null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const hours = Array.from(
    { length: closeHour - openHour + 1 },
    (_, i) => openHour + i,
  );
  const gridHeight = (closeHour - openHour) * ROW_HEIGHT;

  if (assigned.length === 0) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <p className="muted" style={{ margin: 0 }}>
          No assigned shifts yet. Assign someone from the left to see them on the
          grid.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 12, overflowX: "auto" }}>
      <div style={{ display: "flex", minWidth: "fit-content" }}>
        {/* Time axis */}
        <div style={{ width: TIME_COL_WIDTH, flexShrink: 0 }}>
          <div style={{ height: HEADER_HEIGHT }} />
          <div style={{ position: "relative", height: gridHeight }}>
            {hours.map((h, i) => (
              <div
                key={h}
                style={{
                  position: "absolute",
                  top: i * ROW_HEIGHT - 8,
                  right: 8,
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                {hourLabel(h)}
              </div>
            ))}
          </div>
        </div>

        {/* Employee columns */}
        <div style={{ display: "flex", flex: 1, gap: 6 }}>
          {assigned.map((s) => {
            const emp = empById.get(s.employee_id!);
            const top = (toHours(s.start_time) - openHour) * ROW_HEIGHT;
            const height =
              (toHours(s.end_time) - toHours(s.start_time)) * ROW_HEIGHT;
            return (
              <div key={s.id} style={{ flex: "1 0 120px", minWidth: 120 }}>
                {/* Column header */}
                <div
                  style={{
                    height: HEADER_HEIGHT,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    textAlign: "center",
                    borderBottom: "1px solid var(--border)",
                    padding: "0 4px",
                  }}
                >
                  <span style={{ fontWeight: 500, fontSize: 13, lineHeight: 1.2 }}>
                    {emp ? `${emp.first_name} ${emp.last_name}` : "—"}
                  </span>
                  <div className="row" style={{ gap: 4, justifyContent: "center" }}>
                    {emp?.role === "manager" && <span className="mgr-badge">Mgr</span>}
                    <SkillBadge level={emp?.skill_level ?? null} />
                  </div>
                </div>

                {/* Column body with grid lines + the shift bar */}
                <div
                  style={{
                    position: "relative",
                    height: gridHeight,
                    background:
                      "repeating-linear-gradient(to bottom, transparent, transparent " +
                      (ROW_HEIGHT - 1) +
                      "px, var(--border) " +
                      (ROW_HEIGHT - 1) +
                      "px, var(--border) " +
                      ROW_HEIGHT +
                      "px)",
                    borderLeft: "1px solid var(--border)",
                  }}
                >
                  <div
                    onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
                    className={
                      s.was_swapped
                        ? "shift-bar-swapped"
                        : emp?.role === "manager"
                        ? "shift-bar-manager"
                        : s.is_close
                        ? "shift-bar-close"
                        : "shift-bar-open"
                    }
                    style={{
                      position: "absolute",
                      top,
                      height: Math.max(height, 34),
                      left: 3,
                      right: 3,
                      borderRadius: 6,
                      padding: "3px 6px",
                      fontSize: 11,
                      color: "var(--text)",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      outline: selectedId === s.id ? "2px solid var(--brand)" : "none",
                    }}
                  >
                    <div style={{ lineHeight: 1.3 }}>
                      <div style={{ fontWeight: 700 }}>
                        {emp ? `${emp.first_name} ${emp.last_name}` : "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {emp?.role === "manager" ? "Mgr · " : ""}
                        L{emp?.skill_level ?? "—"}
                        {s.was_swapped && " · swapped"}
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {formatShiftRange(s.start_time, s.end_time)}
                      </div>
                    </div>
                    {!disabled && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(s.id);
                        }}
                        style={{
                          alignSelf: "flex-end",
                          padding: "0 5px",
                          fontSize: 11,
                          lineHeight: 1.6,
                          background: "rgba(255,255,255,0.6)",
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
