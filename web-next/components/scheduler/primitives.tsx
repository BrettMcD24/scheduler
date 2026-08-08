import { cn } from '@/lib/utils'
import { initials } from '@/lib/types'
import { levelStyle } from '@/lib/levels'

/* ---------------- Avatar ---------------- */

export function Avatar({
  name,
  size = 'md',
  level,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  /** When provided, the ring takes the skill-level color. */
  level?: number | null
}) {
  const dims =
    size === 'sm' ? 'size-8 text-[0.7rem]' : size === 'lg' ? 'size-12 text-sm' : 'size-10 text-xs'
  const ls = levelStyle(level)
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border font-semibold',
        dims,
        level ? ls.chip : 'border-border bg-secondary text-muted-foreground',
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}

/* ---------------- Badge ---------------- */

const tones = {
  gold: 'border-primary/35 bg-primary/12 text-primary',
  green: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300',
  red: 'border-destructive/35 bg-destructive/12 text-destructive',
  neutral: 'border-border bg-secondary text-muted-foreground',
  blue: 'border-sky-500/30 bg-sky-500/12 text-sky-300',
} as const

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: keyof typeof tones
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ---------------- Level chip ---------------- */

export function LevelChip({
  level,
  className,
}: {
  level: number | null | undefined
  className?: string
}) {
  const ls = levelStyle(level)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[0.65rem] font-semibold',
        ls.chip,
        className,
      )}
      title={level ? `Skill level ${level}` : 'No level set'}
    >
      {ls.label}
    </span>
  )
}

/* ---------------- Card ---------------- */

export function Card({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ---------------- SectionHeader ---------------- */

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[0.7rem] font-semibold tracking-[0.16em] text-primary uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

/* ---------------- Stat card ---------------- */

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: React.ComponentType<{ className?: string }>
  tone?: 'gold' | 'danger' | 'default'
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <p
        className={cn(
          'font-display mt-2 text-3xl font-semibold tracking-tight',
          tone === 'gold' && 'text-primary',
          tone === 'danger' && 'text-destructive',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/* ---------------- Empty / loading ---------------- */

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="p-8 text-center text-sm text-muted-foreground">{label}</div>
  )
}
