// Single source of truth for talking to the FastAPI backend.
// Every screen calls these functions, never fetch() directly.
// When the backend URL changes (e.g. after deploying), update API_BASE only.

import type {
  AvailabilityRow,
  AvailableResponse,
  CallOff,
  Schedule,
  Shift,
  Store,
  SwapDetail,
  SwapRequest,
  TimeOffRequest,
  User,
  ValidationResult,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

const TOKEN_KEY = "teds_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = typeof data.detail === "string" ? data.detail : detail;
    } catch {
      // body wasn't JSON; keep statusText
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // --- auth ---
  login: (email: string, password: string) =>
    request<{ access_token: string }>("POST", "/auth/login", {
      email,
      password,
    }),
  me: () => request<User>("GET", "/auth/me"),

  // --- stores ---
  listStores: () => request<Store[]>("GET", "/stores"),
  getStore: (id: number) => request<Store>("GET", `/stores/${id}`),

  // --- employees ---
  listEmployees: (storeId?: number) =>
    request<User[]>(
      "GET",
      `/employees${storeId ? `?store_id=${storeId}` : ""}`,
    ),

  // --- schedules ---
  listSchedules: (storeId?: number) =>
    request<Schedule[]>(
      "GET",
      `/schedules${storeId ? `?store_id=${storeId}` : ""}`,
    ),
  createSchedule: (storeId: number, weekStart: string) =>
    request<Schedule>("POST", "/schedules", {
      store_id: storeId,
      week_start: weekStart,
    }),
  listShifts: (scheduleId: number) =>
    request<Shift[]>("GET", `/schedules/${scheduleId}/shifts`),
  addShift: (
    scheduleId: number,
    payload: {
      employee_id?: number | null;
      on_date: string;
      code?: string;
      start_time?: string;
      end_time?: string;
      position?: string;
      notes?: string;
      is_manager_shift?: boolean;
    },
  ) => request<Shift>("POST", `/schedules/${scheduleId}/shifts`, payload),
  updateShift: (
    shiftId: number,
    payload: Partial<{
      employee_id: number | null;
      start_time: string;
      end_time: string;
      position: string;
      notes: string;
    }>,
  ) => request<Shift>("PATCH", `/schedules/shifts/${shiftId}`, payload),
  deleteShift: (shiftId: number) =>
    request<{ deleted: number }>("DELETE", `/schedules/shifts/${shiftId}`),
  validateSchedule: (scheduleId: number) =>
    request<ValidationResult>("GET", `/schedules/${scheduleId}/validate`),
  publishSchedule: (scheduleId: number) =>
    request<Schedule>("POST", `/schedules/${scheduleId}/publish`),
  availableOnDay: (scheduleId: number, onDate: string) =>
    request<AvailableResponse>(
      "GET",
      `/schedules/${scheduleId}/available?on_date=${onDate}`,
    ),

  // --- swaps ---
  listSwaps: (status?: string) =>
    request<SwapRequest[]>(
      "GET",
      `/swaps${status ? `?status=${status}` : ""}`,
    ),
  createSwap: (
    shiftId: number,
    targetEmployeeId: number | null,
    targetShiftId: number | null = null,
    dropReason = "",
  ) =>
    request<SwapRequest>("POST", "/swaps", {
      shift_id: shiftId,
      target_employee_id: targetEmployeeId,
      target_shift_id: targetShiftId,
      drop_reason: dropReason,
    }),
  swapDetail: (id: number) =>
    request<SwapDetail>("GET", `/swaps/${id}/detail`),
  acceptSwap: (id: number) =>
    request<SwapRequest>("POST", `/swaps/${id}/accept`),
  declineSwap: (id: number) =>
    request<SwapRequest>("POST", `/swaps/${id}/decline`),
  cancelSwap: (id: number) =>
    request<SwapRequest>("POST", `/swaps/${id}/cancel`),
  claimSwap: (id: number) =>
    request<SwapRequest>("POST", `/swaps/${id}/claim`),
  approveSwap: (id: number, note = "") =>
    request<SwapRequest>("POST", `/swaps/${id}/approve`, { note }),
  denySwap: (id: number, note = "") =>
    request<SwapRequest>("POST", `/swaps/${id}/deny`, { note }),

  // --- time off ---
  listTimeOff: (status?: string) =>
    request<TimeOffRequest[]>(
      "GET",
      `/time-off${status ? `?status=${status}` : ""}`,
    ),
  createTimeOff: (startDate: string, endDate: string, reason: string) =>
    request<TimeOffRequest>("POST", "/time-off", {
      start_date: startDate,
      end_date: endDate,
      reason,
    }),
  cancelTimeOff: (id: number) =>
    request<TimeOffRequest>("POST", `/time-off/${id}/cancel`),
  approveTimeOff: (id: number, note = "") =>
    request<TimeOffRequest>("POST", `/time-off/${id}/approve`, { note }),
  denyTimeOff: (id: number, note = "") =>
    request<TimeOffRequest>("POST", `/time-off/${id}/deny`, { note }),

  // --- availability ---
  getWindows: (employeeId: number) =>
    request<AvailabilityRow[]>("GET", `/availability/${employeeId}/windows`),
  setWindows: (
    employeeId: number,
    windows: { day_of_week: number; start_time: string; end_time: string }[],
  ) => request<AvailabilityRow[]>("PUT", `/availability/${employeeId}/windows`, windows),
  setDesiredHours: (min: number, max: number) =>
    request<User>("PUT", "/employees/me/desired-hours", {
      desired_hours_min: min,
      desired_hours_max: max,
    }),

  // --- call-offs ---
  listCallOffs: () => request<CallOff[]>("GET", "/call-offs"),
  createCallOff: (payload: {
    employee_id: number;
    shift_id?: number | null;
    on_date: string;
    shift_label?: string;
    reason?: string;
  }) => request<CallOff>("POST", "/call-offs", payload),
  deleteCallOff: (id: number) =>
    request<{ deleted: number }>("DELETE", `/call-offs/${id}`),
};
