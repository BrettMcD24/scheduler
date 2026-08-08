import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { DAY_NAMES } from "../../lib/format";

interface Row {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export default function Availability() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [hmin, setHmin] = useState<number>(user?.desired_hours_min ?? 0);
  const [hmax, setHmax] = useState<number>(user?.desired_hours_max ?? 40);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const windows = await api.getWindows(user.id);
    setRows(
      windows.map((w) => ({
        day_of_week: w.day_of_week,
        start_time: w.start_time.slice(0, 5),
        end_time: w.end_time.slice(0, 5),
      })),
    );
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  function addRow(day: number) {
    setRows((r) => [...r, { day_of_week: day, start_time: "08:00", end_time: "16:00" }]);
  }
  function removeRow(idx: number) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }
  function updateRow(idx: number, field: keyof Row, value: string) {
    setRows((r) =>
      r.map((row, i) =>
        i === idx ? { ...row, [field]: field === "day_of_week" ? Number(value) : value } : row,
      ),
    );
  }

  async function save() {
    if (!user) return;
    for (const r of rows) {
      if (r.start_time >= r.end_time) {
        setMsg(`Fix ${DAY_NAMES[r.day_of_week]}: start must be before end.`);
        return;
      }
    }
    setBusy(true);
    setMsg("");
    try {
      await api.setWindows(
        user.id,
        rows.map((r) => ({
          day_of_week: r.day_of_week,
          start_time: r.start_time + ":00",
          end_time: r.end_time + ":00",
        })),
      );
      await api.setDesiredHours(hmin, hmax);
      setMsg("Saved. Your manager will see this when building future schedules.");
      await load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Availability</h2>
      {msg && (
        <div className="tag-ok" style={{ padding: "8px 12px", borderRadius: 6, margin: "8px 0" }}>
          {msg}
        </div>
      )}

      <div className="card" style={{ padding: 16, marginTop: 8 }}>
        <strong>Desired weekly hours</strong>
        <div className="row" style={{ gap: 8, marginTop: 8, alignItems: "flex-end" }}>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>Min</span>
            <input type="number" min={0} value={hmin} onChange={(e) => setHmin(Number(e.target.value))} style={{ width: 90 }} />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>Max</span>
            <input type="number" min={0} value={hmax} onChange={(e) => setHmax(Number(e.target.value))} style={{ width: 90 }} />
          </label>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <strong>Weekly availability</strong>
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Add the time windows you can work each day. Leave a day out if you're never available.
        </p>
        <div className="stack" style={{ gap: 6, marginTop: 8 }}>
          {rows
            .map((r, i) => ({ r, i }))
            .sort((a, b) => a.r.day_of_week - b.r.day_of_week)
            .map(({ r, i }) => (
              <div key={i} className="row" style={{ gap: 8 }}>
                <select
                  value={r.day_of_week}
                  onChange={(e) => updateRow(i, "day_of_week", e.target.value)}
                  style={{ width: 130 }}
                >
                  {DAY_NAMES.map((d, idx) => (
                    <option key={idx} value={idx}>{d}</option>
                  ))}
                </select>
                <input type="time" value={r.start_time} onChange={(e) => updateRow(i, "start_time", e.target.value)} style={{ width: "auto" }} />
                <span className="muted">to</span>
                <input type="time" value={r.end_time} onChange={(e) => updateRow(i, "end_time", e.target.value)} style={{ width: "auto" }} />
                <button style={{ padding: "4px 10px", fontSize: 13 }} onClick={() => removeRow(i)}>✕</button>
              </div>
            ))}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 12 }}>Add day:</span>
          {DAY_NAMES.map((d, idx) => (
            <button key={idx} style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => addRow(idx)}>
              + {d.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <button className="primary" style={{ marginTop: 16 }} onClick={save} disabled={busy}>
        Save availability
      </button>
    </div>
  );
}
