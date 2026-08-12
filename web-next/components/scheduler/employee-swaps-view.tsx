'use client'

import { useState } from 'react'
import { useSWRConfig } from 'swr'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api'
import {
  dayWithDate,
  employeeCacheKeys,
  hhmm,
  useMySwaps,
  usePublishedSchedule,
} from '@/lib/hooks'
import type { SwapStatus } from '@/lib/types'
import { useAuth } from './auth-provider'
import { Avatar, Badge, Card, EmptyState, Loading, SectionHeader } from './primitives'

const STATUS_LABEL: Record<SwapStatus, string> = {
  open: 'Open (in pool)',
  pending_coworker: 'Waiting on coworker',
  pending_manager: 'Waiting on manager',
  approved: 'Approved',
  denied: 'Denied',
  cancelled: 'Cancelled',
}

function toneFor(status: SwapStatus) {
  if (status === 'approved') return 'green' as const
  if (status === 'denied' || status === 'cancelled') return 'red' as const
  return 'gold' as const
}

export function EmployeeSwapsView() {
  const { user } = useAuth()
  const { mutate } = useSWRConfig()
  const { schedule, shifts, names, loading } = usePublishedSchedule()
  const { data: swaps, isLoading } = useMySwaps()
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const nameOf = (id: number | null) => {
    if (!id) return '—'
    const p = names.get(id)
    return p ? `${p.first_name} ${p.last_name}` : `#${id}`
  }

  function shiftLabel(id: number) {
    const s = shifts.find((x) => x.id === id)
    if (!s) return `shift #${id}`
    return `${dayWithDate(s.on_date)} ${hhmm(s.start_time)}–${hhmm(s.end_time)}`
  }

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true)
    setMsg('')
    setError('')
    try {
      await fn()
      await Promise.all(employeeCacheKeys(schedule?.id).map((k) => mutate(k)))
      setMsg(ok)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (loading || isLoading) return <Loading />

  const all = swaps ?? []
  const incoming = all.filter(
    (s) => s.target_employee_id === user?.id && s.status === 'pending_coworker',
  )
  const pool = all.filter(
    (s) => s.status === 'open' && s.requesting_employee_id !== user?.id,
  )
  const mine = all.filter((s) => s.requesting_employee_id === user?.id)

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${mine.length} of your requests`}
        title="Swaps and Drops"
        description="Claim shifts from the pool, respond to coworkers, and track your own requests."
      />

      {msg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {msg}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {incoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold">
            Coworkers asking you to take a shift
          </h2>
          {incoming.map((s) => (
            <div key={s.id} className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-sky-100">
                  <strong>{nameOf(s.requesting_employee_id)}</strong> wants you to
                  take {shiftLabel(s.shift_id)}
                  {s.target_shift_id && (
                    <>, and they take your {shiftLabel(s.target_shift_id)}</>
                  )}
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" disabled={busy}
                    onClick={() => act(() => api.acceptSwap(s.id), 'Accepted — pending manager approval.')}>
                    <Check className="size-3.5" />Accept
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy}
                    onClick={() => act(() => api.declineSwap(s.id), 'Declined.')}>
                    <X className="size-3.5" />Decline
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">
          Open shifts you can claim
          <span className="ml-2 text-sm font-normal text-muted-foreground">({pool.length})</span>
        </h2>
        {pool.length === 0 ? (
          <EmptyState message="Nothing in the pool right now." />
        ) : (
          pool.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={nameOf(s.requesting_employee_id)} size="sm" />
                  <p className="text-sm">
                    <strong>{nameOf(s.requesting_employee_id)}</strong> dropped{' '}
                    {shiftLabel(s.shift_id)}
                  </p>
                </div>
                <Button size="sm" disabled={busy}
                  onClick={() => act(() => api.claimSwap(s.id), 'Claimed — pending manager approval.')}>
                  Claim
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">My requests</h2>
        {mine.length === 0 ? (
          <EmptyState message="No swap or drop requests yet. Start one from My Shifts." />
        ) : (
          mine.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  {shiftLabel(s.shift_id)}
                  {s.target_shift_id ? (
                    <span className="text-muted-foreground">
                      {' '}↔ {nameOf(s.target_employee_id)}&apos;s{' '}
                      {shiftLabel(s.target_shift_id)}
                    </span>
                  ) : s.target_employee_id ? (
                    <span className="text-muted-foreground"> → {nameOf(s.target_employee_id)}</span>
                  ) : (
                    <span className="text-muted-foreground"> (dropped to pool)</span>
                  )}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={toneFor(s.status)}>{STATUS_LABEL[s.status]}</Badge>
                  {['open', 'pending_coworker', 'pending_manager'].includes(s.status) && (
                    <Button variant="ghost" size="sm" disabled={busy}
                      onClick={() => act(() => api.cancelSwap(s.id), 'Request cancelled.')}>
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
