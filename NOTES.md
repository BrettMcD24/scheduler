# Ted's Scheduler — Future Features & Decisions Log

Running list of decisions and planned features captured during development, so
nothing gets lost between sessions.

## Approval workflow (admin layer) — PLANNED
- **Super admins** (corporate/owner) do NOT build schedules. They are not linked
  to a single store, so the builder shows "account isn't linked to a store" —
  this is intentional and fine for now.
- The intended flow: **Managers** build and "publish" a schedule → that publish
  actually submits it to an **Admin** for approval → once the admin approves,
  the schedule goes live and becomes visible to employees.
- Current state (for testing): publishing goes live immediately with a
  confirmation message, no admin approval step. The approval gate is deferred.

## Skill levels → positions — PLANNED
- Levels 1–5 currently represent overall skill. The real model:
  each level corresponds to a **position**: cashing, dressing, frying, cooking
  (and a 5th). A **Level 5** is proficient in all of them.
- Future: make this **per-user** — each employee has a set of positions/skills
  they've "leveled up" / mastered, displayed on their profile. Scheduling can
  then ensure each shift has coverage for each required position.
- This replaces the single numeric skill level with a skills matrix per employee.

## Builder UI — DONE / IN PROGRESS
- DONE: managers are schedulable and visually distinct (purple striped bars + MGR badge).
- DONE: assign-by-code modal flow.
- DONE: grid/list toggle, day grid with employees as columns and hour rows.
- THIS ROUND: availability panel widened to 2 columns; "no shifts this week"
  collapsed into an expandable dropdown; clicking a grid shift shows employee
  name + level; published confirmation message; varied/scattered availability in seed.

## Other deferred items
- Employee self-service web views (view shifts, request swap/time-off, set availability).
- Mobile app (read-only: view shifts, view day schedule, submit swap/time-off).
- Notifications (push + email), opt-in per user.
- Real auth (Supabase/Clerk) before production; replace demo passwords.
- Replace minor labor-law approximations + Sept–June school heuristic with a
  configurable per-store school calendar; verify against NY DOL / AZ ICA.

## Requested 2026-06-13 — next batch (see IMPLEMENTATION_PLAN.md for full detail)
- Labor metrics on builder: total daily labor (single number); lunch (11-4) and
  dinner (4-C) head counts (single numbers); running weekly labor column that
  updates as days are scheduled.
- Grid bars: show employee name + level by DEFAULT (not only on click).
- Split Drop vs Swap: Drop -> pool (as-is); Swap -> picker of everyone working
  that day (name + their shift) to choose a trade partner.
- Two-sided swap: a swap trades BOTH shifts (requester takes coworker's shift
  and vice versa). Message: "[user] wants you to take ____, and they take your ____".
- Manager "View Request": expandable detail showing both employees stacked,
  original shift struck through, proposed new shift shown.
- Approved swaps highlight on the schedule (yellow) for the new times; a notes
  section lists swapped shifts.
- Manager dashboard: swap request history (approved/denied).
- Call-offs (NEW): manager creates a ticket when an employee can't come in —
  logs employee, shift time, reason — for tracking + disciplinary action.

## Implemented 2026-06-14 (this batch — all DONE)
- Labor metrics on builder: daily labor total, lunch (11-4) + dinner (4-close)
  head counts, running weekly labor column with week total.
- Grid bars show name + level by default; swapped shifts highlighted yellow.
- Drop vs Swap split: Drop -> pool; Swap -> picker of everyone working that day.
- Two-sided swaps: both shifts trade; message shows "X wants you to take ___,
  and they take your ___".
- Manager "View Request" expander: both employees stacked, original shift struck
  through, proposed new shift shown.
- Swap notes card on builder (lists swapped shifts for the week).
- Manager dashboard: call-offs count + swap history count cards.
- Swap History page (approved/denied table).
- Call-Offs page: manager logs employee + date + shift + reason; list + delete.

NOTE: schema changed (Shift.was_swapped, SwapRequest.target_shift_id, new
call_offs table) — delete teds.db and re-run seed.py after updating.

## Implemented 2026-06-15
- Manager layout now full-width (removed 1400px cap) so the builder uses the screen.
- Drop shift now prompts for a reason (manager-visible only); shown in the
  "View Request" detail panel. New SwapRequest.drop_reason column.
- My Shifts now surfaces incoming swap requests at the top, highlighted blue,
  "[user] wants to swap shifts" with Accept/Decline (mirrors Swaps tab).

NOTE: schema changed again (SwapRequest.drop_reason) — delete teds.db and
re-run seed.py after updating.

