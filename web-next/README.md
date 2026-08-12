# Ted's Scheduler — Next.js manager console

The v0-designed manager console, wired to the existing FastAPI backend.
Sits alongside the backend; does not replace the Vite app yet (see "What's
missing" below).

## Run

Backend must be running first (port 8000), and needs the CORS change in
`BACKEND_CHANGES.md`.

```bash
npm install
npm run dev          # http://localhost:3000
```

Sign in with a manager account, e.g. `mgr@teds.com` / `password123`.

To point at a deployed backend, copy `.env.local.example` to `.env.local` and
set `NEXT_PUBLIC_API_BASE`.

## How data flows

- `lib/api.ts` — the only place that calls the backend. JWT bearer token in
  localStorage, same scheme as the Vite app.
- `lib/hooks.ts` — SWR hooks + date helpers.
- `lib/types.ts` — types mirroring the real FastAPI schemas (this replaces the
  v0 mock contract in `lib/scheduler-data.ts`, which is deleted).
- `lib/levels.ts` — **skill-level colour ramp (1–5)**, the single source of
  truth for level colouring everywhere.

### Why SWR and not Server Components

The v0 brief asked for Server Components. The backend authenticates with a JWT
bearer token held in localStorage, which server components cannot read, so
fetching is client-side via SWR (the brief's stated alternative). To move to
Server Components later, switch the backend to an httpOnly cookie session.

## Mapping from the v0 mock to the real backend

| v0 mock | Real backend |
|---|---|
| `Role` ('Barista', 'Line Cook'…) | `skill_level` 1–5 + `role` (employee/manager) |
| `Employee.reliability` | *no equivalent — dropped* |
| `Employee.weeklyHours/targetHours` | `desired_hours_min` / `desired_hours_max`, live hours from validation |
| `Shift.day` (0–6) | `on_date` (ISO date) |
| `ApprovalRequest` | split into real swaps + time-off queues |
| `CallOff.coverage/coveredBy` | *not modelled — dropped* |
| `SwapRecord` | `SwapRequest` + `/swaps/{id}/detail` |
| "Est. Labor Cost" | replaced with **Scheduled Hours** (backend has no wage data) |
| "Coverage Rate" | replaced with **Days Meeting Minimums** (3 openers / 4 closers) |

## What's wired up

- Login + auth gate, manager-scoped
- Week navigation (prev / this week / next) — refetches that week's schedule
- Create schedule for a week; Publish (draft → published)
- Roster grid: real shifts, colour-coded by skill level, swapped shifts in amber
- "+" cells create a real shift using backend shift codes (`8-4`, `2-C`,
  `1130-730`), with an **Override & assign** path when the backend blocks on
  availability or approved time off (409)
- Delete shift from the grid
- Real metrics: scheduled hours, shifts filled, days meeting minimums, flag count
- Daily coverage: openers/closers vs minimums, lunch/dinner counts, daily labour
- Needs Attention: real labour-law violations, double-bookings, staffing gaps
- Employees: level filter chips, inline level editing, minor flagging
- Approvals: swaps + time-off, with "View Request" showing both employees'
  original (struck through) and proposed shifts, plus the drop/swap reason
- Call-offs: create and delete real tickets
- Swap history: decided swaps with expandable shift detail
- Live badge counts in sidebar + notification bell

## Employee console

Sign in as an employee and the app routes to a separate console
(`employee-app.tsx`) with its own sidebar. Feature parity with the Vite app:

- **My Shifts** — your published shifts, hours totals, and per-shift
  **Drop** / **Swap** actions. Incoming swap requests appear at the top in a
  blue highlight: "[name] wants to swap shifts — you'd take X, and they take
  your Y", with Accept / Decline. Shifts with a live request show
  "Request pending" instead of the action buttons.
- **Store Schedule** — day tabs showing who else is working, colour-coded by
  skill level, with your own row ringed.
- **Swaps and Drops** — incoming requests, the open pool (claimable), and your
  own requests with status and a **Cancel** button while still undecided.
- **Time Off** — submit a date range + reason, see status, cancel while pending.
- **Availability** — per-day windows (add/remove/edit) plus desired weekly
  hours min/max. Saving writes both.

Drop opens a reason dialog (manager-visible only). Swap is two-step: pick a
coworker working that day, then add a reason and confirm.

## What's still missing

- **Availability panel** on the manager builder (green/red schedulable sorting)
  — still only in the Vite app.
- Employee creation; managers editing someone else's availability.
- Export CSV, Settings, Support (v0 chrome with no backend behind it).
- Managers' availability defaulting to any day/any time (logged in NOTES.md).
