from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import (
    check_store_access,
    get_current_user,
    hash_password,
    require_manager,
)
from ..database import get_db
from ..models import Role, User
from ..schemas import DesiredHoursIn, EmployeeIn, EmployeeOut, EmployeeUpdate
from ..skills import SKILL_ORDER, assign_skills

router = APIRouter(prefix="/employees", tags=["employees"])


@router.post("", response_model=EmployeeOut)
def create_employee(
    body: EmployeeIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    if body.role not in (r.value for r in Role):
        raise HTTPException(422, "Invalid role")
    if body.role == Role.super_admin.value and actor.role != Role.super_admin:
        raise HTTPException(403, "Only super admins can create super admins")

    store_id = body.store_id if body.store_id is not None else actor.store_id
    if actor.role == Role.manager:
        store_id = actor.store_id  # managers can only add to their own store
    if store_id is None and body.role != Role.super_admin.value:
        raise HTTPException(422, "store_id is required")

    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(409, "Email already in use")
    if (
        body.desired_hours_min is not None
        and body.desired_hours_max is not None
        and body.desired_hours_min > body.desired_hours_max
    ):
        raise HTTPException(422, "desired_hours_min cannot exceed max")

    explicit_skills = {
        s: getattr(body, f"skill_{s}") for s in SKILL_ORDER
    }
    if all(v is None for v in explicit_skills.values()):
        is_manager = body.role in (Role.manager.value, Role.super_admin.value)
        skills = assign_skills(body.skill_level, is_manager)
    else:
        skills = {s: bool(v) for s, v in explicit_skills.items()}

    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
        role=Role(body.role),
        store_id=store_id,
        dob=body.dob,
        skill_level=body.skill_level,
        skill_dressing=skills["dressing"],
        skill_cashing=skills["cashing"],
        skill_frying=skills["frying"],
        skill_cooking=skills["cooking"],
        desired_hours_min=body.desired_hours_min,
        desired_hours_max=body.desired_hours_max,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("", response_model=list[EmployeeOut])
def list_employees(
    store_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(User)
    if user.role == Role.super_admin:
        if store_id is not None:
            q = q.filter(User.store_id == store_id)
    else:
        q = q.filter(User.store_id == user.store_id)
    return q.order_by(User.last_name).all()


@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    emp = db.get(User, employee_id)
    if not emp:
        raise HTTPException(404, "Employee not found")
    if user.role == Role.employee and user.id != employee_id:
        raise HTTPException(403, "Access denied")
    if emp.store_id:
        check_store_access(user, emp.store_id)
    return emp


@router.patch("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int,
    body: EmployeeUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_manager),
):
    emp = db.get(User, employee_id)
    if not emp:
        raise HTTPException(404, "Employee not found")
    if emp.store_id:
        check_store_access(actor, emp.store_id)
    data = body.model_dump(exclude_unset=True)
    if "role" in data:
        data["role"] = Role(data["role"])
    for key, value in data.items():
        setattr(emp, key, value)
    db.commit()
    db.refresh(emp)
    return emp


@router.put("/me/desired-hours", response_model=EmployeeOut)
def set_my_desired_hours(
    body: DesiredHoursIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.desired_hours_min > body.desired_hours_max:
        raise HTTPException(422, "Min cannot exceed max")
    user.desired_hours_min = body.desired_hours_min
    user.desired_hours_max = body.desired_hours_max
    db.commit()
    db.refresh(user)
    return user
