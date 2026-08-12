'use client'

import { useEffect, useState } from 'react'
import { hhmm, shortDate, usePublishedSchedule, weekDates } from '@/lib/hooks'
import { levelStyle } from '@/lib/levels'
import { cn } from '@/lib/utils'
import { useAuth } from './auth-provider'
import { Avatar, Card, EmptyState, LevelChip, Loading, SectionHeader } from './primitives'

export function StoreScheduleView() {
  const { user } = useAuth()
  const { schedules, weekStart, setWeekStart, shifts, names, loading } =
    usePublishedSchedule()
  const dates = weekDates(weekStart)
  const [activeDate, setActiveDate] = useState(dates[0])

  useEffect(() => {
    setActiveDate(weekDates(weekStart)[0])
  }, [weekStart])

  if (loading) return <Loading />

  const dayShifts = shifts
    .filter((s) => s.on_date === activeDate && s.employee_id != null)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={schedules.length ? `Week of ${weekStart}` : 'No schedule yet'}
        title="Store Schedule"
        description="See who's working alongside you each day."
        action={
          schedules.length > 1 ? (
            <select
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {schedules.map((s) => (
                <option key={s.id} value={s.week_start}>
                  Week of {shortDate(s.week_start)}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {schedules.length === 0 ? (
        <EmptyState message="No published schedules yet." />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setActiveDate(d)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                  d === activeDate
                    ? 'border-primary/40 bg-primary/12 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {shortDate(d)}
              </button>
            ))}
          </div>

          {dayShifts.length === 0 ? (
            <EmptyState message="No one scheduled this day." />
          ) : (
            <div className="space-y-2">
              {dayShifts.map((s) => {
                const p = s.employee_id ? names.get(s.employee_id) : null
                const ls = levelStyle(p?.skill_level)
                const isMe = s.employee_id === user?.id
                return (
                  <Card
                    key={s.id}
                    className={cn(
                      'border-l-4 py-3',
                      ls.block.split(' ')[0].replace('border-', 'border-l-'),
                      isMe && 'ring-1 ring-primary/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          name={p ? `${p.first_name} ${p.last_name}` : '—'}
                          size="sm"
                          level={p?.skill_level}
                        />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate text-sm font-medium">
                            {p ? `${p.first_name} ${p.last_name}` : '—'}
                            {isMe && <span className="text-xs text-primary">you</span>}
                          </p>
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <LevelChip level={p?.skill_level} />
                            {p?.role === 'manager' && (
                              <span className="text-primary">Mgr</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {hhmm(s.start_time)} – {hhmm(s.end_time)}
                        {s.is_close && ' · close'}
                      </span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
