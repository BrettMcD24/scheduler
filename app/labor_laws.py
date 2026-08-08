"""Minor labor-law checks for NY and AZ.

IMPORTANT: These rules are approximations for MVP scaffolding. Verify current
rules against the NY DOL and AZ Industrial Commission before relying on this
module for real compliance. School-day/school-week detection uses a simple
heuristic (Mon-Fri, Sept-June) and should be replaced with a configurable
school calendar per store/employee.
"""

from dataclasses import dataclass
from datetime import date, time


@dataclass
class LaborIssue:
    code: str
    message: str


def is_school_day(d: date) -> bool:
    """Heuristic: weekdays during the school year (Sept-June).

    Replace with a real school-calendar config in production.
    """
    if d.weekday() >= 5:  # Sat/Sun
        return False
    return d.month in (9, 10, 11, 12, 1, 2, 3, 4, 5, 6)


def is_summer_vacation(d: date) -> bool:
    """Rough NY summer window (June 21 - Labor Day approximation)."""
    if d.month in (7, 8):
        return True
    if d.month == 6 and d.day >= 21:
        return True
    return False


def check_minor_shift(
    age: int,
    state: str,
    on_date: date,
    start: time,
    end: time,
    daily_hours: float,
    weekly_hours: float,
) -> list[LaborIssue]:
    """Validate one shift for a minor. daily_hours/weekly_hours include this shift."""
    issues: list[LaborIssue] = []
    if age >= 18:
        return issues

    school = is_school_day(on_date)

    if state == "NY":
        if age <= 15:
            earliest, latest = time(7, 0), time(21 if is_summer_vacation(on_date) else 19, 0)
            max_daily = 3 if school else 8
            max_weekly = 18 if school else 40
        else:  # 16-17
            earliest, latest = time(6, 0), time(22, 0)
            max_daily = 4 if school else 8
            max_weekly = 28 if school else 48
    elif state == "AZ":
        if age <= 15:
            earliest = time(6, 0)
            latest = time(21, 30) if school else time(23, 0)
            max_daily = 3 if school else 8
            max_weekly = 18 if school else 40
        else:
            # AZ has no special hour limits for 16-17 in most retail/food work
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
                f"latest allowed is {latest.strftime('%H:%M')} ({state}"
                f"{', school day' if school else ''})",
            )
        )
    if daily_hours > max_daily:
        issues.append(
            LaborIssue(
                "MINOR_DAILY_HOURS",
                f"Age {age}: {daily_hours}h scheduled this day, "
                f"max is {max_daily}h ({state}{', school day' if school else ''})",
            )
        )
    if weekly_hours > max_weekly:
        issues.append(
            LaborIssue(
                "MINOR_WEEKLY_HOURS",
                f"Age {age}: {weekly_hours}h scheduled this week, "
                f"max is {max_weekly}h ({state})",
            )
        )
    return issues
