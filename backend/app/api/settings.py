from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.settings import Settings, PLEX_URL_KEY, PLEX_TOKEN_KEY, CURRENCY_SYMBOL_KEY, MONTHLY_PRICE_KEY
from app.services.plex import plex_service

router = APIRouter(prefix="/settings", tags=["settings"])


class PlexSettings(BaseModel):
    plex_url: str
    plex_token: str


class PlexSettingsResponse(BaseModel):
    plex_url: Optional[str] = None
    plex_token_configured: bool = False


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


@router.get("/plex", response_model=PlexSettingsResponse)
def get_plex_settings(db: Session = Depends(get_db)):
    """Get current Plex settings (token is masked)."""
    plex_url = get_setting(db, PLEX_URL_KEY)
    plex_token = get_setting(db, PLEX_TOKEN_KEY)

    return PlexSettingsResponse(
        plex_url=plex_url,
        plex_token_configured=bool(plex_token),
    )


@router.put("/plex")
def update_plex_settings(settings: PlexSettings, db: Session = Depends(get_db)):
    """Update Plex settings."""
    set_setting(db, PLEX_URL_KEY, settings.plex_url)
    set_setting(db, PLEX_TOKEN_KEY, settings.plex_token)

    # Update the plex service with new settings
    plex_service.update_settings(settings.plex_url, settings.plex_token)

    return {"message": "Plex settings updated successfully"}


@router.post("/plex/test")
async def test_plex_connection(db: Session = Depends(get_db)):
    """Test connection to Plex server."""
    plex_url = get_setting(db, PLEX_URL_KEY)
    plex_token = get_setting(db, PLEX_TOKEN_KEY)

    if not plex_url or not plex_token:
        return {"success": False, "error": "Plex URL and token not configured"}

    # Temporarily update service and test
    plex_service.update_settings(plex_url, plex_token)
    info = await plex_service.get_server_info()

    if info:
        return {"success": True, "server_info": info}
    return {"success": False, "error": "Could not connect to Plex server"}


class CurrencySettings(BaseModel):
    currency_symbol: str


class CurrencySettingsResponse(BaseModel):
    currency_symbol: str = "$"


@router.get("/currency", response_model=CurrencySettingsResponse)
def get_currency_settings(db: Session = Depends(get_db)):
    """Get current currency symbol."""
    symbol = get_setting(db, CURRENCY_SYMBOL_KEY)
    return CurrencySettingsResponse(currency_symbol=symbol or "$")


@router.put("/currency")
def update_currency_settings(settings: CurrencySettings, db: Session = Depends(get_db)):
    """Update currency symbol."""
    set_setting(db, CURRENCY_SYMBOL_KEY, settings.currency_symbol)
    return {"message": "Currency settings updated successfully"}


class MonthlyPriceSettings(BaseModel):
    monthly_price: float


class MonthlyPriceSettingsResponse(BaseModel):
    monthly_price: float = 0.0


@router.get("/price", response_model=MonthlyPriceSettingsResponse)
def get_monthly_price_settings(db: Session = Depends(get_db)):
    """Get current monthly price."""
    price = get_setting(db, MONTHLY_PRICE_KEY)
    return MonthlyPriceSettingsResponse(monthly_price=float(price) if price else 0.0)


@router.put("/price")
def update_monthly_price_settings(settings: MonthlyPriceSettings, db: Session = Depends(get_db)):
    """Update monthly price."""
    set_setting(db, MONTHLY_PRICE_KEY, str(settings.monthly_price))
    return {"message": "Monthly price settings updated successfully"}
