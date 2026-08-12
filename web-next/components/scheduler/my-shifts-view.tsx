'use client'

import { useMemo, useState } from 'react'
import { useSWRConfig } from 'swr'
import { ArrowLeftRight, CalendarDays, Check, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api'
import {
  dayWithDate,
  employeeCacheKeys,
  hhmm,
  usePublishedSchedule,
  useMySwaps,
} from '@/lib/hooks'
import { levelStyle } from '@/lib/levels'
import { cn } from '@/lib/utils'
import type { Shift } from '@/lib/types'
import { useAuth } from './auth-provider'
import { Card, EmptyState, Loading, SectionHeader, StatCard } from './primitives'
import { DropReasonDialog } from './drop-reason-dialog'
import { SwapPickerDialog } from './swap-picker-dialog'

export function MyShiftsView() {
  const { user } = useAuth()
  const { mutate } = useSWRConfig()
  const { schedules, schedule, weekStart, setWeekStart, shifts, names, loading } =
    usePublishedSchedule()
  const { data: swaps } = useMySwaps()

  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dropShift, setDropShift] = useState<Shift | null>(null)
  const [swapShift, setSwapShift] = useState<Shift | null>(null)

  const myShifts = useMemo(
    () =>
      shifts
        .filter((s) => s.employee_id === user?.id)
        .sort((a, b) =>
          (a.on_date + a.start_time).localeCompare(b.on_date + b.start_time),
        ),
    [shifts, user],
  )

  const totalHours = myShifts.reduce((sum, s) => sum + s.hours, 0)

  // coworkers asking me to take their shift
  const incoming = (swaps ?? []).filter(
    (s) => s.target_employee_id === user?.id && s.status === 'pending_coworker',
  )

  // shifts I've already got an active request on — can't request twice
  const activeRequestShiftIds = new Set(
    (swaps ?? [])
      .filter(
        (s) =>
          s.requesting_employee_id === user?.id &&
          ['open', 'pending_coworker', 'pending_manager'].includes(s.status),
      )
      .map((s) => s.shift_id),
  )

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

  async function refresh() {
    // Must include the shifts key — without it an approved swap left the
    // other person's shift list stale, so their new shift never appeared.
    await Promise.all(
      employeeCacheKeys(schedule?.id).map((k) => mutate(k)),
    )
  }

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
      await refresh()
      setNotice(ok)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={schedules.length ? `Week of ${weekStart}` : 'No schedule yet'}
        title="My Shifts"
        description="Your published shifts for the week. Drop a shift to the pool, or swap it with a coworker."
        action={
          schedules.length > 1 ? (
            <select
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {schedules.map((s) => (
                <option key={s.id} value={s.week_start}>
                  Week of {dayWithDate(s.week_start)}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

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

      {/* Incoming swap requests — highlighted distinctly */}
      {incoming.length > 0 && (
        <div className="space-y-2">
          {incoming.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-sm text-sky-100">
                  <ArrowLeftRight className="mt-0.5 size-4 shrink-0 text-sky-300" />
                  <span>
                    <strong>{nameOf(s.requesting_employee_id)}</strong> wants to
                    swap shifts — you&apos;d take {shiftLabel(s.shift_id)}
                    {s.target_shift_id && (
                      <>, and they take your {shiftLabel(s.target_shift_id)}</>
                    )}
                  </span>
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => api.acceptSwap(s.id),
                        'Accepted — pending manager approval.',
                      )
                    }
                  >
                    <Check className="size-3.5" />
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => run(() => api.declineSwap(s.id), 'Declined.')}
                  >
                    <X className="size-3.5" />
                    Decline
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {schedules.length === 0 ? (
        <EmptyState message="No published schedules yet. Check back once your manager posts one." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Shifts this week"
              value={myShifts.length}
              icon={CalendarDays}
              tone="gold"
            />
            <StatCard
              label="Scheduled hours"
              value={`${totalHours.toFixed(2)}h`}
              icon={Clock}
            />
            <StatCard
              label="Desired range"
              value={`${user?.desired_hours_min ?? '—'}–${user?.desired_hours_max ?? '—'}h`}
              hint="Set on the Availability tab"
            />
          </div>

          {myShifts.length === 0 ? (
            <EmptyState message="You're not scheduled this week." />
          ) : (
            <div className="space-y-3">
              {myShifts.map((s) => {
                const ls = levelStyle(user?.skill_level)
                const hasRequest = activeRequestShiftIds.has(s.id)
                return (
                  <Card
                    key={s.id}
                    className={cn(
                      'border-l-4',
                      s.was_swapped
                        ? 'border-l-amber-400'
                        : ls.block.split(' ')[0].replace('border-', 'border-l-'),
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-display text-lg font-semibold">
                          {dayWithDate(s.on_date)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {hhmm(s.start_time)} – {hhmm(s.end_time)} · {s.hours}h
                          {s.is_close && ' · closing'}
                          {s.was_swapped && (
                            <span className="ml-2 text-amber-300">swapped</span>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {hasRequest ? (
                          <span className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary">
                            Request pending
                          </span>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDropShift(s)}
                            >
                              Drop
                            </Button>
                            <Button size="sm" onClick={() => setSwapShift(s)}>
                              Swap
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Drop releases the shift to the pool for anyone to claim. Swap trades
            it with a specific coworker working that day. Both need manager
            approval.
          </p>
        </>
      )}

      {dropShift && (
        <DropReasonDialog
          shiftLabel={`${dayWithDate(dropShift.on_date)} ${hhmm(dropShift.start_time)}–${hhmm(dropShift.end_time)}`}
          onConfirm={async (reason) => {
            await run(
              () => api.createSwap(dropShift.id, null, null, reason),
              'Shift dropped to the pool — a coworker can claim it, then your manager approves.',
            )
            setDropShift(null)
          }}
          onCancel={() => setDropShift(null)}
        />
      )}

      {swapShift && (
        <SwapPickerDialog
          myShift={swapShift}
          dayShifts={shifts.filter((s) => s.on_date === swapShift.on_date)}
          names={names}
          onConfirm={async (targetShiftId, reason) => {
            await run(
              () => api.createSwap(swapShift.id, null, targetShiftId, reason),
              'Swap requested — your coworker will be asked to accept, then your manager approves.',
            )
            setSwapShift(null)
          }}
          onCancel={() => setSwapShift(null)}
        />
      )}
    </div>
  )
}
