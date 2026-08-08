// Single source of truth for skill-level (1-5) coloring across the app.
// Levels map to positions at Ted's: cashing, dressing, frying, cooking —
// a level 5 is proficient in all of them.

export type LevelStyle = {
  label: string
  /** Tailwind classes for a filled chip/badge */
  chip: string
  /** Classes for a shift block on the schedule grid */
  block: string
  /** Solid dot / accent */
  dot: string
  /** Raw CSS var for charts or inline use */
  cssVar: string
}

const STYLES: Record<number, LevelStyle> = {
  1: {
    label: 'L1',
    chip: 'bg-sky-500/12 text-sky-300 border-sky-500/30',
    block: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    dot: 'bg-sky-400',
    cssVar: 'var(--lvl1)',
  },
  2: {
    label: 'L2',
    chip: 'bg-teal-500/12 text-teal-300 border-teal-500/30',
    block: 'border-teal-500/30 bg-teal-500/10 text-teal-200',
    dot: 'bg-teal-400',
    cssVar: 'var(--lvl2)',
  },
  3: {
    label: 'L3',
    chip: 'bg-lime-500/12 text-lime-300 border-lime-500/30',
    block: 'border-lime-500/30 bg-lime-500/10 text-lime-200',
    dot: 'bg-lime-400',
    cssVar: 'var(--lvl3)',
  },
  4: {
    label: 'L4',
    chip: 'bg-orange-500/12 text-orange-300 border-orange-500/30',
    block: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
    dot: 'bg-orange-400',
    cssVar: 'var(--lvl4)',
  },
  5: {
    label: 'L5',
    chip: 'bg-primary/15 text-primary border-primary/35',
    block: 'border-primary/35 bg-primary/12 text-primary',
    dot: 'bg-primary',
    cssVar: 'var(--lvl5)',
  },
}

const UNKNOWN: LevelStyle = {
  label: '—',
  chip: 'bg-muted text-muted-foreground border-border',
  block: 'border-border bg-secondary/40 text-muted-foreground',
  dot: 'bg-muted-foreground',
  cssVar: 'var(--muted-foreground)',
}

export function levelStyle(level: number | null | undefined): LevelStyle {
  if (!level) return UNKNOWN
  return STYLES[level] ?? UNKNOWN
}

export const ALL_LEVELS = [1, 2, 3, 4, 5] as const
