"""Tautulli integration API routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import extract
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models.settings import Settings
from app.models.user import User
from app.models.monthly_payment import MonthlyPayment
from app.services.tautulli import tautulli_service
from app.api.settings import get_setting, set_setting

router = APIRouter(tags=["tautulli"])


# ---- Settings endpoints (protected, under /api/settings/tautulli) ----

settings_router = APIRouter(prefix="/settings/tautulli", tags=["tautulli-settings"])


class TautulliSettings(BaseModel):
    tautulli_url: Optional[str] = None
    tautulli_api_key: Optional[str] = None
    kill_message: Optional[str] = None
    warn_mode: Optional[str] = None


@settings_router.get("")
def get_tautulli_settings(db: Session = Depends(get_db)):
    url = get_setting(db, "tautulli_url")
    api_key = get_setting(db, "tautulli_api_key")
    return {
        "tautulli_url": url or "",
        "configured": bool(url and api_key),
        "kill_message": get_setting(db, "tautulli_kill_message") or "",
        "warn_mode": get_setting(db, "kill_stream_warn_mode") or WARN_MODE_ALWAYS,
    }


@settings_router.put("")
def update_tautulli_settings(data: TautulliSettings, db: Session = Depends(get_db)):
    if data.tautulli_url:
        set_setting(db, "tautulli_url", data.tautulli_url)
    if data.tautulli_api_key:
        set_setting(db, "tautulli_api_key", data.tautulli_api_key)
    if data.kill_message is not None:
        set_setting(db, "tautulli_kill_message", data.kill_message)
    if data.warn_mode is not None:
        if data.warn_mode not in [WARN_MODE_ALWAYS, WARN_MODE_ONCE_PER_DAY, WARN_MODE_DISABLED]:
            raise HTTPException(status_code=400, detail=f"Invalid warn_mode: {data.warn_mode}")
        set_setting(db, "kill_stream_warn_mode", data.warn_mode)
    # Reload service config
    tautulli_service.load_from_db(db)
    return {"message": "Tautulli settings saved"}


@settings_router.post("/test")
async def test_tautulli(db: Session = Depends(get_db)):
    tautulli_service.load_from_db(db)
    if not tautulli_service.is_configured():
        raise HTTPException(status_code=400, detail="Tautulli no está configurado")
    result = await tautulli_service.test_connection()
    return result


# ---- Public check endpoint (called by Tautulli on playback start) ----

WARN_MODE_ALWAYS = "always"          # Kill every play while debtor
WARN_MODE_ONCE_PER_DAY = "once_per_day"  # Kill first play of each day
WARN_MODE_DISABLED = "disabled"       # Never kill (monitoring only)

@router.get("/tautulli/check/{plex_id}")
async def check_user_payment(plex_id: str, db: Session = Depends(get_db)):
    """
    Called by Tautulli on Playback Start.
    Returns detailed debug info so scripts can log the reason.
    """
    from datetime import date

    user = db.query(User).filter(User.plex_id == plex_id).first()

    if not user:
        return {
            "action": "allow",
            "reason": "user_not_found",
            "message": "",
            "user_found": False,
        }

    # Check if kill stream is enabled for this user
    if not user.kill_stream_enabled:
        return {
            "action": "allow",
            "reason": "kill_stream_disabled",
            "message": "",
            "user_found": True,
            "username": user.username,
            "kill_stream_enabled": False,
        }

    # Get warn mode setting (default: always kill)
    warn_mode = get_setting(db, "kill_stream_warn_mode") or WARN_MODE_ALWAYS

    if warn_mode == WARN_MODE_DISABLED:
        return {
            "action": "allow",
            "reason": "warn_mode_disabled",
            "message": "",
            "user_found": True,
            "username": user.username,
            "kill_stream_enabled": True,
            "warn_mode": warn_mode,
        }

    now = datetime.utcnow()
    current_year = now.year
    current_month = now.month

    # Count unpaid months up to and including current month
    unpaid_months = db.query(MonthlyPayment).filter(
        MonthlyPayment.user_id == user.id,
        MonthlyPayment.year == current_year,
        MonthlyPayment.month <= current_month,
        MonthlyPayment.is_paid == False,
    ).count()

    if unpaid_months == 0:
        return {
            "action": "allow",
            "reason": "no_debt",
            "message": "",
            "user_found": True,
            "username": user.username,
            "unpaid_months": 0,
            "kill_stream_enabled": True,
            "warn_mode": warn_mode,
        }

    # User has debt — check warn-once-per-day if applicable
    today = date.today()
    if warn_mode == WARN_MODE_ONCE_PER_DAY and user.last_warned_at == today:
        return {
            "action": "allow",
            "reason": "already_warned_today",
            "message": "",
            "user_found": True,
            "username": user.username,
            "unpaid_months": unpaid_months,
            "already_warned": True,
            "last_warned_at": today.isoformat(),
            "warn_mode": warn_mode,
        }

    # ---- KILL the stream ----
    # Persist warned state in DB and increment counter
    user.last_warned_at = today
    user.warn_count = (user.warn_count or 0) + 1
    db.commit()

    custom_msg = get_setting(db, "tautulli_kill_message")
    if custom_msg:
        message = custom_msg.replace("{username}", user.username).replace("{months}", str(unpaid_months))
    else:
        message = (
            f"Aviso del administrador de Plex: Hola {user.username}, "
            f"tienes {unpaid_months} mes(es) de donacion pendiente(s). "
            f"Por favor, ponte al dia con tu aportacion para seguir disfrutando del servicio. Gracias!"
        )

    return {
        "action": "kill",
        "reason": "unpaid_debt",
        "message": message,
        "user_found": True,
        "username": user.username,
        "unpaid_months": unpaid_months,
        "already_warned": False,
        "warn_mode": warn_mode,
        "warn_count": user.warn_count,
    }


# ---- Kill stream settings and management ----

@router.post("/tautulli/reset-warnings")
async def reset_warnings(db: Session = Depends(get_db)):
    """Reset all user warned-today flags and counters."""
    count = db.query(User).filter(
        (User.last_warned_at != None) | (User.warn_count > 0)
    ).update(
        {"last_warned_at": None, "warn_count": 0}, synchronize_session="fetch"
    )
    db.commit()
    return {"reset": True, "users_affected": count}


@router.post("/tautulli/reset-warning/{user_id}")
async def reset_user_warning(user_id: int, db: Session = Depends(get_db)):
    """Reset warned flag and counter for a single user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.last_warned_at = None
    user.warn_count = 0
    db.commit()
    return {"reset": True, "user_id": user_id, "username": user.username}


