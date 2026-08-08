import { cn } from '@/lib/utils'
import { SKILLS, type SkillKey } from '@/lib/skills'
import type { Employee } from '@/lib/types'

/** Compact read-only row of the 4 skill abbreviations, dim when not certified. */
export function SkillBadges({
  employee,
  className,
}: {
  employee: Pick<Employee, 'skill_dressing' | 'skill_cashing' | 'skill_frying' | 'skill_cooking'>
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {SKILLS.map((s) => {
        const has = employee[s.employeeField]
        return (
          <span
            key={s.key}
            title={`${s.label}${has ? ' — certified' : ' — not certified'}`}
            className={cn(
              'rounded px-1 py-px text-[0.6rem] font-semibold leading-tight',
              has
                ? 'bg-primary/15 text-primary'
                : 'bg-secondary text-muted-foreground/40',
            )}
          >
            {s.abbr}
          </span>
        )
      })}
    </span>
  )
}

/** Editable variant: click a chip to toggle that skill. */
export function SkillBadgesEditable({
  employee,
  onToggle,
  disabled,
}: {
  employee: Pick<Employee, 'skill_dressing' | 'skill_cashing' | 'skill_frying' | 'skill_cooking'>
  onToggle: (skill: SkillKey, next: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {SKILLS.map((s) => {
        const has = employee[s.employeeField]
        return (
          <button
            key={s.key}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(s.key, !has)}
            title={s.label}
            className={cn(
              'rounded px-1.5 py-0.5 text-[0.65rem] font-semibold transition-colors',
              has
                ? 'bg-primary/15 text-primary border border-primary/35'
                : 'text-muted-foreground hover:bg-secondary border border-transparent',
            )}
          >
            {s.abbr}
          </button>
        )
      })}
    </div>
  )
}
