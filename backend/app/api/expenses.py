from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from decimal import Decimal
from datetime import datetime

from app.database import get_db
from app.models.expense import Expense
from app.models.monthly_payment import MonthlyPayment
from app.models.user import User
from app.schemas import (
    Expense as ExpenseSchema,
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseSummary,
    EXPENSE_CATEGORIES,
)
from app.api.audit import log_action

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("/", response_model=List[ExpenseSchema])
def get_expenses(
    category: Optional[str] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Get all expenses with optional filters."""
    query = db.query(Expense)
    if category:
        query = query.filter(Expense.category == category)
    if year:
        query = query.filter(extract("year", Expense.date) == year)
    return query.order_by(Expense.date.desc()).all()


@router.post("/", response_model=ExpenseSchema)
async def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db)):
    """Create a new expense."""
    if expense.category not in EXPENSE_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {', '.join(EXPENSE_CATEGORIES)}",
        )

    db_expense = Expense(**expense.model_dump())
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)

    log_action(db, "expense_created", "expense", db_expense.id, {
        "name": db_expense.name,
        "category": db_expense.category,
        "amount": float(db_expense.amount),
    })

    # Send notification if enabled
    from app.services.notification_service import send_expense_notification
    await send_expense_notification(
        db, db_expense.name, db_expense.category, float(db_expense.amount)
    )

    return db_expense


@router.put("/{expense_id}", response_model=ExpenseSchema)
def update_expense(
    expense_id: int,
    expense_update: ExpenseUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing expense."""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    update_data = expense_update.model_dump(exclude_unset=True)
    if "category" in update_data and update_data["category"] not in EXPENSE_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {', '.join(EXPENSE_CATEGORIES)}",
        )

    for field, value in update_data.items():
        setattr(expense, field, value)

    db.commit()
    db.refresh(expense)

    log_action(db, "expense_updated", "expense", expense.id, {
        "name": expense.name, "amount": float(expense.amount),
    })

    return expense


@router.delete("/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    """Delete an expense."""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    name = expense.name
    amount = float(expense.amount)

    db.delete(expense)
    db.commit()

    log_action(db, "expense_deleted", "expense", expense_id, {
        "name": name, "amount": amount,
    })

    return {"message": "Expense deleted"}


@router.get("/summary/{year}", response_model=ExpenseSummary)
def get_expense_summary(year: int, db: Session = Depends(get_db)):
    """Get expense summary. year=0 means all years."""
    # Total expenses (simple sum, no annualization)
    exp_query = db.query(func.coalesce(func.sum(Expense.amount), 0))
    if year > 0:
        exp_query = exp_query.filter(extract("year", Expense.date) == year)
    total_expenses = exp_query.scalar() or Decimal("0")

    # Income: sum of paid monthly payments
    inc_query = (
        db.query(func.coalesce(func.sum(MonthlyPayment.amount), 0))
        .join(User, MonthlyPayment.user_id == User.id)
        .filter(
            MonthlyPayment.is_paid == True,
            User.is_active == True,
            User.deleted_from_plex == False,
        )
    )
    if year > 0:
        inc_query = inc_query.filter(MonthlyPayment.year == year)
    total_income = inc_query.scalar() or Decimal("0")

    net_profit = total_income - total_expenses

    # Monthly average
    if year > 0:
        current_month = datetime.now().month if year == datetime.now().year else 12
    else:
        current_month = 12
    monthly_avg = total_expenses / current_month if current_month > 0 else Decimal("0")

    # By category
    by_category = {}
    for cat in EXPENSE_CATEGORIES:
        cat_query = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
            Expense.category == cat,
        )
        if year > 0:
            cat_query = cat_query.filter(extract("year", Expense.date) == year)
        cat_total = cat_query.scalar() or Decimal("0")
        if cat_total > 0:
            by_category[cat] = cat_total

    return ExpenseSummary(
        total_expenses=total_expenses,
        total_income=total_income,
        net_profit=net_profit,
        monthly_avg_expense=monthly_avg,
        by_category=by_category,
    )

