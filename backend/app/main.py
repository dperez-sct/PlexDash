from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base, SessionLocal
from app.api import users, payments, dashboard, settings as settings_router, monthly_payments, auth
from app.api.auth import get_current_user
from app.services.plex import plex_service

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load Plex settings from database on startup
    db = SessionLocal()
    try:
        plex_service.load_from_db(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    description="Payment management system for Plex servers",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables
Base.metadata.create_all(bind=engine)

# Auth router (no authentication required)
app.include_router(auth.router, prefix="/api")

# Protected routers (require authentication)
protected_dependencies = [Depends(get_current_user)]
app.include_router(users.router, prefix="/api", dependencies=protected_dependencies)
app.include_router(payments.router, prefix="/api", dependencies=protected_dependencies)
app.include_router(dashboard.router, prefix="/api", dependencies=protected_dependencies)
app.include_router(settings_router.router, prefix="/api", dependencies=protected_dependencies)
app.include_router(monthly_payments.router, prefix="/api", dependencies=protected_dependencies)


@app.get("/")
def root():
    return {"message": "Welcome to PlexDash API"}


@app.get("/health")
def health():
    return {"status": "healthy"}
