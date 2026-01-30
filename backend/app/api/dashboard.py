from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal
from datetime import datetime

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
    current_year = datetime.now().year
    current_month = datetime.now().month

    pending_monthly = (
        db.query(func.count(MonthlyPayment.id))
        .join(User, MonthlyPayment.user_id == User.id)
        .filter(
            MonthlyPayment.is_paid == False,
            MonthlyPayment.year == current_year,
            MonthlyPayment.month <= current_month,
            User.is_active == True,
            User.deleted_from_plex == False
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
    current_year = datetime.now().year
    current_month = datetime.now().month

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
