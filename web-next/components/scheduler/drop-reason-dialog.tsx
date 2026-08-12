'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function DropReasonDialog({
  shiftLabel,
  onConfirm,
  onCancel,
}: {
  shiftLabel: string
  onConfirm: (reason: string) => Promise<void>
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await onConfirm(reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div onClick={onCancel} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Drop shift</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          You&apos;re dropping {shiftLabel} to the pool. Add a reason — this is only
          visible to your manager.
        </p>
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. doctor's appointment, family emergency"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none"
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="lg" onClick={onCancel}>Cancel</Button>
          <Button size="lg" disabled={busy} onClick={submit}>
            {busy ? 'Dropping…' : 'Drop shift'}
          </Button>
        </div>
      </div>
    </div>
  )
}
