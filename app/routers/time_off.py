from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..audit import log_action
from ..auth import check_store_access, get_current_user, require_manager
from ..database import get_db
from ..models import RequestStatus, Role, TimeOffRequest, User
from ..schemas import TimeOffDecisionIn, TimeOffIn, TimeOffOut

router = APIRouter(prefix="/time-off", tags=["time-off"])


@router.post("", response_model=TimeOffOut)
def create_request(
    body: TimeOffIn,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if body.start_date > body.end_date:
        raise HTTPException(422, "start_date must be on or before end_date")
    row = TimeOffRequest(employee_id=actor.id, **body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    log_action(
        db, "time_off", row.id, "created", actor.id,
        start=str(body.start_date), end=str(body.end_date),
    )
    db.commit()
    return row


@router.get("", response_model=list[TimeOffOut])
def list_requests(
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(TimeOffRequest).join(User, TimeOffRequest.employee_id == User.id)
    if user.role == Role.employee:
        q = q.filter(TimeOffRequest.employee_id == user.id)
    elif user.role == Role.manager:
        q = q.filter(User.store_id == user.store_id)
    if status:
        q = q.filter(TimeOffRequest.status == RequestStatus(status))
    return q.order_by(TimeOffRequest.created_at.desc()).all()


def _decide(
    request_id: int,
    new_status: RequestStatus,
    note: str,
    db: Session,
    actor: User,
) -> TimeOffRequest:
    row = db.get(TimeOffRequest, request_id)
    if not row or row.status != RequestStatus.pending:
        raise HTTPException(404, "Pending request not found")
    employee = db.get(User, row.employee_id)
    if employee.store_id:
        check_store_access(actor, employee.store_id)
    row.status = new_status
    row.manager_note = note
    row.decided_by = actor.id
    row.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    log_action(db, "time_off", row.id, new_status.value, actor.id)
    db.commit()
    return row


@router.post("/{request_id}/approve", response_model=TimeOffOut)
def approve(
    request_id: int,
    body: TimeOffDecisionIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    return _decide(request_id, RequestStatus.approved, body.note, db, actor)


@router.post("/{request_id}/deny", response_model=TimeOffOut)
def deny(
    request_id: int,
    body: TimeOffDecisionIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    return _decide(request_id, RequestStatus.denied, body.note, db, actor)


@router.post("/{request_id}/cancel", response_model=TimeOffOut)
def cancel(
    request_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    row = db.get(TimeOffRequest, request_id)
    if not row or row.employee_id != actor.id:
        raise HTTPException(404, "Request not found")
    if row.status != RequestStatus.pending:
        raise HTTPException(422, "Only pending requests can be cancelled")
    row.status = RequestStatus.cancelled
    db.commit()
    db.refresh(row)
    log_action(db, "time_off", row.id, "cancelled", actor.id)
    db.commit()
    return row
