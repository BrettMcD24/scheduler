from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..audit import log_action
from ..auth import check_store_access, get_current_user, require_manager
from ..database import get_db
from ..models import Role, Schedule, Shift, SwapRequest, SwapStatus, User
from ..schemas import SwapCreateIn, SwapDecisionIn, SwapDetailOut, SwapOut

router = APIRouter(prefix="/swaps", tags=["swaps"])


def _now():
    return datetime.now(timezone.utc)


@router.post("", response_model=SwapOut)
def create_swap(
    body: SwapCreateIn,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    shift = db.get(Shift, body.shift_id)
    if not shift:
        raise HTTPException(404, "Shift not found")
    if shift.employee_id != actor.id and actor.role == Role.employee:
        raise HTTPException(403, "You can only swap your own shifts")

    if body.target_employee_id is not None or body.target_shift_id is not None:
        schedule = db.get(Schedule, shift.schedule_id)
        target_shift = None
        target_employee_id = body.target_employee_id
        if body.target_shift_id is not None:
            target_shift = db.get(Shift, body.target_shift_id)
            if not target_shift or target_shift.schedule_id != shift.schedule_id:
                raise HTTPException(422, "Target shift not found in this schedule")
            if target_shift.employee_id is None:
                raise HTTPException(422, "Target shift has no assigned employee")
            # the target employee is whoever holds the target shift
            target_employee_id = target_shift.employee_id
        target = db.get(User, target_employee_id)
        if not target or target.store_id != schedule.store_id:
            raise HTTPException(422, "Target employee not found at this store")
        if target.id == shift.employee_id:
            raise HTTPException(422, "Cannot swap a shift with yourself")
        status = SwapStatus.pending_coworker
    else:
        target_employee_id = None
        status = SwapStatus.open

    existing = (
        db.query(SwapRequest)
        .filter(
            SwapRequest.shift_id == shift.id,
            SwapRequest.status.in_(
                [SwapStatus.open, SwapStatus.pending_coworker, SwapStatus.pending_manager]
            ),
        )
        .first()
    )
    if existing:
        raise HTTPException(409, "An active swap request already exists for this shift")

    swap = SwapRequest(
        shift_id=shift.id,
        requesting_employee_id=shift.employee_id,
        target_employee_id=target_employee_id,
        target_shift_id=body.target_shift_id,
        drop_reason=body.drop_reason,
        status=status,
    )
    db.add(swap)
    db.commit()
    db.refresh(swap)
    log_action(
        db, "swap", swap.id, "created", actor.id,
        shift_id=shift.id, target=target_employee_id,
        target_shift_id=body.target_shift_id,
    )
    db.commit()
    return swap


@router.post("/{swap_id}/claim", response_model=SwapOut)
def claim_open_swap(
    swap_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Claim a shift that was dropped to the pool (no target)."""
    swap = db.get(SwapRequest, swap_id)
    if not swap or swap.status != SwapStatus.open:
        raise HTTPException(404, "Open swap not found")
    shift = db.get(Shift, swap.shift_id)
    schedule = db.get(Schedule, shift.schedule_id)
    if actor.store_id != schedule.store_id:
        raise HTTPException(403, "Not your store")
    if actor.id == swap.requesting_employee_id:
        raise HTTPException(422, "Cannot claim your own dropped shift")
    swap.target_employee_id = actor.id
    swap.status = SwapStatus.pending_manager
    swap.coworker_accepted_at = _now()
    db.commit()
    db.refresh(swap)
    log_action(db, "swap", swap.id, "claimed", actor.id)
    db.commit()
    return swap


@router.post("/{swap_id}/accept", response_model=SwapOut)
def coworker_accept(
    swap_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    swap = db.get(SwapRequest, swap_id)
    if not swap or swap.status != SwapStatus.pending_coworker:
        raise HTTPException(404, "Pending swap not found")
    if swap.target_employee_id != actor.id:
        raise HTTPException(403, "This swap is not addressed to you")
    swap.status = SwapStatus.pending_manager
    swap.coworker_accepted_at = _now()
    db.commit()
    db.refresh(swap)
    log_action(db, "swap", swap.id, "coworker_accepted", actor.id)
    db.commit()
    return swap


@router.post("/{swap_id}/decline", response_model=SwapOut)
def coworker_decline(
    swap_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    swap = db.get(SwapRequest, swap_id)
    if not swap or swap.status != SwapStatus.pending_coworker:
        raise HTTPException(404, "Pending swap not found")
    if swap.target_employee_id != actor.id:
        raise HTTPException(403, "This swap is not addressed to you")
    swap.status = SwapStatus.cancelled
    db.commit()
    db.refresh(swap)
    log_action(db, "swap", swap.id, "coworker_declined", actor.id)
    db.commit()
    return swap


@router.post("/{swap_id}/approve", response_model=SwapOut)
def manager_approve(
    swap_id: int,
    body: SwapDecisionIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    swap = db.get(SwapRequest, swap_id)
    if not swap or swap.status != SwapStatus.pending_manager:
        raise HTTPException(404, "Swap awaiting manager approval not found")
    shift = db.get(Shift, swap.shift_id)
    schedule = db.get(Schedule, shift.schedule_id)
    check_store_access(actor, schedule.store_id)

    old_employee = shift.employee_id
    shift.employee_id = swap.target_employee_id
    shift.was_swapped = True

    # Two-sided trade: if there's a target shift, the requester takes it.
    if swap.target_shift_id is not None:
        target_shift = db.get(Shift, swap.target_shift_id)
        if target_shift:
            target_shift.employee_id = old_employee
            target_shift.was_swapped = True

    swap.status = SwapStatus.approved
    swap.decided_by = actor.id
    swap.decided_at = _now()
    swap.manager_note = body.note
    db.commit()
    db.refresh(swap)
    log_action(
        db, "shift", shift.id, "swap_approved", actor.id,
        from_employee=old_employee, to_employee=swap.target_employee_id,
        swap_id=swap.id, target_shift_id=swap.target_shift_id,
    )
    db.commit()
    return swap


@router.post("/{swap_id}/deny", response_model=SwapOut)
def manager_deny(
    swap_id: int,
    body: SwapDecisionIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    swap = db.get(SwapRequest, swap_id)
    if not swap or swap.status not in (
        SwapStatus.pending_manager,
        SwapStatus.pending_coworker,
        SwapStatus.open,
    ):
        raise HTTPException(404, "Active swap not found")
    shift = db.get(Shift, swap.shift_id)
    schedule = db.get(Schedule, shift.schedule_id)
    check_store_access(actor, schedule.store_id)
    swap.status = SwapStatus.denied
    swap.decided_by = actor.id
    swap.decided_at = _now()
    swap.manager_note = body.note
    db.commit()
    db.refresh(swap)
    log_action(db, "swap", swap.id, "denied", actor.id)
    db.commit()
    return swap


@router.post("/{swap_id}/cancel", response_model=SwapOut)
def cancel_swap(
    swap_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """The requester cancels their own swap before a manager decides on it."""
    swap = db.get(SwapRequest, swap_id)
    if not swap:
        raise HTTPException(404, "Swap not found")
    if swap.requesting_employee_id != actor.id and actor.role == Role.employee:
        raise HTTPException(403, "You can only cancel your own swap requests")
    if swap.status not in (
        SwapStatus.open,
        SwapStatus.pending_coworker,
        SwapStatus.pending_manager,
    ):
        raise HTTPException(422, "Only requests not yet decided can be cancelled")
    swap.status = SwapStatus.cancelled
    db.commit()
    db.refresh(swap)
    log_action(db, "swap", swap.id, "cancelled_by_requester", actor.id)
    db.commit()
    return swap


@router.get("", response_model=list[SwapOut])
def list_swaps(
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(SwapRequest).join(Shift, SwapRequest.shift_id == Shift.id).join(Schedule)
    if user.role == Role.employee:
        q = q.filter(
            (SwapRequest.requesting_employee_id == user.id)
            | (SwapRequest.target_employee_id == user.id)
            | (
                (SwapRequest.status == SwapStatus.open)
                & (Schedule.store_id == user.store_id)
            )
        )
    elif user.role == Role.manager:
        q = q.filter(Schedule.store_id == user.store_id)
    if status:
        q = q.filter(SwapRequest.status == SwapStatus(status))
    return q.order_by(SwapRequest.created_at.desc()).all()


def _shift_summary(s):
    if not s:
        return None
    return {
        "id": s.id,
        "on_date": s.on_date,
        "start_time": s.start_time,
        "end_time": s.end_time,
        "is_close": s.is_close,
    }


@router.get("/{swap_id}/detail", response_model=SwapDetailOut)
def swap_detail(
    swap_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    """Enriched detail for the manager 'View Request' panel: both employees
    and both shifts (original + proposed)."""
    swap = db.get(SwapRequest, swap_id)
    if not swap:
        raise HTTPException(404, "Swap not found")
    req_shift = db.get(Shift, swap.shift_id)
    schedule = db.get(Schedule, req_shift.schedule_id)
    check_store_access(actor, schedule.store_id)

    requester = db.get(User, swap.requesting_employee_id)
    target = db.get(User, swap.target_employee_id) if swap.target_employee_id else None
    target_shift = db.get(Shift, swap.target_shift_id) if swap.target_shift_id else None

    return {
        "id": swap.id,
        "status": swap.status.value,
        "requesting_employee_id": swap.requesting_employee_id,
        "requesting_employee_name": f"{requester.first_name} {requester.last_name}" if requester else "—",
        "target_employee_id": swap.target_employee_id,
        "target_employee_name": f"{target.first_name} {target.last_name}" if target else None,
        "requesting_shift": _shift_summary(req_shift),
        "target_shift": _shift_summary(target_shift),
        "manager_note": swap.manager_note,
        "drop_reason": swap.drop_reason,
        "created_at": swap.created_at,
        "decided_at": swap.decided_at,
    }
