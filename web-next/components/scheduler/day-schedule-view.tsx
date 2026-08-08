'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Employee, Shift } from '@/lib/types'
import { levelStyle } from '@/lib/levels'
import { formatTime, useAvailable } from '@/lib/hooks'
import { Avatar, LevelChip } from './primitives'
import { SkillBadges } from './skill-badges'
import { AssignShiftDialog } from './assign-shift-dialog'

const OPEN_HOUR = 7
const CLOSE_HOUR = 24 // midnight
const ROW_HEIGHT = 40 // px per hour
const HEADER_HEIGHT = 120 // px
const COL_WIDTH = 168 // px per employee column
const TIME_COL_WIDTH = 52 // px

/** Fractional hour for a "HH:MM:SS" time string. */
function toHours(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h + (m ?? 0) / 60
}

function hourLabel(h: number) {
  const disp = h % 24
  const ampm = disp >= 12 ? 'p' : 'a'
  let hh = disp % 12
  if (hh === 0) hh = 12
  return `${hh}${ampm}`
}

export function DayScheduleView({
  employees,
  shifts,
  scheduleId,
  date,
  locked,
  onCreate,
  onDelete,
}: {
  employees: Employee[]
  shifts: Shift[]
  scheduleId: number
  date: string
  locked: boolean
  onCreate: (
    employeeId: number,
    onDate: string,
    code: string,
    override: boolean,
  ) => Promise<void>
  onDelete: (shiftId: number) => Promise<void>
}) {
  const { data: available } = useAvailable(scheduleId, date)
  const [target, setTarget] = useState<{ employee: Employee; date: string } | null>(null)

  const dayShifts = shifts.filter((s) => s.on_date === date)
  const availByEmp = new Map((available?.employees ?? []).map((a) => [a.employee_id, a]))

  const hours = Array.from({ length: CLOSE_HOUR - OPEN_HOUR + 1 }, (_, i) => OPEN_HOUR + i)
  const gridHeight = (CLOSE_HOUR - OPEN_HOUR) * ROW_HEIGHT

  function shiftsFor(employeeId: number) {
    return dayShifts.filter((s) => s.employee_id === employeeId)
  }

  function availabilityLine(emp: Employee) {
    if (emp.role !== 'employee') return 'Available anytime'
    const info = availByEmp.get(emp.id)
    if (!info || info.windows.length === 0) return 'Not available'
    return info.windows.map((w) => `${formatTime(w.start)}–${formatTime(w.end)}`).join(', ')
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <div className="flex" style={{ minWidth: 'fit-content' }}>
            {/* Time axis */}
            <div className="sticky left-0 z-10 shrink-0 bg-card" style={{ width: TIME_COL_WIDTH }}>
              <div
                style={{ height: HEADER_HEIGHT }}
                className="border-r border-b border-border"
              />
              <div className="relative border-r border-border" style={{ height: gridHeight }}>
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute right-1.5 text-[0.65rem] text-muted-foreground"
                    style={{ top: i * ROW_HEIGHT - 7 }}
                  >
                    {hourLabel(h)}
                  </div>
                ))}
              </div>
            </div>

            {/* Employee columns */}
            {employees.map((emp) => {
              const ls = levelStyle(emp.skill_level)
              const empShifts = shiftsFor(emp.id)
              return (
                <div
                  key={emp.id}
                  className="shrink-0 border-r border-border last:border-r-0"
                  style={{ width: COL_WIDTH }}
                >
                  {/* Header */}
                  <div
                    className="flex flex-col items-center justify-center gap-0.5 border-b border-border px-2 py-1.5 text-center"
                    style={{ height: HEADER_HEIGHT }}
                  >
                    <Avatar
                      name={`${emp.first_name} ${emp.last_name}`}
                      size="sm"
                      level={emp.skill_level}
                    />
                    <p className="w-full truncate text-xs font-medium leading-tight">
                      {emp.first_name} {emp.last_name}
                    </p>
                    <div className="flex items-center gap-1">
                      <LevelChip level={emp.skill_level} />
                      {emp.role !== 'employee' && (
                        <span className="text-[0.65rem] font-semibold text-primary">Mgr</span>
                      )}
                    </div>
                    <SkillBadges employee={emp} />
                    <p
                      className="w-full truncate text-[0.62rem] text-muted-foreground"
                      title={availabilityLine(emp)}
                    >
                      {availabilityLine(emp)}
                    </p>
                  </div>

                  {/* Body */}
                  <div className="relative" style={{ height: gridHeight }}>
                    {hours.slice(1).map((h, i) => (
                      <div
                        key={h}
                        className="absolute right-0 left-0 border-t border-border/60"
                        style={{ top: (i + 1) * ROW_HEIGHT }}
                      />
                    ))}

                    {empShifts.length === 0 ? (
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => setTarget({ employee: emp, date })}
                        className="absolute inset-1 flex items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground/40 transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed"
                        aria-label={`Add shift for ${emp.first_name} ${emp.last_name}`}
                      >
                        <Plus className="size-4" />
                      </button>
                    ) : (
                      empShifts.map((shift) => {
                        const top = Math.max(
                          0,
                          (toHours(shift.start_time) - OPEN_HOUR) * ROW_HEIGHT,
                        )
                        const height = Math.max(
                          28,
                          (toHours(shift.end_time) - toHours(shift.start_time)) * ROW_HEIGHT,
                        )
                        return (
                          <div
                            key={shift.id}
                            className={cn(
                              'group absolute right-1 left-1 overflow-hidden rounded-lg border px-2 py-1.5',
                              shift.was_swapped
                                ? 'border-amber-400/50 bg-amber-400/10 text-amber-200'
                                : ls.block,
                            )}
                            style={{ top, height }}
                          >
                            <p className="text-[0.68rem] leading-tight font-semibold">
                              {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                            </p>
                            <p className="text-[0.62rem] text-muted-foreground">
                              {shift.hours}h{shift.is_close && ' · close'}
                            </p>
                            {!locked && (
                              <button
                                type="button"
                                onClick={() => onDelete(shift.id)}
                                aria-label="Remove shift"
                                className="absolute top-1 right-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                              >
                                <X className="size-3" />
                              </button>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
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
