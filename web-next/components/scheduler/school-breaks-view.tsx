'use client'

import { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { CalendarX2, Info, Lock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api'
import { toISODate } from '@/lib/hooks'
import { Card, EmptyState, Loading, SectionHeader } from './primitives'

/** "2026-11-23" -> "Mon Nov 23" */
function dayWithDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function stamp(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Audit details arrive as a JSON blob; render it readably without crashing
 * if the shape ever changes. */
function readableDetails(details: string) {
  try {
    const d = JSON.parse(details) as Record<string, unknown>
    const name = d.name ? String(d.name) : null
    const start = d.start ? String(d.start) : null
    const end = d.end ? String(d.end) : null
    if (name && start && end) {
      return `${name} · ${dayWithDate(start)} – ${dayWithDate(end)}`
    }
    return Object.entries(d)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ')
  } catch {
    return details
  }
}

export function SchoolBreaksView() {
  const { mutate } = useSWRConfig()
  const { data: breaks, isLoading } = useSWR('school-breaks', () =>
    api.listSchoolBreaks(),
  )
  const { data: audit } = useSWR('school-breaks-audit', () =>
    api.listSchoolBreakAudit(),
  )

  const [name, setName] = useState('')
  const [start, setStart] = useState(toISODate(new Date()))
  const [end, setEnd] = useState(toISODate(new Date()))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    await Promise.all([mutate('school-breaks'), mutate('school-breaks-audit')])
  }

  async function submit() {
    if (!name.trim()) {
      setError('Give the range a name, e.g. "Winter break".')
      return
    }
    if (end < start) {
      setError('End date cannot be before the start date.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.createSchoolBreak({
        name: name.trim(),
        start_date: start,
        end_date: end,
      })
      setName('')
      await refresh()
      setNotice('Range added. Minor limits on those dates now use the non-school tier.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add the range")
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    setBusy(true)
    setError('')
    try {
      await api.deleteSchoolBreak(id)
      await refresh()
      setNotice('Range removed. The audit trail keeps a record of it.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove it")
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${breaks?.length ?? 0} ranges configured`}
        title="Non-School Dates"
        description="Tell the scheduler when school is out, so minor labor limits use the right tier."
      />

      {/* What this does and doesn't do — stated up front, because the
          difference matters legally. */}
      <div className="flex gap-3 rounded-2xl border border-primary/30 bg-primary/8 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-primary">
            These ranges change which limits apply — they don&apos;t turn the
            checks off.
          </p>
          <p className="text-muted-foreground">
            On school days a 16-year-old in NY is capped at 4 hours; on
            non-school days that becomes 8 hours, with a 48-hour week and later
            permitted hours. Adding a range tells the scheduler to use the
            second set for those dates. Minors are never unprotected, and there
            is no way to disable the checks.
          </p>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Add a range</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Winter break"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">From</span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">To</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <Button size="lg" disabled={busy} onClick={submit}>
            Add range
          </Button>
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Configured ranges</h2>
        {(breaks?.length ?? 0) === 0 ? (
          <EmptyState message="No ranges yet. Until you add some, the scheduler falls back to assuming weekdays from September through June are school days." />
        ) : (
          breaks!.map((b) => (
            <Card key={b.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                    <CalendarX2 className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {dayWithDate(b.start_date)} – {dayWithDate(b.end_date)}
                      {b.created_by_name && ` · added by ${b.created_by_name}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${b.name}`}
                  disabled={busy}
                  onClick={() => remove(b.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold">Audit trail</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[0.7rem] text-muted-foreground">
            <Lock className="size-2.5" />
            Read-only · kept 1 year
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Every range added or removed is recorded here. Entries cannot be
          edited or deleted, and drop off after one year.
        </p>
        {(audit?.length ?? 0) === 0 ? (
          <EmptyState message="No changes recorded yet." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {audit!.map((a, i) => (
              <div
                key={a.id}
                className={
                  'flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between' +
                  (i > 0 ? ' border-t border-border' : '')
                }
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <span
                      className={
                        a.action === 'deleted'
                          ? 'font-medium text-destructive'
                          : 'font-medium text-primary'
                      }
                    >
                      {a.action === 'deleted' ? 'Removed' : 'Added'}
                    </span>{' '}
                    <span className="text-muted-foreground">
                      {readableDetails(a.details)}
                    </span>
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {a.actor_name ?? 'Unknown'} · {stamp(a.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
