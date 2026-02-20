from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.config import get_settings
from app.database import engine, Base, SessionLocal
from app.api import users, payments, dashboard, settings as settings_router, monthly_payments, auth, audit, expenses
from app.api.auth import get_current_user
from app.services.plex import plex_service
import app.models.audit_log  # noqa: ensure table is created
import app.models.expense  # noqa: ensure table is created

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
app.include_router(audit.router, prefix="/api", dependencies=protected_dependencies)
app.include_router(expenses.router, prefix="/api", dependencies=protected_dependencies)


@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/")
async def serve_index():
    if os.path.exists("static/index.html"):
        return FileResponse("static/index.html")
    return {"message": "Welcome to PlexDash API (Frontend not found)"}


# Serve frontend static files
if os.path.isdir("static"):
    app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api"):
            return {"error": "Not found"}
        if os.path.exists("static/index.html"):
            return FileResponse("static/index.html")
        return {"error": "Frontend not found"}
