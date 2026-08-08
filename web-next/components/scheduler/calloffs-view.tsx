'use client'

import { useState } from 'react'
import { useSWRConfig } from 'swr'
import { PhoneOff, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { shortDate, toISODate, useCallOffs, useEmployees } from '@/lib/hooks'
import { Avatar, Card, EmptyState, Loading, SectionHeader } from './primitives'

export function CallOffsView({ storeId }: { storeId: number }) {
  const { mutate } = useSWRConfig()
  const { data: callOffs, isLoading } = useCallOffs()
  const { data: employees } = useEmployees(storeId)
  const [open, setOpen] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [onDate, setOnDate] = useState(toISODate(new Date()))
  const [shiftLabel, setShiftLabel] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const roster = (employees ?? []).filter((e) => e.role !== 'super_admin')

  async function submit() {
    if (!employeeId || !onDate) return
    setBusy(true)
    try {
      await api.createCallOff({
        employee_id: Number(employeeId),
        on_date: onDate,
        shift_label: shiftLabel,
        reason,
      })
      setEmployeeId(''); setShiftLabel(''); setReason(''); setOpen(false)
      await mutate('calloffs')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    setBusy(true)
    try {
      await api.deleteCallOff(id)
      await mutate('calloffs')
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${callOffs?.length ?? 0} logged`}
        title="Call-offs"
        description="Log when someone calls in unable to work. Kept for tracking and any disciplinary follow-up."
        action={
          <Button size="lg" className="gap-1.5" onClick={() => setOpen((v) => !v)}>
            <Plus className="size-4" />
            Log Call-off
          </Button>
        }
      />

      {open && (
        <Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Employee</span>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">— pick —</option>
                {roster.map((e) => (
                  <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Date</span>
              <input type="date" value={onDate} onChange={(e) => setOnDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Shift</span>
              <input value={shiftLabel} onChange={(e) => setShiftLabel(e.target.value)} placeholder="8-4"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Reason</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="sick, no-show"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <Button size="lg" disabled={busy || !employeeId} onClick={submit}>Log</Button>
          </div>
        </Card>
      )}

      {(callOffs?.length ?? 0) === 0 ? (
        <EmptyState message="No call-offs logged." />
      ) : (
        <div className="space-y-3">
          {callOffs!.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-destructive/35 bg-destructive/12 text-destructive">
                    <PhoneOff className="size-4" />
                  </span>
                  <Avatar name={c.employee_name ?? '—'} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.employee_name ?? `#${c.employee_id}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {shortDate(c.on_date)}{c.shift_label && ` · ${c.shift_label}`}
                    </p>
                  </div>
                </div>
                <p className="flex-1 text-sm text-muted-foreground lg:text-center">
                  {c.reason || 'No reason given'}
                </p>
                <Button variant="ghost" size="icon-sm" aria-label="Delete call-off"
                  disabled={busy} onClick={() => remove(c.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
