'use client'

import useSWR from 'swr'
import { CalendarOff } from 'lucide-react'
import { api } from '@/lib/api'
import { formatTime } from '@/lib/hooks'
import { levelStyle } from '@/lib/levels'
import { SKILLS } from '@/lib/skills'
import { cn } from '@/lib/utils'
import { LevelChip } from './primitives'

/** "2026-08-09" -> "Sun Aug 9" */
function dayWithDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

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
    { revalidateOnFocus: false, dedupingInterval: 15000 },
  )

  if (isLoading || !data) {
    return (
      <div className="w-72 rounded-xl border border-border bg-popover p-3 text-xs text-muted-foreground shadow-2xl">
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
    <div className="w-72 space-y-3 rounded-xl border border-border bg-popover p-3 shadow-2xl">
      <div className="flex items-center gap-2">
        <span className={cn('size-2.5 shrink-0 rounded-full', ls.dot)} />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {data.name}
        </p>
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
          <p className="mt-1 text-[0.7rem] text-destructive">
            Over their desired max
          </p>
        )}
        {data.age != null && data.age < 18 && (
          <p className="mt-1 text-[0.7rem] text-destructive">
            Minor (age {data.age}) — labor rules apply
          </p>
        )}
      </div>

      {/* Position certifications */}
      <div>
        <p className="mb-1 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
          Positions
        </p>
        <div className="flex flex-wrap gap-1">
          {SKILLS.map((s) => {
            const certified = data[s.employeeField]
            return (
              <span
                key={s.key}
                title={`${s.label}${certified ? ' — certified' : ' — not certified'}`}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[0.65rem] font-semibold',
                  certified
                    ? 'bg-primary/15 text-primary'
                    : 'bg-secondary text-muted-foreground/40',
                )}
              >
                {s.abbr}
              </span>
            )
          })}
        </div>
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
                className="flex items-baseline gap-2 text-[0.7rem]"
              >
                <span className="w-[4.5rem] shrink-0 text-muted-foreground">
                  {dayWithDate(d.on_date)}
                </span>
                <span
                  className={cn(
                    'flex-1 text-right',
                    d.on_time_off
                      ? 'text-destructive'
                      : unavailable
                        ? 'text-muted-foreground/50'
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
                      .map((w) => `${formatTime(w.start)}–${formatTime(w.end)}`)
                      .join(', ')
                  )}
                </span>
                {d.scheduled_hours > 0 && (
                  <span className="w-8 shrink-0 text-right tabular-nums text-primary">
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

/**
 * Wraps the roster's team cell. Shows the detail card on hover, and pins it
 * open on click (click-away or a second click closes it) so the card is
 * usable on touch devices too.
 */
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
      <details className="peer [&>summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer list-none">{children}</summary>
        {/* Pinned open on click */}
        <div className="absolute top-full left-2 z-50 pt-1">
          <EmployeeDetailCard scheduleId={scheduleId} employeeId={employeeId} />
        </div>
      </details>
      {/* Hover preview — hidden once the details element is open */}
      <div className="pointer-events-none absolute top-full left-2 z-40 hidden pt-1 group-hover/detail:block peer-open:group-hover/detail:hidden">
        <EmployeeDetailCard scheduleId={scheduleId} employeeId={employeeId} />
      </div>
    </div>
  )
}
