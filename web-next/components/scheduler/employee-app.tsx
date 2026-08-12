'use client'

import { useState } from 'react'
import { Bell, Search } from 'lucide-react'
import { EmployeeSidebar, type EmployeeSectionKey } from './employee-sidebar'
import { MyShiftsView } from './my-shifts-view'
import { StoreScheduleView } from './store-schedule-view'
import { EmployeeSwapsView } from './employee-swaps-view'
import { TimeOffView } from './time-off-view'
import { AvailabilityView } from './availability-view'
import { useAuth } from './auth-provider'
import { useMySwaps } from '@/lib/hooks'

const labels: Record<EmployeeSectionKey, string> = {
  'my-shifts': 'My Shifts',
  schedule: 'Store Schedule',
  swaps: 'Swaps and Drops',
  'time-off': 'Time Off',
  availability: 'Availability',
}

export function EmployeeApp() {
  const { user } = useAuth()
  const [active, setActive] = useState<EmployeeSectionKey>('my-shifts')
  const { data: swaps } = useMySwaps()

  const incoming =
    swaps?.filter(
      (s) => s.target_employee_id === user?.id && s.status === 'pending_coworker',
    ).length ?? 0

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <EmployeeSidebar active={active} onSelect={setActive} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <select
              value={active}
              onChange={(e) => setActive(e.target.value as EmployeeSectionKey)}
              aria-label="Select section"
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium lg:hidden"
            >
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <p className="hidden text-sm text-muted-foreground lg:block">
              {labels[active]}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                aria-label={`${incoming} swap requests need your response`}
                onClick={() => setActive('swaps')}
                className="relative flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
              >
                <Bell className="size-[1.1rem]" />
                {incoming > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] font-semibold text-destructive-foreground ring-2 ring-card">
                    {incoming}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {active === 'my-shifts' && <MyShiftsView />}
          {active === 'schedule' && <StoreScheduleView />}
          {active === 'swaps' && <EmployeeSwapsView />}
          {active === 'time-off' && <TimeOffView />}
          {active === 'availability' && <AvailabilityView />}
        </main>
      </div>
    </div>
  )
}
