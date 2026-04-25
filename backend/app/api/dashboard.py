from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, or_, and_
from decimal import Decimal
from datetime import datetime, timezone

from app.database import get_db
from app.models.user import User
from app.models.payment import Payment
from app.models.monthly_payment import MonthlyPayment
from app.schemas import DashboardStats, PlexServerInfo
from app.services.plex import plex_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0

    # Calculate total revenue from MonthlyPayment (paid entries)
    monthly_revenue = (
        db.query(func.sum(MonthlyPayment.amount))
        .filter(MonthlyPayment.is_paid == True)
        .scalar()
    ) or Decimal("0")

    # Also include legacy Payment revenue
    legacy_revenue = (
        db.query(func.sum(Payment.amount))
        .filter(Payment.status == "paid")
        .scalar()
    ) or Decimal("0")

    total_revenue = monthly_revenue + legacy_revenue

    # Count pending monthly payments for current year/month (only active, non-deleted users)
    current_year = datetime.now(timezone.utc).year
    current_month = datetime.now(timezone.utc).month

    joined_year = extract('year', User.joined_at)
    joined_month = extract('month', User.joined_at)
    pending_monthly = (
        db.query(func.count(MonthlyPayment.id))
        .join(User, MonthlyPayment.user_id == User.id)
        .filter(
            MonthlyPayment.is_paid == False,
            MonthlyPayment.year == current_year,
            MonthlyPayment.month <= current_month,
            User.is_active == True,
            User.deleted_from_plex == False,
            or_(
                User.joined_at == None,
                MonthlyPayment.year > joined_year,
                and_(MonthlyPayment.year == joined_year, MonthlyPayment.month >= joined_month),
            ),
        )
        .scalar()
    ) or 0

    pending_payments = (
        db.query(func.count(Payment.id))
        .filter(Payment.status == "pending")
        .scalar()
    ) or 0

    overdue_payments = (
        db.query(func.count(Payment.id))
        .filter(Payment.status == "overdue")
        .scalar()
    ) or 0

    return DashboardStats(
        total_users=total_users,
        active_users=active_users,
        total_revenue=total_revenue,
        pending_payments=pending_payments + pending_monthly,
        overdue_payments=overdue_payments,
    )


@router.get("/plex-info")
async def get_plex_info():
    info = await plex_service.get_server_info()
    if info:
        return PlexServerInfo(**info)
    return {"error": "Could not connect to Plex server"}


@router.get("/recent-payments")
def get_recent_payments(limit: int = 5, db: Session = Depends(get_db)):
    """Get recent paid monthly payments."""
    payments = (
        db.query(MonthlyPayment, User)
        .join(User, MonthlyPayment.user_id == User.id)
        .filter(
            MonthlyPayment.is_paid == True,
            User.is_active == True,
            User.deleted_from_plex == False
        )
        .order_by(MonthlyPayment.paid_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": mp.id,
            "user_id": mp.user_id,
            "username": user.username,
            "amount": mp.amount,
            "year": mp.year,
            "month": mp.month,
            "paid_at": mp.paid_at,
        }
        for mp, user in payments
    ]


@router.get("/upcoming-dues")
def get_upcoming_dues(limit: int = 5, db: Session = Depends(get_db)):
    """Get pending monthly payments for current month."""
    current_year = datetime.now(timezone.utc).year
    current_month = datetime.now(timezone.utc).month

    payments = (
        db.query(MonthlyPayment, User)
        .join(User, MonthlyPayment.user_id == User.id)
        .filter(
            MonthlyPayment.is_paid == False,
            MonthlyPayment.year == current_year,
            MonthlyPayment.month == current_month,
            User.is_active == True,
            User.deleted_from_plex == False
        )
        .order_by(User.username.asc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": mp.id,
            "user_id": mp.user_id,
            "username": user.username,
            "amount": mp.amount,
            "year": mp.year,
            "month": mp.month,
        }
        for mp, user in payments
    ]


