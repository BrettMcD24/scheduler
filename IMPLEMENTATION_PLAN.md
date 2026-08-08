# Implementation Plan — Next Session

A batch of features requested 2026-06-13, organized into logical groups with
the files each touches and the suggested build order. Tackle top to bottom;
each group is independently shippable.

---

## GROUP A — Labor & staffing metrics (builder display)

Single-number metrics shown on the Schedule Builder.

### A1. Total labor used in a day
- **What:** one number = sum of all assigned shift hours for the active day
  (managers + employees, since they're all scheduled now).
- **Where:** Builder, in/near the "Staffing" card.
- **Backend:** validation response already returns `weekly_hours` per employee;
  for per-day, either compute client-side from `dayShifts` (simplest — sum
  `s.hours`) or add a `daily_labor` map to `validate_schedule`. Recommend
  client-side: `dayShifts.reduce((sum,s)=>sum+s.hours,0)`.
- **Files:** `web/src/pages/Builder.tsx`.

### A2. Lunch / dinner head counts (single numbers)
- **Definitions:** lunch = working any time in 11:00–16:00; dinner = working
  any time in 16:00–close (4-C). "Working lunch" = shift overlaps the window.
- **What:** two numbers, e.g. "Lunch: 6  Dinner: 5" for the active day.
- **Logic:** count distinct assigned employees whose [start,end] overlaps the
  window. Overlap test: `start < windowEnd && end > windowStart`.
- **Where:** Builder staffing card, beside openers/closers.
- **Files:** `web/src/pages/Builder.tsx` (client-side calc), or extend
  `DayStaffing` in `app/shift_rules.py` to include `lunch`/`dinner` counts so
  it's reusable. Recommend backend so the numbers are authoritative — add
  `lunch: int` and `dinner: int` to `DayStaffing` and compute in the per-day
  loop using overlap against `store` window constants (add `lunch_start=11:00`,
  `lunch_end=16:00`, `dinner_start=16:00` to the Store model or hardcode).

### A3. Running weekly labor column
- **What:** total labor hours for the WEEK, updating as each day is scheduled.
  Show per-day subtotals and a week total (a small column/table).
- **Logic:** sum hours grouped by date across all shifts in the schedule.
- **Where:** Builder — a compact "Week labor" card (right rail or above tabs):
  rows = Mon..Sun with each day's hours, plus a bold "Week total".
- **Files:** `web/src/pages/Builder.tsx`. Data already available from `shifts`
  state — no backend change needed (`sum s.hours` grouped by `on_date`).

---

## GROUP B — Swap UX overhaul (the big one)

### B1. Default-visible name + level on grid bars
- **What:** the employee name + level currently show only when a bar is
  clicked. Make them show by DEFAULT in each column's bar (click can still
  toggle extra detail if wanted, but name/level always visible).
- **Files:** `web/src/components/DayGrid.tsx` — move name/level out of the
  `selectedId` conditional so they always render; keep the bar tall enough or
  shrink font. Watch short shifts (small height) — may need `min-height` or
  truncate.

### B2. Split "Drop" and "Swap" into distinct actions
- **Drop:** (keep as-is) releases shift to the trade pool — `createSwap(shiftId, null)`.
- **Swap:** NEW flow. When clicked for a shift, show a picker of EVERY employee
  working that same day, listing each name + their assigned shift time. Manager
  picks one → creates a targeted swap (`createSwap(shiftId, targetId)`).
- **Where:** `MyShifts.tsx` (two buttons), and a new modal/component
  `SwapPickerModal.tsx` that takes the day's shifts + names.
- **Data:** the picker needs everyone working that day — from the same
  published schedule's shifts filtered to `on_date`. Already available via the
  `usePublishedSchedule` hook.
- **Files:** `web/src/pages/employee/MyShifts.tsx`, new
  `web/src/components/SwapPickerModal.tsx`, maybe `Swaps.tsx` reuse.

