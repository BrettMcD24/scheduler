// Single source of truth for the 4 position certifications, mirroring the
// order they're mastered in: dressing, cashing, frying, cooking last.

import type { Employee } from './types'

export type SkillKey = 'dressing' | 'cashing' | 'frying' | 'cooking'

export type SkillMeta = {
  key: SkillKey
  label: string
  abbr: string
  employeeField: `skill_${SkillKey}`
}

export const SKILLS: SkillMeta[] = [
  { key: 'dressing', label: 'Dressing', abbr: 'DR', employeeField: 'skill_dressing' },
  { key: 'cashing', label: 'Cashing', abbr: 'CA', employeeField: 'skill_cashing' },
  { key: 'frying', label: 'Frying', abbr: 'FR', employeeField: 'skill_frying' },
  { key: 'cooking', label: 'Cooking', abbr: 'CK', employeeField: 'skill_cooking' },
]

export function certifiedSkills(emp: Pick<Employee, SkillMeta['employeeField']>): SkillKey[] {
  return SKILLS.filter((s) => emp[s.employeeField]).map((s) => s.key)
}

export function skillLabel(key: SkillKey): string {
  return `Certified ${
    { dressing: 'dressers', cashing: 'cashiers', frying: 'fryers', cooking: 'cooks' }[key]
  }`
}
