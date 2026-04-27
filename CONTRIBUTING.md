# Contributing to PlexDash

## Entorno de desarrollo

### Requisitos

- Python 3.12+
- Node.js 20+
- Docker y Docker Compose

### Arrancar en local

```bash
# Clonar el repositorio
git clone https://github.com/dperez-sct/PlexDash.git
cd PlexDash

# Levantar todos los servicios (backend + frontend + postgres)
docker-compose up -d
```

- Frontend: http://localhost:3000
- Backend API + docs: http://localhost:8000/docs

Para desarrollo con hot-reload:

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

### Variables de entorno (backend)

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL: `postgresql://user:pass@host/db` · SQLite: `sqlite:////ruta/plexdash.db` |
| `PLEX_URL` | URL del servidor Plex |
| `PLEX_TOKEN` | Token de autenticación de Plex |
| `JWT_SECRET` | Secreto para firmar JWT (genera uno con `python -c "import secrets; print(secrets.token_urlsafe(32))"`) |
| `HTTPS_ONLY` | `true` para cookies seguras (solo en HTTPS) |
| `ALLOWED_ORIGINS` | Orígenes CORS permitidos (`*` en local) |

### Migraciones de base de datos

```bash
cd backend

# Crear una nueva migración
alembic revision --autogenerate -m "descripcion"

# Aplicar migraciones
alembic upgrade head
```

---

## Proceso de release

El versionado de PlexDash usa un número interno de la forma `X.Y` (ej. `3.14`) que es el que ve el usuario en la app. Los tags de git y las imágenes Docker siguen ese mismo número.

### Pasos para publicar una nueva versión

1. **Actualizar la versión y el changelog** en `frontend/src/constants.ts`:

   ```ts
   export const APP_VERSION = '3.15';  // ← nuevo número

   export const CHANGELOG: ChangelogEntry[] = [
     {
       version: '3.15',
       date: '2026-05',
       changes: [
         { type: 'feat', text: 'Descripción del cambio' },
         { type: 'fix',  text: 'Descripción del fix' },
       ],
     },
     // ... entradas anteriores
   ];
   ```

   Tipos de cambio disponibles: `feat` · `fix` · `security` · `perf`

2. **Commit y tag**:

   ```bash
   git add frontend/src/constants.ts
   git commit -m "chore: bump version to 3.15, add changelog entry"
   git tag v3.15
   git push origin main --tags
   ```

3. **GitHub Actions publica automáticamente** la imagen Docker en GHCR:
   - `ghcr.io/dperez-sct/plexdash:3.15`
   - `ghcr.io/dperez-sct/plexdash:latest`

   El build tarda ~5 minutos y cubre `linux/amd64` y `linux/arm64`.

### Correspondencia versión → imagen Docker

| Tag git | Imagen publicada |
|---------|-----------------|
| `v3.15` | `ghcr.io/dperez-sct/plexdash:3.15` |
| push a `main` | `ghcr.io/dperez-sct/plexdash:latest` |

---

## Estructura del proyecto

```
PlexDash/
├── frontend/              # React + TypeScript + Vite + TailwindCSS
│   └── src/
│       ├── constants.ts   # APP_VERSION y CHANGELOG (actualizar en cada release)
│       ├── components/
│       ├── pages/
│       └── services/api.ts
├── backend/               # FastAPI + SQLAlchemy + Alembic
│   └── app/
│       ├── api/           # Rutas HTTP
│       ├── models/        # Modelos SQLAlchemy
│       ├── services/      # Lógica de negocio (plex, auth, tautulli...)
│       └── main.py
├── deploy/
│   └── lightweight/       # Imagen todo-en-uno con SQLite
├── k8s/                   # Manifiestos Kubernetes
└── .github/workflows/     # CI: build y push a GHCR
```

---

## Convenciones de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

| Prefijo | Cuándo usarlo |
|---------|--------------|
| `feat:` | Nueva funcionalidad |
| `fix:` | Corrección de bug |
| `perf:` | Mejora de rendimiento |
| `security:` | Parche de seguridad |
| `chore:` | Tareas de mantenimiento (versión, dependencias...) |
| `docs:` | Cambios en documentación |
| `ci:` | Cambios en pipelines de CI/CD |
