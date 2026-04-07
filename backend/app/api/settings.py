from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.settings import Settings, PLEX_URL_KEY, PLEX_TOKEN_KEY, CURRENCY_SYMBOL_KEY, MONTHLY_PRICE_KEY
from app.services.plex import plex_service
from app.api.audit import log_action

router = APIRouter(prefix="/settings", tags=["settings"])


class PlexSettings(BaseModel):
    plex_url: str
    plex_token: str


class PlexSettingsResponse(BaseModel):
    plex_url: Optional[str] = None
    plex_token_configured: bool = False


def get_setting(db: Session, key: str) -> Optional[str]:
    setting = db.query(Settings).filter(Settings.key == key).first()
    return setting.value if setting else None


def set_setting(db: Session, key: str, value: str) -> None:
    setting = db.query(Settings).filter(Settings.key == key).first()
    if setting:
        setting.value = value
    else:
        setting = Settings(key=key, value=value)
        db.add(setting)
    db.commit()


@router.get("/plex", response_model=PlexSettingsResponse)
def get_plex_settings(db: Session = Depends(get_db)):
    """Get current Plex settings (token is masked)."""
    plex_url = get_setting(db, PLEX_URL_KEY)
    plex_token = get_setting(db, PLEX_TOKEN_KEY)

    return PlexSettingsResponse(
        plex_url=plex_url,
        plex_token_configured=bool(plex_token),
    )


@router.put("/plex")
def update_plex_settings(settings: PlexSettings, db: Session = Depends(get_db)):
    """Update Plex settings."""
    set_setting(db, PLEX_URL_KEY, settings.plex_url)
    set_setting(db, PLEX_TOKEN_KEY, settings.plex_token)

    # Update the plex service with new settings
    plex_service.update_settings(settings.plex_url, settings.plex_token)

    return {"message": "Plex settings updated successfully"}


@router.post("/plex/test")
async def test_plex_connection(db: Session = Depends(get_db)):
    """Test connection to Plex server."""
    plex_url = get_setting(db, PLEX_URL_KEY)
    plex_token = get_setting(db, PLEX_TOKEN_KEY)

    if not plex_url or not plex_token:
        return {"success": False, "error": "Plex URL and token not configured"}

    # Temporarily update service and test
    plex_service.update_settings(plex_url, plex_token)
    info = await plex_service.get_server_info()

    if info:
        return {"success": True, "server_info": info}
    return {"success": False, "error": "Could not connect to Plex server"}


class CurrencySettings(BaseModel):
    currency_symbol: str


class CurrencySettingsResponse(BaseModel):
    currency_symbol: str = "€"


@router.get("/currency", response_model=CurrencySettingsResponse)
def get_currency_settings(db: Session = Depends(get_db)):
    """Get current currency symbol."""
    symbol = get_setting(db, CURRENCY_SYMBOL_KEY)
    return CurrencySettingsResponse(currency_symbol=symbol or "€")


@router.put("/currency")
def update_currency_settings(settings: CurrencySettings, db: Session = Depends(get_db)):
    """Update currency symbol."""
    set_setting(db, CURRENCY_SYMBOL_KEY, settings.currency_symbol)
    return {"message": "Currency settings updated successfully"}


class MonthlyPriceSettings(BaseModel):
    monthly_price: float


class MonthlyPriceSettingsResponse(BaseModel):
    monthly_price: float = 0.0


@router.get("/price", response_model=MonthlyPriceSettingsResponse)
def get_monthly_price_settings(db: Session = Depends(get_db)):
    """Get current monthly price."""
    price = get_setting(db, MONTHLY_PRICE_KEY)
    return MonthlyPriceSettingsResponse(monthly_price=float(price) if price else 0.0)


@router.put("/price")
def update_monthly_price_settings(settings: MonthlyPriceSettings, db: Session = Depends(get_db)):
    """Update monthly price and log the change."""
    old_raw = get_setting(db, MONTHLY_PRICE_KEY)
    old_price = float(old_raw) if old_raw else 0.0
    set_setting(db, MONTHLY_PRICE_KEY, str(settings.monthly_price))
    log_action(db, "price_changed", "settings", None, {
        "old_price": old_price,
        "new_price": float(settings.monthly_price),
    })
    return {"message": "Monthly price settings updated successfully"}


