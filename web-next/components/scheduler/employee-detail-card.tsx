'use client'

import useSWR from 'swr'
import { CalendarOff, Check, Minus } from 'lucide-react'
import { api } from '@/lib/api'
import { dayWithDate, hhmm } from '@/lib/hooks'
import { levelStyle } from '@/lib/levels'
import { cn } from '@/lib/utils'
import { LevelChip } from './primitives'

/** Detail card shown when a manager hovers/clicks an employee while building.
 * Day-by-day availability, desired vs scheduled hours, mastered positions. */
export function EmployeeDetailCard({
  scheduleId,
  employeeId,
}: {
  scheduleId: number
  employeeId: number
}) {
  const { data, isLoading } = useSWR(
    ['emp-detail', scheduleId, employeeId],
    () => api.employeeDetail(scheduleId, employeeId),
    { revalidateOnFocus: false },
  )

  if (isLoading || !data) {
    return (
      <div className="w-72 rounded-xl border border-border bg-popover p-3 text-xs text-muted-foreground shadow-xl">
        Loading…
      </div>
    )
  }

  const ls = levelStyle(data.skill_level)
  const min = data.desired_hours_min
  const max = data.desired_hours_max
  const overMax = max != null && data.scheduled_hours > max
  const underMin = min != null && data.scheduled_hours < min

  return (
    <div className="w-72 space-y-3 rounded-xl border border-border bg-popover p-3 shadow-xl">
      <div className="flex items-center gap-2">
        <span className={cn('size-2.5 rounded-full', ls.dot)} />
        <p className="flex-1 truncate text-sm font-semibold">{data.name}</p>
        <LevelChip level={data.skill_level} />
      </div>

      {/* Hours */}
      <div className="rounded-lg border border-border bg-background/60 p-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Scheduled</span>
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              overMax && 'text-destructive',
              underMin && 'text-primary',
            )}
          >
            {data.scheduled_hours}h
          </span>
        </div>
        <div className="mt-0.5 flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Wants</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {min ?? '—'}–{max ?? '—'}h / wk
          </span>
        </div>
        {overMax && (
          <p className="mt-1 text-[0.7rem] text-destructive">Over their max</p>
        )}
        {data.age != null && data.age < 18 && (
          <p className="mt-1 text-[0.7rem] text-destructive">
            Minor (age {data.age}) — labor rules apply
          </p>
        )}
      </div>

      {/* Positions */}
      <div>
        <p className="mb-1 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
          Positions
        </p>
        {data.positions.length === 0 ? (
          <p className="text-xs text-muted-foreground">None recorded</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {data.positions.map((p) => (
              <span
                key={p.name}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem]',
                  p.certified
                    ? ls.chip
                    : 'border-border bg-background/40 text-muted-foreground/50',
                )}
                title={p.certified ? 'Certified' : 'Not yet certified'}
              >
                {p.certified ? (
                  <Check className="size-2.5" />
                ) : (
                  <Minus className="size-2.5" />
                )}
                {p.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Day-by-day availability */}
      <div>
        <p className="mb-1 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
          Availability this week
        </p>
        <div className="space-y-0.5">
          {data.days.map((d) => {
            const unavailable = d.windows.length === 0
            return (
              <div
                key={d.on_date}
                className="flex items-center justify-between gap-2 text-[0.7rem]"
              >
                <span className="w-20 shrink-0 text-muted-foreground">
                  {dayWithDate(d.on_date)}
                </span>
                <span
                  className={cn(
                    'flex-1 text-right',
                    d.on_time_off
                      ? 'text-destructive'
                      : unavailable
                        ? 'text-muted-foreground/60'
                        : 'text-foreground',
                  )}
                >
                  {d.on_time_off ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarOff className="size-2.5" />
                      Requested off
                    </span>
                  ) : unavailable ? (
                    'Unavailable'
                  ) : (
                    d.windows
                      .map((w) => `${hhmm(w.start)}–${hhmm(w.end)}`)
                      .join(', ')
                  )}
                </span>
                {d.scheduled_hours > 0 && (
                  <span className="w-9 shrink-0 text-right tabular-nums text-primary">
                    {d.scheduled_hours}h
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Wrapper that shows the card on hover and on click (click sticks). */
export function EmployeeDetailTrigger({
  scheduleId,
  employeeId,
  children,
}: {
  scheduleId: number
  employeeId: number
  children: React.ReactNode
}) {
  return (
    <div className="group/detail relative">
      {children}
      <div className="pointer-events-none absolute top-full left-0 z-40 hidden pt-2 group-hover/detail:block">
        <EmployeeDetailCard scheduleId={scheduleId} employeeId={employeeId} />
      </div>
    </div>
  )
}
