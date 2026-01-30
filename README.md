# PlexDash

Payment management system for Plex servers.

## Features

- **User Management**: Sync and manage users from your Plex server
- **Payment Tracking**: Monthly payment grid with per-user tracking
- **Payment History**: Complete payment history per user
- **User Search**: Filter users by username, email, or notes
- **Dashboard**: Overview of revenue, users, and payment status
- **Authentication**: JWT-based authentication with configurable credentials
- **Currency Settings**: Configurable currency symbol

## Tech Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Python + FastAPI + SQLAlchemy + Alembic
- **Database**: PostgreSQL (CloudNativePG for Kubernetes)
- **Infrastructure**: Docker Compose (dev) + Kubernetes (prod)

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Plex server with API access

### Development Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd plexdash
```

2. Copy environment file and configure:
```bash
cp .env.example .env
# Edit .env with your Plex URL and token
```

3. Start the services:
```bash
docker-compose up --build
```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

5. Login with default credentials:
   - Username: `admin`
   - Password: `admin`
   - **Important**: Change these credentials in Settings after first login

### Getting Your Plex Token

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

### Monthly Payments
- `GET /api/monthly-payments/{year}` - Get all users' payments for a year
- `PUT /api/monthly-payments/{user_id}/{year}/{month}` - Update payment
- `POST /api/monthly-payments/{user_id}/{year}/toggle/{month}` - Toggle paid status
- `GET /api/monthly-payments/user/{user_id}/history` - Get user payment history

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
