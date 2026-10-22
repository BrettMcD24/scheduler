'use client'

import { useMemo, useState } from 'react'
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

/** "16:00:00" -> "4:00 PM" */
export function hhmm(t: string) {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

/** "16:00:00" -> "4PM" (compact, for tight grid cells) */
export function hhmmCompact(t: string) {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'p' : 'a'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, '0')}${period}`
}

/** "2026-08-09" -> "Sun Aug 9" */
export function dayWithDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** "2026-08-09" -> "Sun" */
export function dayName(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

/** "16:00:00" -> "4 PM" / "4:30 PM". Used by the day view and hover card. */
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

/* ---------------- employee-side ---------------- */

/** Published schedules for the employee's store + a name lookup.
 * Defaults to the current week if published, else the most recent. */
export function usePublishedSchedule() {
  const { data: schedules, isLoading: sLoading } = useSWR('emp-schedules', () =>
    api.listSchedules(),
  )
  const { data: people } = useSWR('emp-people', () => api.listEmployees())

  const [override, setOverride] = useState<string | null>(null)

  const published = useMemo(
    () => (schedules ?? []).filter((s) => s.status === 'published'),
    [schedules],
  )

  const defaultWeek = useMemo(() => {
    const thisWeek = mondayOf(new Date())
    const match = published.find((s) => s.week_start === thisWeek)
    return match?.week_start ?? published[0]?.week_start ?? thisWeek
  }, [published])

  const weekStart = override ?? defaultWeek
  const schedule = published.find((s) => s.week_start === weekStart) ?? null
  const { data: shifts, isLoading: shLoading } = useShifts(schedule?.id)

  const names = useMemo(
    () => new Map((people ?? []).map((p) => [p.id, p])),
    [people],
  )

  return {
    schedules: published,
    schedule,
    weekStart,
    setWeekStart: setOverride,
    shifts: shifts ?? [],
    names,
    loading: sLoading || shLoading,
  }
}

/** Keys that must be revalidated after any swap/drop resolves.
 * Missing the shifts key here is what made an approved swap look like it
 * never landed on the other person's My Shifts. */
export function employeeCacheKeys(scheduleId?: number | null) {
  const keys: (string | (string | number)[])[] = [
    'my-swaps',
    'my-timeoff',
    'emp-schedules',
    'emp-people',
  ]
  if (scheduleId) keys.push(['shifts', scheduleId])
  return keys
}

export function useMySwaps() {
  return useSWR('my-swaps', () => api.listSwaps())
}

export function useMyTimeOff() {
  return useSWR('my-timeoff', () => api.listTimeOff())
}
