"""Shift classification, the paper-schedule code parser, and the
schedule validation engine (all warnings are non-blocking; managers
can publish anyway)."""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, time, timedelta

from sqlalchemy.orm import Session

from .labor_laws import check_minor_shift, week_has_school
from .models import (
    Availability,
    AvailabilityException,
    RequestStatus,
    Role,
    Schedule,
    SchoolBreak,
    Shift,
    Store,
    TimeOffRequest,
    User,
)
from .skills import SKILL_ORDER

SEVERITY_WARNING = "warning"      # manager can ignore
SEVERITY_VIOLATION = "violation"  # strongly flagged, still overridable


@dataclass
class ValidationItem:
    severity: str
    code: str
    message: str
    employee_id: int | None = None
    on_date: str | None = None


@dataclass
class DayStaffing:
    on_date: str
    openers: int = 0
    closers: int = 0
    min_openers: int = 3
    min_closers: int = 4
    openers_met: bool = False
    closers_met: bool = False
    lunch: int = 0
    dinner: int = 0
    daily_labor: float = 0.0
    position_breakdown: dict = field(
        default_factory=lambda: {
            "lunch": {s: 0 for s in SKILL_ORDER},
            "dinner": {s: 0 for s in SKILL_ORDER},
        }
    )


# ---------------------------------------------------------------- shift codes

def _parse_clock(token: str, *, force_pm: bool = False) -> time:
    """Parse tokens like '8', '830', '11', '1130', '1205' into a time.

    Heuristic from the paper sheets: 6-11 = am, 12 = pm (noon), 1-5 = pm.
    'NOON' is written out on the paper sheet (e.g. '8-NOON') and listed in the
    PRD, so it is accepted as a token.
    """
    token = token.strip().upper()
    if token in ("NOON", "12NOON"):
        return time(12, 0)
    if len(token) <= 2:
        hour, minute = int(token), 0
    elif len(token) == 3:
        hour, minute = int(token[0]), int(token[1:])
    else:
        hour, minute = int(token[:2]), int(token[2:])
    if force_pm and hour < 12:
        hour += 12
    elif not force_pm:
        if 1 <= hour <= 5:
            hour += 12
    return time(hour, minute)


def parse_shift_code(code: str, store: Store) -> tuple[time, time, bool, str]:
    """Parse a paper-style shift code into (start, end, is_close, note).

    Supported: '8-4', '11-730', '2-C', '4-1045', '@13'.
    """
    code = code.strip().upper().replace(" ", "")
    note = ""

    if code.startswith("@"):
        start = _parse_clock(code[1:].replace(":", ""))
        # interpret 24h style like @13 directly
        raw = int(code[1:].replace(":", "")[:2])
        if raw >= 13:
            start = time(raw, 0)
        return start, store.closer_end_time, True, "starts-at code; end defaulted to close"

    if "-" not in code:
        raise ValueError(f"Unrecognized shift code: {code}")

    start_token, end_token = code.split("-", 1)
    start = _parse_clock(start_token.replace(":", ""))

    if end_token in ("C", "CL", "CLOSE"):
        return start, store.closer_end_time, True, note

    end = _parse_clock(end_token.replace(":", ""))
    # roll end forward to pm if it lands at/before start
    if end <= start:
        end = time(end.hour + 12, end.minute) if end.hour < 12 else end
    is_close = end >= store.closer_end_time
    if is_close:
        end = store.closer_end_time
    return start, end, is_close, note


# ----------------------------------------------------------- classification

def is_opener(shift: Shift, store: Store) -> bool:
    return shift.start_time <= store.opener_cutoff


def is_closer(shift: Shift, store: Store) -> bool:
    return shift.is_close or shift.end_time >= store.closer_end_time


# ------------------------------------------------------------- validation

def _week_dates(week_start: date) -> list[date]:
    return [week_start + timedelta(days=i) for i in range(7)]


def _windows_for(
    employee_id: int,
    on_date: date,
    recurring: dict[tuple[int, int], list[tuple[time, time]]],
    exceptions: dict[tuple[int, date], AvailabilityException],
) -> list[tuple[time, time]] | None:
    """Effective availability windows for a date. None = no info recorded."""
    exc = exceptions.get((employee_id, on_date))
    if exc:
        if not exc.available:
            return []
        if exc.start_time and exc.end_time:
            return [(exc.start_time, exc.end_time)]
    return recurring.get((employee_id, on_date.weekday()))


# Findings that describe the whole week rather than one shift. Emitting these
# per-shift produced seven identical "35h this week" rows for a 7-day schedule.
WEEK_SCOPED_MINOR_CODES = {"MINOR_WEEKLY_HOURS", "MINOR_DAYS_PER_WEEK"}


