from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import check_store_access, get_current_user
from ..database import get_db
from ..models import Availability, AvailabilityException, Role, User
from ..schemas import (
    AvailabilityExceptionIn,
    AvailabilityExceptionOut,
    AvailabilityOut,
    AvailabilityWindowIn,
)

router = APIRouter(prefix="/availability", tags=["availability"])


def _can_edit(actor: User, employee_id: int, db: Session) -> User:
    target = db.get(User, employee_id)
    if not target:
        raise HTTPException(404, "Employee not found")
    if actor.id == employee_id:
        return target
    if actor.role in (Role.manager, Role.super_admin):
        if target.store_id:
            check_store_access(actor, target.store_id)
        return target
    raise HTTPException(403, "Access denied")


@router.put("/{employee_id}/windows", response_model=list[AvailabilityOut])
def replace_windows(
    employee_id: int,
    windows: list[AvailabilityWindowIn],
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Replace all recurring weekly availability windows for an employee."""
    _can_edit(actor, employee_id, db)
    for w in windows:
        if w.start_time >= w.end_time:
            raise HTTPException(422, "start_time must be before end_time")
    db.query(Availability).filter(Availability.employee_id == employee_id).delete()
    rows = [
        Availability(employee_id=employee_id, **w.model_dump()) for w in windows
    ]
    db.add_all(rows)
    db.commit()
    return (
        db.query(Availability)
        .filter(Availability.employee_id == employee_id)
        .order_by(Availability.day_of_week, Availability.start_time)
        .all()
    )


@router.get("/{employee_id}/windows", response_model=list[AvailabilityOut])
def get_windows(
    employee_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    _can_edit(actor, employee_id, db)
    return (
        db.query(Availability)
        .filter(Availability.employee_id == employee_id)
        .order_by(Availability.day_of_week, Availability.start_time)
        .all()
    )


@router.post("/{employee_id}/exceptions", response_model=AvailabilityExceptionOut)
def add_exception(
    employee_id: int,
    body: AvailabilityExceptionIn,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    _can_edit(actor, employee_id, db)
    existing = (
        db.query(AvailabilityException)
        .filter(
            AvailabilityException.employee_id == employee_id,
            AvailabilityException.on_date == body.on_date,
        )
        .first()
    )
    if existing:
        for key, value in body.model_dump().items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing
    row = AvailabilityException(employee_id=employee_id, **body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{employee_id}/exceptions", response_model=list[AvailabilityExceptionOut])
def list_exceptions(
    employee_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    _can_edit(actor, employee_id, db)
    return (
        db.query(AvailabilityException)
        .filter(AvailabilityException.employee_id == employee_id)
        .order_by(AvailabilityException.on_date)
        .all()
    )
