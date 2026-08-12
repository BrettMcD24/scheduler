// Single place that talks to the Ted's Scheduler FastAPI backend.
// Every view calls these functions; nothing calls fetch() directly.
//
// NOTE ON DATA FETCHING STRATEGY
// The backend authenticates with a JWT bearer token, which lives in
// localStorage and is therefore unreadable from React Server Components.
// So data fetching is client-side via SWR (see lib/hooks.ts) rather than in
// Server Components. To move to Server Components later, switch the backend
// to an httpOnly cookie session and read it in a server fetch wrapper.

import type {
  AvailabilityRow,
  AvailableEmployee,
  CallOff,
  Employee,
  Schedule,
  Shift,
  Store,
  SwapDetail,
  SwapRequest,
  TimeOffRequest,
  ValidationResult,
} from './types'

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? 'http://127.0.0.1:8000'

const TOKEN_KEY = 'teds_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}
export function setToken(t: string) {
  window.localStorage.setItem(TOKEN_KEY, t)
}
export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') detail = data.detail
    } catch {
      /* non-JSON body */
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  // auth
  login: (email: string, password: string) =>
    request<{ access_token: string }>('POST', '/auth/login', {
      email,
      password,
    }),
  me: () => request<Employee>('GET', '/auth/me'),

  // stores
  listStores: () => request<Store[]>('GET', '/stores'),
  getStore: (id: number) => request<Store>('GET', `/stores/${id}`),

  // employees
  listEmployees: (storeId?: number) =>
    request<Employee[]>(
      'GET',
      `/employees${storeId ? `?store_id=${storeId}` : ''}`,
    ),
  createEmployee: (payload: {
    email: string
    password: string
    first_name: string
    last_name: string
    phone?: string
    role?: string
    store_id?: number | null
    dob?: string | null
    skill_level?: number | null
    desired_hours_min?: number | null
    desired_hours_max?: number | null
  }) => request<Employee>('POST', '/employees', payload),
  updateEmployee: (
    id: number,
    payload: Partial<{
      phone: string
      role: string
      store_id: number | null
      dob: string | null
      skill_level: number | null
      desired_hours_min: number | null
      desired_hours_max: number | null
      is_active: boolean
    }>,
  ) => request<Employee>('PATCH', `/employees/${id}`, payload),

  // schedules
  listSchedules: (storeId?: number) =>
    request<Schedule[]>(
      'GET',
      `/schedules${storeId ? `?store_id=${storeId}` : ''}`,
    ),
  createSchedule: (storeId: number, weekStart: string) =>
    request<Schedule>('POST', '/schedules', {
      store_id: storeId,
      week_start: weekStart,
    }),
  listShifts: (scheduleId: number) =>
    request<Shift[]>('GET', `/schedules/${scheduleId}/shifts`),
  addShift: (
    scheduleId: number,
    payload: {
      employee_id?: number | null
      on_date: string
      code?: string
      start_time?: string
      end_time?: string
      position?: string
      notes?: string
      is_manager_shift?: boolean
      override_availability?: boolean
    },
  ) => request<Shift>('POST', `/schedules/${scheduleId}/shifts`, payload),
  updateShift: (
    shiftId: number,
    payload: Partial<{
      employee_id: number | null
      start_time: string
      end_time: string
      position: string
      notes: string
      override_availability: boolean
    }>,
  ) => request<Shift>('PATCH', `/schedules/shifts/${shiftId}`, payload),
  deleteShift: (shiftId: number) =>
    request<{ deleted: number }>('DELETE', `/schedules/shifts/${shiftId}`),
  validateSchedule: (scheduleId: number) =>
    request<ValidationResult>('GET', `/schedules/${scheduleId}/validate`),
  publishSchedule: (scheduleId: number) =>
    request<Schedule>('POST', `/schedules/${scheduleId}/publish`),
  availableOnDay: (scheduleId: number, onDate: string) =>
    request<{ date: string; employees: AvailableEmployee[] }>(
      'GET',
      `/schedules/${scheduleId}/available?on_date=${onDate}`,
    ),

  // swaps
  listSwaps: (status?: string) =>
    request<SwapRequest[]>('GET', `/swaps${status ? `?status=${status}` : ''}`),
  swapDetail: (id: number) => request<SwapDetail>('GET', `/swaps/${id}/detail`),
  createSwap: (
    shiftId: number,
    targetEmployeeId: number | null,
    targetShiftId: number | null = null,
    dropReason = '',
  ) =>
    request<SwapRequest>('POST', '/swaps', {
      shift_id: shiftId,
      target_employee_id: targetEmployeeId,
      target_shift_id: targetShiftId,
      drop_reason: dropReason,
    }),
  claimSwap: (id: number) => request<SwapRequest>('POST', `/swaps/${id}/claim`),
  acceptSwap: (id: number) => request<SwapRequest>('POST', `/swaps/${id}/accept`),
  declineSwap: (id: number) =>
    request<SwapRequest>('POST', `/swaps/${id}/decline`),
  cancelSwap: (id: number) => request<SwapRequest>('POST', `/swaps/${id}/cancel`),
  approveSwap: (id: number, note = '') =>
    request<SwapRequest>('POST', `/swaps/${id}/approve`, { note }),
  denySwap: (id: number, note = '') =>
    request<SwapRequest>('POST', `/swaps/${id}/deny`, { note }),

  // time off
  listTimeOff: (status?: string) =>
    request<TimeOffRequest[]>(
      'GET',
      `/time-off${status ? `?status=${status}` : ''}`,
    ),
  approveTimeOff: (id: number, note = '') =>
    request<TimeOffRequest>('POST', `/time-off/${id}/approve`, { note }),
  denyTimeOff: (id: number, note = '') =>
    request<TimeOffRequest>('POST', `/time-off/${id}/deny`, { note }),
  createTimeOff: (startDate: string, endDate: string, reason: string) =>
    request<TimeOffRequest>('POST', '/time-off', {
      start_date: startDate,
      end_date: endDate,
      reason,
    }),
  cancelTimeOff: (id: number) =>
    request<TimeOffRequest>('POST', `/time-off/${id}/cancel`),

  // availability (employee self-service)
  getWindows: (employeeId: number) =>
    request<AvailabilityRow[]>('GET', `/availability/${employeeId}/windows`),
  setWindows: (
    employeeId: number,
    rows: { day_of_week: number; start_time: string; end_time: string }[],
  ) =>
    request<AvailabilityRow[]>(
      'PUT',
      `/availability/${employeeId}/windows`,
      rows,
    ),
  setDesiredHours: (min: number, max: number) =>
    request<Employee>('PUT', '/employees/me/desired-hours', {
      desired_hours_min: min,
      desired_hours_max: max,
    }),

  // call-offs
  listCallOffs: () => request<CallOff[]>('GET', '/call-offs'),
  createCallOff: (payload: {
    employee_id: number
    shift_id?: number | null
    on_date: string
    shift_label?: string
    reason?: string
  }) => request<CallOff>('POST', '/call-offs', payload),
  deleteCallOff: (id: number) =>
    request<{ deleted: number }>('DELETE', `/call-offs/${id}`),
}
