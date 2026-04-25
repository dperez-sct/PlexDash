import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    UserGroupIcon,
    CurrencyEuroIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    FunnelIcon,
} from '@heroicons/react/24/outline';
import { getAuditLogs, AuditLogEntry } from '../services/api';
import { MONTH_NAMES } from '../constants';

const ACTION_CONFIG: Record<string, { label: string; icon: typeof CheckCircleIcon; color: string }> = {
    payment_marked:       { label: 'Pago registrado',            icon: CheckCircleIcon, color: 'text-green-400' },
    payment_removed:      { label: 'Pago eliminado',             icon: XCircleIcon,     color: 'text-red-400' },
    create_quick_payment: { label: 'Pago registrado',            icon: CheckCircleIcon, color: 'text-green-400' },
    price_changed:        { label: 'Precio actualizado',         icon: CurrencyEuroIcon, color: 'text-purple-400' },
    users_synced:         { label: 'Usuarios sincronizados',     icon: ArrowPathIcon,   color: 'text-blue-400' },
    user_toggled:         { label: 'Estado de usuario cambiado', icon: UserGroupIcon,   color: 'text-yellow-400' },
};

const FILTER_OPTIONS = [
    { value: '', label: 'Todos los tipos' },
    { value: 'payment_marked', label: 'Pagos registrados' },
    { value: 'payment_removed', label: 'Pagos eliminados' },
    { value: 'price_changed', label: 'Cambios de precio' },
    { value: 'users_synced', label: 'Sincronizaciones' },
    { value: 'user_toggled', label: 'Cambios de estado' },
];

function formatDetails(action: string, details: Record<string, unknown> | null): JSX.Element | string {
    if (!details) return '';
    const username = (details.username as string) || '';
    const userId = details.user_id as number | undefined;
    const month = details.month as number;
    const year = details.year as number;
    // amount may be stored as string (Decimal serialized via json.dumps default=str)
    const amount = details.amount != null ? parseFloat(String(details.amount)) : NaN;

    const userLink = (name: string, id?: number) =>
        id ? (
            <Link to={`/users/${id}`} className="text-gray-300 hover:text-plex-yellow transition-colors">
                {name}
            </Link>
        ) : (
            <span>{name}</span>
        );

    switch (action) {
        case 'payment_marked':
        case 'create_quick_payment':
            return (
                <span>
                    {userLink(username, userId)} — {MONTH_NAMES[(month || 1) - 1]} {year} ({!isNaN(amount) ? amount.toFixed(2) : '0'})
                </span>
            );
        case 'payment_removed':
            return (
                <span>
                    {userLink(username, userId)} — {MONTH_NAMES[(month || 1) - 1]} {year}
                </span>
            );
        case 'price_changed': {
            const oldP = details.old_price != null ? parseFloat(String(details.old_price)) : NaN;
            const newP = details.new_price != null ? parseFloat(String(details.new_price)) : NaN;
            return `${!isNaN(oldP) ? oldP.toFixed(2) : '?'} → ${!isNaN(newP) ? newP.toFixed(2) : '?'}`;
        }
        case 'users_synced': {
            const n = (details.new as number) || 0;
            const d = (details.deleted as number) || 0;
            const r = (details.restored as number) || 0;
            return `${details.total} total · ${n} nuevos · ${d} eliminados · ${r} restaurados`;
        }
        case 'user_toggled':
            return `${username} → ${(details.is_active as boolean) ? 'Activo' : 'Inactivo'}`;
        default:
            return JSON.stringify(details);
    }
}

export default function AuditLog() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [actionFilter, setActionFilter] = useState('');
    const limit = 30;

    useEffect(() => {
        setPage(1);
    }, [actionFilter]);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const res = await getAuditLogs(page, limit, actionFilter);
                setLogs(res.data.logs);
                setTotal(res.data.total);
            } catch (err) {
                console.error('Error fetching audit logs:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [page, actionFilter]);

    const totalPages = Math.ceil(total / limit);

    return (
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">Registro de Actividad</h1>

            {/* Filter bar */}
            <div className="flex items-center gap-3 mb-6">
                <FunnelIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="bg-plex-dark border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-plex-yellow transition-colors"
                >
                    {FILTER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                {total > 0 && (
                    <span className="text-gray-500 text-sm ml-auto">
                        {total} {total === 1 ? 'registro' : 'registros'}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-gray-400">Cargando...</div>
                </div>
            ) : logs.length === 0 ? (
                <div className="bg-plex-dark rounded-lg p-8 text-center text-gray-400">
                    <CurrencyEuroIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No hay actividad registrada todavía.</p>
                    <p className="text-sm mt-1">Las acciones como pagos y sincronizaciones aparecerán aquí.</p>
                </div>
            ) : (
                <>
                    <div className="space-y-3">
                        {logs.map((log) => {
                            const config = ACTION_CONFIG[log.action] || {
                                label: log.action,
                                icon: CurrencyEuroIcon,
                                color: 'text-gray-400',
                            };
                            const Icon = config.icon;

                            return (
                                <div
                                    key={log.id}
                                    className="bg-plex-dark rounded-lg p-4 flex items-start gap-4 hover:bg-plex-dark/80 transition-colors"
                                >
                                    <div className={`p-2 rounded-lg bg-plex-darker ${config.color}`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium">{config.label}</p>
                                        <p className="text-gray-400 text-sm truncate">
                                            {formatDetails(log.action, log.details)}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-gray-500 text-xs">
                                            {new Date(log.created_at).toLocaleDateString()}
                                        </p>
                                        <p className="text-gray-600 text-xs">
                                            {new Date(log.created_at).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6">
                            <p className="text-gray-500 text-sm">
                                Página {page} de {totalPages}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 rounded-lg bg-plex-dark text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                                >
                                    <ChevronLeftIcon className="h-4 w-4" />
                                </button>
                                <span className="text-gray-400 text-sm px-2">
                                    {page} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 rounded-lg bg-plex-dark text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                                >
                                    <ChevronRightIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
