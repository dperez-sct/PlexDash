from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# Settings keys
PLEX_URL_KEY = "plex_url"
PLEX_TOKEN_KEY = "plex_token"
CURRENCY_SYMBOL_KEY = "currency_symbol"
ADMIN_USERNAME_KEY = "admin_username"
ADMIN_PASSWORD_KEY = "admin_password_hash"
JWT_SECRET_KEY = "jwt_secret"
MONTHLY_PRICE_KEY = "monthly_price"
