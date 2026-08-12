'use client'

import { useState } from 'react'
import {
  dayWithDate,
  hhmm,
  hhmmCompact,
  shortDate,
  usePublishedSchedule,
  weekDates,
} from '@/lib/hooks'
import { levelStyle } from '@/lib/levels'
import { cn } from '@/lib/utils'
import { useAuth } from './auth-provider'
import { Avatar, EmptyState, LevelChip, Loading, SectionHeader } from './primitives'

const isWeekend = (iso: string) => {
  const d = new Date(iso + 'T00:00:00').getDay()
  return d === 0 || d === 6
}

export function StoreScheduleView() {
  const { user } = useAuth()
  const { schedules, weekStart, setWeekStart, shifts, names, loading } =
    usePublishedSchedule()
  const [mode, setMode] = useState<'week' | 'day'>('week')
  const [activeDate, setActiveDate] = useState<string | null>(null)

  if (loading) return <Loading />

  const dates = weekDates(weekStart)
  const focus = activeDate ?? dates[0]
  const shownDates = mode === 'day' ? [focus] : dates

  const rosterIds = Array.from(
    new Set(shifts.filter((s) => s.employee_id != null).map((s) => s.employee_id!)),
  )
  const roster = rosterIds
    .map((id) => names.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => (b.skill_level ?? 0) - (a.skill_level ?? 0))

  const cols = {
    gridTemplateColumns: `180px repeat(${shownDates.length}, minmax(0, 1fr))`,
  }

  function shiftsFor(employeeId: number, date: string) {
    return shifts
      .filter((s) => s.employee_id === employeeId && s.on_date === date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={schedules.length ? `Week of ${shortDate(weekStart)}` : 'No schedule yet'}
        title="Store Schedule"
        description="See who's working alongside you each day."
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
              {(['week', 'day'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                    mode === m
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            {schedules.length > 1 && (
              <select
                value={weekStart}
                onChange={(e) => {
                  setWeekStart(e.target.value)
                  setActiveDate(null)
                }}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                {schedules.map((s) => (
                  <option key={s.id} value={s.week_start}>
                    Week of {shortDate(s.week_start)}
                  </option>
                ))}
              </select>
            )}
          </div>
        }
      />

      {schedules.length === 0 ? (
        <EmptyState message="No published schedules yet." />
      ) : roster.length === 0 ? (
        <EmptyState message="No one is scheduled this week." />
      ) : (
        <>
          {mode === 'day' && (
            <div className="flex flex-wrap gap-1.5">
              {dates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setActiveDate(d)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                    d === focus
                      ? 'border-primary/40 bg-primary/12 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {dayWithDate(d)}
                </button>
              ))}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="overflow-x-auto">
              <div className={mode === 'day' ? 'min-w-[380px]' : 'min-w-[860px]'}>
                <div className="grid border-b border-border bg-secondary/40" style={cols}>
                  <div className="px-4 py-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Team
                  </div>
                  {shownDates.map((date) => (
                    <div
                      key={date}
                      className={cn(
                        'border-l border-border px-2 py-3 text-center',
                        isWeekend(date) && 'bg-secondary/30',
                      )}
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {dayWithDate(date)}
                      </p>
                    </div>
                  ))}
                </div>

                {roster.map((p) => {
                  const ls = levelStyle(p.skill_level)
                  const isMe = p.id === user?.id
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'grid border-b border-border last:border-b-0',
                        isMe && 'bg-primary/5',
                      )}
                      style={cols}
                    >
                      <div className="flex items-center gap-2.5 px-4 py-3">
                        <span className={cn('h-8 w-1 rounded-full', ls.dot)} />
                        <Avatar
                          name={`${p.first_name} ${p.last_name}`}
                          size="sm"
                          level={p.skill_level}
                        />
                        <div className="min-w-0 leading-tight">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                            {p.first_name} {p.last_name}
                            {isMe && <span className="text-[0.7rem] text-primary">you</span>}
                          </p>
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <LevelChip level={p.skill_level} />
                            {p.role === 'manager' && (
                              <span className="text-primary">Mgr</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {shownDates.map((date) => {
                        const dayShifts = shiftsFor(p.id, date)
                        return (
                          <div
                            key={date}
                            className={cn(
                              'border-l border-border p-1.5',
                              isWeekend(date) && 'bg-secondary/20',
                            )}
                          >
                            {dayShifts.length === 0 ? (
                              <div className="flex h-full min-h-[46px] items-center justify-center">
                                <span className="text-xs text-muted-foreground/30">—</span>
                              </div>
                            ) : (
                              <div className="flex h-full flex-col gap-1">
                                {dayShifts.map((s) => (
                                  <div
                                    key={s.id}
                                    className={cn(
                                      'rounded-lg border px-2 py-1.5',
                                      s.was_swapped
                                        ? 'border-amber-400/50 bg-amber-400/10 text-amber-200'
                                        : ls.block,
                                    )}
                                  >
                                    <p className="text-xs font-semibold">
                                      {mode === 'day'
                                        ? `${hhmm(s.start_time)} – ${hhmm(s.end_time)}`
                                        : `${hhmmCompact(s.start_time)}–${hhmmCompact(s.end_time)}`}
                                    </p>
                                    <p className="text-[0.7rem] text-muted-foreground">
                                      {s.hours}h{s.is_close && ' · close'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
