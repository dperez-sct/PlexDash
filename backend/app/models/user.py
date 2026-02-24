from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    plex_id = Column(String, unique=True, index=True)
    username = Column(String, index=True)
    email = Column(String, nullable=True, index=True)
    thumb = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    deleted_from_plex = Column(Boolean, default=False)
    kill_stream_enabled = Column(Boolean, default=False)
    last_warned_at = Column(Date, nullable=True)  # Persist warn-once state
    warn_count = Column(Integer, default=0)  # Total warnings delivered
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    subscriptions = relationship("Subscription", back_populates="user")
    payments = relationship("Payment", back_populates="user")
    monthly_payments = relationship("MonthlyPayment", back_populates="user")
