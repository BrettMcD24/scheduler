# Ted's Hot Dogs — Web App

React + Vite + TypeScript frontend. This is the **website** — the full product where
managers build schedules and (soon) employees self-serve. Mobile comes later as a
thinner read-only client.

## Quick start

The backend must be running first (see `../README.md`). Then:

```bash
cd web
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

Log in with a seeded account (run `python seed.py` in the backend first):
- Manager: `mgr@teds.com` / `password123`
- Owner/super-admin: `owner@teds.com` / `password123`

## Configuration

Frontend talks to `http://127.0.0.1:8000` by default. To point elsewhere (e.g. after
deploying), copy `.env.example` to `.env` and set `VITE_API_BASE`.

## What's built (manager experience)

- Login + JWT auth (persisted), role-aware routing
- Dashboard — pending approval counts
- Schedule Builder (centerpiece):
  - Pick a week (snaps to Monday), create or load its schedule
  - Day tabs with a dot indicator when staffing is below minimum
  - Add shifts via paper codes (8-4, 2-C, 1130-730, 4-1045)
  - "Available [day]" panel: who can work, hours-so-far vs desired range, skill
    level, minor/time-off flags — assign with one click
  - Assign/unassign/remove shifts
  - Live staffing summary (openers/closers vs minimums) + flags panel
    (labor-law violations, double-bookings, overtime, etc.)
  - Publish (warnings never block — manager stays in control)
- Employees — roster with skill levels, ages (minor flag), desired hours
- Approvals — approve/deny swaps and time-off requests

Store scoping is enforced by the backend: a Sheridan manager only sees Sheridan.

## Architecture

```
src/
  lib/
    api.ts       <- single API client; ALL backend calls go through here
    auth.tsx     <- auth context (current user, login/logout, token)
    types.ts     <- TS types mirroring backend schemas
    format.ts    <- date/time/shift formatting helpers
  components/
    Layout.tsx, AvailablePanel.tsx, SkillBadge.tsx
  pages/
    Login.tsx, Dashboard.tsx, Builder.tsx, Employees.tsx, Approvals.tsx
  App.tsx        <- routing + role gating
```

Golden rule: screens never call fetch() directly — everything goes through
lib/api.ts. When the backend URL changes, you touch exactly one file.

## Next steps

- Employee self-service web views (my shifts, store schedule, request
  swap/time-off, set availability + desired hours)
- Drag-and-drop on the builder (currently click-to-assign)
- "Copy last week" on the builder
- Notifications
