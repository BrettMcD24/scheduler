// Types mirroring the FastAPI backend schemas.

export type Role = "super_admin" | "manager" | "employee";

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: Role;
  store_id: number | null;
  dob: string | null;
  skill_level: number | null;
  desired_hours_min: number | null;
  desired_hours_max: number | null;
  is_active: boolean;
}

export interface Store {
  id: number;
  name: string;
  address: string;
  state: "NY" | "AZ";
  timezone: string;
  open_time: string;
  close_time: string;
  closer_end_time: string;
  min_openers: number;
  min_closers: number;
  opener_cutoff: string;
}

export type ScheduleStatus = "draft" | "published";

export interface Schedule {
  id: number;
  store_id: number;
  week_start: string;
  status: ScheduleStatus;
  created_by: number;
  published_at: string | null;
}

export interface Shift {
  id: number;
  schedule_id: number;
  employee_id: number | null;
  on_date: string;
  start_time: string;
  end_time: string;
  is_close: boolean;
  position: string;
  notes: string;
  is_manager_shift: boolean;
  was_swapped: boolean;
  hours: number;
}

export interface AvailabilityWindow {
  start: string;
  end: string;
}

export interface AvailabilityRow {
  id: number;
  employee_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface AvailableEmployee {
  employee_id: number;
  name: string;
  skill_level: number | null;
  is_manager: boolean;
  age: number | null;
  windows: AvailabilityWindow[];
  hours_this_week: number;
  desired_hours_min: number | null;
  desired_hours_max: number | null;
  on_time_off: boolean;
  can_schedule: boolean;
  flags: string[];
}

export interface AvailableResponse {
  date: string;
  employees: AvailableEmployee[];
}

export interface ValidationItem {
  severity: "warning" | "violation";
  code: string;
  message: string;
  employee_id: number | null;
  on_date: string | null;
}

export interface DayStaffing {
  on_date: string;
  openers: number;
  closers: number;
  min_openers: number;
  min_closers: number;
  openers_met: boolean;
  closers_met: boolean;
  lunch: number;
  dinner: number;
  daily_labor: number;
}

export interface ValidationResult {
  schedule_id: number;
  violations: ValidationItem[];
  warnings: ValidationItem[];
  staffing: DayStaffing[];
  weekly_hours: Record<string, number>;
}

export interface SwapRequest {
  id: number;
  shift_id: number;
  requesting_employee_id: number;
  target_employee_id: number | null;
  target_shift_id: number | null;
  status: string;
  manager_note: string;
  created_at: string;
  coworker_accepted_at: string | null;
  decided_at: string | null;
}

export interface ShiftSummary {
  id: number;
  on_date: string;
  start_time: string;
  end_time: string;
  is_close: boolean;
}

export interface SwapDetail {
  id: number;
  status: string;
  requesting_employee_id: number;
  requesting_employee_name: string;
  target_employee_id: number | null;
  target_employee_name: string | null;
  requesting_shift: ShiftSummary | null;
  target_shift: ShiftSummary | null;
  manager_note: string;
  drop_reason: string;
  created_at: string;
  decided_at: string | null;
}

export interface CallOff {
  id: number;
  store_id: number;
  employee_id: number;
  employee_name: string | null;
  shift_id: number | null;
  on_date: string;
  shift_label: string;
  reason: string;
  created_at: string;
}

export interface TimeOffRequest {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  manager_note: string;
  created_at: string;
}
