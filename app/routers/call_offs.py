from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..audit import log_action
from ..auth import check_store_access, require_manager
from ..database import get_db
from ..models import CallOff, Role, Shift, User
from ..schemas import CallOffIn, CallOffOut

router = APIRouter(prefix="/call-offs", tags=["call-offs"])


@router.post("", response_model=CallOffOut)
def create_call_off(
    body: CallOffIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    employee = db.get(User, body.employee_id)
    if not employee:
        raise HTTPException(404, "Employee not found")
    store_id = employee.store_id
    if store_id is None:
        raise HTTPException(422, "Employee is not linked to a store")
    check_store_access(actor, store_id)

    # If a shift was referenced, derive a label from it.
    label = body.shift_label
    if body.shift_id is not None:
        shift = db.get(Shift, body.shift_id)
        if shift and not label:
            label = f"{shift.start_time.strftime('%H:%M')}-{shift.end_time.strftime('%H:%M')}"

    row = CallOff(
        store_id=store_id,
        employee_id=body.employee_id,
        shift_id=body.shift_id,
        on_date=body.on_date,
        shift_label=label,
        reason=body.reason,
        created_by=actor.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_action(
        db, "call_off", row.id, "created", actor.id,
        employee_id=body.employee_id, date=str(body.on_date),
    )
    db.commit()
    return _with_name(row, employee)


@router.get("", response_model=list[CallOffOut])
def list_call_offs(
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    q = db.query(CallOff)
    if actor.role != Role.super_admin:
        q = q.filter(CallOff.store_id == actor.store_id)
    rows = q.order_by(CallOff.created_at.desc()).all()
    names = {
        u.id: f"{u.first_name} {u.last_name}"
        for u in db.query(User).filter(
            User.id.in_([r.employee_id for r in rows] or [0])
        )
    }
    return [
        {
            "id": r.id,
            "store_id": r.store_id,
            "employee_id": r.employee_id,
            "employee_name": names.get(r.employee_id),
            "shift_id": r.shift_id,
            "on_date": r.on_date,
            "shift_label": r.shift_label,
            "reason": r.reason,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.delete("/{call_off_id}")
def delete_call_off(
    call_off_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    row = db.get(CallOff, call_off_id)
    if not row:
        raise HTTPException(404, "Call-off not found")
    check_store_access(actor, row.store_id)
    db.delete(row)
    log_action(db, "call_off", call_off_id, "deleted", actor.id)
    db.commit()
    return {"deleted": call_off_id}


def _with_name(row: CallOff, employee: User) -> dict:
    return {
        "id": row.id,
        "store_id": row.store_id,
        "employee_id": row.employee_id,
        "employee_name": f"{employee.first_name} {employee.last_name}",
        "shift_id": row.shift_id,
        "on_date": row.on_date,
        "shift_label": row.shift_label,
        "reason": row.reason,
        "created_at": row.created_at,
    }
