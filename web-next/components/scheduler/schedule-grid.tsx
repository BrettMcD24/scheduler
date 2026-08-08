'use client'

import { useState } from 'react'
import { Plus, X, ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { days, type Employee, type Shift } from '@/lib/types'
import { levelStyle } from '@/lib/levels'
import { formatTime, shortDate, weekDates } from '@/lib/hooks'
import { Avatar, LevelChip } from './primitives'
import { AssignShiftDialog } from './assign-shift-dialog'

export function ScheduleGrid({
  employees,
  shifts,
  weekStart,
  locked,
  onCreate,
  onDelete,
}: {
  employees: Employee[]
  shifts: Shift[]
  weekStart: string
  locked: boolean
  onCreate: (
    employeeId: number,
    onDate: string,
    code: string,
    override: boolean,
  ) => Promise<void>
  onDelete: (shiftId: number) => Promise<void>
}) {
  const dates = weekDates(weekStart)
  const [target, setTarget] = useState<{
    employee: Employee
    date: string
  } | null>(null)

  function shiftsFor(employeeId: number, date: string) {
    return shifts.filter(
      (s) => s.employee_id === employeeId && s.on_date === date,
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Header row */}
            <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-border bg-secondary/40">
              <div className="px-4 py-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Team
              </div>
              {days.map((d, i) => (
                <div
                  key={d}
                  className={cn(
                    'border-l border-border px-3 py-3 text-center',
                    (i === 5 || i === 6) && 'bg-secondary/30',
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">{d}</p>
                  <p className="text-[0.7rem] text-muted-foreground">
                    {shortDate(dates[i])}
                  </p>
                </div>
              ))}
            </div>

            {/* Employee rows */}
            {employees.map((emp) => {
              const ls = levelStyle(emp.skill_level)
              return (
                <div
                  key={emp.id}
                  className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-border last:border-b-0"
                >
                  <div className="flex items-center gap-2.5 px-4 py-3">
                    <span className={cn('h-8 w-1 rounded-full', ls.dot)} />
                    <Avatar
                      name={`${emp.first_name} ${emp.last_name}`}
                      size="sm"
                      level={emp.skill_level}
                    />
                    <div className="min-w-0 leading-tight">
                      <p className="truncate text-sm font-medium">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <LevelChip level={emp.skill_level} />
                        {emp.role === 'manager' && (
                          <span className="text-primary">Mgr</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {dates.map((date, dayIndex) => {
                    const dayShifts = shiftsFor(emp.id, date)
                    const weekend = dayIndex === 5 || dayIndex === 6
                    return (
                      <div
                        key={date}
                        className={cn(
                          'group border-l border-border p-1.5',
                          weekend && 'bg-secondary/20',
                        )}
                      >
                        {dayShifts.length > 0 ? (
                          <div className="flex h-full flex-col gap-1">
                            {dayShifts.map((shift) => (
                              <div
                                key={shift.id}
                                className={cn(
                                  'relative rounded-lg border px-2.5 py-2',
                                  shift.was_swapped
                                    ? 'border-amber-400/50 bg-amber-400/10 text-amber-200'
                                    : ls.block,
                                )}
                              >
                                <p className="text-xs font-semibold">
                                  {formatTime(shift.start_time)} –{' '}
                                  {formatTime(shift.end_time)}
                                </p>
                                <p className="mt-0.5 flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                                  {shift.hours}h
                                  {shift.is_close && ' · close'}
                                  {shift.was_swapped && (
                                    <ArrowLeftRight className="size-3 text-amber-300" />
                                  )}
                                </p>
                                {!locked && (
                                  <button
                                    type="button"
                                    onClick={() => onDelete(shift.id)}
                                    aria-label="Remove shift"
                                    className="absolute right-1 top-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                  >
                                    <X className="size-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => setTarget({ employee: emp, date })}
                            className="flex h-full min-h-[52px] w-full items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground/50 transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed"
                            aria-label={`Add shift for ${emp.first_name} ${emp.last_name} on ${days[dayIndex]}`}
                          >
                            <Plus className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
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

      {target && (
        <AssignShiftDialog
          employee={target.employee}
          date={target.date}
          onConfirm={async (code, override) => {
            await onCreate(target.employee.id, target.date, code, override)
            setTarget(null)
          }}
          onCancel={() => setTarget(null)}
        />
      )}
    </>
  )
}
