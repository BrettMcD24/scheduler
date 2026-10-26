'use client'

import { Search, Bell, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SectionKey } from './sidebar'
import { useCallOffs, useSwaps, useTimeOff } from '@/lib/hooks'

const labels: Record<SectionKey, string> = {
  dashboard: 'Dashboard',
  employees: 'Employees',
  approvals: 'Approvals',
  calloffs: 'Call-offs',
  swaps: 'Shift Swap History',
  'school-breaks': 'Non-School Dates',
  export: 'Print & Export',
}

export function Topbar({
  active,
  onSelect,
  query,
  onQueryChange,
  onNewShift,
}: {
  active: SectionKey
  onSelect: (key: SectionKey) => void
  query: string
  onQueryChange: (q: string) => void
  onNewShift: () => void
}) {
  const { data: pendingSwaps } = useSwaps('pending_manager')
  const { data: pendingTimeOff } = useTimeOff('pending')
  const { data: callOffs } = useCallOffs()

  const alerts =
    (pendingSwaps?.length ?? 0) +
    (pendingTimeOff?.length ?? 0) +
    (callOffs?.length ?? 0)

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <select
          value={active}
          onChange={(e) => onSelect(e.target.value as SectionKey)}
          aria-label="Select section"
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground lg:hidden"
        >
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <div className="relative hidden max-w-sm flex-1 items-center md:flex">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search employees, shifts, requests…"
            className="w-full rounded-lg border border-border bg-card py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label={`Notifications: ${alerts} items need attention`}
            onClick={() => onSelect('approvals')}
            className="relative flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            <Bell className="size-[1.1rem]" />
            {alerts > 0 && (
              <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] font-semibold text-destructive-foreground ring-2 ring-card">
                {alerts}
              </span>
            )}
          </button>
          <Button size="lg" className="gap-1.5" onClick={onNewShift}>
            <Plus className="size-4" />
            New Shift
          </Button>
        </div>
      </div>
    </header>
  )
}
