# Ted's Hot Dogs — Scheduler Backend

FastAPI backend for the scheduling app (PRD v0.1). No styling/frontend yet — this is the API layer the Expo app and web dashboard will call.

## Quick start

```bash
pip install -r requirements.txt
python seed.py                      # optional demo data (password123)
uvicorn app.main:app --reload
```

Interactive API docs: http://localhost:8000/docs

Run the test suite: `python test_smoke.py` (60+ end-to-end checks)

## Stack

- FastAPI + SQLAlchemy 2.0 + Pydantic v2
- SQLite by default; set `DATABASE_URL` env var for Postgres (e.g. `postgresql://user:pass@host/db`)
- JWT auth (set `SECRET_KEY` env var in production)

## API overview

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/bootstrap` (first super-admin only), `POST /auth/login`, `GET /auth/me` |
| Stores | `POST/GET/PATCH /stores` (super admin manages; managers see their own) |
| Employees | `POST/GET/PATCH /employees`, `PUT /employees/me/desired-hours` |
| Availability | `PUT/GET /availability/{id}/windows` (recurring weekly), `POST/GET /availability/{id}/exceptions` (one-off) |
| Schedules | `POST /schedules`, `GET /schedules`, `POST /schedules/{id}/publish` |
| Shifts | `POST /schedules/{id}/shifts` (accepts paper codes or explicit times), `PATCH/DELETE /schedules/shifts/{id}`, `GET /schedules/{id}/shifts` |
| Builder helpers | `GET /schedules/{id}/available?on_date=` (the "Available Monday" panel), `GET /schedules/{id}/validate` |
| Swaps | `POST /swaps`, `/claim`, `/accept`, `/decline`, `/approve`, `/deny`, `GET /swaps` |
| Time off | `POST /time-off`, `/approve`, `/deny`, `/cancel`, `GET /time-off` |

## Business rules implemented

- **Opener** = shift starting at or before 9:00am (configurable per store: `opener_cutoff`)
- **Closer** = shift coded `-C` or ending at 10:45pm (`closer_end_time`); a shift ending at the 10pm door close does NOT count as a closer
- **Staffing minimums**: 3 openers / 4 closers per day, excluding managers (configurable per store); validation flags days that fall short
- **Paper shift codes** parse directly: `8-4`, `11-730`, `1130-730`, `2-C`, `4-1045`, `@13`
- **Validation is advisory, never blocking** — managers can publish with warnings (your "warn but let them ignore it" rule)
- **Warnings**: staffing minimums, zero-shift employees, over desired max hours, overtime >40h, shifts outside availability
- **Violations** (stronger flag, still overridable): minor labor-law issues, double-booking, shifts on approved time off
- **Minor labor laws**: NY (14–15 and 16–17 brackets) and AZ (under 16), with age computed per shift date so mid-week birthdays are handled
- **Swap lifecycle**: targeted swap (pending coworker → pending manager → approved/denied) and open drops to a pool that any coworker can claim; every transition writes an audit-log row
- **Roles**: super_admin (all stores) / manager (own store only) / employee (self + published store schedules)

## Known limitations / next steps

1. **Labor law rules are approximations** — verify against current NY DOL and AZ ICA guidance before relying on them. School-day detection is a Sept–June weekday heuristic; replace with a per-store school calendar config.
2. **Auth is self-contained JWT** — fine for development; consider Supabase Auth or Clerk before production (password reset, email verification, etc.).
3. **No notifications yet** — publish/swap/time-off events log to the audit table; wire to Expo Push + email later.
4. **No migrations** — tables auto-create. Add Alembic before the schema starts evolving in production.
5. **No rate limiting / CORS config** — add CORS middleware when the Expo app connects.
