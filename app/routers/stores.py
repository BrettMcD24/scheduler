from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import check_store_access, get_current_user, require_super_admin
from ..database import get_db
from ..models import Role, Store, User
from ..schemas import StoreIn, StoreOut

router = APIRouter(prefix="/stores", tags=["stores"])


@router.post("", response_model=StoreOut)
def create_store(
    body: StoreIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    store = Store(**body.model_dump())
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


@router.get("", response_model=list[StoreOut])
def list_stores(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Store)
    if user.role != Role.super_admin:
        q = q.filter(Store.id == user.store_id)
    return q.all()


@router.get("/{store_id}", response_model=StoreOut)
def get_store(
    store_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    store = db.get(Store, store_id)
    if not store:
        raise HTTPException(404, "Store not found")
    check_store_access(user, store_id)
    return store


@router.patch("/{store_id}", response_model=StoreOut)
def update_store(
    store_id: int,
    body: StoreIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    store = db.get(Store, store_id)
    if not store:
        raise HTTPException(404, "Store not found")
    for key, value in body.model_dump().items():
        setattr(store, key, value)
    db.commit()
    db.refresh(store)
    return store
