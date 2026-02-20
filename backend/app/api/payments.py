from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.payment import Payment
from app.models.user import User
from app.models.settings import Settings, MONTHLY_PRICE_KEY
from app.models.monthly_payment import MonthlyPayment
from app.schemas import Payment as PaymentSchema, PaymentCreate, PaymentUpdate
from app.api.audit import log_action

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/", response_model=List[PaymentSchema])
def get_payments(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    user_id: int = None,
    db: Session = Depends(get_db),
):
    query = db.query(Payment)
    if status:
        query = query.filter(Payment.status == status)
    if user_id:
        query = query.filter(Payment.user_id == user_id)
    payments = query.order_by(Payment.created_at.desc()).offset(skip).limit(limit).all()
    return payments


@router.get("/{payment_id}", response_model=PaymentSchema)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.post("/", response_model=PaymentSchema)
def create_payment(payment: PaymentCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payment.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db_payment = Payment(**payment.model_dump())
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment


@router.put("/{payment_id}", response_model=PaymentSchema)
def update_payment(payment_id: int, payment_update: PaymentUpdate, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    update_data = payment_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(payment, field, value)

    db.commit()
    db.refresh(payment)
    return payment


@router.put("/{payment_id}/mark-paid", response_model=PaymentSchema)
def mark_payment_paid(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment.status = "paid"
    payment.paid_at = datetime.utcnow()
    db.commit()
    db.refresh(payment)

    log_action(
        db, 
        action="mark_payment_paid", 
        entity_type="payment", 
        entity_id=payment.id,
        details={"amount": payment.amount, "user_id": payment.user_id}
    )

    return payment


@router.delete("/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    db.delete(payment)
    db.commit()
    return {"message": "Payment deleted"}


@router.post("/quick/{user_id}", response_model=PaymentSchema)
def create_quick_payment(user_id: int, db: Session = Depends(get_db)):
    """Create a payment for the current month with the default monthly price."""
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get monthly price
    price_setting = db.query(Settings).filter(Settings.key == MONTHLY_PRICE_KEY).first()
    amount = float(price_setting.value) if price_setting and price_setting.value else 0.0

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Monthly price not configured")

    # Check if payment already exists for this month
    now = datetime.utcnow()
    existing = db.query(Payment).filter(
        Payment.user_id == user_id,
        extract('year', Payment.created_at) == now.year,
        extract('month', Payment.created_at) == now.month,
        Payment.status == "paid"
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Payment already exists for this month")

    # Create payment
    payment = Payment(
        user_id=user_id,
        amount=amount,
        currency="EUR", # Default to EUR as per user request context (Euro symbol mentioned) or make dynamic later
        status="paid",
        paid_at=now,
        notes=f"Quick payment for {now.strftime('%B %Y')}",
        created_at=now
    )
    
    db.add(payment)
    
    # Also update the MonthlyPayment table so it reflects in the dashboard
    monthly = db.query(MonthlyPayment).filter(
        MonthlyPayment.user_id == user_id,
        MonthlyPayment.year == now.year,
        MonthlyPayment.month == now.month
    ).first()
    
    if not monthly:
        monthly = MonthlyPayment(
            user_id=user_id,
            year=now.year,
            month=now.month,
            amount=amount,
            is_paid=True,
            paid_at=now
        )
        db.add(monthly)
    else:
        monthly.is_paid = True
        monthly.paid_at = now
        monthly.amount = amount

    db.commit()
    db.refresh(payment)

    log_action(
        db, 
        action="create_quick_payment", 
        entity_type="payment", 
        entity_id=payment.id,
        details={"amount": payment.amount, "user_id": payment.user_id, "month": now.month, "year": now.year}
    )

    return payment
