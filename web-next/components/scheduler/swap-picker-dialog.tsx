'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { hhmm } from '@/lib/hooks'
import { levelStyle } from '@/lib/levels'
import { cn } from '@/lib/utils'
import type { Employee, Shift } from '@/lib/types'
import { Avatar, LevelChip } from './primitives'

export function SwapPickerDialog({
  myShift,
  dayShifts,
  names,
  onConfirm,
  onCancel,
}: {
  myShift: Shift
  dayShifts: Shift[]
  names: Map<number, Employee>
  onConfirm: (targetShiftId: number, reason: string) => Promise<void>
  onCancel: () => void
}) {
  const [picked, setPicked] = useState<Shift | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const candidates = dayShifts.filter(
    (s) => s.id !== myShift.id && s.employee_id != null,
  )

  const personFor = (s: Shift) => (s.employee_id ? names.get(s.employee_id) : null)
  const nameFor = (s: Shift) => {
    const p = personFor(s)
    return p ? `${p.first_name} ${p.last_name}` : '—'
  }

  async function submit() {
    if (!picked) return
    setBusy(true)
    try {
      await onConfirm(picked.id, reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div onClick={onCancel} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5"
      >
        <h2 className="font-display text-lg font-semibold">Swap your shift</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          You&apos;re giving up {hhmm(myShift.start_time)}–{hhmm(myShift.end_time)}.
          {!picked && ' Pick a coworker working that day to trade with.'}
        </p>

        {!picked ? (
          candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No one else is scheduled that day to swap with.
            </p>
          ) : (
            <div className="space-y-2">
              {candidates.map((s) => {
                const p = personFor(s)
                const ls = levelStyle(p?.skill_level)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPicked(s)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/40',
                      'border-border bg-background/60',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn('size-2 rounded-full', ls.dot)} />
                      <Avatar name={nameFor(s)} size="sm" level={p?.skill_level} />
                      <span className="text-sm font-medium">{nameFor(s)}</span>
                      <LevelChip level={p?.skill_level} />
                      {p?.role === 'manager' && (
                        <span className="text-xs text-primary">Mgr</span>
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {hhmm(s.start_time)}–{hhmm(s.end_time)}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        ) : (
          <>
            <div className="mb-4 rounded-lg border border-border bg-background/60 p-3 text-sm">
              <p>
                <strong>You</strong> give up {hhmm(myShift.start_time)}–
                {hhmm(myShift.end_time)}
              </p>
              <p className="mt-1">
                <strong>{nameFor(picked)}</strong> gives up{' '}
                {hhmm(picked.start_time)}–{hhmm(picked.end_time)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                If approved, you&apos;ll take their shift and they&apos;ll take yours.
              </p>
            </div>

            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">
                Reason for the swap (visible to your manager)
              </span>
              <input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. schedule conflict, prefer earlier shift"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none"
              />
            </label>

            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" size="lg" onClick={() => setPicked(null)}>
                ← Back
              </Button>
              <Button size="lg" disabled={busy} onClick={submit}>
                {busy ? 'Requesting…' : 'Confirm swap request'}
              </Button>
            </div>
          </>
        )}

        {!picked && (
          <div className="mt-5 flex justify-end">
            <Button variant="ghost" size="lg" onClick={onCancel}>Cancel</Button>
          </div>
        )}
      </div>
    </div>
  )
}
