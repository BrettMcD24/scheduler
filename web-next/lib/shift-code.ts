// Renders a shift back into the paper-schedule code the store already uses
// ("8-4", "1130-8", "2-C", "730-430"). This is the inverse of
// parse_shift_code() in app/shift_rules.py — keep the two in step.

import type { Shift } from './types'

/** "07:30:00" -> "730", "08:00:00" -> "8", "12:00:00" -> "NOON" */
function clockToken(t: string): string {
  const [h, m] = t.split(':').map(Number)
  if (h === 12 && m === 0) return 'NOON'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}` : `${h12}${String(m).padStart(2, '0')}`
}

/** A shift as the paper code: "8-4", "1130-8", "2-C". */
export function shiftCode(s: Pick<Shift, 'start_time' | 'end_time' | 'is_close'>) {
  const start = clockToken(s.start_time)
  return s.is_close ? `${start}-C` : `${start}-${clockToken(s.end_time)}`
}

/** What goes in an empty cell. The paper sheet uses X for a normal day off
 * and R/O for an approved request-off, which managers read differently. */
export const OFF = 'X'
export const REQUESTED_OFF = 'R/O'
