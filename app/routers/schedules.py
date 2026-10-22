from collections import defaultdict
from datetime import date, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..audit import log_action
from ..auth import check_store_access, get_current_user, require_manager
from ..database import get_db
from ..models import (
    Availability,
    AvailabilityException,
    RequestStatus,
    Role,
    Schedule,
    ScheduleStatus,
    Shift,
    TimeOffRequest,
    User,
)
from ..schemas import ScheduleIn, ScheduleOut, ShiftIn, ShiftOut, ShiftUpdate
from ..shift_rules import parse_shift_code, validate_schedule

router = APIRouter(prefix="/schedules", tags=["schedules"])


def _assignment_block_reason(
    db: Session,
    employee_id: int,
    on_date: date,
    start: time,
    end: time,
) -> str | None:
    """Return a reason string if this employee can't be directly scheduled for
    this shift (on approved time off, or shift falls outside availability),
    else None. Used to block MANAGER direct assignment — not swaps/pickups."""
    # approved time off that covers the date
    on_time_off = (
        db.query(TimeOffRequest)
        .filter(
            TimeOffRequest.employee_id == employee_id,
            TimeOffRequest.status == RequestStatus.approved,
            TimeOffRequest.start_date <= on_date,
            TimeOffRequest.end_date >= on_date,
        )
        .first()
    )
    if on_time_off:
        return "Employee has approved time off on this date"

    # availability for the date: exception overrides recurring
    exc = (
        db.query(AvailabilityException)
        .filter(
            AvailabilityException.employee_id == employee_id,
            AvailabilityException.on_date == on_date,
        )
        .first()
    )
    if exc is not None:
        if not exc.available:
            return "Employee marked unavailable on this date"
        if exc.start_time and exc.end_time:
            if start >= exc.start_time and end <= exc.end_time:
                return None
            return "Shift falls outside the employee's availability for this date"

    windows = (
        db.query(Availability)
        .filter(
            Availability.employee_id == employee_id,
            Availability.day_of_week == on_date.weekday(),
        )
        .all()
    )
    if not windows:
        return "Employee has no availability listed for this day"
    if any(start >= w.start_time and end <= w.end_time for w in windows):
        return None
    return "Shift falls outside the employee's availability for this day"



def _get_schedule(db: Session, schedule_id: int) -> Schedule:
    schedule = (
        db.query(Schedule)
        .options(joinedload(Schedule.shifts), joinedload(Schedule.store))
        .filter(Schedule.id == schedule_id)
        .first()
    )
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    return schedule


