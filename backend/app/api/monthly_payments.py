from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict
from datetime import datetime, timezone
from decimal import Decimal
import csv
import io

from app.database import get_db
from app.models.monthly_payment import MonthlyPayment
from app.models.user import User
from app.api.audit import log_action
from app.schemas import (
    MonthlyPayment as MonthlyPaymentSchema,
    MonthlyPaymentUpdate,
    UserYearPayments,
)

router = APIRouter(prefix="/monthly-payments", tags=["monthly-payments"])


@router.get("/{year}", response_model=List[UserYearPayments])
def get_year_payments(
    year: int,
    include_inactive: bool = False,
    include_deleted: bool = False,
    db: Session = Depends(get_db)
):
    """Get all users with their 12 months of payments for a given year."""
    query = db.query(User)
    if not include_inactive:
        query = query.filter(User.is_active == True)
    if not include_deleted:
        query = query.filter(User.deleted_from_plex == False)
    users = query.order_by(User.username).all()

    result = []
    for user in users:
        # Get existing payments for this user and year
        payments = db.query(MonthlyPayment).filter(
            MonthlyPayment.user_id == user.id,
            MonthlyPayment.year == year
        ).all()

        # Create a dict of month -> payment
        payments_dict = {p.month: p for p in payments}

        # Ensure all 12 months exist (create if missing)
        for month in range(1, 13):
            if month not in payments_dict:
                new_payment = MonthlyPayment(
                    user_id=user.id,
                    year=year,
                    month=month,
                    amount=0,
                    is_paid=False
                )
                db.add(new_payment)
                db.flush()
                payments_dict[month] = new_payment

        db.commit()

        result.append(UserYearPayments(
            user_id=user.id,
            username=user.username,
            thumb=user.thumb,
            payments=payments_dict
        ))

    return result


@router.put("/{user_id}/{year}/{month}", response_model=MonthlyPaymentSchema)
async def update_monthly_payment(
    user_id: int,
    year: int,
    month: int,
    payment_update: MonthlyPaymentUpdate,
    db: Session = Depends(get_db)
):
    """Update a specific month's payment (amount and/or is_paid)."""
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")

    # Get or create the payment record
    payment = db.query(MonthlyPayment).filter(
        MonthlyPayment.user_id == user_id,
        MonthlyPayment.year == year,
        MonthlyPayment.month == month
    ).first()

    if not payment:
        # Create new payment record
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        payment = MonthlyPayment(
            user_id=user_id,
            year=year,
            month=month,
            amount=0,
            is_paid=False
        )
        db.add(payment)
        db.flush()

    # Update fields
    update_data = payment_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(payment, field, value)

    # Set paid_at timestamp if marking as paid
    if payment_update.is_paid is True:
        payment.paid_at = datetime.now(timezone.utc)
    elif payment_update.is_paid is False:
        payment.paid_at = None

    db.commit()
    db.refresh(payment)

    # Audit log
    user = db.query(User).filter(User.id == user_id).first()
    username = user.username if user else f"user_{user_id}"
    if payment_update.is_paid is True:
        log_action(db, "payment_marked", "payment", payment.id, {
            "username": username, "user_id": user_id, "year": year, "month": month,
            "amount": float(payment.amount)
        })
    elif payment_update.is_paid is False:
        log_action(db, "payment_removed", "payment", payment.id, {
            "username": username, "user_id": user_id, "year": year, "month": month
        })

    # Send notification on payment received
    if payment_update.is_paid is True:
        from app.services.notification_service import send_payment_notification
        await send_payment_notification(db, username, month, year, float(payment.amount))

    return payment


