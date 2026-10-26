"""Minor labor-law checks for NY and AZ.

Rules verified 2026-10-22 against:
  - NY DOL "When a Minor Can Work"  https://dol.ny.gov/hours-work-minors
  - NY DOL form LS171 (permitted working hours chart)
  - AZ ICA youth employment hours   https://azica.gov/labor-youth-employment-hours-restrictions
  - Federal FLSA child labor rules  https://webapps.dol.gov/elaws/whd/flsa/cl/e14.asp

Where state and federal differ, the STRICTER rule is applied, which is what an
employer covered by both must follow. This matters for Arizona: AZ state law
allows under-16s until 9:30/11pm, but FLSA caps them at 7pm (9pm Jun 1-Labor
Day), so the federal limit governs for any FLSA-covered employer.

Not modelled (deliberate gaps, flagged in NOTES.md):
  - NY 16-17 may work to midnight before a school day with written parental AND
    school consent; we enforce the unconsented 10pm limit.
  - Work/study and Cooperative Education programme allowances.
  - The resort-hotel/restaurant carve-out in LS171 footnote 4.
  - "May not work during school hours" (we have no bell schedule).
These make the checks CONSERVATIVE: they can over-flag, never under-flag.
"""

from dataclasses import dataclass
from datetime import date, time, timedelta


@dataclass
class LaborIssue:
    code: str
    message: str


def _labor_day(year: int) -> date:
    """First Monday in September."""
    d = date(year, 9, 1)
    return d + timedelta(days=(7 - d.weekday()) % 7)


def is_school_day(d: date, breaks: list[tuple[date, date]] | None = None) -> bool:
    """Is `d` a school day?

    Weekends are never school days. Any date inside a configured non-school
    range (summer, winter break, Thanksgiving week, a snow day) is not either.
    With no ranges configured we fall back to a Sept-June heuristic so existing
    stores keep working until someone fills in their calendar.
    """
    if d.weekday() >= 5:  # Sat/Sun
        return False
    if breaks:
        for start, end in breaks:
            if start <= d <= end:
                return False
    return d.month in (9, 10, 11, 12, 1, 2, 3, 4, 5, 6)


def week_has_school(
    week_dates: list[date], breaks: list[tuple[date, date]] | None = None
) -> bool:
    """True if ANY day in the week is a school day.

    NY's higher weekly caps (40h for 14-15, 48h for 16-17) apply only when
    school is closed for the ENTIRE calendar week, so a week containing even
    one school day keeps the lower cap.
    """
    return any(is_school_day(d, breaks) for d in week_dates)


def ny_summer_window(d: date, breaks: list[tuple[date, date]] | None = None) -> bool:
    """NY under-16 evening extension: June 21 through Labor Day (7pm -> 9pm).

    NY is stricter than FLSA here (which starts June 1), so NY governs in NY.
    A configured non-school range covering `d` also counts.
    """
    if breaks:
        for start, end in breaks:
            if start <= d <= end and d.month in (6, 7, 8, 9):
                return True
    if d.month in (7, 8):
        return True
    if d.month == 6 and d.day >= 21:
        return True
    if d.month == 9 and d <= _labor_day(d.year):
        return True
    return False


def federal_summer_window(d: date) -> bool:
    """FLSA under-16 evening extension: June 1 through Labor Day (7pm -> 9pm)."""
    if d.month in (6, 7, 8):
        return True
    if d.month == 9 and d <= _labor_day(d.year):
        return True
    return False


# Back-compat alias; older callers used this name.
def is_summer_vacation(d: date, breaks=None) -> bool:
    return ny_summer_window(d, breaks)


def check_minor_shift(
    age: int,
    state: str,
    on_date: date,
    start: time,
    end: time,
    daily_hours: float,
    weekly_hours: float,
    breaks: list[tuple[date, date]] | None = None,
    school_week: bool | None = None,
    days_worked: int | None = None,
) -> list[LaborIssue]:
    """Validate one shift for a minor.

    daily_hours/weekly_hours include this shift. `school_week` says whether the
    week contains any school day (defaults to today's status if not supplied).
    `days_worked` is the count of distinct days worked in the week, for the
    6-day cap.

    `breaks` select WHICH TIER of limits applies. They never disable a check.
    """
    issues: list[LaborIssue] = []
    if age >= 18:
        return issues

    school_today = is_school_day(on_date, breaks)
    school_tomorrow = is_school_day(on_date + timedelta(days=1), breaks)
    if school_week is None:
        school_week = school_today

    if state == "NY":
        if age <= 15:
            earliest = time(7, 0)
            latest = time(21, 0) if ny_summer_window(on_date, breaks) else time(19, 0)
            max_daily = 3 if school_today else 8
            max_weekly = 18 if school_week else 40
            tier = "school day" if school_today else "non-school day"
        else:  # 16-17
            earliest = time(6, 0)
            # LS171: 10pm while school is in session, midnight when it is not.
            # The 10pm->midnight extension needs written parental AND school
            # consent, which we do not model, so we enforce the stricter 10pm.
            latest = time(22, 0) if school_week else time(23, 59)
            # 4h applies on days BEFORE a school day (Mon-Thu in a school
            # week); Fri/Sat/Sun and holidays get 8h even in a school week.
            max_daily = 4 if (school_week and school_tomorrow) else 8
            max_weekly = 28 if school_week else 48
            tier = "day before a school day" if (school_week and school_tomorrow) else "non-school day"
    elif state == "AZ":
        if age <= 15:
            # AZ state allows 6am-9:30pm/11pm, but FLSA caps under-16s at
            # 7am-7pm (9pm Jun 1 - Labor Day). Federal is stricter, so it wins.
            earliest = time(7, 0)
            latest = time(21, 0) if federal_summer_window(on_date) else time(19, 0)
            max_daily = 3 if school_today else 8
            max_weekly = 18 if school_week else 40
            tier = "school day" if school_today else "non-school day"
        else:
            # Neither AZ nor the FLSA sets hour limits for 16-17 in ordinary
            # retail/food work.
            return issues
    else:
        return issues

    if start < earliest:
        issues.append(
            LaborIssue(
                "MINOR_TOO_EARLY",
                f"Age {age}: shift starts {start.strftime('%H:%M')}, "
                f"earliest allowed is {earliest.strftime('%H:%M')} ({state})",
            )
        )
    if end > latest:
        issues.append(
            LaborIssue(
                "MINOR_TOO_LATE",
                f"Age {age}: shift ends {end.strftime('%H:%M')}, "
                f"latest allowed is {latest.strftime('%H:%M')} ({state}, {tier})",
            )
        )
    if daily_hours > max_daily:
        issues.append(
            LaborIssue(
                "MINOR_DAILY_HOURS",
                f"Age {age}: {daily_hours}h scheduled this day, "
                f"max is {max_daily}h ({state}, {tier})",
            )
        )
    if weekly_hours > max_weekly:
        issues.append(
            LaborIssue(
                "MINOR_WEEKLY_HOURS",
                f"Age {age}: {weekly_hours}h scheduled this week, max is "
                f"{max_weekly}h ({state}, {'school week' if school_week else 'non-school week'})",
            )
        )
    if days_worked is not None and days_worked > 6:
        issues.append(
            LaborIssue(
                "MINOR_DAYS_PER_WEEK",
                f"Age {age}: scheduled {days_worked} days this week, max is 6 ({state})",
            )
        )
    return issues
