# PlexDash

![Build](https://github.com/dperez-sct/PlexDash/actions/workflows/docker-publish.yml/badge.svg)

Payment management system for Plex servers.

## Features

- **User Management**: Sync and manage users from your Plex server
- **Library Sharing Toggle**: Revoke and restore Plex library access per user
- **User Invitations**: Invite new users directly from the dashboard
- **User Profiles**: Detailed user view with payment history, Tautulli stats, and warnings
- **Payment Tracking**: Monthly payment grid with per-user tracking
- **Quick Payments**: Bulk payment recording with multi-month selection
- **Payment History**: Complete payment history per user
- **Expenses Management**: Track platform expenses with category breakdown and year filtering
- **Dashboard**: Overview of revenue, users, payment status, and accumulated expenses
- **Tautulli Integration**: Kill-stream for unpaid users with configurable warning modes and debt periods
- **Notifications**: Telegram and Discord — payments, expenses, and monthly reminders
- **Audit Log**: Full audit trail of all actions
- **Backup & Restore**: Export/import all data as JSON
- **User Search**: Filter and sort users by username, email, status, or notes
- **Authentication**: JWT-based authentication with configurable credentials
- **Currency & Price Settings**: Configurable currency symbol and monthly price
- **Help Page**: Built-in documentation for all features
- **Multi-language**: Spanish UI

## Tech Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Python + FastAPI + SQLAlchemy + Alembic + python-plexapi
- **Database**: PostgreSQL (CloudNativePG for Kubernetes) / SQLite (Lightweight)
- **Infrastructure**: Docker Compose / Kubernetes

## Docker Images

Pre-built images are published automatically to GitHub Container Registry on every release:

```
ghcr.io/dperez-sct/plexdash:<version>
```

| Tag | Description |
|-----|-------------|
| `latest` | Latest build from `main` branch |
| `3.14` | Specific version (matches the version shown in the app) |

Images are built for `linux/amd64` and `linux/arm64` (Raspberry Pi compatible).

## Deployment Options

### Option 1: Lightweight — Single Container (Recommended)

Best for homelab and personal use. A single container bundles the frontend, backend, and SQLite database — no external dependencies.

**Using the pre-built image:**

```bash
docker run -d \
  --name plexdash \
  -p 8000:8000 \
  -v plexdash_data:/app/data \
  -e PLEX_URL=http://192.168.1.10:32400 \
  -e PLEX_TOKEN=your-plex-token \
  -e JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))") \
  --restart unless-stopped \
  ghcr.io/dperez-sct/plexdash:latest
```

**Using docker-compose:**

```bash
cd deploy/lightweight/

PLEX_URL=http://192.168.1.10:32400 PLEX_TOKEN=your-token docker-compose up -d
```

Available environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PLEX_URL` | `http://host.docker.internal:32400` | Plex Media Server URL |
| `PLEX_TOKEN` | — | Plex authentication token |
| `JWT_SECRET` | — | Secret for JWT signing — generate with `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `PORT` | `8000` | Port exposed on the host |
| `HTTPS_ONLY` | `false` | Set to `true` when serving over HTTPS (enables secure cookies) |
| `ALLOWED_ORIGINS` | `*` | CORS allowed origins — restrict to your domain in production |

Access the dashboard at [http://localhost:8000](http://localhost:8000).

> **Default credentials:** `admin` / `admin` — change them immediately after first login from the Settings page.

> **Note:** Data is persisted in a Docker volume (`plexdash_data`). The SQLite database lives at `/app/data/plexdash.db` inside the container.

---

### Option 2: Standard Deployment (Docker Compose)

Uses separate containers for frontend, backend, and PostgreSQL.

1. **Start services**:
   ```bash
   docker-compose up -d
   ```

2. **Access**:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:8000](http://localhost:8000)

> Configure `PLEX_URL`, `PLEX_TOKEN`, and `SECRET_KEY` in `docker-compose.yaml` or via environment variables before starting.

---

### Option 3: Kubernetes

Uses CloudNativePG for PostgreSQL and separate backend/frontend deployments.

#### Prerequisites

- Kubernetes cluster
- CloudNativePG operator installed
- NGINX Ingress Controller
- cert-manager (optional, for TLS)

#### Deploy

1. **Create secrets** (do not commit real values to git):
   ```bash
   cat > k8s/secrets.yaml << EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: plexdash-db-credentials
     namespace: plexdash
   type: kubernetes.io/basic-auth
   stringData:
     username: plexdash
     password: YOUR_SECURE_DB_PASSWORD
   ---
   apiVersion: v1
   kind: Secret
   metadata:
     name: plexdash-backend-secrets
     namespace: plexdash
   type: Opaque
   stringData:
     database-url: "postgresql://plexdash:YOUR_SECURE_DB_PASSWORD@plexdash-db-rw:5432/plexdash"
     plex-token: "YOUR_PLEX_TOKEN"
   EOF
   ```

2. **Configure Ingress host** in `k8s/base/ingress.yaml`

3. **Apply manifests**:
   ```bash
   kubectl apply -f k8s/secrets.yaml
   kubectl apply -k k8s/
   ```

4. **Run migrations** (first time or after updates):
   ```bash
   kubectl apply -f k8s/base/migration-job.yaml
   ```

#### Production Considerations

- Use external secrets management (Vault, AWS Secrets Manager, etc.)
- Enable TLS in Ingress with cert-manager
- Configure proper resource limits based on load
- Configure backup for PostgreSQL (CNPG supports automated backups)

---

## In-app Configuration

Most settings are configured from **Settings** inside the app — no need to restart the container. This includes:

- Plex connection URL and token
- Monthly price and currency symbol
- Notifications (Telegram / Discord)
- Tautulli integration and kill-stream behavior
- Admin credentials

---

## Notifications (Telegram & Discord)

Configure from **Settings → Notifications**.

### Telegram

1. Create a bot via [@BotFather](https://t.me/botfather) and copy the token
2. Get your chat ID — send a message to your bot and visit:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Enter both values in Settings → Notifications

### Discord

1. In your Discord server, go to **Settings → Integrations → Webhooks → New Webhook**
2. Copy the webhook URL
3. Paste it in Settings → Notifications

### Notification events

| Event | Description |
|-------|-------------|
| Payment received | Fires when a monthly payment is marked as paid |
| Expense created | Fires when a new expense is added |
| Monthly reminders | Summary of pending payments (triggered manually or on schedule) |

---

## Tautulli Integration

PlexDash can automatically kill streams for users with outstanding debt.

### How it works

When a user starts playing something, Tautulli calls a PlexDash endpoint. PlexDash checks the user's payment status and tells Tautulli whether to allow or kill the stream.

### Setup

1. In Tautulli, go to **Settings → Web Interface** and copy the **API Key**
2. In PlexDash, go to **Settings → Tautulli** and enter the URL and API key
3. In Tautulli, create a **Script** notification agent (Settings → Notification Agents):
   - **Script folder**: directory where you save the script below
   - **Script file**: `plexdash_check.py`
   - **Trigger**: Playback Start only
   - **Script Arguments** (under the Playback Start trigger): `{user_id} {session_key}`

> **Note:** Tautulli passes notification parameters as command-line arguments, not environment variables. The correct parameter for the Plex user ID is `{user_id}`.

**Script to save as `plexdash_check.py`:**

```python
#!/usr/bin/env python3
import sys, json
import urllib.request, urllib.parse

# Tautulli passes parameters as arguments — configure Script Arguments as: {user_id} {session_key}
if len(sys.argv) < 3:
    sys.exit(0)

plex_user_id = sys.argv[1]
session_key  = sys.argv[2]

PLEXDASH_URL = "http://YOUR_PLEXDASH:8000"   # no trailing slash
TAUTULLI_URL = "http://YOUR_TAUTULLI:8181"   # no trailing slash
TAUTULLI_KEY = "YOUR_TAUTULLI_API_KEY"

try:
    with urllib.request.urlopen(f"{PLEXDASH_URL}/api/tautulli/check/{plex_user_id}", timeout=5) as r:
        data = json.loads(r.read())
except Exception as e:
    print(f"[PlexDash] Error: {e}")
    sys.exit(0)

if data.get("action") != "kill":
    sys.exit(0)

message = data.get("message", "")
params = urllib.parse.urlencode({
    "apikey": TAUTULLI_KEY,
    "cmd": "terminate_session",
    "session_key": session_key,
    "message": message,
})
try:
    urllib.request.urlopen(f"{TAUTULLI_URL}/api/v2?{params}", timeout=5)
    print(f"[PlexDash] Stream killed: {data.get('username')} ({data.get('unpaid_months')} months)")
except Exception as e:
    print(f"[PlexDash] Error terminating session: {e}")
```

### Kill-stream modes

| Mode | Behavior |
|------|----------|
| Always | Kills every playback attempt while the user has debt |
| Once per day | Kills only the first playback of each day |
| Disabled | Never kills (monitoring only) |

### Debt period

Configurable from Settings → Tautulli. Determines which unpaid months count as debt:

- Current year
- Last 3 / 6 / 12 months
- Since join date
- All time

### User exceptions

- **Inactive users** (e.g. family) are never checked — mark a user as inactive from the Users list
- **Per-user kill-stream** can be disabled individually from the user's profile

---

## Finding Your Plex Token

1. Sign in to [Plex Web App](https://app.plex.tv)
2. Open browser developer tools (F12)
3. Navigate to any library and look for requests to `plex.tv`
4. Find the `X-Plex-Token` header value

## Issues & Support

Found a bug or have a feature request? [Open an issue](https://github.com/dperez-sct/PlexDash/issues).

## License

MIT