@router.post("/{user_id}/{year}/toggle/{month}", response_model=MonthlyPaymentSchema)
async def toggle_month_paid(
    user_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    """Toggle the paid status of a specific month."""
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")

    # Get or create the payment record
    payment = db.query(MonthlyPayment).filter(
        MonthlyPayment.user_id == user_id,
        MonthlyPayment.year == year,
        MonthlyPayment.month == month
    ).first()

    if not payment:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        payment = MonthlyPayment(
            user_id=user_id,
            year=year,
            month=month,
            amount=0,
            is_paid=True,
            paid_at=datetime.now(timezone.utc)
        )
        db.add(payment)
    else:
        # Toggle the status
        payment.is_paid = not payment.is_paid
        payment.paid_at = datetime.now(timezone.utc) if payment.is_paid else None

    db.commit()
    db.refresh(payment)

    # Send notification if toggled to paid
    if payment.is_paid:
        user = db.query(User).filter(User.id == user_id).first()
        username = user.username if user else f"user_{user_id}"
        from app.services.notification_service import send_payment_notification
        await send_payment_notification(db, username, month, year, float(payment.amount))

    return payment


@router.get("/user/{user_id}/history")
def get_user_payment_history(user_id: int, db: Session = Depends(get_db)):
    """Get complete payment history for a user, grouped by year."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get all payments for this user
    payments = db.query(MonthlyPayment).filter(
        MonthlyPayment.user_id == user_id
    ).order_by(MonthlyPayment.year.desc(), MonthlyPayment.month.asc()).all()

    # Group by year
    years_data: Dict[int, dict] = {}
    for payment in payments:
        if payment.year not in years_data:
            years_data[payment.year] = {
                "year": payment.year,
                "payments": {},
                "total_paid": Decimal("0"),
            }
        years_data[payment.year]["payments"][payment.month] = {
            "id": payment.id,
            "month": payment.month,
            "amount": payment.amount,
            "is_paid": payment.is_paid,
            "paid_at": payment.paid_at,
        }
        if payment.is_paid:
            years_data[payment.year]["total_paid"] += payment.amount

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "thumb": user.thumb,
            "is_active": user.is_active,
            "deleted_from_plex": user.deleted_from_plex,
            "kill_stream_enabled": user.kill_stream_enabled,
            "warn_count": user.warn_count or 0,
            "last_warned_at": user.last_warned_at.isoformat() if user.last_warned_at else None,
            "created_at": user.created_at,
            "notes": user.notes,
        },
        "years": list(years_data.values()),
        "total_all_time": sum(y["total_paid"] for y in years_data.values()),
    }


@router.get("/{year}/export")
def export_year_payments(
    year: int,
    include_inactive: bool = False,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
):
    """Export yearly payments as CSV."""
    query = db.query(User)
    if not include_inactive:
        query = query.filter(User.is_active == True)
    if not include_deleted:
        query = query.filter(User.deleted_from_plex == False)
    users = query.order_by(User.username).all()

    months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Usuario'] + months + ['Total'])

    for user in users:
        payments = db.query(MonthlyPayment).filter(
            MonthlyPayment.user_id == user.id,
            MonthlyPayment.year == year
        ).all()
        payments_dict = {p.month: p for p in payments}

        row = [user.username]
        total = Decimal('0')
        for m in range(1, 13):
            p = payments_dict.get(m)
            if p and p.is_paid:
                row.append(float(p.amount))
                total += p.amount
            else:
                row.append('')
        row.append(float(total))
        writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=pagos_{year}.csv"},
    )


@router.post("/{year}/{month}/bulk-pay")
def bulk_mark_paid(year: int, month: int, db: Session = Depends(get_db)):
    """Mark all active users as paid for a specific month."""
    payments = (
        db.query(MonthlyPayment)
        .join(User, MonthlyPayment.user_id == User.id)
        .filter(
            MonthlyPayment.year == year,
            MonthlyPayment.month == month,
            MonthlyPayment.is_paid == False,
            User.is_active == True,
            User.deleted_from_plex == False,
        )
        .all()
    )
    count = 0
    for p in payments:
        p.is_paid = True
        p.paid_at = datetime.now(timezone.utc)
        count += 1
    db.commit()
    log_action(db, "bulk_mark_paid", "monthly_payment", None, {"year": year, "month": month, "count": count})
    return {"updated": count}


@router.post("/{year}/{month}/bulk-unpay")
def bulk_mark_unpaid(year: int, month: int, db: Session = Depends(get_db)):
    """Mark all active users as unpaid for a specific month."""
    payments = (
        db.query(MonthlyPayment)
        .join(User, MonthlyPayment.user_id == User.id)
        .filter(
            MonthlyPayment.year == year,
            MonthlyPayment.month == month,
            MonthlyPayment.is_paid == True,
            User.is_active == True,
            User.deleted_from_plex == False,
        )
        .all()
    )
    count = 0
    for p in payments:
        p.is_paid = False
        p.paid_at = None
        count += 1
    db.commit()
    log_action(db, "bulk_mark_unpaid", "monthly_payment", None, {"year": year, "month": month, "count": count})
    return {"updated": count}