### B3. Two-sided swap semantics
- **What:** a targeted swap is a TRADE — Jake gives his shift to Ethan AND
  takes Ethan's shift on that day. Current backend only reassigns ONE shift
  (the requester's) to the target. Needs extension.
- **Backend change (important):** `SwapRequest` needs to reference BOTH shifts —
  add `target_shift_id` (the coworker's shift the requester will take). On
  approve, swap the `employee_id` on both shifts.
  - Model: add `target_shift_id: int | None` to `SwapRequest`
    (`app/models.py`).
  - `POST /swaps`: accept optional `target_shift_id`.
  - approve handler (`app/routers/swaps.py`): if `target_shift_id` set, swap
    employees on both shifts; else current single-shift behavior (pool drops).
- **Message copy:** "[Requester] wants you to take [their shift], and they take
  your [your shift]." Build this string from both shifts.
- **Files:** `app/models.py` (migration: drop/recreate dev DB or add column),
  `app/schemas.py` (`SwapCreateIn.target_shift_id`, `SwapOut.target_shift_id`),
  `app/routers/swaps.py` (create + approve logic), `web/src/lib/api.ts`,
  `web/src/lib/types.ts`, employee Swaps UI.

### B4. Manager "View Request" detail
- **What:** in Approvals, each pending swap gets a "View Request" expander
  showing BOTH employees stacked vertically, each with their ORIGINAL shift
  (struck through) and their NEW shift (what they'd work if approved).
- **Files:** `web/src/pages/Approvals.tsx` — needs both shifts' data; fetch the
  schedule's shifts or include shift times in `SwapOut` (recommend adding
  `requesting_shift` and `target_shift` summary objects to `SwapOut`, or a
  dedicated `GET /swaps/{id}` detail endpoint that returns both shift records).
- **Backend:** add a swap-detail endpoint or enrich `SwapOut`.

### B5. Swapped shifts highlighted on the schedule (yellow)
- **What:** once a swap is approved, the affected shifts show a yellow highlight
  on the builder grid + list for the new assignees.
- **Approach:** add a `was_swapped: bool` (or `swapped_at` timestamp) to `Shift`,
  set true on both shifts when a swap is approved. Frontend renders yellow
  border/background when true.
- **Files:** `app/models.py` (Shift field), `app/routers/swaps.py` (set on
  approve), `web/src/lib/types.ts`, `DayGrid.tsx` + Builder list view.

### B6. Notes section listing swapped shifts
- **What:** a running notes list of approved swaps (who↔who, which shifts, when).
- **Source:** the `AuditLog` already records `swap_approved` actions — expose a
  `GET /swaps?status=approved` (exists) or read audit log. Recommend a simple
  approved-swaps list.
- **Where:** Builder (a "Swap notes" card) and/or Approvals history (see C1).

---

## GROUP C — Manager dashboard additions

### C1. Swap request history
- **What:** dashboard section listing past swap requests + their outcome
  (approved / denied), with names and shifts.
- **Backend:** `GET /swaps` already returns all store swaps for a manager;
  filter client-side to decided ones (`approved`/`denied`).
- **Files:** `web/src/pages/Dashboard.tsx` or new `SwapHistory.tsx`,
  add nav entry in `Layout.tsx`.

### C2. Call-offs (NEW feature)
- **What:** when an employee calls in unable to work, the manager creates a
  call-off ticket: employee + their shift (date/time) + reason. Logged so
  managers can track and apply disciplinary action.
- **New entity `CallOff`:** id, employee_id, shift_id (nullable — may not map to
  a specific shift), on_date, shift_label (free text fallback), reason,
  created_by (manager), created_at.
- **Backend:** new model + router `app/routers/call_offs.py`
  (`POST /call-offs`, `GET /call-offs` store-scoped, maybe `DELETE`).
  Register in `app/main.py`.
- **Frontend:** dashboard "Call-offs" section — form (pick employee, pick their
  shift or enter date/time, reason) + list of logged call-offs.
- **Files:** `app/models.py`, `app/schemas.py`, `app/routers/call_offs.py`,
  `app/main.py`, `web/src/lib/api.ts`, `web/src/lib/types.ts`,
  `web/src/pages/Dashboard.tsx` (or new `CallOffs.tsx` + nav entry).

---

## Suggested build order (by dependency + value)

1. **A1–A3 labor metrics** — pure frontend (+ optional small backend for B2
   counts). Quick wins, no schema changes. Good warm-up.
2. **B1 default name/level on bars** — tiny frontend change.
3. **B5 + B6 swap highlight & notes** — small schema add (`Shift.was_swapped`),
   sets up the visual feedback.
4. **B2 lunch/dinner counts** — if doing backend version, small `DayStaffing`
   change.
5. **C2 call-offs** — self-contained new feature, no entanglement with swaps.
6. **B3 two-sided swap** — the meatiest; touches model, schemas, routers, and
   UI. Do when fresh. Requires dev DB reset (delete teds.db, re-seed).
7. **B2/B4 swap detail + View Request** — depends on B3's two-shift model.
8. **C1 swap history** — depends on B3/B4 data being in place.

## Important notes / gotchas
- **DB schema changes** (B3, B5, C2): the app uses `Base.metadata.create_all`
  with no migrations, so adding columns/tables means **delete `teds.db` and
  re-run `python seed.py`** to pick them up. Fine for dev; add Alembic before
  production.
- After any backend model change, update `app/schemas.py` AND the matching
  `web/src/lib/types.ts` so the frontend contract stays in sync.
- Keep using the verified test pattern: spin up uvicorn on a test port, drive
  the new endpoints with httpx, assert the round-trip before wiring UI.
- Test scenario to validate the two-sided swap end to end:
  **swap Jake Pearson (12-8) with Ethan Bauer (4-C)** — after approval, Jake
  should hold 4-C and Ethan should hold 12-8, both highlighted yellow, and a
  swap note logged.
