from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict
from datetime import datetime
from decimal import Decimal

from app.database import get_db
from app.models.monthly_payment import MonthlyPayment
from app.models.user import User
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
def update_month_payment(
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
        payment.paid_at = datetime.utcnow()
    elif payment_update.is_paid is False:
        payment.paid_at = None

    db.commit()
    db.refresh(payment)
    return payment


@router.post("/{user_id}/{year}/toggle/{month}", response_model=MonthlyPaymentSchema)
def toggle_month_paid(
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
            paid_at=datetime.utcnow()
        )
        db.add(payment)
    else:
        # Toggle the status
        payment.is_paid = not payment.is_paid
        payment.paid_at = datetime.utcnow() if payment.is_paid else None

    db.commit()
    db.refresh(payment)
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
            "created_at": user.created_at,
        },
        "years": list(years_data.values()),
        "total_all_time": sum(y["total_paid"] for y in years_data.values()),
    }
