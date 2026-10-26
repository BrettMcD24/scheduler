from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..audit import log_action
from ..auth import check_store_access, get_current_user, require_manager
from ..database import get_db
from ..models import Role, Schedule, Shift, SwapRequest, SwapStatus, User
from ..shift_rules import preview_assignment_issues, unmet_board_criteria
from ..skills import SKILL_ORDER
from ..shift_rules import parse_shift_code
from ..schemas import (
    OpenShiftPostIn,
    SwapCreateIn,
    SwapDecisionIn,
    SwapDetailOut,
    SwapOut,
)

router = APIRouter(prefix="/swaps", tags=["swaps"])


def _now():
    return datetime.now(timezone.utc)


def _block_if_illegal(db, schedule, employee_id, gaining, losing=None):
    """Refuse a pickup that would breach minor labor law or double-book.

    Those limits are statutory, so they are a hard stop rather than a warning.
    Availability is intentionally not checked here — picking up outside your
    posted availability is allowed.
    """
    blocking, _ = preview_assignment_issues(
        db, schedule, employee_id, gaining, losing
    )
    if blocking:
        raise HTTPException(409, blocking[0].message)


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

    # A manager-posted shift can carry criteria (certifications / level).
    missing = unmet_board_criteria(actor, swap.required_skills, swap.min_skill_level)
    if missing:
        raise HTTPException(
            409,
            "This shift asks for " + ", ".join(missing)
            + ". Ask your manager if you think that's wrong.",
        )

    _block_if_illegal(db, schedule, actor.id, shift, losing=None)

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

    shift = db.get(Shift, swap.shift_id)
    schedule = db.get(Schedule, shift.schedule_id)
    # In a two-sided trade the accepter gives up their own shift, so the net
    # hours change is what matters.
    losing = db.get(Shift, swap.target_shift_id) if swap.target_shift_id else None
    _block_if_illegal(db, schedule, actor.id, shift, losing=losing)

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

    # Re-check at the decision point: the week may have changed since the
    # employee claimed it, so a pickup that was legal then may not be now.
    if swap.target_employee_id:
        losing = db.get(Shift, swap.target_shift_id) if swap.target_shift_id else None
        _block_if_illegal(db, schedule, swap.target_employee_id, shift, losing=losing)
        # the requester takes the other side of a two-sided trade
        if swap.target_shift_id and shift.employee_id:
            other = db.get(Shift, swap.target_shift_id)
            if other:
                _block_if_illegal(
                    db, schedule, shift.employee_id, other, losing=shift
                )

    old_employee = shift.employee_id
    shift.employee_id = swap.target_employee_id
    # a shift that had nobody on it was filled, not swapped
    shift.was_swapped = old_employee is not None

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

    # What a manager should know before approving: overtime, over-desired-max.
    warnings: list[str] = []
    if swap.target_employee_id and swap.status != SwapStatus.approved:
        losing = db.get(Shift, swap.target_shift_id) if swap.target_shift_id else None
        _, warn = preview_assignment_issues(
            db, schedule, swap.target_employee_id, req_shift, losing
        )
        warnings = [w.message for w in warn]

    return {
        "id": swap.id,
        "status": swap.status.value,
        "warnings": warnings,
        "board_message": swap.board_message,
        "required_skills": swap.required_skills,
        "min_skill_level": swap.min_skill_level,
        "posted_by_manager": swap.posted_by_manager,
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


@router.post("/open-shift", response_model=SwapOut)
def post_open_shift(
    body: OpenShiftPostIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    """Put a shift on the board for anyone at the store to claim.

    Use for a shift nobody is assigned to yet, or one being given up. The
    manager can attach a message and criteria ("closer who can dress"), and
    only employees meeting the criteria can claim it.
    """
    if body.shift_id is not None:
        shift = db.get(Shift, body.shift_id)
        if not shift:
            raise HTTPException(404, "Shift not found")
        schedule = db.get(Schedule, shift.schedule_id)
        check_store_access(actor, schedule.store_id)
    else:
        if not (body.schedule_id and body.on_date and body.code):
            raise HTTPException(
                422, "Provide shift_id, or schedule_id + on_date + code"
            )
        schedule = db.get(Schedule, body.schedule_id)
        if not schedule:
            raise HTTPException(404, "Schedule not found")
        check_store_access(actor, schedule.store_id)
        week_end = date.fromordinal(schedule.week_start.toordinal() + 6)
        if not (schedule.week_start <= body.on_date <= week_end):
            raise HTTPException(422, "Date is outside the schedule week")
        try:
            start, end, is_close, note = parse_shift_code(body.code, schedule.store)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        shift = Shift(
            schedule_id=schedule.id,
            employee_id=None,  # unfilled until somebody claims it
            on_date=body.on_date,
            start_time=start,
            end_time=end,
            is_close=is_close,
            notes=note,
        )
        db.add(shift)
        db.flush()

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
        raise HTTPException(409, "This shift is already on the board")

    bad = [
        k
        for k in [x.strip() for x in (body.required_skills or "").split(",") if x.strip()]
        if k not in SKILL_ORDER
    ]
    if bad:
        raise HTTPException(422, f"Unknown skill(s): {', '.join(bad)}")
    if body.min_skill_level is not None and not 1 <= body.min_skill_level <= 5:
        raise HTTPException(422, "min_skill_level must be between 1 and 5")

    swap = SwapRequest(
        shift_id=shift.id,
        # the manager is the one asking for coverage
        requesting_employee_id=actor.id,
        target_employee_id=None,
        target_shift_id=None,
        status=SwapStatus.open,
        posted_by_manager=True,
        board_message=body.message.strip(),
        required_skills=",".join(
            x.strip() for x in (body.required_skills or "").split(",") if x.strip()
        ),
        min_skill_level=body.min_skill_level,
    )
    db.add(swap)
    db.commit()
    db.refresh(swap)
    log_action(
        db, "swap", swap.id, "posted_to_board", actor.id,
        shift_id=shift.id, criteria=swap.required_skills,
        min_level=body.min_skill_level,
    )
    db.commit()
    return swap
