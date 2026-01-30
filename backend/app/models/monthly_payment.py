from sqlalchemy import Column, Integer, Boolean, ForeignKey, DateTime, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class MonthlyPayment(Base):
    __tablename__ = "monthly_payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)  # 1-12
    amount = Column(Numeric(10, 2), default=0)
    is_paid = Column(Boolean, default=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="monthly_payments")

    __table_args__ = (
        UniqueConstraint('user_id', 'year', 'month', name='uq_user_year_month'),
    )
