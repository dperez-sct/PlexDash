from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, nullable=False, index=True)  # e.g. "payment_marked", "payment_removed", "user_synced"
    entity_type = Column(String, nullable=False)  # "payment", "user", "settings"
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)  # JSON string with extra details
    created_at = Column(DateTime(timezone=True), server_default=func.now())
