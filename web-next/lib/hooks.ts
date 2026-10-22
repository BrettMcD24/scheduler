'use client'

import useSWR from 'swr'
import { api } from './api'
import type { Employee, Schedule } from './types'

/* ---------------- date helpers ---------------- */

export function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday on or before the given date, as yyyy-mm-dd. */
export function mondayOf(d: Date) {
  const c = new Date(d)
  const dow = (c.getDay() + 6) % 7
  c.setDate(c.getDate() - dow)
  return toISODate(c)
}

export function addWeeks(weekStart: string, delta: number) {
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + delta * 7)
  return toISODate(d)
}

export function weekDates(weekStart: string) {
  const start = new Date(weekStart + 'T00:00:00')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return toISODate(d)
  })
}

/** "2026-08-10" -> "Aug 10" */
export function shortDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "08:00:00" -> "08:00" */
export function hhmm(t: string) {
  return t.slice(0, 5)
}

/** "08:00:00" -> "8:00 AM", "16:30:00" -> "4:30 PM" */
export function formatTime(t: string) {
  const [hStr, mStr] = t.split(':')
  let h = parseInt(hStr, 10)
  const m = mStr ?? '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return m === '00' ? `${h} ${ampm}` : `${h}:${m} ${ampm}`
}

export function weekLabel(weekStart: string) {
  const dates = weekDates(weekStart)
  return `${shortDate(dates[0])} – ${shortDate(dates[6])}`
}

/** Managers/admins always first, then by skill level desc, then last name.
 * Shared by the week grid and day view so "managers on top" is one rule. */
export function sortRoster(employees: Employee[]) {
  const roleRank = (r: Employee['role']) => (r === 'employee' ? 1 : 0)
  return [...employees].sort((a, b) => {
    const roleDiff = roleRank(a.role) - roleRank(b.role)
    if (roleDiff !== 0) return roleDiff
    const lvlDiff = (b.skill_level ?? 0) - (a.skill_level ?? 0)
    if (lvlDiff !== 0) return lvlDiff
    return a.last_name.localeCompare(b.last_name)
  })
}

/* ---------------- data hooks ---------------- */

export function useMe() {
  return useSWR<Employee>('me', () => api.me(), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })
}

export function useEmployees(storeId?: number | null) {
  return useSWR(
    storeId ? ['employees', storeId] : null,
    () => api.listEmployees(storeId!),
  )
}

export function useSchedules(storeId?: number | null) {
  return useSWR(
    storeId ? ['schedules', storeId] : null,
    () => api.listSchedules(storeId!),
  )
}

/** Resolves the Schedule object for a given week, if one exists. */
export function scheduleForWeek(
  schedules: Schedule[] | undefined,
  weekStart: string,
) {
  return schedules?.find((s) => s.week_start === weekStart) ?? null
}

export function useShifts(scheduleId?: number | null) {
  return useSWR(
    scheduleId ? ['shifts', scheduleId] : null,
    () => api.listShifts(scheduleId!),
  )
}

export function useValidation(scheduleId?: number | null) {
  return useSWR(
    scheduleId ? ['validate', scheduleId] : null,
    () => api.validateSchedule(scheduleId!),
  )
}

export function useAvailable(scheduleId?: number | null, onDate?: string) {
  return useSWR(
    scheduleId && onDate ? ['available', scheduleId, onDate] : null,
    () => api.availableOnDay(scheduleId!, onDate!),
  )
}

export function useSwaps(status?: string) {
  return useSWR(['swaps', status ?? 'all'], () => api.listSwaps(status))
}

export function useTimeOff(status?: string) {
  return useSWR(['timeoff', status ?? 'all'], () => api.listTimeOff(status))
}

export function useCallOffs() {
  return useSWR('calloffs', () => api.listCallOffs())
}
