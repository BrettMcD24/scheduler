// Small formatting/date helpers used across the UI.

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Returns the Monday on or before the given date, as an ISO yyyy-mm-dd string. */
export function mondayOf(d: Date): string {
  const copy = new Date(d);
  const dow = (copy.getDay() + 6) % 7; // 0 = Monday
  copy.setDate(copy.getDate() - dow);
  return toISODate(copy);
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The seven ISO date strings of the week starting at weekStart (a Monday). */
export function weekDates(weekStart: string): string[] {
  const start = new Date(weekStart + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return toISODate(d);
  });
}

/** "08:00:00" -> "8:00 AM" */
export function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return m === "00" ? `${h} ${ampm}` : `${h}:${m} ${ampm}`;
}

/** "2026-06-15" -> "Mon 6/15" */
export function formatDateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const dow = (d.getDay() + 6) % 7;
  return `${DAY_SHORT[dow]} ${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatShiftRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** Friendly label for an availability/validation flag code. */
export function flagLabel(flag: string): string {
  if (flag.startsWith("minor_age_")) return `Minor (age ${flag.slice(10)})`;
  const map: Record<string, string> = {
    approved_time_off: "Approved time off",
    already_scheduled_today: "Already scheduled today",
    at_or_over_desired_max: "At/over desired max",
    no_shifts_yet: "No shifts yet",
  };
  return map[flag] ?? flag;
}
