from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, List


# User schemas
class UserBase(BaseModel):
    username: str
    email: str
    thumb: Optional[str] = None
    notes: Optional[str] = None


class UserCreate(UserBase):
    plex_id: str


class UserUpdate(BaseModel):
    notes: Optional[str] = None


class User(UserBase):
    id: int
    plex_id: str
    is_active: bool
    deleted_from_plex: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


# Subscription schemas
class SubscriptionBase(BaseModel):
    plan_name: str = "Standard"
    amount: Decimal
    currency: str = "EUR"


class SubscriptionCreate(SubscriptionBase):
    user_id: int


class SubscriptionUpdate(BaseModel):
    plan_name: Optional[str] = None
    amount: Optional[Decimal] = None
    status: Optional[str] = None
    next_payment_date: Optional[datetime] = None


class Subscription(SubscriptionBase):
    id: int
    user_id: int
    status: str
    start_date: datetime
    next_payment_date: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# Payment schemas
class PaymentBase(BaseModel):
    amount: Decimal
    currency: str = "EUR"
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[datetime] = None


class PaymentCreate(PaymentBase):
    user_id: int
    subscription_id: Optional[int] = None


class PaymentUpdate(BaseModel):
    status: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    paid_at: Optional[datetime] = None


class Payment(PaymentBase):
    id: int
    user_id: int
    subscription_id: Optional[int]
    status: str
    paid_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# Dashboard schemas
class DashboardStats(BaseModel):
    total_users: int
    active_users: int
    total_revenue: Decimal
    pending_payments: int
    overdue_payments: int


class PlexServerInfo(BaseModel):
    name: str
    version: str
    platform: str


# Monthly Payment schemas
class MonthlyPaymentBase(BaseModel):
    year: int
    month: int
    amount: Decimal = Decimal("0")
    is_paid: bool = False


class MonthlyPaymentUpdate(BaseModel):
    amount: Optional[Decimal] = None
    is_paid: Optional[bool] = None


class MonthlyPayment(MonthlyPaymentBase):
    id: int
    user_id: int
    paid_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserYearPayments(BaseModel):
    user_id: int
    username: str
    thumb: Optional[str] = None
    payments: Dict[int, MonthlyPayment]  # month -> payment data


# Expense schemas
EXPENSE_CATEGORIES = [
    "hardware", "licenses", "hosting", "plex_pass",
    "domain", "subscriptions", "other"
]

EXPENSE_RECURRENCES = ["monthly", "yearly", "one_time"]


class ExpenseBase(BaseModel):
    name: str
    category: str = "other"
    amount: Decimal
    is_recurring: bool = False
    recurrence: str = "one_time"
    date: datetime
    notes: Optional[str] = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[Decimal] = None
    is_recurring: Optional[bool] = None
    recurrence: Optional[str] = None
    date: Optional[datetime] = None
    notes: Optional[str] = None


class Expense(ExpenseBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExpenseSummary(BaseModel):
    total_expenses: Decimal
    total_income: Decimal
    net_profit: Decimal
    monthly_avg_expense: Decimal
    by_category: Dict[str, Decimal]
