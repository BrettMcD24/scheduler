from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import create_token, get_current_user, hash_password, verify_password
from ..database import get_db
from ..models import Role, User
from ..schemas import BootstrapIn, EmployeeOut, LoginIn, TokenOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/bootstrap", response_model=TokenOut)
def bootstrap(body: BootstrapIn, db: Session = Depends(get_db)):
    """Create the first super-admin. Only works on an empty user table."""
    if db.query(User).count() > 0:
        raise HTTPException(403, "Bootstrap already completed")
    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        role=Role.super_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_token(user))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(403, "Account is deactivated")
    return TokenOut(access_token=create_token(user))


@router.get("/me", response_model=EmployeeOut)
def me(user: User = Depends(get_current_user)):
    return user
