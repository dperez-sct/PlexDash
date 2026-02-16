import logging
import httpx
import xml.etree.ElementTree as ET
from typing import Optional
from app.config import get_settings
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)


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
            logger.error(f"Error fetching server machineIdentifier: {e}")
            return None

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(httpx.HTTPError)
    )
    async def get_users(self) -> list[dict]:
        """Fetch users with access to this server from plex.tv."""
        if not self.token:
            return []

        async with httpx.AsyncClient() as client:
            try:
                # Get server machineIdentifier
                machine_id = await self._get_server_machine_identifier(client)
                if not machine_id:
                    logger.warning("Could not get server machineIdentifier")
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
                    shared_server_id = None
                    for server_elem in user_elem.findall("Server"):
                        if server_elem.get("machineIdentifier") == machine_id:
                            has_access = True
                            shared_server_id = server_elem.get("id")
                            break

                    if has_access:
                        plex_id = user_elem.get("id")
                        if plex_id:
                            users.append({
                                "plex_id": plex_id,
                                "username": user_elem.get("username") or user_elem.get("title", ""),
                                "email": user_elem.get("email", ""),
                                "thumb": user_elem.get("thumb", ""),
                                "shared_server_id": shared_server_id,
                            })
                return users
            except (httpx.HTTPError, ET.ParseError) as e:
                logger.error(f"Error fetching Plex users: {e}")
                return []

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(httpx.HTTPError)
    )
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
                    "machineIdentifier": container.get("machineIdentifier"),
                }
            except httpx.HTTPError as e:
                logger.error(f"Error fetching Plex server info: {e}")
                return None

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(httpx.HTTPError)
    )
    async def get_sections(self) -> list[dict]:
        """Fetch all library sections from the Plex server."""
        if not self.token:
            return []

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/library/sections",
                    headers=self._get_headers(),
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                container = data.get("MediaContainer", {})
                return container.get("Directory", [])
            except httpx.HTTPError as e:
                logger.error(f"Error fetching Plex sections: {e}")
                return []


    def _get_plex_server(self):
        """Get a PlexServer instance using python-plexapi."""
        from plexapi.server import PlexServer
        return PlexServer(self.base_url, self.token)

    def _get_plex_account(self):
        """Get the MyPlexAccount from the server."""
        server = self._get_plex_server()
        return server.myPlexAccount(), server

    async def share_libraries(self, username: str) -> bool:
        """Share all libraries with a user using python-plexapi."""
        if not self.token:
            logger.warning("Plex token not configured")
            return False

        try:
            import asyncio
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._share_libraries_sync, username)
            return result
        except Exception as e:
            logger.error(f"Error sharing libraries: {e}", exc_info=True)
            return False

    def _share_libraries_sync(self, username: str) -> bool:
        """Synchronous implementation of share_libraries."""
        try:
            account, server = self._get_plex_account()
            
            # Find the user
            target_user = None
            for u in account.users():
                if u.username == username or u.email == username:
                    target_user = u
                    break
            
            if not target_user:
                logger.warning(f"User {username} not found in Plex friends")
                return False
            
            # Get all library sections
            sections = server.library.sections()
            
            logger.info(f"Sharing {len(sections)} libraries with {target_user.username}")
            
            # updateFriend handles both new shares and re-sharing
            result = account.updateFriend(
                user=target_user,
                server=server,
                sections=sections
            )
            
            logger.info(f"Libraries shared successfully with {target_user.username}")
            return True
        except Exception as e:
            logger.error(f"Error sharing libraries with {username}: {e}", exc_info=True)
            return False

    async def unshare_libraries(self, username: str) -> bool:
        """Remove all shared libraries from a user, keeping them as a friend."""
        if not self.token:
            logger.warning("Plex token not configured")
            return False

        try:
            import asyncio
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._unshare_libraries_sync, username)
            return result
        except Exception as e:
            logger.error(f"Error unsharing libraries: {e}", exc_info=True)
            return False

    def _unshare_libraries_sync(self, username: str) -> bool:
        """Synchronous implementation of unshare_libraries.
        
        Uses direct DELETE on the shared server endpoint because
        python-plexapi's removeSections=True has a logic issue where
        the delete is skipped when the user already has server access.
        """
        try:
            account, server = self._get_plex_account()
            
            # Find the user
            target_user = None
            for u in account.users():
                if u.username == username or u.email == username:
                    target_user = u
                    break
            
            if not target_user:
                logger.warning(f"User {username} not found in Plex friends")
                return False
            
            # Find the shared server entry for this machine
            machine_id = server.machineIdentifier
            user_servers = [s for s in target_user.servers if s.machineIdentifier == machine_id]
            
            if not user_servers:
                logger.info(f"User {username} already has no access to this server")
                return True
            
            server_id = user_servers[0].id
            logger.info(f"Removing library access from {target_user.username}")
            
            # Direct DELETE to the shared server endpoint
            url = f"https://plex.tv/api/servers/{machine_id}/shared_servers/{server_id}"
            headers = {'Content-Type': 'application/json'}
            result = account.query(url, account._session.delete, headers=headers)
            
            logger.info(f"Library access removed from {target_user.username}")
            return True
        except Exception as e:
            logger.error(f"Error unsharing libraries for {username}: {e}", exc_info=True)
            return False

    async def _get_machine_identifier(self) -> Optional[str]:
        """Helper to get Plex machine identifier."""
        info = await self.get_server_info()
        return info.get("machineIdentifier") if info else None


plex_service = PlexService()
