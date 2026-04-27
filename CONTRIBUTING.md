# Contributing to PlexDash

## Entorno de desarrollo

### Requisitos

- Python 3.12+
- Node.js 20+
- Docker y Docker Compose

### Arrancar en local

```bash
git clone https://github.com/dperez-sct/PlexDash.git
cd PlexDash

# Levanta backend + frontend + postgres
docker-compose up -d
```

- Frontend: http://localhost:3000
- Backend API + Swagger: http://localhost:8000/docs

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
| `JWT_SECRET` | Secreto para firmar JWT |
| `HTTPS_ONLY` | `true` para cookies seguras (solo en HTTPS) |
| `ALLOWED_ORIGINS` | Orígenes CORS permitidos (`*` en local) |

El resto de configuración (Telegram, Discord, Tautulli, precio, moneda...) se gestiona desde la propia app en Ajustes y se persiste en la base de datos.

### SQLite vs PostgreSQL

El modo **lightweight** usa SQLite en lugar de PostgreSQL. Hay algunas diferencias a tener en cuenta al desarrollar:

- En SQLite, `main.py` ejecuta `ALTER TABLE` manuales al arrancar para añadir columnas nuevas si no existen. Esto es un mecanismo de compatibilidad hacia atrás — las migraciones Alembic siguen siendo la fuente de verdad para PostgreSQL.
- SQLite no soporta operaciones concurrentes de escritura; en producción esto no es un problema dado el uso típico de la app.
- Para desarrollar contra SQLite: `DATABASE_URL=sqlite:////tmp/plexdash.db uvicorn app.main:app --reload`

### Migraciones de base de datos

```bash
cd backend

# Crear una nueva migración
alembic revision --autogenerate -m "descripcion"

# Aplicar migraciones
alembic upgrade head
```

Al añadir una columna nueva al modelo, añade también el `ALTER TABLE` correspondiente en el bloque de compatibilidad SQLite de `main.py` para que el lightweight no rompa en instalaciones existentes.

---

## Conceptos clave del dominio

### Estados de usuario

Los usuarios tienen dos flags independientes que es importante no confundir:

| Flag | Qué significa | Quién lo cambia |
|------|--------------|-----------------|
| `is_active` | Si el usuario se gestiona en PlexDash (pagos, avisos, etc.) | El administrador manualmente |
| `deleted_from_plex` | Si el usuario ya no aparece en el servidor Plex | El sync automático con Plex |

Un usuario inactivo (`is_active=False`) no aparece en la cuadrícula de pagos, no recibe avisos de Tautulli y no cuenta en el dashboard. Útil para familia u otros usuarios que no pagan.

Un usuario eliminado de Plex (`deleted_from_plex=True`) sigue visible en PlexDash (con su historial de pagos) pero marcado como eliminado.

### Sincronización de usuarios

`POST /api/users/sync` consulta la API de Plex y:
- Crea usuarios nuevos que aparezcan en Plex y no existan en PlexDash
- Marca como `deleted_from_plex=True` los usuarios que ya no están en Plex
- Restaura a `deleted_from_plex=False` usuarios que hayan vuelto a aparecer

Los usuarios invitados desde PlexDash se crean con `plex_id = pending_{email}` y se actualizan al `plex_id` real en la próxima sincronización.

### Creación de filas de pago

Las filas mensuales (`MonthlyPayment`) **no se crean automáticamente** al inicio de cada mes. Se generan de forma lazy cuando se consulta la vista de Pagos para un año concreto. Si nadie abre esa vista, las filas no existen y el check de Tautulli devolverá `allow` por ausencia de deuda.

---

## Proceso de release

El versionado usa un número de la forma `X.Y` (ej. `3.14`) visible en la app. Los tags de git y las imágenes Docker usan ese mismo número.

### Pasos

1. **Actualizar versión y changelog** en `frontend/src/constants.ts`:

   ```ts
   export const APP_VERSION = '3.15';

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

   Tipos disponibles: `feat` · `fix` · `security` · `perf`

2. **Commit y tag**:

   ```bash
   git add frontend/src/constants.ts
   git commit -m "chore: bump version to 3.15, add changelog entry"
   git tag v3.15
   git push origin main --tags
   ```

3. **GitHub Actions publica automáticamente**:
   - `ghcr.io/dperez-sct/plexdash:3.15`
   - `ghcr.io/dperez-sct/plexdash:latest`

   El build tarda ~5 minutos y cubre `linux/amd64` y `linux/arm64`.

---

## Estructura del proyecto

```
PlexDash/
├── frontend/              # React + TypeScript + Vite + TailwindCSS
│   └── src/
│       ├── constants.ts   # APP_VERSION y CHANGELOG — actualizar en cada release
│       ├── components/
│       ├── pages/
│       └── services/api.ts
├── backend/               # FastAPI + SQLAlchemy + Alembic
│   └── app/
│       ├── api/           # Rutas HTTP
│       ├── models/        # Modelos SQLAlchemy
│       ├── services/      # Lógica de negocio (plex, auth, tautulli, notificaciones)
│       └── main.py        # Arranque, middlewares, compatibilidad SQLite
├── deploy/
│   └── lightweight/       # Imagen todo-en-uno con SQLite
├── k8s/                   # Manifiestos Kubernetes (CNPG + ingress)
└── .github/workflows/     # CI: build y push a GHCR en cada tag
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
| `chore:` | Mantenimiento (versión, dependencias...) |
| `docs:` | Cambios en documentación |
| `ci:` | Cambios en pipelines de CI/CD |
