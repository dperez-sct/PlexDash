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
    """Get yearly expense summary with income comparison."""
    # Calculate total expenses for the year
    # Include one_time expenses that fall in this year
    one_time_total = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            extract("year", Expense.date) == year,
            Expense.recurrence == "one_time",
        )
        .scalar()
    ) or Decimal("0")

    # Monthly recurring expenses: amount * 12
    monthly_recurring = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.is_recurring == True,
            Expense.recurrence == "monthly",
            extract("year", Expense.date) <= year,
        )
        .scalar()
    ) or Decimal("0")
    monthly_total = monthly_recurring * 12

    # Yearly recurring expenses
    yearly_recurring = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.is_recurring == True,
            Expense.recurrence == "yearly",
            extract("year", Expense.date) <= year,
        )
        .scalar()
    ) or Decimal("0")

    total_expenses = one_time_total + monthly_total + yearly_recurring

    # Income: sum of paid monthly payments for this year
    total_income = (
        db.query(func.coalesce(func.sum(MonthlyPayment.amount), 0))
        .join(User, MonthlyPayment.user_id == User.id)
        .filter(
            MonthlyPayment.year == year,
            MonthlyPayment.is_paid == True,
            User.is_active == True,
            User.deleted_from_plex == False,
        )
        .scalar()
    ) or Decimal("0")

    net_profit = total_income - total_expenses

    # Monthly average
    current_month = datetime.now().month if year == datetime.now().year else 12
    monthly_avg = total_expenses / current_month if current_month > 0 else Decimal("0")

    # By category
    by_category = {}
    for cat in EXPENSE_CATEGORIES:
        cat_one_time = (
            db.query(func.coalesce(func.sum(Expense.amount), 0))
            .filter(
                extract("year", Expense.date) == year,
                Expense.category == cat,
                Expense.recurrence == "one_time",
            )
            .scalar()
        ) or Decimal("0")

        cat_monthly = (
            db.query(func.coalesce(func.sum(Expense.amount), 0))
            .filter(
                Expense.category == cat,
                Expense.is_recurring == True,
                Expense.recurrence == "monthly",
                extract("year", Expense.date) <= year,
            )
            .scalar()
        ) or Decimal("0")

        cat_yearly = (
            db.query(func.coalesce(func.sum(Expense.amount), 0))
            .filter(
                Expense.category == cat,
                Expense.is_recurring == True,
                Expense.recurrence == "yearly",
                extract("year", Expense.date) <= year,
            )
            .scalar()
        ) or Decimal("0")

        cat_total = cat_one_time + (cat_monthly * 12) + cat_yearly
        if cat_total > 0:
            by_category[cat] = cat_total

    return ExpenseSummary(
        total_expenses=total_expenses,
        total_income=total_income,
        net_profit=net_profit,
        monthly_avg_expense=monthly_avg,
        by_category=by_category,
    )
