import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.models.settings import Settings, ADMIN_USERNAME_KEY, ADMIN_PASSWORD_KEY, JWT_SECRET_KEY
from app.config import get_settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin"


def get_setting(db: Session, key: str) -> Optional[str]:
    setting = db.query(Settings).filter(Settings.key == key).first()
    return setting.value if setting else None


def set_setting(db: Session, key: str, value: str) -> None:
    setting = db.query(Settings).filter(Settings.key == key).first()
    if setting:
        setting.value = value
    else:
        setting = Settings(key=key, value=value)
        db.add(setting)
    db.commit()


def get_jwt_secret(db: Session) -> str:
    """Get JWT secret key. Prefers JWT_SECRET env var over database storage."""
    env_secret = get_settings().jwt_secret
    if env_secret:
        return env_secret
    # Legacy fallback: read from database (auto-generates on first run)
    secret = get_setting(db, JWT_SECRET_KEY)
    if not secret:
        secret = secrets.token_urlsafe(32)
        set_setting(db, JWT_SECRET_KEY, secret)
    return secret


def get_admin_username(db: Session) -> str:
    """Get admin username, defaulting to 'admin'."""
    return get_setting(db, ADMIN_USERNAME_KEY) or DEFAULT_USERNAME


def get_admin_password_hash(db: Session) -> str:
    """Get admin password hash, creating default if not exists."""
    hash_value = get_setting(db, ADMIN_PASSWORD_KEY)
    if not hash_value:
        hash_value = hash_password(DEFAULT_PASSWORD)
        set_setting(db, ADMIN_PASSWORD_KEY, hash_value)
    return hash_value


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')


def authenticate_user(db: Session, username: str, password: str) -> bool:
    """Verify username and password."""
    stored_username = get_admin_username(db)
    stored_hash = get_admin_password_hash(db)

    if username != stored_username:
        return False
    return verify_password(password, stored_hash)


def create_access_token(db: Session, data: dict) -> str:
    """Create JWT access token."""
    secret = get_jwt_secret(db)
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, secret, algorithm=ALGORITHM)


def verify_token(db: Session, token: str) -> Optional[str]:
    """Verify JWT token and return username if valid."""
    try:
        secret = get_jwt_secret(db)
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return username
    except JWTError:
        return None
