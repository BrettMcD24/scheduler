'use client'

import { useState } from 'react'
import { Sidebar, type SectionKey } from './sidebar'
import { Topbar } from './topbar'
import { DashboardView } from './dashboard-view'
import { EmployeesView } from './employees-view'
import { ApprovalsView } from './approvals-view'
import { CallOffsView } from './calloffs-view'
import { SwapsView } from './swaps-view'
import { AuthGate, AuthProvider, useAuth } from './auth-provider'
import { EmployeeApp } from './employee-app'
import { mondayOf } from '@/lib/hooks'
import { EmptyState } from './primitives'
import { cn } from '@/lib/utils'

function Shell() {
  const { user } = useAuth()
  const [active, setActive] = useState<SectionKey>('dashboard')
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [query, setQuery] = useState('')
  const [newShiftNonce, setNewShiftNonce] = useState(0)
  const [collapsed, setCollapsed] = useState(false)

  const isManager = user?.role === 'manager' || user?.role === 'super_admin'
  const storeId = user?.store_id ?? null

  // Employees get their own console entirely.
  if (!isManager) return <EmployeeApp />

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar
        active={active}
        onSelect={setActive}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          active={active}
          onSelect={setActive}
          query={query}
          onQueryChange={setQuery}
          onNewShift={() => {
            setActive('dashboard')
            setNewShiftNonce((n) => n + 1)
          }}
        />
        <main
          className={cn(
            'mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:px-8',
            collapsed ? 'max-w-none' : 'max-w-[1600px]',
          )}
        >
          {storeId === null ? (
            <EmptyState message="Your account isn't linked to a store, so there's no schedule to manage. Admin approval tooling is planned — see NOTES.md." />
          ) : (
            <>
              {active === 'dashboard' && (
                <DashboardView
                  storeId={storeId}
                  weekStart={weekStart}
                  onWeekChange={setWeekStart}
                  query={query}
                  newShiftNonce={newShiftNonce}
                />
              )}
              {active === 'employees' && (
                <EmployeesView storeId={storeId} query={query} />
              )}
              {active === 'approvals' && <ApprovalsView storeId={storeId} />}
              {active === 'calloffs' && <CallOffsView storeId={storeId} />}
              {active === 'swaps' && <SwapsView storeId={storeId} />}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export function SchedulerApp() {
  return (
    <AuthProvider>
      <AuthGate>
        <Shell />
      </AuthGate>
    </AuthProvider>
  )
}
