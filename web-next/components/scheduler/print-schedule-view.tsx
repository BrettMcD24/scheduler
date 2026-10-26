'use client'

import { useMemo } from 'react'
import type {
  Employee,
  Shift,
  Store,
  TimeOffRequest,
  ValidationResult,
} from '@/lib/types'
import { OFF, REQUESTED_OFF, shiftCode } from '@/lib/shift-code'
import { weekDates } from '@/lib/hooks'

/** Decimal age, the way the paper sheet tracks it (17.80 = close to 18). */
function decimalAge(dob: string | null, on: string): number | null {
  if (!dob) return null
  const b = new Date(dob + 'T00:00:00')
  const d = new Date(on + 'T00:00:00')
  const years = (d.getTime() - b.getTime()) / (365.2425 * 24 * 3600 * 1000)
  return Math.floor(years * 100) / 100
}

function dayAbbr(iso: string) {
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('en-US', { weekday: 'short' })
    .toUpperCase()
}

/** "2026-06-03" -> "6/3" */
function shortNum(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function isWeekend(iso: string) {
  const dow = new Date(iso + 'T00:00:00').getDay()
  return dow === 0 || dow === 6
}

/** Surname-first initial, as the paper sheet lists people. */
function printName(e: Employee) {
  return `${e.last_name}, ${e.first_name[0]}.`
}

export function PrintScheduleView({
  store,
  weekStart,
  employees,
  shifts,
  validation,
  timeOff,
  publishedAt,
}: {
  store: Store | null
  weekStart: string
  employees: Employee[]
  shifts: Shift[]
  validation: ValidationResult | null
  timeOff: TimeOffRequest[]
  publishedAt: string | null
}) {
  const dates = weekDates(weekStart)

  // Only people who actually appear: scheduled this week, or active crew.
  // Keeps the printout to one page instead of listing 30 empty rows.
  const { managers, crew } = useMemo(() => {
    const scheduled = new Set(
      shifts.filter((s) => s.employee_id != null).map((s) => s.employee_id!),
    )
    const rows = employees
      .filter((e) => e.is_active && (scheduled.has(e.id) || e.role !== 'super_admin'))
      .sort((a, b) => {
        const lvl = (b.skill_level ?? 0) - (a.skill_level ?? 0)
        if (lvl !== 0) return lvl
        return a.last_name.localeCompare(b.last_name)
      })
    return {
      managers: rows.filter((e) => e.role !== 'employee'),
      crew: rows.filter((e) => e.role === 'employee'),
    }
  }, [employees, shifts])

  const hoursFor = (id: number) => validation?.weekly_hours?.[String(id)] ?? 0

  const mgrHours = managers.reduce((t, e) => t + hoursFor(e.id), 0)
  const crewHours = crew.reduce((t, e) => t + hoursFor(e.id), 0)

  // approved time off -> R/O in the cell, which reads differently from a plain
  // day off and is the thing the paper process kept losing
  const offByEmpDate = useMemo(() => {
    const m = new Set<string>()
    for (const t of timeOff) {
      if (t.status !== 'approved') continue
      for (const d of dates) {
        if (t.start_date <= d && d <= t.end_date) m.add(`${t.employee_id}|${d}`)
      }
    }
    return m
  }, [timeOff, dates])

  function cellFor(empId: number, date: string) {
    const day = shifts
      .filter((s) => s.employee_id === empId && s.on_date === date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
    if (day.length > 0) {
      return {
        text: day.map(shiftCode).join(' / '),
        swapped: day.some((s) => s.was_swapped),
        worked: true,
      }
    }
    if (offByEmpDate.has(`${empId}|${date}`)) {
      return { text: REQUESTED_OFF, swapped: false, worked: false }
    }
    return { text: OFF, swapped: false, worked: false }
  }

  const staffing = (d: string) => validation?.staffing.find((s) => s.on_date === d)

  // Minor / labor-law flags per employee, from the real validation output
  const flagged = useMemo(() => {
    const s = new Set<number>()
    for (const v of validation?.violations ?? []) {
      if (v.code.startsWith('MINOR') && v.employee_id) s.add(v.employee_id)
    }
    return s
  }, [validation])

  function Rows({ list, band }: { list: Employee[]; band: string }) {
    if (list.length === 0) return null
    return (
      <>
        <tr className="band">
          <td colSpan={11}>{band}</td>
        </tr>
        {list.map((e) => {
          const age = decimalAge(e.dob, weekStart)
          const minor = age !== null && age < 18
          return (
            <tr key={e.id}>
              <td className="num">{e.skill_level ?? '—'}</td>
              <td className="name">{printName(e)}</td>
              <td className="num">
                {age !== null ? age.toFixed(2) : ''}
                {minor ? <span className="minor"> M</span> : null}
              </td>
              {dates.map((d) => {
                const c = cellFor(e.id, d)
                return (
                  <td
                    key={d}
                    className={[
                      'cell',
                      isWeekend(d) ? 'wknd' : '',
                      c.worked ? '' : 'off',
                      c.swapped ? 'swapped' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {c.text}
                  </td>
                )
              })}
              <td className={'num total' + (flagged.has(e.id) ? ' flagged' : '')}>
                {hoursFor(e.id).toFixed(1)}
              </td>
            </tr>
          )
        })}
      </>
    )
  }

  return (
    <div className="print-sheet">
      <header className="sheet-head">
        <div>
          <h1>Ted&apos;s Hot Dogs{store ? ` — ${store.name}` : ''}</h1>
          <p className="wk">
            Week of {dayAbbr(dates[0])} {shortNum(dates[0])} –{' '}
            {dayAbbr(dates[6])} {shortNum(dates[6])}
          </p>
        </div>
        <table className="totals">
          <tbody>
            <tr>
              <th>MGRS</th>
              <td>{mgrHours.toFixed(1)}</td>
            </tr>
            <tr>
              <th>CREW</th>
              <td>{crewHours.toFixed(1)}</td>
            </tr>
            <tr className="grand">
              <th>TOTAL</th>
              <td>{(mgrHours + crewHours).toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      </header>

      <table className="sheet-grid">
        {/* Explicit column sizing. A fixed-layout table does not reliably
            distribute leftover width to unsized columns, so the day columns
            are given percentages and fill the sheet edge to edge. */}
        <colgroup>
          <col style={{ width: '3.6%' }} />
          <col style={{ width: '14.5%' }} />
          <col style={{ width: '6.2%' }} />
          {dates.map((d) => (
            <col key={d} style={{ width: '10.1%' }} />
          ))}
          <col style={{ width: '5%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>LVL</th>
            <th>NAME</th>
            <th>AGE</th>
            {dates.map((d) => (
              <th key={d} className={isWeekend(d) ? 'wknd' : ''}>
                <span className="dow">{dayAbbr(d)}</span>
                <span className="dnum">{shortNum(d)}</span>
              </th>
            ))}
            <th>HRS</th>
          </tr>
        </thead>
        <tbody>
          <Rows list={managers} band="MANAGERS" />
          <Rows list={crew} band="CREW" />
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={3}>OPENERS</th>
            {dates.map((d) => {
              const st = staffing(d)
              return (
                <td key={d} className={'count' + (st && !st.openers_met ? ' short' : '')}>
                  {st ? `${st.openers}/${st.min_openers}` : '—'}
                </td>
              )
            })}
            <td />
          </tr>
          <tr>
            <th colSpan={3}>CLOSERS</th>
            {dates.map((d) => {
              const st = staffing(d)
              return (
                <td key={d} className={'count' + (st && !st.closers_met ? ' short' : '')}>
                  {st ? `${st.closers}/${st.min_closers}` : '—'}
                </td>
              )
            })}
            <td />
          </tr>
          <tr>
            <th colSpan={3}>LUNCH (11–4)</th>
            {dates.map((d) => (
              <td key={d} className="count">
                {staffing(d)?.lunch ?? '—'}
              </td>
            ))}
            <td />
          </tr>
          <tr>
            <th colSpan={3}>DINNER (4–CL)</th>
            {dates.map((d) => (
              <td key={d} className="count">
                {staffing(d)?.dinner ?? '—'}
              </td>
            ))}
            <td />
          </tr>
          <tr className="labor">
            <th colSpan={3}>LABOR HOURS</th>
            {dates.map((d) => (
              <td key={d} className="count">
                {staffing(d)?.daily_labor?.toFixed(1) ?? '—'}
              </td>
            ))}
            <td className="num total">
              {(mgrHours + crewHours).toFixed(1)}
            </td>
          </tr>
        </tfoot>
      </table>

      <footer className="sheet-foot">
        <span>
          X = off · R/O = approved time off · C = close · M = minor
          {' · '}shaded = changed by an approved swap
        </span>
        <span>
          {publishedAt
            ? `Published ${new Date(publishedAt).toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}`
            : 'DRAFT — not published'}
        </span>
      </footer>
    </div>
  )
}
