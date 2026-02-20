import httpx
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from decimal import Decimal

from app.models.monthly_payment import MonthlyPayment
from app.models.user import User
from app.models.settings import Settings

MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']


def get_setting_value(db: Session, key: str) -> Optional[str]:
    setting = db.query(Settings).filter(Settings.key == key).first()
    return setting.value if setting else None


async def send_telegram(bot_token: str, chat_id: str, message: str) -> bool:
    """Send a message via Telegram Bot API."""
    import logging
    logger = logging.getLogger(__name__)
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json={
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "HTML",
            })
            if response.status_code != 200:
                logger.error(f"Telegram API Error: {response.status_code} - {response.text}")
                print(f"Telegram API Error: {response.status_code} - {response.text}")
            return response.status_code == 200
    except Exception as e:
        logger.error(f"Telegram Request Exception: {str(e)}")
        print(f"Telegram Request Exception: {str(e)}")
        return False


async def send_discord(webhook_url: str, message: str) -> bool:
    """Send a message via Discord webhook."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json={
                "content": message,
            })
            return response.status_code in (200, 204)
    except Exception:
        return False


async def _dispatch_message(db: Session, message: str) -> dict:
    """Send a message through all configured channels."""
    results = {}

    # Telegram
    bot_token = get_setting_value(db, "telegram_bot_token")
    chat_id = get_setting_value(db, "telegram_chat_id")
    if bot_token and chat_id:
        success = await send_telegram(bot_token, chat_id, message)
        results["telegram"] = "sent" if success else "failed"

    # Discord
    webhook_url = get_setting_value(db, "discord_webhook_url")
    if webhook_url:
        plain_message = message.replace("<b>", "**").replace("</b>", "**")
        success = await send_discord(webhook_url, plain_message)
        results["discord"] = "sent" if success else "failed"

    return results


def build_pending_message(db: Session) -> Optional[str]:
    """Build a message listing users with pending payments for current month."""
    from datetime import datetime
    current_year = datetime.now().year
    current_month = datetime.now().month
    month_name = MONTH_NAMES[current_month - 1]

    pending = (
        db.query(MonthlyPayment, User)
        .join(User, MonthlyPayment.user_id == User.id)
        .filter(
            MonthlyPayment.year == current_year,
            MonthlyPayment.month == current_month,
            MonthlyPayment.is_paid == False,
            User.is_active == True,
            User.deleted_from_plex == False,
        )
        .order_by(User.username.asc())
        .all()
    )

    if not pending:
        return None

    lines = [f"📋 <b>Pagos pendientes - {month_name} {current_year}</b>\n"]
    for mp, user in pending:
        lines.append(f"  ❌ {user.username}")
    lines.append(f"\n📊 Total pendientes: {len(pending)} usuarios")

    # Include monthly summary if enabled
    if get_setting_value(db, "notify_monthly_summary") == "true":
        summary = _build_monthly_summary_text(db, current_year, current_month)
        if summary:
            lines.append(f"\n{summary}")

    return "\n".join(lines)


def _build_monthly_summary_text(db: Session, year: int, month: int) -> Optional[str]:
    """Build summary text for income/expenses."""
    from app.models.expense import Expense as ExpenseModel

    month_name = MONTH_NAMES[month - 1]

    # Income: paid this month
    income = (
        db.query(func.coalesce(func.sum(MonthlyPayment.amount), 0))
        .join(User, MonthlyPayment.user_id == User.id)
        .filter(
            MonthlyPayment.year == year,
            MonthlyPayment.month == month,
            MonthlyPayment.is_paid == True,
        )
        .scalar()
    ) or Decimal("0")

    # Monthly recurring expenses
    monthly_expenses = (
        db.query(func.coalesce(func.sum(ExpenseModel.amount), 0))
        .filter(
            ExpenseModel.is_recurring == True,
            ExpenseModel.recurrence == "monthly",
        )
        .scalar()
    ) or Decimal("0")

    net = income - monthly_expenses

    lines = [
        f"📈 <b>Resumen {month_name}</b>",
        f"  💰 Ingresos: €{income:.2f}",
        f"  💸 Gastos recurrentes: €{monthly_expenses:.2f}",
        f"  {'📊' if net >= 0 else '⚠️'} Neto: €{net:.2f}",
    ]
    return "\n".join(lines)


def build_payment_received_message(username: str, month: int, year: int, amount: float) -> str:
    """Build notification for a payment received."""
    month_name = MONTH_NAMES[month - 1]
    return (
        f"💰 <b>Pago recibido</b>\n"
        f"  👤 {username}\n"
        f"  📅 {month_name} {year}\n"
        f"  💵 €{amount:.2f}"
    )


def build_new_expense_message(name: str, category: str, amount: float) -> str:
    """Build notification for a new expense."""
    cat_labels = {
        "hardware": "🖥️ Hardware",
        "licenses": "📄 Licencias",
        "hosting": "🌐 Hosting",
        "plex_pass": "🎬 Plex Pass",
        "domain": "🌍 Dominio",
        "subscriptions": "📦 Suscripciones",
        "other": "📋 Otro",
    }
    cat_label = cat_labels.get(category, category)
    return (
        f"💸 <b>Nuevo gasto registrado</b>\n"
        f"  📝 {name}\n"
        f"  📂 {cat_label}\n"
        f"  💵 €{amount:.2f}"
    )


async def send_pending_reminders(db: Session) -> dict:
    """Send pending payment reminders via configured channels."""
    message = build_pending_message(db)
    if not message:
        return {"sent": False, "reason": "No hay pagos pendientes este mes"}

    results = await _dispatch_message(db, message)

    if not results:
        return {"sent": False, "reason": "No hay canales de notificación configurados"}

    return {"sent": True, "results": results}


async def send_payment_notification(db: Session, username: str, month: int, year: int, amount: float) -> dict:
    """Send payment received notification if enabled."""
    if get_setting_value(db, "notify_on_payment") != "true":
        return {"sent": False, "reason": "Notifications disabled for payments"}

    message = build_payment_received_message(username, month, year, amount)
    results = await _dispatch_message(db, message)

    if not results:
        return {"sent": False, "reason": "No channels configured"}

    return {"sent": True, "results": results}


async def send_expense_notification(db: Session, name: str, category: str, amount: float) -> dict:
    """Send new expense notification if enabled."""
    if get_setting_value(db, "notify_on_expense") != "true":
        return {"sent": False, "reason": "Notifications disabled for expenses"}

    message = build_new_expense_message(name, category, amount)
    results = await _dispatch_message(db, message)

    if not results:
        return {"sent": False, "reason": "No channels configured"}

    return {"sent": True, "results": results}
