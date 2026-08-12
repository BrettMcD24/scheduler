'use client'

import {
  CalendarClock,
  CalendarDays,
  CalendarOff,
  Clock4,
  LogOut,
  Repeat,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from './primitives'
import { useAuth } from './auth-provider'
import { useMySwaps } from '@/lib/hooks'

export type EmployeeSectionKey =
  | 'my-shifts'
  | 'schedule'
  | 'swaps'
  | 'time-off'
  | 'availability'

export function EmployeeSidebar({
  active,
  onSelect,
}: {
  active: EmployeeSectionKey
  onSelect: (key: EmployeeSectionKey) => void
}) {
  const { user, logout } = useAuth()
  const { data: swaps } = useMySwaps()

  // things needing my attention: coworkers asking me to take a shift
  const incoming =
    swaps?.filter(
      (s) => s.target_employee_id === user?.id && s.status === 'pending_coworker',
    ).length ?? 0

  const nav: {
    key: EmployeeSectionKey
    label: string
    icon: React.ComponentType<{ className?: string }>
    badge?: number
  }[] = [
    { key: 'my-shifts', label: 'My Shifts', icon: CalendarDays, badge: incoming || undefined },
    { key: 'schedule', label: 'Store Schedule', icon: Users },
    { key: 'swaps', label: 'Swaps and Drops', icon: Repeat },
    { key: 'time-off', label: 'Time Off', icon: CalendarOff },
    { key: 'availability', label: 'Availability', icon: Clock4 },
  ]

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CalendarClock className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-base font-semibold tracking-tight text-sidebar-foreground">
            Ted&apos;s
          </p>
          <p className="text-[0.7rem] tracking-[0.18em] text-primary uppercase">
            My Schedule
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        <p className="px-3 pt-3 pb-2 text-[0.7rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Crew
        </p>
        {nav.map((item) => {
          const isActive = active === item.key
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              )}
            >
              {isActive && (
                <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-primary" />
              )}
              <Icon className="size-[1.15rem]" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-[0.7rem] font-semibold text-destructive-foreground">
                  {item.badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="m-3 flex items-center gap-3 rounded-xl border border-sidebar-border bg-card/60 p-3">
        <Avatar
          name={user ? `${user.first_name} ${user.last_name}` : '—'}
          size="sm"
          level={user?.skill_level}
        />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {user ? `${user.first_name} ${user.last_name}` : '—'}
          </p>
          <p className="truncate text-xs text-muted-foreground">Crew</p>
        </div>
        <button
          type="button"
          onClick={logout}
          aria-label="Sign out"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  )
}
