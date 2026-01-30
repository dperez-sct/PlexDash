from fastapi import APIRouter, Depends, HTTPException, status
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

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class ChangeCredentialsRequest(BaseModel):
    current_password: str
    new_username: str | None = None
    new_password: str | None = None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> str:
    """Dependency to verify JWT token and return current user."""
    token = credentials.credentials
    username = verify_token(db, token)
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return username


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return JWT token."""
    if not authenticate_user(db, request.username, request.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    access_token = create_access_token(db, data={"sub": request.username})
    return LoginResponse(
        access_token=access_token,
        username=request.username,
    )


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