## Implemented 2026-06-16
- Availability enforcement: managers can't directly assign an employee outside
  their availability or on approved time off (409 block). override_availability
  flag bypasses. Swaps/pickups still bypass (employee CAN pick up outside their
  listed availability) — handled because swap approval sets employee_id directly.
- Swap reason: SwapPickerModal now 2-step (pick coworker -> add reason + confirm).
- Employees can cancel their own swap/drop before a manager decides (new
  POST /swaps/{id}/cancel for the requester).
- Swap History rows expand to show the switched shifts (reuses SwapRequestDetail).
- Renamed employee "Swaps" tab to "Swaps and Drops".
- Time off greys out the employee in the availability panel with "Requested off".
- Availability panel cards: green if schedulable that day, red if not, grey if
  on time off. Sorted schedulable-first, then by level within each group.
  New response fields: can_schedule, on_time_off.

NOTE: no schema change this round (drop_reason reused for swap reason), but
re-seeding is still fine. The override flag is on ShiftIn/ShiftUpdate.

## Requested 2026-06-17 — deferred to a future update
- Managers' availability should default to any day / any time (always schedulable).
  Implement by treating role==manager as always-available in the availability
  panel + skipping the _assignment_block_reason check for managers, OR by
  seeding managers with full 7-day windows. Backend + seed change.

