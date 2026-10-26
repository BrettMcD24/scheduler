'use client'

import { useState } from 'react'
import { useSWRConfig } from 'swr'
import { Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api'
import { SKILLS, type SkillKey } from '@/lib/skills'
import { scheduleForWeek, useSchedules, weekDates, weekLabel } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { Card } from './primitives'

const QUICK_CODES = ['8-4', '11-7', '1130-8', '4-C', '2-C', '8-NOON']

/** Manager posts a shift to the board for anyone qualified to claim. */
export function PostOpenShift({
  storeId,
  weekStart,
}: {
  storeId: number
  weekStart: string
}) {
  const { mutate } = useSWRConfig()
  const { data: schedules } = useSchedules(storeId)
  const schedule = scheduleForWeek(schedules, weekStart)
  const dates = weekDates(weekStart)

  const [open, setOpen] = useState(false)
  const [onDate, setOnDate] = useState(dates[0])
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [skills, setSkills] = useState<SkillKey[]>([])
  const [minLevel, setMinLevel] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function toggle(k: SkillKey) {
    setSkills((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))
  }

  async function submit() {
    if (!schedule) {
      setError('No schedule exists for this week yet — create one first.')
      return
    }
    if (!code.trim()) {
      setError('Add a shift code, e.g. 4-C.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.postOpenShift({
        schedule_id: schedule.id,
        on_date: onDate,
        code: code.trim(),
        message: message.trim(),
        required_skills: skills.join(','),
        min_skill_level: minLevel ? Number(minLevel) : null,
      })
      setCode('')
      setMessage('')
      setSkills([])
      setMinLevel('')
      setOpen(false)
      await Promise.all([
        mutate(['swaps', 'all']),
        mutate(['shifts', schedule.id]),
        mutate(['validate', schedule.id]),
      ])
      setNotice('Posted. Anyone who meets the criteria can claim it.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't post the shift")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Open shift board</h2>
        <Button size="sm" variant={open ? 'ghost' : 'default'} className="gap-1.5"
          onClick={() => setOpen((v) => !v)}>
          <Megaphone className="size-3.5" />
          {open ? 'Cancel' : 'Post a shift'}
        </Button>
      </div>

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

      {open && (
        <Card>
          <p className="mb-3 text-xs text-muted-foreground">
            Week of {weekLabel(weekStart)}. The shift is created unassigned and
            goes on the board — only people meeting the criteria can claim it.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Day</span>
              <select value={onDate} onChange={(e) => setOnDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                    })}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Shift code</span>
              <input value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="4-C"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Message to the team</span>
              <input value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder="Looking for a closer who can dress"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUICK_CODES.map((c) => (
              <Button key={c} size="xs" variant="outline" onClick={() => setCode(c)}>
                {c}
              </Button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">
                Must be certified in
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SKILLS.map((s) => (
                  <button key={s.key} type="button" onClick={() => toggle(s.key)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      skills.includes(s.key)
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Minimum level</span>
              <select value={minLevel} onChange={(e) => setMinLevel(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="">Any</option>
                {[1, 2, 3, 4, 5].map((l) => (
                  <option key={l} value={l}>{l}+</option>
                ))}
              </select>
            </label>
            <Button size="lg" disabled={busy} onClick={submit}>
              {busy ? 'Posting…' : 'Post to board'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
