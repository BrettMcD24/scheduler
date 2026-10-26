// Types mirroring the Ted's Scheduler FastAPI backend.
// These replace the v0 mock contract in lib/scheduler-data.ts.

export type UserRole = 'super_admin' | 'manager' | 'employee'

/** Skill level 1-5. Drives the color ramp across the UI. */
export type SkillLevel = 1 | 2 | 3 | 4 | 5

export type Employee = {
  id: number
  email: string
  first_name: string
  last_name: string
  phone: string
  role: UserRole
  store_id: number | null
  dob: string | null
  skill_level: number | null
  // position certifications; cooking is always the last one mastered
  skill_dressing: boolean
  skill_cashing: boolean
  skill_frying: boolean
  skill_cooking: boolean
  desired_hours_min: number | null
  desired_hours_max: number | null
  is_active: boolean
}

export type Store = {
  id: number
  name: string
  address: string
  state: 'NY' | 'AZ'
  timezone: string
  open_time: string
  close_time: string
  closer_end_time: string
  min_openers: number
  min_closers: number
  opener_cutoff: string
}

export type ScheduleStatus = 'draft' | 'published'

export type Schedule = {
  id: number
  store_id: number
  week_start: string
  status: ScheduleStatus
  created_by: number
  published_at: string | null
}

export type Shift = {
  id: number
  schedule_id: number
  employee_id: number | null
  on_date: string
  start_time: string
  end_time: string
  is_close: boolean
  position: string
  notes: string
  is_manager_shift: boolean
  was_swapped: boolean
  hours: number
}

export type AvailabilityWindow = { start: string; end: string }

export type AvailabilityRow = {
  id: number
  employee_id: number
  day_of_week: number
  start_time: string
  end_time: string
}

export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export type AvailableEmployee = {
  employee_id: number
  name: string
  skill_level: number | null
  is_manager: boolean
  age: number | null
  windows: AvailabilityWindow[]
  hours_this_week: number
  desired_hours_min: number | null
  desired_hours_max: number | null
  on_time_off: boolean
  can_schedule: boolean
  flags: string[]
}

export type EmployeeDayDetail = {
  on_date: string
  windows: AvailabilityWindow[]
  on_time_off: boolean
  scheduled_hours: number
  has_exception: boolean
}

export type EmployeeDetail = {
  employee_id: number
  name: string
  skill_level: number | null
  is_manager: boolean
  age: number | null
  desired_hours_min: number | null
  desired_hours_max: number | null
  scheduled_hours: number
  // real certifications, mirroring the skill_* columns on User
  skill_dressing: boolean
  skill_cashing: boolean
  skill_frying: boolean
  skill_cooking: boolean
  days: EmployeeDayDetail[]
}

export type LevelChange = {
  id: number
  employee_id: number
  employee_name: string | null
  store_id: number
  from_level: number | null
  to_level: number
  reason: string
  status: RequestStatus
  requested_by: number
  requested_by_name: string | null
  admin_note: string
  created_at: string
  decided_at: string | null
}

export type ValidationItem = {
  severity: 'warning' | 'violation'
  code: string
  message: string
  employee_id: number | null
  on_date: string | null
}

export type DayStaffing = {
  on_date: string
  openers: number
  closers: number
  min_openers: number
  min_closers: number
  openers_met: boolean
  closers_met: boolean
  lunch: number
  dinner: number
  daily_labor: number
}

export type ValidationResult = {
  schedule_id: number
  violations: ValidationItem[]
  warnings: ValidationItem[]
  staffing: DayStaffing[]
  weekly_hours: Record<string, number>
}

export type SwapStatus =
  | 'open'
  | 'pending_coworker'
  | 'pending_manager'
  | 'approved'
  | 'denied'
  | 'cancelled'

export type SwapRequest = {
  id: number
  shift_id: number
  requesting_employee_id: number
  target_employee_id: number | null
  target_shift_id: number | null
  status: SwapStatus
  /** manager put this shift on the board for anyone to claim */
  posted_by_manager: boolean
  board_message: string
  /** comma-separated skill keys, e.g. "dressing,frying" */
  required_skills: string
  min_skill_level: number | null
  manager_note: string
  created_at: string
  coworker_accepted_at: string | null
  decided_at: string | null
}

export type ShiftSummary = {
  id: number
  on_date: string
  start_time: string
  end_time: string
  is_close: boolean
}

export type SwapDetail = {
  id: number
  status: SwapStatus
  requesting_employee_id: number
  requesting_employee_name: string
  target_employee_id: number | null
  target_employee_name: string | null
  /** things the manager should weigh before approving (overtime etc.) */
  warnings: string[]
  board_message: string
  required_skills: string
  min_skill_level: number | null
  posted_by_manager: boolean
  requesting_shift: ShiftSummary | null
  target_shift: ShiftSummary | null
  manager_note: string
  drop_reason: string
  created_at: string
  decided_at: string | null
}

export type RequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled'

export type TimeOffRequest = {
  id: number
  employee_id: number
  start_date: string
  end_date: string
  reason: string
  status: RequestStatus
  manager_note: string
  created_at: string
}

export type CallOff = {
  id: number
  store_id: number
  employee_id: number
  employee_name: string | null
  shift_id: number | null
  on_date: string
  shift_label: string
  reason: string
  created_at: string
}

export const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function fullName(e: Employee | null | undefined) {
  return e ? `${e.first_name} ${e.last_name}` : '—'
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** A date range when school is out for the store's area. Selects the
 * NON-SCHOOL tier of minor labor limits — never disables the checks. */
export type SchoolBreak = {
  id: number
  store_id: number
  name: string
  start_date: string
  end_date: string
  created_by: number
  created_by_name: string | null
  created_at: string
}

/** Immutable audit entry. Retained for one year; there is no delete. */
export type AuditEntry = {
  id: number
  entity_type: string
  entity_id: number
  action: string
  actor_id: number | null
  actor_name: string | null
  details: string
  created_at: string
}
