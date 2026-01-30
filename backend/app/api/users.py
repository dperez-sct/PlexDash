from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.subscription import Subscription
from app.schemas import User as UserSchema, UserCreate, UserUpdate, SubscriptionCreate, Subscription as SubscriptionSchema
from app.services.plex import plex_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=List[UserSchema])
def get_users(skip: int = 0, limit: int = 100, include_deleted: bool = False, db: Session = Depends(get_db)):
    query = db.query(User)
    if not include_deleted:
        query = query.filter(User.deleted_from_plex == False)
    users = query.offset(skip).limit(limit).all()
    return users


@router.get("/{user_id}", response_model=UserSchema)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/", response_model=UserSchema)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.plex_id == user.plex_id).first()
    if db_user:
        raise HTTPException(status_code=400, detail="User already exists")

    db_user = User(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.put("/{user_id}/toggle-active", response_model=UserSchema)
def toggle_user_active(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserSchema)
def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.post("/sync")
async def sync_plex_users(db: Session = Depends(get_db)):
    """Sync users from Plex server."""
    # Load latest settings from database
    plex_service.load_from_db(db)

    if not plex_service.is_configured():
        raise HTTPException(
            status_code=400,
            detail="Plex not configured. Please configure Plex URL and token in Settings."
        )

    plex_users = await plex_service.get_users()
    plex_ids = {user["plex_id"] for user in plex_users}

    synced = 0
    restored = 0
    for plex_user in plex_users:
        existing = db.query(User).filter(User.plex_id == plex_user["plex_id"]).first()
        if existing:
            existing.username = plex_user["username"]
            existing.email = plex_user["email"]
            existing.thumb = plex_user["thumb"]
            if existing.deleted_from_plex:
                existing.deleted_from_plex = False
                restored += 1
        else:
            new_user = User(**plex_user)
            db.add(new_user)
            synced += 1

    # Mark users not in Plex as deleted
    deleted = db.query(User).filter(
        User.plex_id.notin_(plex_ids),
        User.deleted_from_plex == False
    ).update({User.deleted_from_plex: True}, synchronize_session=False)

    db.commit()
    return {
        "message": f"Synced {synced} new users, {deleted} marked as deleted, {restored} restored",
        "total": len(plex_users),
        "new": synced,
        "deleted": deleted,
        "restored": restored
    }


@router.post("/{user_id}/subscription", response_model=SubscriptionSchema)
def create_subscription(user_id: int, subscription: SubscriptionCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db_subscription = Subscription(**subscription.model_dump())
    db.add(db_subscription)
    db.commit()
    db.refresh(db_subscription)
    return db_subscription


@router.get("/{user_id}/subscriptions", response_model=List[SubscriptionSchema])
def get_user_subscriptions(user_id: int, db: Session = Depends(get_db)):
    subscriptions = db.query(Subscription).filter(Subscription.user_id == user_id).all()
    return subscriptions
