from sqlalchemy import Column, Integer, String, DateTime, Text, Numeric, Boolean
from sqlalchemy.sql import func
from app.database import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False, default="other")
    # Categories: hardware, licenses, hosting, plex_pass, domain, subscriptions, other
    amount = Column(Numeric(10, 2), nullable=False)
    is_recurring = Column(Boolean, default=False)
    recurrence = Column(String, default="one_time")
    # Recurrence: monthly, yearly, one_time
    date = Column(DateTime(timezone=True), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
