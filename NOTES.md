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
