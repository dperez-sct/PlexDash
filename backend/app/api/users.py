from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime

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
class UserInvite(BaseModel):
    email: str


@router.post("/invite", response_model=UserSchema)
async def invite_user(invite: UserInvite, db: Session = Depends(get_db)):
    """Invite a user to the Plex server."""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == invite.email).first()
    if existing_user and not existing_user.deleted_from_plex:
        raise HTTPException(status_code=400, detail="User already exists")

    # Invite via Plex
    success = await plex_service.invite_friend(invite.email)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to invite user via Plex")

    # If user existed but was deleted, restore them
    if existing_user:
        existing_user.deleted_from_plex = False
        existing_user.is_active = True
        db.commit()
        db.refresh(existing_user)
        return existing_user

    # Create placeholder user (will be fully synced later)
    # We use email as plex_id temporarily until sync updates it with real ID
    new_user = User(
        plex_id=f"pending_{invite.email}",
        username=invite.email.split("@")[0],
        email=invite.email,
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    db.refresh(new_user)
    return new_user


@router.delete("/{user_id}/access")
async def remove_user_access(user_id: int, db: Session = Depends(get_db)):
    """Remove a user's library access (revoke all shared libraries)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Use python-plexapi to remove library access (keeps user as friend)
    identifier = user.username or user.email
    if not identifier:
        raise HTTPException(status_code=400, detail="User has no username or email")

    success = await plex_service.unshare_libraries(identifier)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to remove library access on Plex")
    
    # Update local status
    user.deleted_from_plex = True
    user.is_active = False
    db.commit()
    db.refresh(user)
    
    return {"message": "User library access removed successfully"}


@router.post("/{user_id}/reactivate")
async def reactivate_user(user_id: int, db: Session = Depends(get_db)):
    """Reactivate a user by restoring all shared libraries."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Use python-plexapi to share all libraries
    identifier = user.username or user.email
    if not identifier:
        raise HTTPException(status_code=400, detail="User has no username or email")

    success = await plex_service.share_libraries(identifier)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to restore library access on Plex")

    # Update local status
    user.deleted_from_plex = False
    user.is_active = True
    db.commit()
    db.refresh(user)

    return user
