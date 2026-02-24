"""Tautulli integration service for checking user activity and kill-stream support."""
import httpx
import logging

logger = logging.getLogger(__name__)


class TautulliService:
    """Interact with the Tautulli API."""

    def __init__(self):
        self.base_url: str | None = None
        self.api_key: str | None = None
        # Track warned users: {plex_id: date_of_last_warning}
        self._warned_users: dict[str, str] = {}

    def configure(self, url: str, api_key: str):
        self.base_url = url.rstrip("/")
        self.api_key = api_key

    def is_configured(self) -> bool:
        return bool(self.base_url and self.api_key)

    def should_warn(self, plex_id: str) -> bool:
        """Check if user should be warned (only once per day)."""
        from datetime import date
        today = date.today().isoformat()
        last_warned = self._warned_users.get(plex_id)
        if last_warned == today:
            return False  # Already warned today, let them watch
        return True

    def mark_warned(self, plex_id: str):
        """Record that the user has been warned today."""
        from datetime import date
        self._warned_users[plex_id] = date.today().isoformat()

    def load_from_db(self, db):
        from app.models.settings import Settings
        url_row = db.query(Settings).filter(Settings.key == "tautulli_url").first()
        key_row = db.query(Settings).filter(Settings.key == "tautulli_api_key").first()
        if url_row and key_row:
            self.configure(url_row.value, key_row.value)

    async def _call(self, cmd: str, **params) -> dict:
        """Make a Tautulli API call."""
        if not self.is_configured():
            raise RuntimeError("Tautulli not configured")

        url = f"{self.base_url}/api/v2"
        params.update({"apikey": self.api_key, "cmd": cmd})

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    async def test_connection(self) -> dict:
        """Test connection and return server info."""
        try:
            data = await self._call("get_tautulli_info")
            info = data.get("response", {}).get("data", {})
            return {
                "success": True,
                "server_name": info.get("tautulli_version", "Tautulli"),
            }
        except Exception as e:
            logger.error(f"Tautulli connection test failed: {e}")
            return {"success": False, "error": str(e)}

    async def get_user_watch_stats(self, plex_id: str) -> dict | None:
        """Get comprehensive watch stats for a user by their Plex user ID."""
        try:
            # Basic user info
            data = await self._call("get_user", user_id=plex_id)
            user_data = data.get("response", {}).get("data", {})
            if not user_data:
                return None

            result = {
                "total_plays": user_data.get("plays", 0),
                "total_duration": user_data.get("duration", 0),
                "last_seen": user_data.get("last_seen", None),
                "last_played": user_data.get("last_played", ""),
                "player": user_data.get("player", ""),
            }

            # Watch time stats by period (1, 7, 30 days)
            try:
                wts = await self._call("get_user_watch_time_stats", user_id=plex_id, grouping=1)
                wts_data = wts.get("response", {}).get("data", [])
                for period in wts_data:
                    days = period.get("query_days", 0)
                    if days == 1:
                        result["plays_today"] = period.get("total_plays", 0)
                        result["duration_today"] = period.get("total_time", 0)
                    elif days == 7:
                        result["plays_7d"] = period.get("total_plays", 0)
                        result["duration_7d"] = period.get("total_time", 0)
                    elif days == 30:
                        result["plays_30d"] = period.get("total_plays", 0)
                        result["duration_30d"] = period.get("total_time", 0)
            except Exception:
                pass  # Watch time stats are optional

            # Recent history (last 5 items)
            try:
                hist = await self._call("get_history", user_id=plex_id, length=5)
                hist_data = hist.get("response", {}).get("data", {}).get("data", [])
                result["recent_history"] = [
                    {
                        "title": h.get("full_title", h.get("title", "")),
                        "media_type": h.get("media_type", ""),
                        "date": h.get("date", 0),
                        "duration": h.get("duration", 0),
                        "percent_complete": h.get("percent_complete", 0),
                    }
                    for h in hist_data
                ]
            except Exception:
                result["recent_history"] = []

            return result
        except Exception as e:
            logger.error(f"Error fetching Tautulli user stats for {plex_id}: {e}")
            return None

    async def terminate_session(self, session_id: str, message: str) -> bool:
        """Kill an active stream with a custom message."""
        try:
            await self._call(
                "terminate_session",
                session_id=session_id,
                message=message,
            )
            return True
        except Exception as e:
            logger.error(f"Error terminating session {session_id}: {e}")
            return False

    async def get_activity(self) -> list[dict]:
        """Get current server activity (active streams)."""
        try:
            data = await self._call("get_activity")
            sessions = data.get("response", {}).get("data", {}).get("sessions", [])
            return sessions
        except Exception as e:
            logger.error(f"Error fetching Tautulli activity: {e}")
            return []


tautulli_service = TautulliService()
