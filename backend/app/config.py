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
    secret_key: str = "changeme_in_production_please"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 43200  # 30 days

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
