# PlexDash

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
- **Tautulli Integration**: Kill-stream for unpaid users with configurable warning messages
- **Telegram Notifications**: Configurable notifications for payments, expenses, and warnings
- **Audit Log**: Full audit trail of all actions
- **Backup & Restore**: Export/import all data as JSON
- **User Search**: Filter users by username, email, or notes
- **Authentication**: JWT-based authentication with configurable credentials
- **Currency & Price Settings**: Configurable currency symbol and monthly price
- **Help Page**: Built-in documentation for all features
- **Multi-language**: Spanish UI

## Tech Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Python + FastAPI + SQLAlchemy + Alembic + python-plexapi
- **Database**: PostgreSQL (CloudNativePG for Kubernetes) / SQLite (Lightweight)
- **Infrastructure**: Docker Compose (dev) + Kubernetes (prod) + Lightweight single-container

## Deployment Options

PlexDash offers two deployment modes. Choose the one that best fits your needs.

### Option 1: Standard Deployment (Recommended)
Best for production environments. Uses a separate PostgreSQL container and isolated frontend/backend containers.

1. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Plex URL and token
   ```

2. **Start Services**:
   ```bash
   docker-compose up -d
   ```

3. **Access**:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:8000](http://localhost:8000)

### Option 2: Lightweight (Single Container)
Best for low-resource environments (e.g., Raspberry Pi). Uses SQLite and bundles the frontend/backend into a single container.

1. **Navigate to lightweight directory**:
   ```bash
   cd deploy/lightweight/
   ```

2. **Start Service**:
   ```bash
   # You can set variables inline or create a .env here
   PLEX_URL=http://192.168.1.10:32400 PLEX_TOKEN=your-token docker-compose up -d
   ```

3. **Access**:
   - Dashboard: [http://localhost:8000](http://localhost:8000)
   - *Note: Database is stored in `plexdash.db` in the volume.*

## Quick Start (Development)

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd plexdash
   ```

1. Sign in to Plex Web App
2. Open browser developer tools (F12)
3. Go to any library and look for requests to `plex.tv`
4. Find the `X-Plex-Token` header value

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster
- CloudNativePG operator installed
- NGINX Ingress Controller
- cert-manager (optional, for TLS)

### Deploy

1. **Create secrets** (don't commit real values to git):
```bash
# Create a secrets file (add to .gitignore)
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

2. **Build and push images**:
```bash
# Set your registry
REGISTRY=your-registry.com/plexdash

# Build and push
docker build -t $REGISTRY/backend:latest ./backend
docker build -t $REGISTRY/frontend:latest ./frontend
docker push $REGISTRY/backend:latest
docker push $REGISTRY/frontend:latest
```

3. **Update image references** in `k8s/base/backend-deployment.yaml` and `k8s/base/frontend-deployment.yaml`

4. **Configure Ingress host** in `k8s/base/ingress.yaml`

5. **Apply manifests**:
```bash
# Apply secrets first
kubectl apply -f k8s/secrets.yaml

# Apply the rest
kubectl apply -k k8s/
```

6. **Run migrations** (first time or after updates):
```bash
kubectl apply -f k8s/base/migration-job.yaml
```

### Production Considerations

- Use external secrets management (Vault, AWS Secrets Manager, etc.)
- Enable TLS in Ingress with cert-manager
- Configure proper resource limits based on load
- Set up monitoring and alerting
- Configure backup for PostgreSQL (CNPG supports automated backups)

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/change-credentials` - Change username/password

### Users
- `GET /api/users` - List all users
- `GET /api/users/{id}` - Get user details
- `POST /api/users/sync` - Sync users from Plex
- `PUT /api/users/{id}` - Update user (notes)
- `PUT /api/users/{id}/toggle-active` - Toggle user active status
- `DELETE /api/users/{id}/access` - Revoke library access (keeps user as friend)
- `POST /api/users/{id}/reactivate` - Restore all library access
- `POST /api/users/invite` - Invite a new user to the Plex server

### Monthly Payments
- `GET /api/monthly-payments/{year}` - Get all users' payments for a year
- `PUT /api/monthly-payments/{user_id}/{year}/{month}` - Update payment
- `POST /api/monthly-payments/{user_id}/{year}/toggle/{month}` - Toggle paid status
- `GET /api/monthly-payments/user/{user_id}/history` - Get user payment history
- `POST /api/monthly-payments/quick-payment` - Bulk payment for multiple months

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/recent-payments` - Get recent payments
- `GET /api/dashboard/upcoming-dues` - Get upcoming payment dues

### Settings
- `GET /api/settings/plex` - Get Plex settings
- `PUT /api/settings/plex` - Update Plex settings
- `POST /api/settings/plex/test` - Test Plex connection
- `GET /api/settings/currency` - Get currency symbol
- `PUT /api/settings/currency` - Update currency symbol
- `GET /api/settings/price` - Get monthly price
- `PUT /api/settings/price` - Update monthly price
- `GET /api/settings/backup` - Export all data as JSON
- `POST /api/settings/restore` - Import data from JSON backup

### Expenses
- `GET /api/expenses` - List expenses (filterable by category/year)
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/{id}` - Update expense
- `DELETE /api/expenses/{id}` - Delete expense
- `GET /api/expenses/summary/{year}` - Expense summary (year=0 for all-time)

### Tautulli
- `GET /api/tautulli/settings` - Get Tautulli settings
- `PUT /api/tautulli/settings` - Update Tautulli settings
- `GET /api/tautulli/check/{username}` - Public endpoint for kill-stream checks

### Audit
- `GET /api/audit` - Get audit log entries

### Notifications
- `GET /api/settings/notifications` - Get notification preferences
- `PUT /api/settings/notifications` - Update notification preferences
- `POST /api/settings/notifications/test` - Send test notification

## Project Structure

```
plexdash/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # React contexts (Auth)
│   │   ├── pages/         # Page components
│   │   └── services/      # API client
│   ├── nginx.conf         # Nginx config for Docker
│   └── Dockerfile
├── backend/               # FastAPI backend
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── models/        # SQLAlchemy models
│   │   └── services/      # Business logic (plex, auth)
│   ├── alembic/           # Database migrations
│   └── Dockerfile
├── deploy/
│   └── lightweight/       # Single-container SQLite deployment
│       ├── Dockerfile
│       └── docker-compose.yaml
├── k8s/                   # Kubernetes manifests
│   ├── base/
│   │   ├── namespace.yaml
│   │   ├── cnpg-cluster.yaml
│   │   ├── backend-deployment.yaml
│   │   ├── frontend-deployment.yaml
│   │   ├── ingress.yaml
│   │   └── migration-job.yaml
│   └── kustomization.yaml
└── docker-compose.yaml
```

## License

MIT
