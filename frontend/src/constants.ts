export const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export const APP_VERSION = '3.13';

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: { type: 'feat' | 'fix' | 'security' | 'perf'; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '3.13',
    date: '2026-04',
    changes: [
      { type: 'feat', text: 'PWA: instala PlexDash como app desde Android Chrome (banner "Añadir a pantalla de inicio")' },
      { type: 'fix', text: 'Pagos pendientes en dashboard respetan la fecha de alta del usuario' },
      { type: 'fix', text: 'Gráfico donut del mes respeta la fecha de alta (no cuenta meses previos al alta)' },
      { type: 'fix', text: 'Vista de Pagos: meses previos a la fecha de alta se muestran como "—" en lugar de deuda' },
      { type: 'fix', text: 'get_year_payments no crea filas para meses anteriores a la fecha de alta' },
      { type: 'fix', text: 'Lista de deudores en Dashboard respeta la fecha de alta' },
      { type: 'fix', text: 'Pago rápido ahora marca el siguiente mes al último pagado (no siempre el mes actual)' },
    ],
  },
  {
    version: '3.12',
    date: '2026-04',
    changes: [
      { type: 'feat', text: 'Confirm modal al marcar/desmarcar pagos desde el perfil de usuario' },
      { type: 'feat', text: 'Período de deuda configurable en ajustes: año actual, últimos 3/6/12 meses, desde fecha de alta, todo el historial' },
      { type: 'feat', text: 'Opción "Desde fecha de alta" en el período de deuda respeta el joined_at del perfil' },
      { type: 'fix', text: 'Tipo TypeScript corregido en updateUser para aceptar joined_at sin cast' },
    ],
  },
  {
    version: '3.11',
    date: '2026-04',
    changes: [
      { type: 'feat', text: 'Sistema de toasts global (success/error/warning/info) con auto-dismiss' },
      { type: 'feat', text: 'ConfirmModal reutilizable — sustituye todos los alert() y confirm() nativos del browser' },
      { type: 'feat', text: 'Fecha de alta (joined_at) editable en el perfil de usuario' },
      { type: 'feat', text: 'Cálculo de deuda pendiente respeta la fecha de alta' },
      { type: 'feat', text: 'Audit log en endpoint toggle de pagos (payment_marked / payment_removed)' },
      { type: 'fix', text: 'Toggle de mes en perfil marcaba 0€ — ahora lee el precio mensual configurado' },
      { type: 'fix', text: 'Bulk-pay marcaba 0€ — corregido para usar el precio mensual' },
      { type: 'fix', text: 'Race condition en update_monthly_payment resuelta con SELECT FOR UPDATE' },
      { type: 'fix', text: 'Sesión expirada (401) muestra toast antes de redirigir al login' },
      { type: 'fix', text: 'React error #310 en Payments.tsx (useMemo llamado después de early return)' },
      { type: 'fix', text: 'Relación Subscription eliminada del modelo User (causaba crash al arrancar)' },
      { type: 'fix', text: 'Migración automática de columna joined_at en SQLite al arrancar' },
      { type: 'security', text: 'datetime.utcnow() deprecado sustituido por datetime.now(timezone.utc) en tautulli.py' },
      { type: 'fix', text: 'Validación de precio negativo en ajustes (devuelve HTTP 400)' },
    ],
  },
  {
    version: '3.10',
    date: '2026-04',
    changes: [
      { type: 'feat', text: 'Pagos rápidos registran audit log idéntico a pagos normales (payment_marked)' },
      { type: 'feat', text: 'Pagos rápidos envían notificación Telegram/Discord igual que pagos normales' },
      { type: 'feat', text: 'Clic en usuario desde cualquier sección navega a su perfil (/users/:id)' },
      { type: 'feat', text: 'Filtros en AuditLog por tipo de acción' },
      { type: 'feat', text: 'Historial de cambios de precio en AuditLog (price_changed)' },
      { type: 'feat', text: 'Búsqueda por usuario en la vista de Pagos' },
      { type: 'feat', text: 'Paginación y ordenación por columna en la vista de Usuarios' },
      { type: 'feat', text: 'Tarjeta de deuda pendiente en el perfil de usuario' },
      { type: 'feat', text: 'Constante MONTH_NAMES extraída a constants.ts' },
      { type: 'feat', text: 'Rate limiting en el endpoint de login (10 intentos/minuto por IP)' },
      { type: 'feat', text: 'JWT secret configurable desde variable de entorno JWT_SECRET' },
      { type: 'feat', text: 'Cookies seguras (HTTPS_ONLY) y CORS configurable (ALLOWED_ORIGINS)' },
      { type: 'fix', text: 'Desactivar usuario ya no borra el historial de pagos (deleted_from_plex no se activa)' },
      { type: 'fix', text: 'Deudores en Dashboard reescrito de N+1 queries a un JOIN único' },
      { type: 'fix', text: 'Eliminado db.refresh() duplicado al crear usuario' },
      { type: 'fix', text: 'TypeError: o.toFixed is not a function en AuditLog (Decimal serializado como string)' },
      { type: 'fix', text: 'Endpoints de Subscription eliminados (dead code)' },
      { type: 'perf', text: 'print() sustituido por logging en el servicio de notificaciones' },
      { type: 'security', text: 'datetime.utcnow() deprecado sustituido por datetime.now(timezone.utc) en todos los módulos' },
    ],
  },
];

