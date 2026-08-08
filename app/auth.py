import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import Role, User

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
TOKEN_TTL_HOURS = 24 * 7

_bearer = HTTPBearer(auto_error=False)


# --- password hashing (pbkdf2, stdlib only) ---

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), 200_000
    ).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), 200_000
    ).hex()
    return hmac.compare_digest(candidate, digest)


# --- tokens ---

def create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user


def require_manager(user: User = Depends(get_current_user)) -> User:
    if user.role not in (Role.manager, Role.super_admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Manager access required")
    return user


def require_super_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.super_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Super admin access required")
    return user


def check_store_access(user: User, store_id: int) -> None:
    """Managers can only act on their own store; super admins on any."""
    if user.role == Role.super_admin:
        return
    if user.store_id != store_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this store")
