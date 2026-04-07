from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "PlexDash"
    debug: bool = False

    # Database
    database_url: str = "postgresql://plexdash:plexdash@localhost:5432/plexdash"

    # Plex
    plex_url: str = "http://localhost:32400"
    plex_token: str = ""

    # Security
    # JWT_SECRET: set this in production to a strong random value.
    # If not set, the app falls back to a secret stored in the database (legacy).
    jwt_secret: str = ""
    # HTTPS_ONLY: set to true when serving over HTTPS so session cookies are secure.
    https_only: bool = False
    # ALLOWED_ORIGINS: comma-separated list of allowed origins for CORS.
    # Use "*" only for local development. In production, set to your domain.
    allowed_origins: str = "*"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