# ---- Notification Settings ----

class NotificationSettings(BaseModel):
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    discord_webhook_url: Optional[str] = None


class NotificationSettingsResponse(BaseModel):
    telegram_configured: bool = False
    telegram_chat_id: Optional[str] = None
    discord_configured: bool = False


@router.get("/notifications", response_model=NotificationSettingsResponse)
def get_notification_settings(db: Session = Depends(get_db)):
    """Get current notification settings."""
    telegram_token = get_setting(db, "telegram_bot_token")
    telegram_chat = get_setting(db, "telegram_chat_id")
    discord_url = get_setting(db, "discord_webhook_url")

    return NotificationSettingsResponse(
        telegram_configured=bool(telegram_token),
        telegram_chat_id=telegram_chat,
        discord_configured=bool(discord_url),
    )


@router.put("/notifications")
def update_notification_settings(ns: NotificationSettings, db: Session = Depends(get_db)):
    """Update notification settings."""
    if ns.telegram_bot_token is not None:
        set_setting(db, "telegram_bot_token", ns.telegram_bot_token)
    if ns.telegram_chat_id is not None:
        set_setting(db, "telegram_chat_id", ns.telegram_chat_id)
    if ns.discord_webhook_url is not None:
        set_setting(db, "discord_webhook_url", ns.discord_webhook_url)
    return {"message": "Notification settings updated successfully"}


@router.post("/notifications/test")
async def test_notification(db: Session = Depends(get_db)):
    """Send a test notification to configured channels."""
    from app.services.notification_service import send_telegram, send_discord

    results = {}
    telegram_token = get_setting(db, "telegram_bot_token")
    telegram_chat = get_setting(db, "telegram_chat_id")
    discord_url = get_setting(db, "discord_webhook_url")

    if telegram_token and telegram_chat:
        success = await send_telegram(telegram_token, telegram_chat, "🧪 Test de notificación de PlexDash - ¡Funciona!")
        results["telegram"] = "sent" if success else "failed"

    if discord_url:
        success = await send_discord(discord_url, "🧪 Test de notificación de PlexDash - ¡Funciona!")
        results["discord"] = "sent" if success else "failed"

    if not results:
        return {"success": False, "error": "No hay canales configurados"}

    return {"success": True, "results": results}


@router.post("/notifications/send-reminders")
async def send_reminders(db: Session = Depends(get_db)):
    """Manually send pending payment reminders."""
    from app.services.notification_service import send_pending_reminders
    result = await send_pending_reminders(db)
    return result


