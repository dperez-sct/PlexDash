from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.payment import Payment
from app.models.user import User
from app.schemas import Payment as PaymentSchema, PaymentCreate, PaymentUpdate

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
    return payment


@router.delete("/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    db.delete(payment)
    db.commit()
    return {"message": "Payment deleted"}
