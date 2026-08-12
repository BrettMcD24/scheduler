'use client'

import { useMemo, useState } from 'react'
import { useSWRConfig } from 'swr'
import { Search, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useEmployees } from '@/lib/hooks'
import { ALL_LEVELS, levelStyle } from '@/lib/levels'
import { cn } from '@/lib/utils'
import type { Employee } from '@/lib/types'
import { Avatar, Card, EmptyState, LevelChip, Loading, SectionHeader } from './primitives'

function ageOf(dob: string | null) {
  if (!dob) return null
  const d = new Date(dob)
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
  return a
}

export function EmployeesView({ storeId, query }: { storeId: number; query: string }) {
  const { data: employees, isLoading } = useEmployees(storeId)
  const { mutate } = useSWRConfig()
  const [levelFilter, setLevelFilter] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const roster = useMemo(() => {
    let list = (employees ?? []).filter((e) => e.role !== 'super_admin')
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((e) => `${e.first_name} ${e.last_name}`.toLowerCase().includes(q))
    if (levelFilter) list = list.filter((e) => e.skill_level === levelFilter)
    return [...list].sort((a, b) => (b.skill_level ?? 0) - (a.skill_level ?? 0))
  }, [employees, query, levelFilter])

  async function setLevel(emp: Employee, level: number) {
    setBusyId(emp.id)
    try {
      await api.updateEmployee(emp.id, { skill_level: level })
      await mutate(['employees', storeId])
    } finally {
      setBusyId(null)
    }
  }

  if (isLoading) return <Loading />

  const byLevel = ALL_LEVELS.map((l) => ({
    level: l,
    count: (employees ?? []).filter((e) => e.skill_level === l).length,
  }))

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${roster.length} of ${(employees ?? []).length} shown`}
        title="Employees"
        description="Your store roster, with skill level driving color across the app. Levels map to positions — a level 5 is proficient in all of them."
        action={
          <Button variant="outline" size="lg" className="gap-1.5" disabled title="Adding employees is planned">
            <UserPlus className="size-4" />
            Add Employee
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setLevelFilter(null)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            levelFilter === null ? 'border-primary/40 bg-primary/12 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          All levels
        </button>
        {byLevel.map(({ level, count }) => {
          const ls = levelStyle(level)
          return (
            <button
              key={level}
              type="button"
              onClick={() => setLevelFilter(levelFilter === level ? null : level)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                levelFilter === level ? ls.chip : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <span className={cn('size-2 rounded-full', ls.dot)} />
              Level {level}
              <span className="text-muted-foreground">({count})</span>
            </button>
          )
        })}
      </div>

      {roster.length === 0 ? (
        <EmptyState message="No employees match those filters." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {roster.map((emp) => {
            const age = ageOf(emp.dob)
            const ls = levelStyle(emp.skill_level)
            return (
              <Card key={emp.id} className={cn('border-l-4', ls.block.split(' ')[0])}>
                <div className="flex items-start gap-3">
                  <Avatar name={`${emp.first_name} ${emp.last_name}`} level={emp.skill_level} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{emp.first_name} {emp.last_name}</p>
                      <LevelChip level={emp.skill_level} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {emp.role === 'manager' ? 'Manager' : 'Crew'}
                      {age !== null && ` · ${age}y`}
                      {age !== null && age < 18 && (
                        <span className="ml-1 text-destructive">minor</span>
                      )}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Wants{' '}
                      <span className="text-foreground">
                        {emp.desired_hours_min ?? '—'}–{emp.desired_hours_max ?? '—'}
                      </span>{' '}
                      hrs/wk
                    </p>
                    <div className="mt-3 flex items-center gap-1">
                      <span className="mr-1 text-[0.7rem] text-muted-foreground">Level</span>
                      {ALL_LEVELS.map((l) => (
                        <button
                          key={l}
                          type="button"
                          disabled={busyId === emp.id}
                          onClick={() => setLevel(emp, l)}
                          aria-label={`Set ${emp.first_name} to level ${l}`}
                          className={cn(
                            'size-5 rounded text-[0.65rem] font-semibold transition-colors',
                            emp.skill_level === l
                              ? levelStyle(l).chip + ' border'
                              : 'text-muted-foreground hover:bg-secondary',
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
