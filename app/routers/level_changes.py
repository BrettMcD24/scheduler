"""Skill-level changes.

Level increases require super-admin sign-off, because level drives scheduling
authority and pay banding. Decreases apply immediately — a manager can always
demote within their own store. Super admins change levels directly.

Position certifications (dressing/cashing/frying/cooking) are edited through
the normal employee PATCH and are NOT gated here.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..audit import log_action
from ..auth import check_store_access, get_current_user, require_manager
from ..database import get_db
from ..models import LevelChangeRequest, RequestStatus, Role, User
from ..schemas import LevelChangeIn, LevelChangeOut

router = APIRouter(prefix="/level-changes", tags=["level-changes"])


def _now():
    return datetime.now(timezone.utc)


def _out(db: Session, row: LevelChangeRequest) -> dict:
    emp = db.get(User, row.employee_id)
    req = db.get(User, row.requested_by)
    return {
        "id": row.id,
        "employee_id": row.employee_id,
        "employee_name": f"{emp.first_name} {emp.last_name}" if emp else None,
        "store_id": row.store_id,
        "from_level": row.from_level,
        "to_level": row.to_level,
        "reason": row.reason,
        "status": row.status.value,
        "requested_by": row.requested_by,
        "requested_by_name": f"{req.first_name} {req.last_name}" if req else None,
        "admin_note": row.admin_note,
        "created_at": row.created_at,
        "decided_at": row.decided_at,
    }


@router.post("", response_model=LevelChangeOut)
def request_level_change(
    body: LevelChangeIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    if body.to_level < 1 or body.to_level > 5:
        raise HTTPException(422, "Level must be between 1 and 5")
    emp = db.get(User, body.employee_id)
    if not emp:
        raise HTTPException(404, "Employee not found")
    if emp.store_id is None:
        raise HTTPException(422, "Employee is not linked to a store")
    check_store_access(actor, emp.store_id)

    current = emp.skill_level
    if current == body.to_level:
        raise HTTPException(422, "Employee is already at that level")

    is_increase = current is None or body.to_level > current

    # Super admin, or any decrease -> apply now.
    if actor.role == Role.super_admin or not is_increase:
        emp.skill_level = body.to_level
        row = LevelChangeRequest(
            employee_id=emp.id,
            store_id=emp.store_id,
            from_level=current,
            to_level=body.to_level,
            reason=body.reason,
            status=RequestStatus.approved,
            requested_by=actor.id,
            decided_by=actor.id,
            decided_at=_now(),
            admin_note=(
                "Applied directly by super admin"
                if actor.role == Role.super_admin
                else "Decrease — no approval required"
            ),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        log_action(
            db, "level_change", row.id, "applied", actor.id,
            employee_id=emp.id, from_level=current, to_level=body.to_level,
        )
        db.commit()
        return _out(db, row)

    # Manager requesting an increase -> hold for super admin.
    existing = (
        db.query(LevelChangeRequest)
        .filter(
            LevelChangeRequest.employee_id == emp.id,
            LevelChangeRequest.status == RequestStatus.pending,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            409, "A level change for this employee is already awaiting approval"
        )

    row = LevelChangeRequest(
        employee_id=emp.id,
        store_id=emp.store_id,
        from_level=current,
        to_level=body.to_level,
        reason=body.reason,
        status=RequestStatus.pending,
        requested_by=actor.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_action(
        db, "level_change", row.id, "requested", actor.id,
        employee_id=emp.id, from_level=current, to_level=body.to_level,
    )
    db.commit()
    return _out(db, row)


@router.get("", response_model=list[LevelChangeOut])
def list_level_changes(
    status: str | None = None,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if actor.role == Role.employee:
        raise HTTPException(403, "Managers only")
    q = db.query(LevelChangeRequest)
    if actor.role != Role.super_admin:
        q = q.filter(LevelChangeRequest.store_id == actor.store_id)
    if status:
        q = q.filter(LevelChangeRequest.status == RequestStatus(status))
    rows = q.order_by(LevelChangeRequest.created_at.desc()).all()
    return [_out(db, r) for r in rows]


@router.post("/{request_id}/approve", response_model=LevelChangeOut)
def approve_level_change(
    request_id: int,
    note: str = "",
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if actor.role != Role.super_admin:
        raise HTTPException(403, "Only a super admin can approve level increases")
    row = db.get(LevelChangeRequest, request_id)
    if not row:
        raise HTTPException(404, "Request not found")
    if row.status != RequestStatus.pending:
        raise HTTPException(422, "Request has already been decided")

    emp = db.get(User, row.employee_id)
    emp.skill_level = row.to_level
    row.status = RequestStatus.approved
    row.decided_by = actor.id
    row.decided_at = _now()
    row.admin_note = note
    db.commit()
    db.refresh(row)
    log_action(
        db, "level_change", row.id, "approved", actor.id,
        employee_id=emp.id, to_level=row.to_level,
    )
    db.commit()
    return _out(db, row)


@router.post("/{request_id}/deny", response_model=LevelChangeOut)
def deny_level_change(
    request_id: int,
    note: str = "",
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if actor.role != Role.super_admin:
        raise HTTPException(403, "Only a super admin can deny level increases")
    row = db.get(LevelChangeRequest, request_id)
    if not row:
        raise HTTPException(404, "Request not found")
    if row.status != RequestStatus.pending:
        raise HTTPException(422, "Request has already been decided")
    row.status = RequestStatus.denied
    row.decided_by = actor.id
    row.decided_at = _now()
    row.admin_note = note
    db.commit()
    db.refresh(row)
    log_action(db, "level_change", row.id, "denied", actor.id)
    db.commit()
    return _out(db, row)
