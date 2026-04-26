from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.services.auth import (
    authenticate_user,
    create_access_token,
    verify_token,
    get_admin_username,
    hash_password,
    set_setting,
)
from app.models.settings import ADMIN_USERNAME_KEY, ADMIN_PASSWORD_KEY
from app.config import get_settings
from app.limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])
# Make security optional so we can fall back to cookies
security = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    username: str
    message: str


class ChangeCredentialsRequest(BaseModel):
    current_password: str
    new_username: str | None = None
    new_password: str | None = None


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db)
) -> str:
    """Dependency to verify JWT token and return current user."""
    token = None
    if credentials:
        token = credentials.credentials
    elif access_token:
        # Strip quotes (Python http.cookies quotes values with spaces) and optional Bearer prefix
        token = access_token.strip('"').strip("'")
        if token.startswith("Bearer "):
            token = token[len("Bearer "):]
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = verify_token(db, token)
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return username


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
def login(request: Request, response: Response, login_data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and set JWT token in HttpOnly cookie. Max 10 attempts per minute per IP."""
    if not authenticate_user(db, login_data.username, login_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    access_token = create_access_token(db, data={"sub": login_data.username})

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=get_settings().https_only,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,  # 7 days
    )

    return LoginResponse(
        username=login_data.username,
        message="Login successful"
    )


@router.post("/logout")
def logout(response: Response):
    """Logout user by clearing the auth cookie."""
    response.delete_cookie("access_token")
    return {"message": "Logged out successfully"}



@router.get("/me")
def get_me(current_user: str = Depends(get_current_user)):
    """Get current authenticated user."""
    return {"username": current_user}


@router.post("/change-credentials")
def change_credentials(
    request: ChangeCredentialsRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change admin username and/or password."""
    # Verify current password
    if not authenticate_user(db, current_user, request.current_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    # Update username if provided
    if request.new_username:
        set_setting(db, ADMIN_USERNAME_KEY, request.new_username)

    # Update password if provided
    if request.new_password:
        set_setting(db, ADMIN_PASSWORD_KEY, hash_password(request.new_password))

    return {"message": "Credentials updated successfully"}