## Visual pass 2026-06-17 (Direction A: warm corporate + touch of diner)
- New palette: warm off-white bg (#faf8f5), charcoal ink text, Ted's red as
  confident accent, gold as secondary (manager badges, highlights).
- Fonts: Inter (UI) + Fraunces (wordmark/logo). Loaded via Google Fonts.
- Polished primitives in index.css: softer shadows, pill badges, rounded
  buttons with red primary, focus rings, hover states.
- Headers (both layouts): sticky, logo mark "T" tile, Fraunces wordmark,
  pill nav with red-tint active state.
- Login: logo mark + wordmark, larger shadow.
- Dashboard: bigger stat numbers, hover lift.
- All .card/.badge/.tag/button/input styling inherited app-wide automatically.
- NO functionality changed.

## Implemented 2026-08-09
- Level increases now require SUPER-ADMIN approval. New LevelChangeRequest
  model + /level-changes router (request / list / approve / deny). Managers
  PATCHing skill_level upward get a 403 pointing them at the request flow.
  Decreases still apply immediately. Super-admins change levels directly.
- New GET /schedules/{id}/employee-detail/{employee_id} — day-by-day
  availability, desired vs scheduled hours, approved time off, and mastered
  positions, for the manager's hover card.
- POSITION_LADDER (Cashing/Dressing/Frying/Cooking/Expediting) is DERIVED from
  skill_level, not stored per user. The real per-user position matrix is still
  pending — see the deferred list.

SCHEMA CHANGED (level_change_requests table) — delete teds.db and re-seed.

## Verified NOT a backend bug (2026-08-09)
Two-sided swap Logan<->Aria was reported as "showed for Aria but Logan wasn't
scheduled". Reproduced against the API: both shifts trade owners correctly.
The fault was frontend SWR cache invalidation — the shifts key was never
revalidated after a swap resolved, so the other person's list stayed stale.
Fixed via employeeCacheKeys() in web-next/lib/hooks.ts.

## 2026-10-22 — merge gaps closed + level approval wired

Frontend (web-next) now typechecks clean and builds. Fixed:
- `lib/types.ts` — `Employee` was missing the four `skill_*` certification
  booleans, which broke `lib/skills.ts`, `skill-badges.tsx` and
  `day-schedule-view.tsx` (the Pick<> constraint had nothing to pick).
- `lib/hooks.ts` — restored `formatTime()`, imported by `day-schedule-view`.
- `employee-detail-card.tsx` — now reads the real `skill_*` booleans via the
  `SKILLS` constant instead of an orphaned `PositionCert[]` shape, so the hover
  card's badges match the day view exactly. Removed the dead `PositionCert` type.

Backend:
- `employee-detail` endpoint added to `schedules.py` — day-by-day availability,
  desired vs scheduled hours, approved time off, and position certifications.
  Read-only; no schema dependency.
- `LevelChangeRequest` model + `LevelChangeIn/Out` schemas added, and
  `level_changes` router registered in `main.py`. The router file was already in
  the repo but its model/schemas/registration were missing, so it was broken
  dead code that raised ImportError if touched.
- `employees.py` PATCH now blocks skill_level INCREASES for non-super-admins
  (403 pointing at /level-changes). Decreases and position certifications are
  not gated.

SCHEMA CHANGED (level_change_requests table) — delete teds.db and re-seed.

Verified end to end: direct PATCH increase blocked; request held pending; level
unchanged while pending; manager cannot approve; super-admin approves and level
applies; decrease immediate; employee-detail returns 7 days + real certs.

## 2026-10-22 (later) — managers always schedulable
Closes the item logged 2026-06-17. Managers/admins now bypass the availability
window check entirely in `_assignment_block_reason` — they run the store and
are expected to cover any day and any hours, so their windows are advisory.
Approved TIME OFF still blocks them. The availability panel's `can_schedule`
uses the same rule so the UI and the API agree.

Before: a manager seeded with Mon 06:00-14:00 was refused a 4-C close (409).
After: any shift, any day, no override needed. Crew gating is unchanged.

## 2026-10-22 — non-school date ranges + audit trail

Replaces the Sept-June school-day heuristic (which wrongly flagged Thanksgiving
and winter break) with a per-store calendar of non-school ranges.

IMPORTANT — what this does and does not do. The request was for ranges where
"labor laws aren't in effect." That is not what was built, deliberately: minor
labor limits are statutory and cannot be waived by a scheduling app, and a
blanket off-switch would let the tool schedule a 15-year-old past legal limits
with an audit trail showing the store knew. What the statutes actually provide
is a DIFFERENT TIER of limits on non-school days (longer caps, later hours), so
a range flips a date to that tier. The checks always run.

- New `SchoolBreak` model (store_id, name, start/end, created_by, created_at).
  Multiple ranges per store.
- `labor_laws.is_school_day()` / `is_summer_vacation()` now take the store's
  ranges; validate_schedule loads them once and passes them through. With no
  ranges configured, the old heuristic still applies, so existing stores are
  unaffected.
- `/school-breaks` router: create, list, delete (manager+; employees get 403).
- `/school-breaks/audit`: every create and delete recorded via the existing
  AuditLog. No update or delete endpoint exists for audit entries, and the
  endpoint filters out anything older than AUDIT_RETENTION_DAYS (365).
- Frontend: "Non-School Dates" sidebar section — add/remove ranges, plus the
  read-only audit trail with a "kept 1 year" badge and copy explaining the
  tier distinction.

Verified: 6h shift for a 16yo on Thanksgiving week flags as a school-day
violation (4h cap) BEFORE a range is added, passes AFTER (8h cap), and a 10h
shift on a break day STILL violates. Multiple ranges, reversed-date rejection,
audit retention after deletion, and employee 403 all tested.

NOTE ON RETENTION: one year is what was asked for. NY requires payroll/hour
records be kept SIX years, so if these ranges are ever used to justify a
minor's hours in an audit, 365 days is likely too short. Change
AUDIT_RETENTION_DAYS in app/routers/school_breaks.py.

## 2026-10-22 — labor laws verified against primary sources + corrections

Audit retention bumped 365 -> 365*6 (NY requires minor payroll/hour records
be kept six years).

Rules checked against NY DOL "When a Minor Can Work" + form LS171, the AZ ICA
youth-employment hours page, and the federal FLSA child-labor rules. Where
state and federal differ, the STRICTER now applies (what a covered employer
must follow). Five real bugs found and fixed:

1. NY 16-17 daily cap. The 4h limit applies on days BEFORE a school day
   (Mon-Thu), not on every school day. Fridays in a school week get 8h.
   Previously every Friday 4h+ shift was flagged as a false violation.
2. NY 16-17 evening limit. 10pm while school is in session, MIDNIGHT when it
   is not. Previously hardcoded 10pm year-round, so summer evening shifts were
   falsely flagged.
3. AZ under-16 hours were too PERMISSIVE — the only under-flagging bug. AZ
   state allows 6am-9:30pm/11pm, but FLSA caps under-16s at 7am-7pm (9pm
   Jun 1 - Labor Day). Federal governs for an FLSA-covered employer, which a
   restaurant in interstate commerce is. The app would have green-lit an
   illegal 9pm shift for a 15-year-old in Arizona.
4. Weekly caps were keyed off a single day's school status, so the cap could
   differ between two shifts in the same week. They now key off whether the
   WHOLE calendar week is school-free, which is what NY requires for the
   40h/48h tiers.
5. Missing 6-days-per-week cap (both states, all ages) — added as
   MINOR_DAYS_PER_WEEK.

Also: week-scoped findings (weekly hours, days per week) are now emitted once
per employee instead of once per shift. A 7-day schedule previously produced
seven identical "35h this week" rows.

Labor Day is computed (first Monday in September), not hardcoded.

STILL NOT MODELLED (conservative — these over-flag, never under-flag):
- NY 16-17 may work to midnight before a school day with written parental AND
  school consent; we enforce the unconsented 10pm limit.
- Work/study (23h) and Cooperative Education (6h) programme allowances.
- LS171 footnote 4 resort-hotel/restaurant carve-out.
- "No work during school hours" — we have no bell schedule.
- Employment certificates (working papers) are not tracked at all.

Sources are listed at the top of app/labor_laws.py. These are statutes that
change; re-verify before relying on this for a real store.

## 2026-10-23 — printable schedule + CSV export

Not in the PRD, but the store posts a paper sheet on the wall, so the app has
to produce one. New "Print & Export" section, modelled on the real Sheridan
sheet (photo 6/9/2024).

Layout, matching the paper:
- Header: store, week range, and the MGRS / CREW / TOTAL hours box.
- Columns: LVL, NAME (surname first), AGE as a decimal (17.80 — the way the
  paper tracks proximity to 18), then the 7 days, then weekly HRS.
- Managers banded at the top, crew below, each sorted by level then surname.
- Cells carry the store's own shift codes (8-4, 1130-8, 2-C, 730-430, 8-NOON),
  X for a day off, R/O for approved time off.
- Footer counters: OPENERS and CLOSERS as actual/minimum (red when short),
  LUNCH (11-4), DINNER (4-close), and daily LABOR HOURS.
- Minors get an M next to their age; anyone with a live labor-law violation
  gets a red rule on their weekly total — the paper sheet's "LABOR LAW OVER"
  column, as a mark instead of a column.
- Draft weeks print marked DRAFT; published weeks carry the publish timestamp.

Mechanics:
- Pure CSS print (@media print), PORTRAIT Letter, no new dependencies. Portrait
  because the store posts the sheet in a vertical frame; it also matches the
  photo. The day columns get tight (~0.78in each), which is expected — the
  paper sheet is tighter still. The app
  is dark but the sheet carries its own light palette, on screen and on paper —
  a dark printout wastes toner and reads badly.
- Verified by rendering to PDF: 23-row roster fits ONE landscape page. Print
  media uses tighter sizing than the on-screen preview, which otherwise spilled
  to a second page. thead repeats if a very large roster does paginate.
- CSV export of the same grid, UTF-8 with BOM so Excel doesn't mangle names.

Also fixed: parse_shift_code() rejected 8-NOON with a ValueError, even though
NOON appears all over the paper sheet and is listed in PRD s.12. _parse_clock
now accepts it. All codes round-trip: code -> times -> code.

GOTCHA worth remembering: the print table was originally class="grid", which
collides with Tailwind's .grid utility. The <table> was being laid out as a CSS
grid (display:grid on the table, display:block on tbody), so every column width
was ignored and thead/tbody disagreed. Renamed to .sheet-grid. Don't give an
element a bare Tailwind utility name.

## 2026-10-26 — pickup gates + manager open-shift board

Closes a real gap found by testing: swaps bypassed the validation engine
entirely (app/routers/swaps.py made zero calls into it), so an employee could
pick up a shift that broke minor labor law or pushed them past 40h, and the
approving manager saw no warning. Validation was a reporting layer, not a gate.

New `preview_assignment_issues()` in shift_rules.py answers "what breaks if
this person takes this shift (and gives up that one)". Two tiers:

- BLOCKING (409 at claim, accept, AND approve): minor labor-law breaches and
  double-booking. Statutory limits aren't a manager's to waive, so these are a
  hard stop. Re-checked at approval because the week can change between a
  claim and the decision.
- WARNING (surfaced, never blocks): over 40h, over the employee's desired max.
  Overtime is a business call, so the manager decides — the warnings now
  appear next to the Approve button via SwapDetailOut.warnings.

Availability is deliberately still NOT checked on this path. Picking up a
shift outside your posted availability remains allowed (requested 2026-06-14);
only MANAGER direct-assignment enforces availability, in
_assignment_block_reason(). Verified both halves still behave.

### Manager open-shift board
`POST /swaps/open-shift` puts a shift on the board with a message and criteria,
e.g. "Looking for a closer who can dress" requiring skill_dressing and level 2+.
- Takes an existing shift_id, OR schedule_id + on_date + code and creates the
  shift unassigned (the builder has no "add unassigned shift" affordance, so
  requiring a pre-existing shift would have made this unusable).
- Criteria are the real skill_* certifications plus an optional minimum level.
  A claim that doesn't meet them is refused with a readable reason.
- Employees see the message and criteria on their board; the Claim button is
  disabled with "You don't meet the criteria" rather than failing on click.
- A newly filled shift sets was_swapped=False — it was filled, not traded.

New SwapRequest fields: posted_by_manager, board_message, required_skills,
min_skill_level. SCHEMA CHANGED — delete teds.db and re-seed.

test_smoke.py updated: the old test had Omar claim a shift overlapping one he
already worked, which now correctly 409s. It asserts the refusal and then has
Nina (free that week) claim it.
