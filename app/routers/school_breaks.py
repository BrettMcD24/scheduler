"""Non-school date ranges, plus the audit trail for changes to them.

A range marks dates when school is out for the store's area. Minor labor rules
are NOT suspended on those dates — the non-school tier of limits applies
instead (longer daily/weekly caps, later permitted hours), which is what the
statutes provide. There is deliberately no switch that turns the checks off.

Every create and delete is written to the audit log. Audit entries have no
delete endpoint and are surfaced for one year.
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..audit import log_action
from ..auth import check_store_access, get_current_user, require_manager
from ..database import get_db
from ..models import AuditLog, Role, SchoolBreak, User
from ..schemas import AuditEntryOut, SchoolBreakIn, SchoolBreakOut

router = APIRouter(prefix="/school-breaks", tags=["school-breaks"])

# NY requires payroll/hour records for minors be retained SIX years
# (NY Labor Law s.661). These ranges can justify a minor's hours in an audit,
# so they are kept for the same period.
AUDIT_RETENTION_DAYS = 365 * 6
ENTITY = "school_break"


def _out(db: Session, row: SchoolBreak) -> dict:
    creator = db.get(User, row.created_by)
    return {
        "id": row.id,
        "store_id": row.store_id,
        "name": row.name,
        "start_date": row.start_date,
        "end_date": row.end_date,
        "created_by": row.created_by,
        "created_by_name": (
            f"{creator.first_name} {creator.last_name}" if creator else None
        ),
        "created_at": row.created_at,
    }


@router.post("", response_model=SchoolBreakOut)
def create_break(
    body: SchoolBreakIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    if actor.store_id is None and actor.role != Role.super_admin:
        raise HTTPException(422, "Your account isn't linked to a store")
    store_id = actor.store_id
    if store_id is None:
        raise HTTPException(422, "store_id required")
    check_store_access(actor, store_id)

    if body.end_date < body.start_date:
        raise HTTPException(422, "end_date cannot be before start_date")
    if not body.name.strip():
        raise HTTPException(422, "Name is required")

    row = SchoolBreak(
        store_id=store_id,
        name=body.name.strip(),
        start_date=body.start_date,
        end_date=body.end_date,
        created_by=actor.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_action(
        db, ENTITY, row.id, "created", actor.id,
        name=row.name, start=str(row.start_date), end=str(row.end_date),
    )
    db.commit()
    return _out(db, row)


@router.get("", response_model=list[SchoolBreakOut])
def list_breaks(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    q = db.query(SchoolBreak)
    if actor.role != Role.super_admin:
        q = q.filter(SchoolBreak.store_id == actor.store_id)
    rows = q.order_by(SchoolBreak.start_date.desc()).all()
    return [_out(db, r) for r in rows]


@router.delete("/{break_id}")
def delete_break(
    break_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    """Removes the range. The audit record of its creation and removal stays."""
    row = db.get(SchoolBreak, break_id)
    if not row:
        raise HTTPException(404, "Date range not found")
    check_store_access(actor, row.store_id)
    log_action(
        db, ENTITY, row.id, "deleted", actor.id,
        name=row.name, start=str(row.start_date), end=str(row.end_date),
    )
    db.delete(row)
    db.commit()
    return {"deleted": break_id}


@router.get("/audit", response_model=list[AuditEntryOut])
def list_audit(
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    """Immutable history of non-school range changes, retained for one year.

    There is no endpoint to modify or delete these entries. Entries older than
    AUDIT_RETENTION_DAYS are not returned.
    """
    cutoff = date.today() - timedelta(days=AUDIT_RETENTION_DAYS)
    rows = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == ENTITY)
        .order_by(AuditLog.created_at.desc())
        .all()
    )
    out = []
    for r in rows:
        if r.created_at.date() < cutoff:
            continue
        actor_user = db.get(User, r.actor_id) if r.actor_id else None
        # scope to the manager's own store by resolving the actor's store
        if actor.role != Role.super_admin and actor_user is not None:
            if actor_user.store_id not in (None, actor.store_id):
                continue
        out.append(
            {
                "id": r.id,
                "entity_type": r.entity_type,
                "entity_id": r.entity_id,
                "action": r.action,
                "actor_id": r.actor_id,
                "actor_name": (
                    f"{actor_user.first_name} {actor_user.last_name}"
                    if actor_user
                    else None
                ),
                "details": r.details,
                "created_at": r.created_at,
            }
        )
    return out