def validate_schedule(db: Session, schedule: Schedule) -> dict:
    store = schedule.store
    shifts = [s for s in schedule.shifts]
    dates = _week_dates(schedule.week_start)

    # Non-school ranges for this store. These select the NON-SCHOOL tier of
    # minor limits for the dates they cover — they never disable the checks.
    school_breaks = [
        (b.start_date, b.end_date)
        for b in db.query(SchoolBreak)
        .filter(SchoolBreak.store_id == store.id)
        .all()
    ]
    # NY's higher weekly caps apply only when school is closed for the WHOLE
    # calendar week, so this is computed once per week, not per shift.
    school_week = week_has_school(dates, school_breaks)
    seen_week_issues: set[tuple[int, str]] = set()

    employees = (
        db.query(User)
        .filter(User.store_id == store.id, User.is_active.is_(True))
        .all()
    )
    emp_by_id = {e.id: e for e in employees}

    avail_rows = (
        db.query(Availability)
        .filter(Availability.employee_id.in_(emp_by_id.keys()))
        .all()
        if emp_by_id
        else []
    )
    recurring: dict[tuple[int, int], list[tuple[time, time]]] = defaultdict(list)
    for row in avail_rows:
        recurring[(row.employee_id, row.day_of_week)].append(
            (row.start_time, row.end_time)
        )

    exc_rows = (
        db.query(AvailabilityException)
        .filter(
            AvailabilityException.employee_id.in_(emp_by_id.keys()),
            AvailabilityException.on_date.in_(dates),
        )
        .all()
        if emp_by_id
        else []
    )
    exceptions = {(r.employee_id, r.on_date): r for r in exc_rows}

    approved_time_off = (
        db.query(TimeOffRequest)
        .filter(
            TimeOffRequest.employee_id.in_(emp_by_id.keys()),
            TimeOffRequest.status == RequestStatus.approved,
            TimeOffRequest.start_date <= dates[-1],
            TimeOffRequest.end_date >= dates[0],
        )
        .all()
        if emp_by_id
        else []
    )

    items: list[ValidationItem] = []

    # --- per-day staffing minimums (non-manager shifts only) ---
    # lunch window 11:00-16:00, dinner 16:00-close. Overlap = working that meal.
    lunch_start, lunch_end = time(11, 0), time(16, 0)
    dinner_start = time(16, 0)
    dinner_end = store.close_time

    def _overlaps(s, w_start, w_end) -> bool:
        return s.start_time < w_end and s.end_time > w_start

    staffing: list[DayStaffing] = []
    for d in dates:
        day = DayStaffing(
            on_date=d.isoformat(),
            min_openers=store.min_openers,
            min_closers=store.min_closers,
        )
        lunch_counted: set[int] = set()
        dinner_counted: set[int] = set()
        for s in shifts:
            if s.on_date != d or s.employee_id is None:
                continue
            emp = emp_by_id.get(s.employee_id)
            is_mgr_shift = s.is_manager_shift or (emp and emp.role != Role.employee)
            # labor + meal counts include everyone working (managers too)
            day.daily_labor += s.hours()
            if _overlaps(s, lunch_start, lunch_end):
                day.lunch += 1
                if emp and emp.id not in lunch_counted:
                    lunch_counted.add(emp.id)
                    for skill in SKILL_ORDER:
                        if getattr(emp, f"skill_{skill}"):
                            day.position_breakdown["lunch"][skill] += 1
            if _overlaps(s, dinner_start, dinner_end):
                day.dinner += 1
                if emp and emp.id not in dinner_counted:
                    dinner_counted.add(emp.id)
                    for skill in SKILL_ORDER:
                        if getattr(emp, f"skill_{skill}"):
                            day.position_breakdown["dinner"][skill] += 1
            # opener/closer minimums exclude managers (matches paper process)
            if is_mgr_shift:
                continue
            if is_opener(s, store):
                day.openers += 1
            if is_closer(s, store):
                day.closers += 1
        day.daily_labor = round(day.daily_labor, 2)
        day.openers_met = day.openers >= day.min_openers
        day.closers_met = day.closers >= day.min_closers
        staffing.append(day)
        if not day.openers_met:
            items.append(
                ValidationItem(
                    SEVERITY_WARNING,
                    "STAFFING_OPENERS",
                    f"{d.strftime('%a %m/%d')}: {day.openers} opener(s), "
                    f"minimum is {day.min_openers}",
                    on_date=d.isoformat(),
                )
            )
        if not day.closers_met:
            items.append(
                ValidationItem(
                    SEVERITY_WARNING,
                    "STAFFING_CLOSERS",
                    f"{d.strftime('%a %m/%d')}: {day.closers} closer(s), "
                    f"minimum is {day.min_closers}",
                    on_date=d.isoformat(),
                )
            )

    # --- per-employee checks ---
    weekly_hours: dict[int, float] = defaultdict(float)
    daily_hours: dict[tuple[int, date], float] = defaultdict(float)
    shifts_by_emp: dict[int, list[Shift]] = defaultdict(list)
    for s in shifts:
        if s.employee_id is None:
            continue
        weekly_hours[s.employee_id] += s.hours()
        daily_hours[(s.employee_id, s.on_date)] += s.hours()
        shifts_by_emp[s.employee_id].append(s)

    for emp in employees:
        hours = round(weekly_hours.get(emp.id, 0.0), 2)
        name = f"{emp.first_name} {emp.last_name[:1]}."

        if emp.role != Role.super_admin and hours == 0:
            items.append(
                ValidationItem(
                    SEVERITY_WARNING,
                    "NO_SHIFTS",
                    f"{name} has no shifts this week",
                    employee_id=emp.id,
                )
            )
        if emp.desired_hours_max and hours > emp.desired_hours_max:
            items.append(
                ValidationItem(
                    SEVERITY_WARNING,
                    "OVER_DESIRED_MAX",
                    f"{name}: {hours}h scheduled, desired max is "
                    f"{emp.desired_hours_max}h",
                    employee_id=emp.id,
                )
            )
        if hours > 40:
            items.append(
                ValidationItem(
                    SEVERITY_WARNING,
                    "OVERTIME",
                    f"{name}: {hours}h scheduled (overtime past 40h)",
                    employee_id=emp.id,
                )
            )

        emp_shifts = sorted(
            shifts_by_emp.get(emp.id, []), key=lambda s: (s.on_date, s.start_time)
        )

        # double booking
        for a, b in zip(emp_shifts, emp_shifts[1:]):
            if a.on_date == b.on_date and b.start_time < a.end_time:
                items.append(
                    ValidationItem(
                        SEVERITY_VIOLATION,
                        "DOUBLE_BOOKED",
                        f"{name}: overlapping shifts on "
                        f"{a.on_date.strftime('%a %m/%d')}",
                        employee_id=emp.id,
                        on_date=a.on_date.isoformat(),
                    )
                )

        for s in emp_shifts:
            # approved time off conflict
            for to in approved_time_off:
                if (
                    to.employee_id == emp.id
                    and to.start_date <= s.on_date <= to.end_date
                ):
                    items.append(
                        ValidationItem(
                            SEVERITY_VIOLATION,
                            "TIME_OFF_CONFLICT",
                            f"{name} is scheduled "
                            f"{s.on_date.strftime('%a %m/%d')} but has an "
                            f"approved request off",
                            employee_id=emp.id,
                            on_date=s.on_date.isoformat(),
                        )
                    )

            # outside availability
            windows = _windows_for(emp.id, s.on_date, recurring, exceptions)
            if windows is not None:
                fits = any(w[0] <= s.start_time and s.end_time <= w[1] for w in windows)
                if not fits:
                    items.append(
                        ValidationItem(
                            SEVERITY_WARNING,
                            "OUTSIDE_AVAILABILITY",
                            f"{name}: shift on {s.on_date.strftime('%a %m/%d')} "
                            f"({s.start_time.strftime('%H:%M')}-"
                            f"{s.end_time.strftime('%H:%M')}) is outside "
                            f"their availability",
                            employee_id=emp.id,
                            on_date=s.on_date.isoformat(),
                        )
                    )

            # minor labor laws (age computed on the shift date -> handles
            # birthdays mid-week)
            age = emp.age_on(s.on_date)
            if age is not None and age < 18:
                for issue in check_minor_shift(  # noqa: E501
                    age,
                    store.state,
                    s.on_date,
                    s.start_time,
                    s.end_time,
                    daily_hours[(emp.id, s.on_date)],
                    hours,
                    school_breaks,
                    school_week,
                    len({x.on_date for x in shifts_by_emp.get(emp.id, [])}),
                ):
                    # Week-scoped findings are about the week, not this shift,
                    # so emit them once per employee instead of once per shift.
                    if issue.code in WEEK_SCOPED_MINOR_CODES:
                        key = (emp.id, issue.code)
                        if key in seen_week_issues:
                            continue
                        seen_week_issues.add(key)
                    items.append(
                        ValidationItem(
                            SEVERITY_VIOLATION,
                            issue.code,
                            f"{name}: {issue.message}",
                            employee_id=emp.id,
                            on_date=s.on_date.isoformat(),
                        )
                    )

    # de-duplicate identical items (e.g. weekly-hours issue repeated per shift)
    seen: set[tuple] = set()
    unique_items: list[ValidationItem] = []
    for item in items:
        key = (item.code, item.message, item.employee_id, item.on_date)
        if key not in seen:
            seen.add(key)
            unique_items.append(item)

    return {
        "schedule_id": schedule.id,
        "violations": [i.__dict__ for i in unique_items if i.severity == SEVERITY_VIOLATION],
        "warnings": [i.__dict__ for i in unique_items if i.severity == SEVERITY_WARNING],
        "staffing": [d.__dict__ for d in staffing],
        "weekly_hours": {
            str(emp_id): round(h, 2) for emp_id, h in weekly_hours.items()
        },
    }
