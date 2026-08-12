'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api'
import { DAY_NAMES } from '@/lib/types'
import { useAuth } from './auth-provider'
import { Card, Loading, SectionHeader } from './primitives'

type Row = { day_of_week: number; start_time: string; end_time: string }

export function AvailabilityView() {
  const { user } = useAuth()
  const { data: windows, isLoading, mutate } = useSWR(
    user ? ['windows', user.id] : null,
    () => api.getWindows(user!.id),
  )
  const [rows, setRows] = useState<Row[]>([])
  const [hmin, setHmin] = useState(user?.desired_hours_min ?? 0)
  const [hmax, setHmax] = useState(user?.desired_hours_max ?? 40)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (windows) {
      setRows(
        windows.map((w) => ({
          day_of_week: w.day_of_week,
          start_time: w.start_time.slice(0, 5),
          end_time: w.end_time.slice(0, 5),
        })),
      )
    }
  }, [windows])

  function addRow(day: number) {
    setRows((r) => [...r, { day_of_week: day, start_time: '08:00', end_time: '16:00' }])
  }
  function removeRow(idx: number) {
    setRows((r) => r.filter((_, i) => i !== idx))
  }
  function updateRow(idx: number, field: keyof Row, value: string) {
    setRows((r) =>
      r.map((row, i) =>
        i === idx
          ? { ...row, [field]: field === 'day_of_week' ? Number(value) : value }
          : row,
      ),
    )
  }

  async function save() {
    if (!user) return
    for (const r of rows) {
      if (r.start_time >= r.end_time) {
        setError(`Fix ${DAY_NAMES[r.day_of_week]}: start must be before end.`)
        return
      }
    }
    setBusy(true); setMsg(''); setError('')
    try {
      await api.setWindows(
        user.id,
        rows.map((r) => ({
          day_of_week: r.day_of_week,
          start_time: r.start_time + ':00',
          end_time: r.end_time + ':00',
        })),
      )
      await api.setDesiredHours(hmin, hmax)
      setMsg('Saved. Your manager will see this when building future schedules.')
      await mutate()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save")
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${rows.length} windows set`}
        title="Availability"
        description="Tell your manager when you can work. You won't be scheduled outside these windows — though you can still pick up shifts through swaps."
        action={<Button size="lg" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button>}
      />

      {msg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">{msg}</div>
      )}
      {error && (
        <div className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Desired weekly hours</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Min</span>
            <input type="number" min={0} value={hmin} onChange={(e) => setHmin(Number(e.target.value))}
              className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Max</span>
            <input type="number" min={0} value={hmax} onChange={(e) => setHmax(Number(e.target.value))}
              className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
        </div>
      </Card>

      <div className="space-y-3">
        {DAY_NAMES.map((dayName, dayIdx) => {
          const dayRows = rows
            .map((r, i) => ({ r, i }))
            .filter(({ r }) => r.day_of_week === dayIdx)
          return (
            <Card key={dayName}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{dayName}</h3>
                <Button variant="outline" size="sm" onClick={() => addRow(dayIdx)}>
                  <Plus className="size-3.5" />Add window
                </Button>
              </div>
              {dayRows.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Not available — you won&apos;t be scheduled this day.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {dayRows.map(({ r, i }) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="time" value={r.start_time}
                        onChange={(e) => updateRow(i, 'start_time', e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
                      <span className="text-muted-foreground">–</span>
                      <input type="time" value={r.end_time}
                        onChange={(e) => updateRow(i, 'end_time', e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
                      <Button variant="ghost" size="icon-sm" aria-label="Remove window"
                        onClick={() => removeRow(i)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
