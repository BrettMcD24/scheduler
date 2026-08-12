'use client'

import { useState } from 'react'
import { useSWRConfig } from 'swr'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api'
import { shortDate, useMyTimeOff } from '@/lib/hooks'
import type { RequestStatus } from '@/lib/types'
import { Badge, Card, EmptyState, Loading, SectionHeader } from './primitives'

function toneFor(status: RequestStatus) {
  if (status === 'approved') return 'green' as const
  if (status === 'denied' || status === 'cancelled') return 'red' as const
  return 'gold' as const
}

export function TimeOffView() {
  const { mutate } = useSWRConfig()
  const { data: requests, isLoading } = useMyTimeOff()
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!start || !end) return
    if (end < start) {
      setError("End date can't be before start date.")
      return
    }
    setBusy(true); setMsg(''); setError('')
    try {
      await api.createTimeOff(start, end, reason)
      setStart(''); setEnd(''); setReason('')
      setMsg('Request submitted — your manager will review it.')
      await mutate('my-timeoff')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit request")
    } finally {
      setBusy(false)
    }
  }

  async function cancel(id: number) {
    setBusy(true)
    try {
      await api.cancelTimeOff(id)
      await mutate('my-timeoff')
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${requests?.length ?? 0} requests`}
        title="Time Off"
        description="Request days off. Approved time off blocks you from being scheduled."
      />

      {msg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">{msg}</div>
      )}
      {error && (
        <div className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Request time off</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">From</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">To</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Reason (optional)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. family trip"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <Button size="lg" disabled={busy || !start || !end} onClick={submit}>Submit</Button>
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">My requests</h2>
        {(requests?.length ?? 0) === 0 ? (
          <EmptyState message="No time-off requests yet." />
        ) : (
          requests!.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {r.start_date === r.end_date
                      ? shortDate(r.start_date)
                      : `${shortDate(r.start_date)} – ${shortDate(r.end_date)}`}
                  </p>
                  {r.reason && <p className="text-xs text-muted-foreground">{r.reason}</p>}
                  {r.manager_note && (
                    <p className="text-xs text-muted-foreground">Manager: {r.manager_note}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={toneFor(r.status)}>{r.status}</Badge>
                  {r.status === 'pending' && (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => cancel(r.id)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  )
}