@router.post("", response_model=ScheduleOut)
def create_schedule(
    body: ScheduleIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    check_store_access(actor, body.store_id)
    if body.week_start.weekday() != 0:
        raise HTTPException(422, "week_start must be a Monday")
    existing = (
        db.query(Schedule)
        .filter(
            Schedule.store_id == body.store_id,
            Schedule.week_start == body.week_start,
        )
        .first()
    )
    if existing:
        raise HTTPException(409, f"Schedule already exists (id={existing.id})")
    schedule = Schedule(
        store_id=body.store_id, week_start=body.week_start, created_by=actor.id
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    log_action(db, "schedule", schedule.id, "created", actor.id)
    db.commit()
    return schedule


@router.get("", response_model=list[ScheduleOut])
def list_schedules(
    store_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Schedule)
    if user.role == Role.super_admin:
        if store_id is not None:
            q = q.filter(Schedule.store_id == store_id)
    else:
        q = q.filter(Schedule.store_id == user.store_id)
        # employees only see published schedules
        if user.role == Role.employee:
            q = q.filter(Schedule.status == ScheduleStatus.published)
    return q.order_by(Schedule.week_start.desc()).all()


@router.get("/{schedule_id}/shifts", response_model=list[ShiftOut])
def list_shifts(
    schedule_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    schedule = _get_schedule(db, schedule_id)
    check_store_access(user, schedule.store_id)
    if (
        user.role == Role.employee
        and schedule.status != ScheduleStatus.published
    ):
        raise HTTPException(403, "Schedule not published yet")
    return [
        ShiftOut.from_shift(s)
        for s in sorted(schedule.shifts, key=lambda s: (s.on_date, s.start_time))
    ]


@router.post("/{schedule_id}/shifts", response_model=ShiftOut)
def add_shift(
    schedule_id: int,
    body: ShiftIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    schedule = _get_schedule(db, schedule_id)
    check_store_access(actor, schedule.store_id)

    week_end = date.fromordinal(schedule.week_start.toordinal() + 6)
    if not (schedule.week_start <= body.on_date <= week_end):
        raise HTTPException(422, "Shift date is outside the schedule week")

    if body.code:
        start, end, is_close, note = parse_shift_code(body.code, schedule.store)
    elif body.start_time and body.end_time:
        start, end = body.start_time, body.end_time
        is_close = end >= schedule.store.closer_end_time
        note = ""
    else:
        raise HTTPException(422, "Provide either a code or start_time + end_time")

    if start >= end:
        raise HTTPException(422, "start_time must be before end_time")

    if body.employee_id is not None:
        emp = db.get(User, body.employee_id)
        if not emp or emp.store_id != schedule.store_id:
            raise HTTPException(422, "Employee not found at this store")
        if not body.override_availability:
            reason = _assignment_block_reason(
                db, body.employee_id, body.on_date, start, end
            )
            if reason:
                raise HTTPException(409, reason)

    shift = Shift(
        schedule_id=schedule_id,
        employee_id=body.employee_id,
        on_date=body.on_date,
        start_time=start,
        end_time=end,
        is_close=is_close,
        position=body.position,
        notes=(body.notes + (f" [{note}]" if note else "")).strip(),
        is_manager_shift=body.is_manager_shift,
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    log_action(
        db, "shift", shift.id, "created", actor.id,
        employee_id=body.employee_id, date=str(body.on_date),
    )
    db.commit()
    return ShiftOut.from_shift(shift)


@router.patch("/shifts/{shift_id}", response_model=ShiftOut)
def update_shift(
    shift_id: int,
    body: ShiftUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    shift = db.get(Shift, shift_id)
    if not shift:
        raise HTTPException(404, "Shift not found")
    schedule = _get_schedule(db, shift.schedule_id)
    check_store_access(actor, schedule.store_id)

    data = body.model_dump(exclude_unset=True)
    override = data.pop("override_availability", False)
    old_employee = shift.employee_id

    # If reassigning to a different employee, enforce availability/time-off
    # (unless the manager explicitly overrides).
    new_employee = data.get("employee_id", shift.employee_id)
    if new_employee is not None and new_employee != old_employee and not override:
        new_start = data.get("start_time", shift.start_time)
        new_end = data.get("end_time", shift.end_time)
        reason = _assignment_block_reason(
            db, new_employee, shift.on_date, new_start, new_end
        )
        if reason:
            raise HTTPException(409, reason)

    for key, value in data.items():
        setattr(shift, key, value)
    if shift.start_time >= shift.end_time:
        raise HTTPException(422, "start_time must be before end_time")
    shift.is_close = shift.end_time >= schedule.store.closer_end_time
    db.commit()
    db.refresh(shift)
    log_action(
        db, "shift", shift.id, "updated", actor.id,
        old_employee_id=old_employee, **{k: str(v) for k, v in data.items()},
    )
    db.commit()
    return ShiftOut.from_shift(shift)


@router.delete("/shifts/{shift_id}")
def delete_shift(
    shift_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    shift = db.get(Shift, shift_id)
    if not shift:
        raise HTTPException(404, "Shift not found")
    schedule = _get_schedule(db, shift.schedule_id)
    check_store_access(actor, schedule.store_id)
    db.delete(shift)
    log_action(db, "shift", shift_id, "deleted", actor.id)
    db.commit()
    return {"deleted": shift_id}


@router.get("/{schedule_id}/validate")
def validate(
    schedule_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    schedule = _get_schedule(db, schedule_id)
    check_store_access(actor, schedule.store_id)
    return validate_schedule(db, schedule)


@router.post("/{schedule_id}/publish", response_model=ScheduleOut)
def publish(
    schedule_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    """Publish the schedule. Validation warnings do NOT block publishing —
    they are surfaced to the manager, who can choose to ignore them."""
    from datetime import datetime, timezone

    schedule = _get_schedule(db, schedule_id)
    check_store_access(actor, schedule.store_id)
    schedule.status = ScheduleStatus.published
    schedule.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(schedule)
    log_action(db, "schedule", schedule.id, "published", actor.id)
    db.commit()
    return schedule


@router.get("/{schedule_id}/available")
def available_on_day(
    schedule_id: int,
    on_date: date,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    """The 'Available [day]' panel: who can work, their windows, hours so far,
    desired range, and flags."""
    schedule = _get_schedule(db, schedule_id)
    check_store_access(actor, schedule.store_id)

    employees = (
        db.query(User)
        .filter(
            User.store_id == schedule.store_id,
            User.is_active.is_(True),
            User.role.in_([Role.employee, Role.manager]),
        )
        .all()
    )
    emp_ids = [e.id for e in employees]

    weekly_hours: dict[int, float] = defaultdict(float)
    assigned_today: set[int] = set()
    for s in schedule.shifts:
        if s.employee_id is None:
            continue
        weekly_hours[s.employee_id] += s.hours()
        if s.on_date == on_date:
            assigned_today.add(s.employee_id)

    avail_rows = (
        db.query(Availability)
        .filter(
            Availability.employee_id.in_(emp_ids),
            Availability.day_of_week == on_date.weekday(),
        )
        .all()
        if emp_ids
        else []
    )
    windows_by_emp: dict[int, list] = defaultdict(list)
    for row in avail_rows:
        windows_by_emp[row.employee_id].append(
            {"start": row.start_time.isoformat(), "end": row.end_time.isoformat()}
        )

    exceptions = {
        r.employee_id: r
        for r in (
            db.query(AvailabilityException)
            .filter(
                AvailabilityException.employee_id.in_(emp_ids),
                AvailabilityException.on_date == on_date,
            )
            .all()
            if emp_ids
            else []
        )
    }

    time_off_ids = {
        r.employee_id
        for r in (
            db.query(TimeOffRequest)
            .filter(
                TimeOffRequest.employee_id.in_(emp_ids),
                TimeOffRequest.status == RequestStatus.approved,
                TimeOffRequest.start_date <= on_date,
                TimeOffRequest.end_date >= on_date,
            )
            .all()
            if emp_ids
            else []
        )
    }

    out = []
    for emp in employees:
        exc = exceptions.get(emp.id)
        if exc and not exc.available:
            windows = []
        elif exc and exc.start_time and exc.end_time:
            windows = [
                {"start": exc.start_time.isoformat(), "end": exc.end_time.isoformat()}
            ]
        else:
            windows = windows_by_emp.get(emp.id, [])

        hours = round(weekly_hours.get(emp.id, 0.0), 2)
        age = emp.age_on(on_date)
        on_time_off = emp.id in time_off_ids
        flags = []
        if on_time_off:
            flags.append("approved_time_off")
        if emp.id in assigned_today:
            flags.append("already_scheduled_today")
        if age is not None and age < 18:
            flags.append(f"minor_age_{age}")
        if emp.desired_hours_max and hours >= emp.desired_hours_max:
            flags.append("at_or_over_desired_max")
        if hours == 0:
            flags.append("no_shifts_yet")

        # can be scheduled today = has availability windows AND not on approved time off
        can_schedule = len(windows) > 0 and not on_time_off

        out.append(
            {
                "employee_id": emp.id,
                "name": f"{emp.first_name} {emp.last_name}",
                "skill_level": emp.skill_level,
                "is_manager": emp.role == Role.manager,
                "age": age,
                "windows": windows,
                "hours_this_week": hours,
                "desired_hours_min": emp.desired_hours_min,
                "desired_hours_max": emp.desired_hours_max,
                "on_time_off": on_time_off,
                "can_schedule": can_schedule,
                "flags": flags,
            }
        )

    # schedulable first, then by skill level descending within each group
    out.sort(key=lambda e: (not e["can_schedule"], -(e["skill_level"] or 0)))
    return {"date": on_date.isoformat(), "employees": out}


@router.get("/{schedule_id}/employee-detail/{employee_id}")
def employee_detail(
    schedule_id: int,
    employee_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    """Everything a manager wants while building the schedule: day-by-day
    availability, desired vs already-scheduled hours, approved time off, and
    position certifications. Powers the hover card on the roster grid."""
    schedule = db.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    check_store_access(actor, schedule.store_id)
    emp = db.get(User, employee_id)
    if not emp or emp.store_id != schedule.store_id:
        raise HTTPException(404, "Employee not found at this store")

    dates = [schedule.week_start + timedelta(days=i) for i in range(7)]

    # recurring weekly availability
    by_day: dict[int, list[dict]] = {i: [] for i in range(7)}
    for w in (
        db.query(Availability).filter(Availability.employee_id == employee_id).all()
    ):
        by_day[w.day_of_week].append(
            {"start": w.start_time.isoformat(), "end": w.end_time.isoformat()}
        )

    # date-specific exceptions override the recurring pattern
    exc_by_date = {
        e.on_date: e
        for e in db.query(AvailabilityException)
        .filter(
            AvailabilityException.employee_id == employee_id,
            AvailabilityException.on_date.in_(dates),
        )
        .all()
    }

    # approved time off overlapping the week
    off_dates = set()
    for t in (
        db.query(TimeOffRequest)
        .filter(
            TimeOffRequest.employee_id == employee_id,
            TimeOffRequest.status == RequestStatus.approved,
            TimeOffRequest.start_date <= dates[-1],
            TimeOffRequest.end_date >= dates[0],
        )
        .all()
    ):
        for d in dates:
            if t.start_date <= d <= t.end_date:
                off_dates.add(d)

    hours_by_date = {d.isoformat(): 0.0 for d in dates}
    for sh in (
        db.query(Shift)
        .filter(Shift.schedule_id == schedule_id, Shift.employee_id == employee_id)
        .all()
    ):
        key = sh.on_date.isoformat()
        if key in hours_by_date:
            hours_by_date[key] += sh.hours()

    days_out = []
    for d in dates:
        exc = exc_by_date.get(d)
        if exc is not None:
            if not exc.available:
                wins = []
            elif exc.start_time and exc.end_time:
                wins = [
                    {
                        "start": exc.start_time.isoformat(),
                        "end": exc.end_time.isoformat(),
                    }
                ]
            else:
                wins = by_day[d.weekday()]
        else:
            wins = by_day[d.weekday()]
        days_out.append(
            {
                "on_date": d.isoformat(),
                "windows": wins,
                "on_time_off": d in off_dates,
                "scheduled_hours": round(hours_by_date[d.isoformat()], 2),
                "has_exception": exc is not None,
            }
        )

    return {
        "employee_id": emp.id,
        "name": f"{emp.first_name} {emp.last_name}",
        "skill_level": emp.skill_level,
        "is_manager": emp.role != Role.employee,
        "age": emp.age_on(schedule.week_start),
        "desired_hours_min": emp.desired_hours_min,
        "desired_hours_max": emp.desired_hours_max,
        "scheduled_hours": round(sum(hours_by_date.values()), 2),
        # real certifications straight off the User columns
        "skill_dressing": emp.skill_dressing,
        "skill_cashing": emp.skill_cashing,
        "skill_frying": emp.skill_frying,
        "skill_cooking": emp.skill_cooking,
        "days": days_out,
    }
