'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSWRConfig } from 'swr'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  TrendingUp,
  Users,
  Utensils,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import {
  addWeeks,
  mondayOf,
  scheduleForWeek,
  shortDate,
  dayWithDate,
  useEmployees,
  useSchedules,
  useShifts,
  useValidation,
  weekDates,
  weekLabel,
} from '@/lib/hooks'
import { ALL_LEVELS, levelStyle } from '@/lib/levels'
import { cn } from '@/lib/utils'
import { Card, EmptyState, Loading, SectionHeader, StatCard } from './primitives'
import { ScheduleGrid } from './schedule-grid'

export function DashboardView({
  storeId,
  weekStart,
  onWeekChange,
  query,
  newShiftNonce,
}: {
  storeId: number
  weekStart: string
  onWeekChange: (w: string) => void
  query: string
  newShiftNonce: number
}) {
  const { mutate } = useSWRConfig()
  const { data: employees } = useEmployees(storeId)
  const { data: schedules, isLoading: schedLoading } = useSchedules(storeId)
  const schedule = scheduleForWeek(schedules, weekStart)
  const { data: shifts } = useShifts(schedule?.id)
  const { data: validation } = useValidation(schedule?.id)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [focusDate, setFocusDate] = useState<string | null>(null)

  useEffect(() => {
    if (newShiftNonce > 0) {
      setNotice('Pick a "+" cell on the roster to add a shift.')
      const t = setTimeout(() => setNotice(''), 4000)
      return () => clearTimeout(t)
    }
  }, [newShiftNonce])

  const roster = useMemo(() => {
    const list = (employees ?? []).filter(
      (e) => e.is_active && (e.role === 'employee' || e.role === 'manager'),
    )
    const q = query.trim().toLowerCase()
    const filtered = q
      ? list.filter((e) =>
          `${e.first_name} ${e.last_name}`.toLowerCase().includes(q),
        )
      : list
    return filtered.sort((a, b) => (b.skill_level ?? 0) - (a.skill_level ?? 0))
  }, [employees, query])

  const weekLabor = validation?.staffing.reduce((s, d) => s + d.daily_labor, 0) ?? 0
  const assigned = shifts?.filter((s) => s.employee_id != null).length ?? 0
  const totalShifts = shifts?.length ?? 0
  const daysMeetingMins =
    validation?.staffing.filter((d) => d.openers_met && d.closers_met).length ?? 0
  const issues = [
    ...(validation?.violations ?? []),
    ...(validation?.warnings ?? []),
  ].filter((i) => i.code !== 'NO_SHIFTS')

  async function refresh() {
    if (!schedule) return
    await Promise.all([
      mutate(['shifts', schedule.id]),
      mutate(['validate', schedule.id]),
    ])
  }

  async function createSchedule() {
    setBusy(true)
    try {
      await api.createSchedule(storeId, weekStart)
      await mutate(['schedules', storeId])
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    if (!schedule) return
    setBusy(true)
    try {
      await api.publishSchedule(schedule.id)
      await mutate(['schedules', storeId])
      setNotice('Schedule published — employees can now see it.')
      setTimeout(() => setNotice(''), 5000)
    } finally {
      setBusy(false)
    }
  }

  if (schedLoading) return <Loading />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`Week of ${weekLabel(weekStart)}`}
        title="Weekly Command Center"
        description="Build the roster, balance coverage, and stay ahead of gaps before the week starts."
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Previous week"
                onClick={() => onWeekChange(addWeeks(weekStart, -1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <button
                type="button"
                onClick={() => onWeekChange(mondayOf(new Date()))}
                className="px-2 text-sm font-medium text-foreground"
              >
                This Week
              </button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Next week"
                onClick={() => onWeekChange(addWeeks(weekStart, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            {schedule && schedule.status === 'draft' && (
              <Button size="lg" disabled={busy} onClick={publish}>
                Publish Schedule
              </Button>
            )}
            {schedule?.status === 'published' && (
              <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                Published
              </span>
            )}
          </div>
        }
      />

      {notice && (
        <div className="rounded-xl border border-primary/35 bg-primary/10 px-4 py-2.5 text-sm text-primary">
          {notice}
        </div>
      )}

      {!schedule ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            No schedule exists for the week of {weekLabel(weekStart)}.
          </p>
          <Button size="lg" disabled={busy} onClick={createSchedule}>
            Create schedule
          </Button>
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Scheduled Hours"
              value={`${weekLabor.toFixed(1)}h`}
              hint="Total labor this week"
              icon={Clock}
              tone="gold"
            />
            <StatCard
              label="Shifts Filled"
              value={`${assigned} / ${totalShifts}`}
              hint={`${totalShifts - assigned} unassigned`}
              icon={Users}
            />
            <StatCard
              label="Days Meeting Minimums"
              value={`${daysMeetingMins} / 7`}
              hint="3 openers · 4 closers"
              icon={TrendingUp}
              tone={daysMeetingMins === 7 ? 'gold' : 'danger'}
            />
            <StatCard
              label="Flags"
              value={issues.length}
              hint={`${validation?.violations.length ?? 0} violations`}
              icon={AlertTriangle}
              tone={issues.length ? 'danger' : 'default'}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold">
                  {focusDate ? dayWithDate(focusDate) : 'Weekly Roster'}
                </h2>
                <div className="flex items-center gap-3">
                  <LevelLegend />
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
                    <button
                      type="button"
                      onClick={() => setFocusDate(null)}
                      className={cn(
                        'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                        !focusDate
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Week
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFocusDate(focusDate ?? weekDates(weekStart)[0])
                      }
                      className={cn(
                        'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                        focusDate
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Day
                    </button>
                  </div>
                </div>
              </div>

              {focusDate && (
                <div className="flex flex-wrap gap-1.5">
                  {weekDates(weekStart).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setFocusDate(d)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                        d === focusDate
                          ? 'border-primary/40 bg-primary/12 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {dayWithDate(d)}
                    </button>
                  ))}
                </div>
              )}
              {roster.length === 0 ? (
                <EmptyState message="No employees match." />
              ) : (
                <ScheduleGrid
                  employees={roster}
                  shifts={shifts ?? []}
                  weekStart={weekStart}
                  scheduleId={schedule.id}
                  focusDate={focusDate}
                  locked={schedule.status === 'published'}
                  onCreate={async (employeeId, onDate, code, override) => {
                    await api.addShift(schedule.id, {
                      employee_id: employeeId,
                      on_date: onDate,
                      code,
                      override_availability: override,
                    })
                    await refresh()
                  }}
                  onDelete={async (shiftId) => {
                    await api.deleteShift(shiftId)
                    await refresh()
                  }}
                />
              )}
            </div>

            <div className="space-y-4">
              <DailyCoverage staffing={validation?.staffing ?? []} />
              <NeedsAttention issues={issues} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function LevelLegend() {
  return (
    <div className="hidden items-center gap-3 sm:flex">
      {ALL_LEVELS.map((l) => {
        const ls = levelStyle(l)
        return (
          <span
            key={l}
            className="flex items-center gap-1 text-[0.7rem] text-muted-foreground"
          >
            <span className={cn('size-2 rounded-full', ls.dot)} />
            {ls.label}
          </span>
        )
      })}
    </div>
  )
}

function DailyCoverage({
  staffing,
}: {
  staffing: {
    on_date: string
    openers: number
    closers: number
    min_openers: number
    min_closers: number
    openers_met: boolean
    closers_met: boolean
    lunch: number
    dinner: number
    daily_labor: number
  }[]
}) {
  if (staffing.length === 0) return null
  return (
    <Card>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Utensils className="size-4 text-primary" />
        Daily Coverage
      </h3>
      <div className="space-y-2.5">
        {staffing.map((d) => {
          const ok = d.openers_met && d.closers_met
          const pct = Math.round(
            ((Math.min(d.openers, d.min_openers) +
              Math.min(d.closers, d.min_closers)) /
              (d.min_openers + d.min_closers)) *
              100,
          )
          return (
            <div key={d.on_date} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {shortDate(d.on_date)}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {d.daily_labor}h · L{d.lunch} · D{d.dinner}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      ok ? 'bg-primary' : 'bg-destructive',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'w-16 text-right text-[0.7rem] tabular-nums',
                    ok ? 'text-muted-foreground' : 'text-destructive',
                  )}
                >
                  {d.openers}/{d.min_openers}o {d.closers}/{d.min_closers}c
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function NeedsAttention({
  issues,
}: {
  issues: { severity: string; code: string; message: string }[]
}) {
  return (
    <Card>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="size-4 text-destructive" />
        Needs Attention
      </h3>
      {issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No issues — coverage and compliance look good.
        </p>
      ) : (
        <div className="space-y-2">
          {issues.slice(0, 12).map((i, idx) => (
            <div
              key={idx}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs',
                i.severity === 'violation'
                  ? 'border-destructive/35 bg-destructive/10 text-destructive'
                  : 'border-primary/30 bg-primary/8 text-primary',
              )}
            >
              {i.message}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
