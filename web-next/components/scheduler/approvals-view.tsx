'use client'

import { useState } from 'react'
import { useSWRConfig } from 'swr'
import { Check, X, Clock3, CalendarOff, Repeat, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useEmployees, useSwaps, useTimeOff, shortDate } from '@/lib/hooks'
import { Avatar, Badge, Card, EmptyState, Loading, SectionHeader } from './primitives'
import { SwapDetailPanel } from './swap-detail-panel'

export function ApprovalsView({ storeId }: { storeId: number }) {
  const { mutate } = useSWRConfig()
  const { data: swaps, isLoading: l1 } = useSwaps('pending_manager')
  const { data: timeOff, isLoading: l2 } = useTimeOff('pending')
  const { data: employees } = useEmployees(storeId)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const nameOf = (id: number | null) => {
    const e = employees?.find((x) => x.id === id)
    return e ? `${e.first_name} ${e.last_name}` : '—'
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      await Promise.all([
        mutate(['swaps', 'pending_manager']),
        mutate(['swaps', 'all']),
        mutate(['timeoff', 'pending']),
        mutate(['timeoff', 'all']),
      ])
    } finally {
      setBusy(false)
    }
  }

  if (l1 || l2) return <Loading />

  const total = (swaps?.length ?? 0) + (timeOff?.length ?? 0)

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${total} pending`}
        title="Approvals"
        description="Shift swaps and time-off requests waiting on your decision."
      />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Repeat className="size-4 text-primary" />
          Shift swaps
          <span className="text-sm font-normal text-muted-foreground">({swaps?.length ?? 0})</span>
        </h2>
        {(swaps?.length ?? 0) === 0 ? (
          <EmptyState message="No swaps awaiting approval." />
        ) : (
          swaps!.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 items-center gap-3">
                  <Avatar name={nameOf(s.requesting_employee_id)} size="sm" />
                  <span className="text-sm font-medium">{nameOf(s.requesting_employee_id)}</span>
                  <span className="text-muted-foreground">{s.target_shift_id ? '↔' : '→'}</span>
                  <Avatar name={nameOf(s.target_employee_id)} size="sm" />
                  <span className="text-sm font-medium">{nameOf(s.target_employee_id)}</span>
                  <Badge tone={s.target_shift_id ? 'gold' : 'neutral'}>
                    {s.target_shift_id ? 'Two-way swap' : 'Drop / claim'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                    <ChevronDown className="size-3.5" />
                    {expanded === s.id ? 'Hide' : 'View Request'}
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => act(() => api.approveSwap(s.id))}>
                    <Check className="size-3.5" />
                    Approve
                  </Button>
                  <Button variant="destructive" size="sm" disabled={busy} onClick={() => act(() => api.denySwap(s.id))}>
                    <X className="size-3.5" />
                    Deny
                  </Button>
                </div>
              </div>
              {expanded === s.id && <SwapDetailPanel swapId={s.id} />}
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <CalendarOff className="size-4 text-primary" />
          Time off
          <span className="text-sm font-normal text-muted-foreground">({timeOff?.length ?? 0})</span>
        </h2>
        {(timeOff?.length ?? 0) === 0 ? (
          <EmptyState message="No time-off requests pending." />
        ) : (
          timeOff!.map((t) => (
            <Card key={t.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 items-center gap-3">
                  <Avatar name={nameOf(t.employee_id)} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{nameOf(t.employee_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.start_date === t.end_date
                        ? shortDate(t.start_date)
                        : `${shortDate(t.start_date)} – ${shortDate(t.end_date)}`}
                      {t.reason && ` · ${t.reason}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="gold"><Clock3 className="size-3" />Pending</Badge>
                  <Button size="sm" disabled={busy} onClick={() => act(() => api.approveTimeOff(t.id))}>
                    <Check className="size-3.5" />
                    Approve
                  </Button>
                  <Button variant="destructive" size="sm" disabled={busy} onClick={() => act(() => api.denyTimeOff(t.id))}>
                    <X className="size-3.5" />
                    Deny
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  )
}
