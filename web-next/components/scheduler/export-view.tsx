'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import {
  addWeeks,
  mondayOf,
  scheduleForWeek,
  useEmployees,
  useSchedules,
  useShifts,
  useTimeOff,
  useValidation,
  weekDates,
  weekLabel,
} from '@/lib/hooks'
import { OFF, REQUESTED_OFF, shiftCode } from '@/lib/shift-code'
import { EmptyState, Loading, SectionHeader } from './primitives'
import { PrintScheduleView } from './print-schedule-view'

function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function ExportView({
  storeId,
  weekStart,
  onWeekChange,
}: {
  storeId: number
  weekStart: string
  onWeekChange: (w: string) => void
}) {
  const { data: employees } = useEmployees(storeId)
  const { data: schedules, isLoading } = useSchedules(storeId)
  const schedule = scheduleForWeek(schedules, weekStart)
  const { data: shifts } = useShifts(schedule?.id)
  const { data: validation } = useValidation(schedule?.id)
  const { data: timeOff } = useTimeOff('approved')
  const { data: store } = useSWR(['store', storeId], () => api.getStore(storeId))

  const dates = weekDates(weekStart)

  /** Same grid as the printed sheet, as CSV — for records or a spreadsheet. */
  const csv = useMemo(() => {
    if (!employees || !shifts) return ''
    const offSet = new Set<string>()
    for (const t of timeOff ?? []) {
      for (const d of dates) {
        if (t.start_date <= d && d <= t.end_date) offSet.add(`${t.employee_id}|${d}`)
      }
    }
    const header = ['Level', 'Name', 'Role', ...dates, 'Weekly Hours']
    const rows = employees
      .filter((e) => e.is_active)
      .sort((a, b) => {
        const r = (a.role === 'employee' ? 1 : 0) - (b.role === 'employee' ? 1 : 0)
        if (r !== 0) return r
        return a.last_name.localeCompare(b.last_name)
      })
      .map((e) => {
        const cells = dates.map((d) => {
          const day = shifts
            .filter((s) => s.employee_id === e.id && s.on_date === d)
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
          if (day.length) return day.map(shiftCode).join(' / ')
          return offSet.has(`${e.id}|${d}`) ? REQUESTED_OFF : OFF
        })
        const hrs = validation?.weekly_hours?.[String(e.id)] ?? 0
        return [
          String(e.skill_level ?? ''),
          `${e.last_name}, ${e.first_name}`,
          e.role === 'employee' ? 'Crew' : 'Manager',
          ...cells,
          hrs.toFixed(1),
        ]
      })
    const footer = [
      ['OPENERS', '', '', ...dates.map((d) => {
        const st = validation?.staffing.find((x) => x.on_date === d)
        return st ? `${st.openers}/${st.min_openers}` : ''
      }), ''],
      ['CLOSERS', '', '', ...dates.map((d) => {
        const st = validation?.staffing.find((x) => x.on_date === d)
        return st ? `${st.closers}/${st.min_closers}` : ''
      }), ''],
      ['LABOR HOURS', '', '', ...dates.map((d) => {
        const st = validation?.staffing.find((x) => x.on_date === d)
        return st ? st.daily_labor.toFixed(1) : ''
      }), ''],
    ]
    return [header, ...rows, [], ...footer]
      .map((r) => r.map((c) => csvEscape(String(c))).join(','))
      .join('\r\n')
  }, [employees, shifts, validation, timeOff, dates])

  function downloadCsv() {
    // ﻿ so Excel opens it as UTF-8 rather than mangling names
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `teds-schedule-${weekStart}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) return <Loading />

  return (
    <div className="space-y-5">
      <div className="no-print">
        <SectionHeader
          eyebrow={`Week of ${weekLabel(weekStart)}`}
          title="Print & Export"
          description="The sheet below is what prints — landscape, one page, in the shift codes the store already reads."
          action={
            <div className="flex flex-wrap items-center gap-2">
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
              <Button
                variant="outline"
                size="lg"
                className="gap-1.5"
                disabled={!schedule}
                onClick={downloadCsv}
              >
                <Download className="size-4" />
                CSV
              </Button>
              <Button
                size="lg"
                className="gap-1.5"
                disabled={!schedule}
                onClick={() => window.print()}
              >
                <Printer className="size-4" />
                Print
              </Button>
            </div>
          }
        />
      </div>

      {!schedule ? (
        <div className="no-print">
          <EmptyState message={`No schedule exists for the week of ${weekLabel(weekStart)}. Build one on the dashboard first.`} />
        </div>
      ) : (
        <>
          {schedule.status === 'draft' && (
            <div className="no-print rounded-xl border border-primary/35 bg-primary/10 px-4 py-2.5 text-sm text-primary">
              This week is still a draft. It will print marked DRAFT until you
              publish it.
            </div>
          )}
          <PrintScheduleView
            store={store ?? null}
            weekStart={weekStart}
            employees={employees ?? []}
            shifts={shifts ?? []}
            validation={validation ?? null}
            timeOff={timeOff ?? []}
            publishedAt={schedule.published_at}
          />
        </>
      )}
    </div>
  )
}
