'use client'

import { useState } from 'react'
import { ArrowRight, Check, X, Clock3, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, Badge, Card, EmptyState, Loading, SectionHeader } from './primitives'
import { useEmployees, useSwaps } from '@/lib/hooks'
import type { SwapStatus } from '@/lib/types'
import { SwapDetailPanel } from './swap-detail-panel'

function StatusBadge({ status }: { status: SwapStatus }) {
  if (status === 'approved')
    return <Badge tone="green"><Check className="size-3" />Approved</Badge>
  if (status === 'denied' || status === 'cancelled')
    return <Badge tone="red"><X className="size-3" />{status === 'denied' ? 'Denied' : 'Cancelled'}</Badge>
  return <Badge tone="gold"><Clock3 className="size-3" />Pending</Badge>
}

export function SwapsView({ storeId }: { storeId: number }) {
  const { data: swaps, isLoading } = useSwaps()
  const { data: employees } = useEmployees(storeId)
  const [expanded, setExpanded] = useState<number | null>(null)

  const nameOf = (id: number | null) => {
    const e = employees?.find((x) => x.id === id)
    return e ? `${e.first_name} ${e.last_name}` : '—'
  }

  if (isLoading) return <Loading />

  const history = (swaps ?? []).filter(
    (s) => s.status === 'approved' || s.status === 'denied' || s.status === 'cancelled',
  )
  const approved = history.filter((s) => s.status === 'approved').length

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${history.length} swaps · ${approved} approved`}
        title="Shift Swap History"
        description="A complete audit trail of every shift swap requested between team members."
      />

      {history.length === 0 ? (
        <EmptyState message="No decided swaps yet." />
      ) : (
        <div className="space-y-3">
          {history.map((swap) => (
            <Card key={swap.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={nameOf(swap.requesting_employee_id)} size="sm" />
                    <span className="text-sm font-medium">{nameOf(swap.requesting_employee_id)}</span>
                  </div>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ArrowRight className="size-3.5" />
                  </span>
                  <div className="flex items-center gap-2">
                    <Avatar name={nameOf(swap.target_employee_id)} size="sm" />
                    <span className="text-sm font-medium">{nameOf(swap.target_employee_id)}</span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-0.5 lg:items-center">
                  <p className="text-sm font-medium text-foreground">
                    {swap.target_shift_id ? 'Two-way swap' : 'Drop / claim'}
                  </p>
                  {swap.manager_note && (
                    <p className="text-xs text-muted-foreground">Note · {swap.manager_note}</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 lg:justify-end">
                  <Button variant="outline" size="sm"
                    onClick={() => setExpanded(expanded === swap.id ? null : swap.id)}>
                    <ChevronDown className="size-3.5" />
                    {expanded === swap.id ? 'Hide' : 'View shifts'}
                  </Button>
                  <StatusBadge status={swap.status} />
                </div>
              </div>
              {expanded === swap.id && <SwapDetailPanel swapId={swap.id} />}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