@router.get("/monthly-revenue/{year}")
def get_monthly_revenue(year: int, db: Session = Depends(get_db)):
    """Get monthly revenue data for a given year (for charts)."""
    result = []
    for month in range(1, 13):
        paid_data = (
            db.query(
                func.count(MonthlyPayment.id),
                func.coalesce(func.sum(MonthlyPayment.amount), 0)
            )
            .join(User, MonthlyPayment.user_id == User.id)
            .filter(
                MonthlyPayment.year == year,
                MonthlyPayment.month == month,
                MonthlyPayment.is_paid == True,
                User.is_active == True,
                User.deleted_from_plex == False
            )
            .first()
        )
        unpaid_count = (
            db.query(func.count(MonthlyPayment.id))
            .join(User, MonthlyPayment.user_id == User.id)
            .filter(
                MonthlyPayment.year == year,
                MonthlyPayment.month == month,
                MonthlyPayment.is_paid == False,
                User.is_active == True,
                User.deleted_from_plex == False
            )
            .scalar()
        ) or 0

        result.append({
            "month": month,
            "total": float(paid_data[1]) if paid_data else 0,
            "paid_count": paid_data[0] if paid_data else 0,
            "unpaid_count": unpaid_count,
        })
    return result


@router.get("/payment-summary/{year}/{month}")
def get_payment_summary(year: int, month: int, db: Session = Depends(get_db)):
    """Get paid vs unpaid summary for a specific month (for donut chart)."""
    joined_year = extract('year', User.joined_at)
    joined_month = extract('month', User.joined_at)
    joined_ok = or_(
        User.joined_at == None,
        MonthlyPayment.year > joined_year,
        and_(MonthlyPayment.year == joined_year, MonthlyPayment.month >= joined_month),
    )

    base_filters = [
        MonthlyPayment.year == year,
        MonthlyPayment.month == month,
        User.is_active == True,
        User.deleted_from_plex == False,
        joined_ok,
    ]

    paid = (
        db.query(func.count(MonthlyPayment.id))
        .join(User, MonthlyPayment.user_id == User.id)
        .filter(*base_filters, MonthlyPayment.is_paid == True)
        .scalar()
    ) or 0

    unpaid = (
        db.query(func.count(MonthlyPayment.id))
        .join(User, MonthlyPayment.user_id == User.id)
        .filter(*base_filters, MonthlyPayment.is_paid == False)
        .scalar()
    ) or 0

    total_amount = (
        db.query(func.sum(MonthlyPayment.amount))
        .join(User, MonthlyPayment.user_id == User.id)
        .filter(
            MonthlyPayment.year == year,
            MonthlyPayment.month == month,
            MonthlyPayment.is_paid == True,
            User.is_active == True,
            User.deleted_from_plex == False
        )
        .scalar()
    ) or 0

    return {
        "paid": paid,
        "unpaid": unpaid,
        "total_amount": float(total_amount),
    }


@router.get("/debtors")
def get_debtors(year: int = None, db: Session = Depends(get_db)):
    """Get users with unpaid months for a given year. Uses a single JOIN query."""
    now = datetime.now(timezone.utc)
    if year is None:
        year = now.year
    current_month = now.month if year == now.year else 12

    # Single query: fetch all unpaid payments with user data in one JOIN
    unpaid_rows = (
        db.query(MonthlyPayment, User)
        .join(User, MonthlyPayment.user_id == User.id)
        .filter(
            MonthlyPayment.year == year,
            MonthlyPayment.month <= current_month,
            MonthlyPayment.is_paid == False,
            User.is_active == True,
            User.deleted_from_plex == False,
        )
        .all()
    )

    # Aggregate in Python — avoids DB-specific GROUP_CONCAT / ARRAY_AGG
    debtors_map: dict = {}
    for mp, user in unpaid_rows:
        # Skip months before joined_at if set
        if user.joined_at:
            j = user.joined_at
            if mp.year < j.year or (mp.year == j.year and mp.month < j.month):
                continue
        uid = user.id
        if uid not in debtors_map:
            debtors_map[uid] = {
                "user_id": uid,
                "username": user.username,
                "thumb": user.thumb,
                "unpaid_months": 0,
                "total_debt": 0.0,
                "months": [],
            }
        debtors_map[uid]["unpaid_months"] += 1
        debtors_map[uid]["total_debt"] += float(mp.amount)
        debtors_map[uid]["months"].append(mp.month)

    debtors = list(debtors_map.values())
    for d in debtors:
        d["months"].sort()
    debtors.sort(key=lambda d: d["total_debt"], reverse=True)
    return debtors