@router.get("/backup")
def download_backup(db: Session = Depends(get_db)):
    """Export full database as JSON backup."""
    import json
    from app.models.user import User
    from app.models.monthly_payment import MonthlyPayment
    from app.models.settings import Settings
    from app.models.audit_log import AuditLog

    users = db.query(User).all()
    payments = db.query(MonthlyPayment).all()
    settings = db.query(Settings).all()
    logs = db.query(AuditLog).all()

    from app.models.expense import Expense as ExpenseModel
    expenses_list = db.query(ExpenseModel).all()

    backup = {
        "version": "2.1",
        "exported_at": datetime.utcnow().isoformat(),
        "users": [
            {
                "id": u.id, "plex_id": u.plex_id, "username": u.username,
                "email": u.email, "thumb": u.thumb, "notes": u.notes,
                "is_active": u.is_active, "deleted_from_plex": u.deleted_from_plex,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "monthly_payments": [
            {
                "id": p.id, "user_id": p.user_id, "year": p.year,
                "month": p.month, "amount": float(p.amount),
                "is_paid": p.is_paid,
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            }
            for p in payments
        ],
        "settings": [
            {"key": s.key, "value": s.value} for s in settings
        ],
        "audit_logs_count": len(logs),
        "expenses": [
            {
                "id": e.id, "name": e.name, "category": e.category,
                "amount": float(e.amount), "is_recurring": e.is_recurring,
                "recurrence": e.recurrence,
                "date": e.date.isoformat() if e.date else None,
                "notes": e.notes,
            }
            for e in expenses_list
        ],
    }

    content = json.dumps(backup, indent=2, ensure_ascii=False)
    from fastapi.responses import Response
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=plexdash_backup.json"},
    )


@router.post("/restore")
async def restore_backup(request: Request, db: Session = Depends(get_db)):
    """Restore database from JSON backup."""
    import json
    from app.models.user import User
    from app.models.monthly_payment import MonthlyPayment
    from app.models.settings import Settings

    body = await request.json()

    if "users" not in body or "monthly_payments" not in body:
        raise HTTPException(status_code=400, detail="Invalid backup format")

    restored = {"users": 0, "payments": 0, "settings": 0}

    # Restore users
    for u_data in body.get("users", []):
        existing = db.query(User).filter(User.plex_id == u_data.get("plex_id")).first()
        if not existing:
            user = User(
                plex_id=u_data.get("plex_id"),
                username=u_data.get("username"),
                email=u_data.get("email"),
                thumb=u_data.get("thumb"),
                notes=u_data.get("notes"),
                is_active=u_data.get("is_active", True),
                deleted_from_plex=u_data.get("deleted_from_plex", False),
            )
            db.add(user)
            restored["users"] += 1

    db.flush()

    # Restore monthly payments
    for p_data in body.get("monthly_payments", []):
        user = db.query(User).filter(User.plex_id == next(
            (u.get("plex_id") for u in body["users"] if u.get("id") == p_data.get("user_id")), None
        )).first()
        if user:
            existing = db.query(MonthlyPayment).filter(
                MonthlyPayment.user_id == user.id,
                MonthlyPayment.year == p_data.get("year"),
                MonthlyPayment.month == p_data.get("month"),
            ).first()
            if not existing:
                mp = MonthlyPayment(
                    user_id=user.id,
                    year=p_data.get("year"),
                    month=p_data.get("month"),
                    amount=p_data.get("amount", 0),
                    is_paid=p_data.get("is_paid", False),
                )
                db.add(mp)
                restored["payments"] += 1

    # Restore settings
    for s_data in body.get("settings", []):
        set_setting(db, s_data["key"], s_data["value"])
        restored["settings"] += 1

    # Restore expenses
    from app.models.expense import Expense as ExpenseModel
    restored["expenses"] = 0
    for e_data in body.get("expenses", []):
        expense = ExpenseModel(
            name=e_data.get("name"),
            category=e_data.get("category", "other"),
            amount=e_data.get("amount", 0),
            is_recurring=e_data.get("is_recurring", False),
            recurrence=e_data.get("recurrence", "one_time"),
            date=datetime.fromisoformat(e_data["date"]) if e_data.get("date") else datetime.utcnow(),
            notes=e_data.get("notes"),
        )
        db.add(expense)
        restored["expenses"] += 1

    db.commit()
    return {"success": True, "restored": restored}


# ---- Notification Preferences ----

class NotificationPreferences(BaseModel):
    notify_on_payment: Optional[bool] = None
    notify_on_expense: Optional[bool] = None
    notify_monthly_summary: Optional[bool] = None


class NotificationPreferencesResponse(BaseModel):
    notify_on_payment: bool = False
    notify_on_expense: bool = False
    notify_monthly_summary: bool = False


@router.get("/notification-preferences", response_model=NotificationPreferencesResponse)
def get_notification_preferences(db: Session = Depends(get_db)):
    return NotificationPreferencesResponse(
        notify_on_payment=get_setting(db, "notify_on_payment") == "true",
        notify_on_expense=get_setting(db, "notify_on_expense") == "true",
        notify_monthly_summary=get_setting(db, "notify_monthly_summary") == "true",
    )


@router.put("/notification-preferences")
def update_notification_preferences(
    prefs: NotificationPreferences, db: Session = Depends(get_db)
):
    if prefs.notify_on_payment is not None:
        set_setting(db, "notify_on_payment", "true" if prefs.notify_on_payment else "false")
    if prefs.notify_on_expense is not None:
        set_setting(db, "notify_on_expense", "true" if prefs.notify_on_expense else "false")
    if prefs.notify_monthly_summary is not None:
        set_setting(db, "notify_monthly_summary", "true" if prefs.notify_monthly_summary else "false")
    return {"message": "Notification preferences updated"}
