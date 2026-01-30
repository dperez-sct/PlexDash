import httpx
import xml.etree.ElementTree as ET
from typing import Optional
from app.config import get_settings


class PlexService:
    def __init__(self):
        settings = get_settings()
        self.base_url = settings.plex_url
        self.token = settings.plex_token

    def update_settings(self, base_url: str, token: str) -> None:
        """Update Plex settings dynamically."""
        self.base_url = base_url
        self.token = token

    def load_from_db(self, db) -> None:
        """Load settings from database."""
        from app.models.settings import Settings, PLEX_URL_KEY, PLEX_TOKEN_KEY

        url_setting = db.query(Settings).filter(Settings.key == PLEX_URL_KEY).first()
        token_setting = db.query(Settings).filter(Settings.key == PLEX_TOKEN_KEY).first()

        if url_setting and url_setting.value:
            self.base_url = url_setting.value
        if token_setting and token_setting.value:
            self.token = token_setting.value

    def _get_headers(self) -> dict:
        return {
            "X-Plex-Token": self.token,
            "Accept": "application/json",
        }

    def is_configured(self) -> bool:
        """Check if Plex is configured."""
        return bool(self.base_url and self.token)

    async def _get_server_machine_identifier(self, client: httpx.AsyncClient) -> Optional[str]:
        """Get the machineIdentifier of the local Plex server."""
        try:
            response = await client.get(
                f"{self.base_url}/",
                headers=self._get_headers(),
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("MediaContainer", {}).get("machineIdentifier")
        except httpx.HTTPError as e:
            print(f"Error fetching server machineIdentifier: {e}")
            return None

    async def get_users(self) -> list[dict]:
        """Fetch users with access to this server from plex.tv."""
        if not self.token:
            return []

        async with httpx.AsyncClient() as client:
            try:
                # Get server machineIdentifier
                machine_id = await self._get_server_machine_identifier(client)
                if not machine_id:
                    print("Could not get server machineIdentifier")
                    return []

                # Get users from plex.tv (the source of truth for shared access)
                response = await client.get(
                    f"https://plex.tv/api/users/?X-Plex-Token={self.token}",
                    timeout=30.0,
                )
                response.raise_for_status()

                root = ET.fromstring(response.text)
                users = []
                for user_elem in root.findall("User"):
                    # Check if user has access to this specific server
                    has_access = False
                    for server_elem in user_elem.findall("Server"):
                        if server_elem.get("machineIdentifier") == machine_id:
                            has_access = True
                            break

                    if has_access:
                        plex_id = user_elem.get("id")
                        if plex_id:
                            users.append({
                                "plex_id": plex_id,
                                "username": user_elem.get("username") or user_elem.get("title", ""),
                                "email": user_elem.get("email", ""),
                                "thumb": user_elem.get("thumb", ""),
                            })
                return users
            except (httpx.HTTPError, ET.ParseError) as e:
                print(f"Error fetching Plex users: {e}")
                return []

    async def get_server_info(self) -> Optional[dict]:
        """Get Plex server information."""
        if not self.token:
            return None

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/",
                    headers=self._get_headers(),
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                container = data.get("MediaContainer", {})
                return {
                    "name": container.get("friendlyName", "Unknown"),
                    "version": container.get("version", "Unknown"),
                    "platform": container.get("platform", "Unknown"),
                }
            except httpx.HTTPError as e:
                print(f"Error fetching Plex server info: {e}")
                return None


plex_service = PlexService()
