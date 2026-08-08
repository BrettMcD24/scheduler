'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { shortDate } from '@/lib/hooks'
import type { Employee } from '@/lib/types'
import { LevelChip } from './primitives'

const QUICK_CODES = ['8-4', '9-4', '11-730', '4-1045', '2-C']

export function AssignShiftDialog({
  employee,
  date,
  onConfirm,
  onCancel,
}: {
  employee: Employee
  date: string
  onConfirm: (code: string, override: boolean) => Promise<void>
  onCancel: () => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(override: boolean) {
    if (!code.trim()) return
    setBusy(true)
    setError('')
    try {
      await onConfirm(code.trim(), override)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        // 409 = availability / time-off block, which a manager may override
        setBlocked(err.status === 409)
      } else {
        setError('Could not create the shift.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5"
      >
        <div className="mb-1 flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold">
            {employee.first_name} {employee.last_name}
          </h2>
          <LevelChip level={employee.skill_level} />
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Assign a shift on {shortDate(date)}
        </p>

        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit(false)}
          placeholder="Shift code — 8-4, 2-C, 1130-730"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none"
        />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_CODES.map((c) => (
            <Button
              key={c}
              size="xs"
              variant="outline"
              onClick={() => setCode(c)}
            >
              {c}
            </Button>
          ))}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="lg" onClick={onCancel}>
            Cancel
          </Button>
          {blocked && (
            <Button
              variant="destructive"
              size="lg"
              disabled={busy}
              onClick={() => submit(true)}
            >
              Override &amp; assign
            </Button>
          )}
          <Button size="lg" disabled={busy || !code.trim()} onClick={() => submit(false)}>
            {busy ? 'Assigning…' : 'Assign'}
          </Button>
        </div>
      </div>
    </div>
  )
}
