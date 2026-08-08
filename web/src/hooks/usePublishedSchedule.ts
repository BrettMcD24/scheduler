import { useEffect, useState } from "react";

import { api } from "../lib/api";
import { mondayOf } from "../lib/format";
import type { Schedule, Shift, User } from "../lib/types";

/** Loads published schedules for the employee's store, plus a name lookup.
 * Defaults the selected week to the current week if a schedule exists for it,
 * otherwise the most recent published week. */
export function usePublishedSchedule() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [weekStart, setWeekStart] = useState<string>(() => mondayOf(new Date()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [names, setNames] = useState<Map<number, User>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [scheds, people] = await Promise.all([
        api.listSchedules(),
        api.listEmployees(),
      ]);
      if (cancelled) return;
      setSchedules(scheds);
      setNames(new Map(people.map((p) => [p.id, p])));
      // pick current week if present, else most recent
      const thisWeek = mondayOf(new Date());
      const match = scheds.find((s) => s.week_start === thisWeek);
      const chosen = match ?? scheds[0];
      if (chosen) setWeekStart(chosen.week_start);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sched = schedules.find((s) => s.week_start === weekStart);
    if (!sched) {
      setShifts([]);
      return;
    }
    api.listShifts(sched.id).then(setShifts);
  }, [schedules, weekStart]);

  return { schedules, weekStart, setWeekStart, shifts, names, loading };
}
