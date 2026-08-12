'use client'

import useSWR from 'swr'
import { api } from '@/lib/api'
import { dayWithDate, hhmm } from '@/lib/hooks'
import type { ShiftSummary } from '@/lib/types'

function PersonRow({
  name,
  original,
  proposed,
}: {
  name: string
  original: ShiftSummary | null
  proposed: ShiftSummary | null
}) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5">
      <p className="text-sm font-medium">{name}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          Now:{' '}
          {original ? (
            <span className="line-through">
              {dayWithDate(original.on_date)} {hhmm(original.start_time)}–{hhmm(original.end_time)}
            </span>
          ) : (
            '—'
          )}
        </span>
        <span className="text-primary">
          After:{' '}
          {proposed ? (
            <span className="font-medium">
              {dayWithDate(proposed.on_date)} {hhmm(proposed.start_time)}–{hhmm(proposed.end_time)}
            </span>
          ) : (
            <span className="text-muted-foreground">gives up shift</span>
          )}
        </span>
      </div>
    </div>
  )
}

export function SwapDetailPanel({ swapId }: { swapId: number }) {
  const { data } = useSWR(['swap-detail', swapId], () => api.swapDetail(swapId))
  if (!data) return <p className="mt-3 text-xs text-muted-foreground">Loading…</p>

  return (
    <div className="mt-4 space-y-2 border-t border-border pt-4">
      {data.drop_reason && (
        <div className="rounded-lg border border-primary/30 bg-primary/8 px-3 py-2 text-xs text-primary">
          Reason given: {data.drop_reason}
        </div>
      )}
      <PersonRow
        name={data.requesting_employee_name}
        original={data.requesting_shift}
        proposed={data.target_shift}
      />
      <PersonRow
        name={data.target_employee_name ?? 'Pool (unclaimed)'}
        original={data.target_shift}
        proposed={data.requesting_shift}
      />
    </div>
  )
}