@router.get("/tautulli/kill-stream-settings")
async def get_kill_stream_settings(db: Session = Depends(get_db)):
    """Get kill stream configuration."""
    warn_mode = get_setting(db, "kill_stream_warn_mode") or WARN_MODE_ALWAYS
    kill_message = get_setting(db, "tautulli_kill_message") or ""
    return {
        "warn_mode": warn_mode,
        "kill_message": kill_message,
        "available_modes": [
            {"value": WARN_MODE_ALWAYS, "label": "Siempre cortar", "description": "Corta cada reproducción mientras tenga deuda"},
            {"value": WARN_MODE_ONCE_PER_DAY, "label": "Una vez al día", "description": "Corta solo la primera reproducción del día"},
            {"value": WARN_MODE_DISABLED, "label": "Desactivado", "description": "No corta nunca (solo monitorización)"},
        ],
    }


@router.put("/tautulli/kill-stream-settings")
async def update_kill_stream_settings(
    settings: dict,
    db: Session = Depends(get_db),
):
    """Update kill stream configuration."""
    from app.models.settings import Settings

    if "warn_mode" in settings:
        mode = settings["warn_mode"]
        if mode not in [WARN_MODE_ALWAYS, WARN_MODE_ONCE_PER_DAY, WARN_MODE_DISABLED]:
            raise HTTPException(status_code=400, detail=f"Invalid warn_mode: {mode}")
        row = db.query(Settings).filter(Settings.key == "kill_stream_warn_mode").first()
        if row:
            row.value = mode
        else:
            db.add(Settings(key="kill_stream_warn_mode", value=mode))

    if "kill_message" in settings:
        row = db.query(Settings).filter(Settings.key == "tautulli_kill_message").first()
        if row:
            row.value = settings["kill_message"]
        else:
            db.add(Settings(key="tautulli_kill_message", value=settings["kill_message"]))

    db.commit()
    return await get_kill_stream_settings(db)


# ---- User activity endpoint (for UserDetail widget) ----

@router.get("/tautulli/user/{user_id}/activity")
async def get_user_activity(user_id: int, db: Session = Depends(get_db)):
    """Get Tautulli watch stats for a user."""
    tautulli_service.load_from_db(db)

    if not tautulli_service.is_configured():
        return {"configured": False}

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.plex_id:
        raise HTTPException(status_code=404, detail="User not found")

    stats = await tautulli_service.get_user_watch_stats(str(user.plex_id))
    if stats is None:
        return {"configured": True, "stats": None}

    return {"configured": True, "stats": stats}
