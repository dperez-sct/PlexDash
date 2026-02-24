import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    XCircleIcon,
    PencilIcon,
    BanknotesIcon,
    UserMinusIcon,
    ArrowPathIcon,
    CheckIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import {
    getUserPaymentHistory,
    UserPaymentHistory,
    getCurrencySettings,
    getMonthlyPrice,
    createQuickPayment,
    toggleUserActive,
    removeUserAccess,
    reactivateUser,
    updateUser
} from '../services/api';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function UserDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [history, setHistory] = useState<UserPaymentHistory | null>(null);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState('€');
    const [monthlyPrice, setMonthlyPrice] = useState(0);

    // Quick Action states
    const [processingPayment, setProcessingPayment] = useState(false);
    const [editingNote, setEditingNote] = useState(false);
    const [noteContent, setNoteContent] = useState('');
    const [activity, setActivity] = useState<{
        total_plays: number; total_duration: number;
        last_seen: number | null; last_played: string;
        plays_today?: number; plays_7d?: number; plays_30d?: number;
        duration_today?: number; duration_7d?: number; duration_30d?: number;
        recent_history?: Array<{ title: string; media_type: string; date: number; duration: number; percent_complete: number }>;
    } | null>(null);

    const loadData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [histRes, currRes, priceRes] = await Promise.all([
                getUserPaymentHistory(parseInt(id)),
                getCurrencySettings(),
                getMonthlyPrice(),
            ]);
            setHistory(histRes.data);
            setNoteContent(histRes.data.user.notes || '');
            setCurrency(currRes.data.currency_symbol);
            setMonthlyPrice(priceRes.data.monthly_price);

            // Fetch Tautulli activity (optional, non-blocking)
            try {
                const actRes = await fetch(`/api/tautulli/user/${id}/activity`);
                if (actRes.ok) {
                    const actData = await actRes.json();
                    if (actData.configured && actData.stats) {
                        setActivity(actData.stats);
                    }
                }
            } catch { /* Tautulli not configured or unavailable */ }
        } catch (err) {
            console.error('Error loading user detail', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleQuickPay = async () => {
        if (!history || !monthlyPrice || monthlyPrice <= 0) {
            alert("Por favor, configura el precio mensual en Ajustes primero.");
            return;
        }

        if (!confirm(`¿Registrar pago de ${currency}${monthlyPrice} para ${history.user.username}?`)) {
            return;
        }

        setProcessingPayment(true);
        try {
            await createQuickPayment(history.user.id);
            alert("Pago registrado correctamente");
            await loadData(); // Reload history
        } catch (error: any) {
            console.error('Error processing quick payment:', error);
            alert(error.response?.data?.detail || "Error al registrar el pago");
        } finally {
            setProcessingPayment(false);
        }
    };

    const handleToggleActive = async () => {
        if (!history) return;
        try {
            await toggleUserActive(history.user.id);
            // Updating local state instead of doing complete reload to feel faster
            setHistory({
                ...history,
                user: {
                    ...history.user,
                    is_active: !history.user.is_active
                }
            });
        } catch (error) {
            console.error('Error toggling user status:', error);
        }
    };

    const handleRemoveAccess = async () => {
        if (!history) return;
        if (!confirm(`¿Estás seguro que quieres quitar el acceso a la biblioteca para ${history.user.username}? Esta acción dejará de compartir el servidor con este usuario.`)) {
            return;
        }

        try {
            await removeUserAccess(history.user.id);
            setHistory({
                ...history,
                user: {
                    ...history.user,
                    deleted_from_plex: true,
                    is_active: false
                }
            });
        } catch (error) {
            console.error('Error removing user access:', error);
            alert('Error al quitar acceso. Asegúrate que la conexión con Plex es correcta.');
        }
    };

    const handleReactivateUser = async () => {
        if (!history) return;
        if (!confirm(`¿Quieres reactivar a ${history.user.username} y darle acceso a todas las bibliotecas nuevamente?`)) {
            return;
        }

        try {
            await reactivateUser(history.user.id);
            setHistory({
                ...history,
                user: {
                    ...history.user,
                    deleted_from_plex: false,
                    is_active: true
                }
            });
            alert(`Usuario ${history.user.username} reactivado correctamente.`);
        } catch (error) {
            console.error('Error reactivating user:', error);
            alert('Error al reactivar usuario.');
        }
    };

    const handleSaveNote = async () => {
        if (!history) return;
        try {
            await updateUser(history.user.id, { notes: noteContent });
            setHistory({
                ...history,
                user: {
                    ...history.user,
                    notes: noteContent
                }
            });
            setEditingNote(false);
        } catch (error) {
            console.error('Error updating note:', error);
        }
    };

    if (loading && !history) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-400">Cargando...</div>
            </div>
        );
    }

    if (!history) {
        return (
            <div className="p-6">
                <div className="text-red-400">Usuario no encontrado</div>
            </div>
        );
    }

    const { user, years, total_all_time } = history;

    // Calculate stats
    const totalMonths = years.reduce((acc, y) => acc + Object.keys(y.payments).length, 0);
    const paidMonths = years.reduce(
        (acc: number, y: any) => acc + Object.values(y.payments).filter((p: any) => p.is_paid).length,
        0
    );

    return (
        <div className="space-y-6 pb-12">
            {/* Back button */}
            <button
                onClick={() => navigate('/users')}
                className="flex items-center text-gray-400 hover:text-white transition-colors"
            >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Volver a Usuarios
            </button>

            {/* User header & Quick Actions */}
            <div className="bg-plex-dark rounded-lg p-6 border border-gray-800">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    {/* User Info */}
                    <div className="flex items-center space-x-4">
                        <img
                            src={user.thumb || 'https://www.plex.tv/wp-content/uploads/2021/08/plex-avatar-default.png'}
                            alt={user.username}
                            className="h-16 w-16 md:h-20 md:w-20 rounded-full border-2 border-plex-yellow object-cover"
                        />
                        <div>
                            <h1 className="text-2xl font-bold text-white">{user.username}</h1>
                            <p className="text-gray-400">{user.email}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                {user.is_active && !user.deleted_from_plex ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-400">
                                        Activo
                                    </span>
                                ) : user.deleted_from_plex ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/50 text-red-400">
                                        Eliminado de Plex
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                                        Inactivo
                                    </span>
                                )}
                                <span className="text-gray-500 text-sm hidden sm:inline">•</span>
                                <span className="text-gray-500 text-sm">
                                    Miembro desde {user.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' }) : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions Panel */}
                    <div className="bg-plex-darker p-4 rounded-lg border border-gray-700 md:min-w-[300px]">
                        <h3 className="text-white font-medium mb-3 text-sm uppercase tracking-wider text-gray-400">Acciones Rápidas</h3>
                        <div className="flex flex-col space-y-2">
                            <button
                                onClick={handleQuickPay}
                                disabled={processingPayment || user.deleted_from_plex || monthlyPrice <= 0}
                                className="flex items-center justify-center px-4 py-2 bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/30 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {processingPayment ? (
                                    <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                                ) : (
                                    <BanknotesIcon className="h-5 w-5 mr-2" />
                                )}
                                Pago Rápido ({currency}{monthlyPrice})
                            </button>

                            {/* Active toggle — always visible */}
                            <button
                                onClick={handleToggleActive}
                                className={`w-full flex items-center justify-center px-4 py-2 rounded-lg transition-colors border ${user.is_active
                                    ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-600 border-gray-600'
                                    : 'bg-plex-yellow/20 text-plex-yellow hover:bg-plex-yellow/30 border-plex-yellow/30'
                                    }`}
                            >
                                {user.is_active ? 'Desactivar Usuario' : 'Activar Usuario'}
                            </button>

                            {/* Plex access actions */}
                            {user.deleted_from_plex ? (
                                <button
                                    onClick={handleReactivateUser}
                                    className="flex items-center justify-center px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30 rounded-lg transition-colors"
                                >
                                    Reactivar en Plex
                                </button>
                            ) : (
                                <button
                                    onClick={handleRemoveAccess}
                                    className="flex items-center justify-center px-4 py-2 bg-red-900/40 text-red-400 hover:bg-red-900/60 border border-red-900/50 rounded-lg transition-colors"
                                    title="Quitar acceso a Plex"
                                >
                                    <UserMinusIcon className="h-5 w-5 mr-2" />
                                    Quitar Acceso
                                </button>
                            )}

                            {/* Kill Stream Toggle */}
                            <div className="mt-1 pt-3 border-t border-gray-700 flex items-center justify-between">
                                <div>
                                    <p className="text-white text-sm font-medium">Aviso de pago</p>
                                    <p className="text-gray-500 text-xs">Aviso al reproducir si debe</p>
                                </div>
                                <button
                                    onClick={async () => {
                                        const newVal = !user.kill_stream_enabled;
                                        try {
                                            const res = await fetch(`/api/users/${user.id}`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                credentials: 'include',
                                                body: JSON.stringify({ kill_stream_enabled: newVal }),
                                            });
                                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                            setHistory({
                                                ...history,
                                                user: { ...user, kill_stream_enabled: newVal }
                                            });
                                        } catch (e) {
                                            console.error('Error updating kill_stream_enabled:', e);
                                            alert('Error al guardar el cambio. Revisa la consola.');
                                        }
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${user.kill_stream_enabled ? 'bg-plex-yellow' : 'bg-gray-600'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user.kill_stream_enabled ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>

                            {/* Warning Counter */}
                            {user.kill_stream_enabled && (user.warn_count > 0 || user.last_warned_at) && (
                                <div className="mt-2 flex items-center justify-between bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-amber-400 text-sm font-medium">
                                            {user.warn_count || 0} aviso{(user.warn_count || 0) !== 1 ? 's' : ''}
                                        </span>
                                        {user.last_warned_at && (
                                            <span className="text-gray-500 text-xs">
                                                (ultimo: {new Date(user.last_warned_at).toLocaleDateString('es-ES')})
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await fetch(`/api/tautulli/reset-warning/${user.id}`, {
                                                    method: 'POST',
                                                    credentials: 'include',
                                                });
                                                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                                setHistory({
                                                    ...history,
                                                    user: { ...user, warn_count: 0, last_warned_at: null }
                                                });
                                            } catch (e) {
                                                console.error('Error resetting warnings:', e);
                                            }
                                        }}
                                        className="text-xs text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
                                        title="Resetear contador de avisos"
                                    >
                                        Resetear
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Notes Section underneath */}
                <div className="mt-6 pt-6 border-t border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-gray-400 text-sm font-medium">Notas del Usuario</label>
                        {!editingNote && (
                            <button
                                onClick={() => setEditingNote(true)}
                                className="text-gray-500 hover:text-plex-yellow flex items-center text-sm transition-colors"
                            >
                                <PencilIcon className="h-4 w-4 mr-1" /> Editar
                            </button>
                        )}
                    </div>
                    {editingNote ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                className="flex-1 bg-plex-darker text-white border border-gray-700 rounded-lg px-3 py-2 focus:border-plex-yellow focus:outline-none"
                                placeholder="Añadir observaciones sobre el usuario..."
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveNote();
                                    if (e.key === 'Escape') {
                                        setEditingNote(false);
                                        setNoteContent(user.notes || '');
                                    }
                                }}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveNote}
                                    className="px-4 py-2 bg-green-900/50 text-green-400 hover:bg-green-900/70 rounded-lg flex items-center"
                                >
                                    <CheckIcon className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingNote(false);
                                        setNoteContent(user.notes || '');
                                    }}
                                    className="px-4 py-2 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg flex items-center"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-plex-darker p-3 rounded-lg border border-gray-800 text-gray-300 min-h-[44px]">
                            {user.notes || <span className="text-gray-600 italic">No hay notas para este usuario.</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-plex-dark rounded-lg p-4 border border-gray-800 flex flex-col justify-center">
                    <p className="text-gray-400 text-sm mb-1">Total Pagado Histórico</p>
                    <p className="text-3xl font-bold text-plex-yellow">{currency}{Number(total_all_time).toFixed(2)}</p>
                </div>
                <div className="bg-plex-dark rounded-lg p-4 border border-gray-800 flex flex-col justify-center">
                    <p className="text-gray-400 text-sm mb-1">Meses Pagados</p>
                    <p className="text-3xl font-bold text-white">
                        {paidMonths} <span className="text-gray-500 text-lg sm:text-xl font-normal">/ {totalMonths || '-'}</span>
                    </p>
                </div>
                <div className="bg-plex-dark rounded-lg p-4 border border-gray-800 flex flex-col justify-center">
                    <p className="text-gray-400 text-sm mb-1">Reprod. Último Mes</p>
                    <p className="text-3xl font-bold text-white">
                        {activity ? (activity.plays_30d ?? activity.total_plays) : '--'}
                    </p>
                    {activity && activity.last_seen && (
                        <p className="text-gray-500 text-xs mt-1">
                            Último: {new Date(activity.last_seen * 1000).toLocaleDateString()}
                        </p>
                    )}
                </div>
            </div>

            {/* Tautulli Activity Widget */}
            {activity && (
                <div className="bg-plex-dark rounded-lg p-5 border border-gray-800">
                    <h2 className="text-lg font-bold text-white mb-4">🎬 Actividad Plex</h2>

                    {/* Period stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                        <div className="bg-plex-darker rounded-lg p-3 border border-gray-800 text-center">
                            <p className="text-gray-500 text-xs">Hoy</p>
                            <p className="text-xl font-bold text-white">{activity.plays_today ?? 0}</p>
                            <p className="text-gray-500 text-xs">
                                {activity.duration_today && activity.duration_today > 0
                                    ? `${Math.floor(activity.duration_today / 60)}m`
                                    : '-'}
                            </p>
                        </div>
                        <div className="bg-plex-darker rounded-lg p-3 border border-gray-800 text-center">
                            <p className="text-gray-500 text-xs">7 días</p>
                            <p className="text-xl font-bold text-white">{activity.plays_7d ?? 0}</p>
                            <p className="text-gray-500 text-xs">
                                {activity.duration_7d && activity.duration_7d > 0
                                    ? `${Math.floor(activity.duration_7d / 3600)}h ${Math.floor((activity.duration_7d % 3600) / 60)}m`
                                    : '-'}
                            </p>
                        </div>
                        <div className="bg-plex-darker rounded-lg p-3 border border-gray-800 text-center">
                            <p className="text-gray-500 text-xs">30 días</p>
                            <p className="text-xl font-bold text-plex-yellow">{activity.plays_30d ?? 0}</p>
                            <p className="text-gray-500 text-xs">
                                {activity.duration_30d && activity.duration_30d > 0
                                    ? `${Math.floor(activity.duration_30d / 3600)}h ${Math.floor((activity.duration_30d % 3600) / 60)}m`
                                    : '-'}
                            </p>
                        </div>
                        <div className="bg-plex-darker rounded-lg p-3 border border-gray-800 text-center">
                            <p className="text-gray-500 text-xs">Total</p>
                            <p className="text-xl font-bold text-white">{activity.total_plays}</p>
                            <p className="text-gray-500 text-xs">
                                {activity.total_duration > 0
                                    ? `${Math.floor(activity.total_duration / 3600)}h`
                                    : '-'}
                            </p>
                        </div>
                    </div>

                    {/* Recent history */}
                    {activity.recent_history && activity.recent_history.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-400 mb-2">Últimas reproducciones</h3>
                            <div className="space-y-2">
                                {activity.recent_history.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between bg-plex-darker p-3 rounded-lg border border-gray-800">
                                        <div className="flex items-center space-x-3 min-w-0">
                                            <span className="text-lg">
                                                {item.media_type === 'movie' ? '🎬' : item.media_type === 'episode' ? '📺' : '🎵'}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-white text-sm font-medium truncate">{item.title}</p>
                                                <p className="text-gray-500 text-xs">
                                                    {item.date ? new Date(item.date * 1000).toLocaleDateString() : ''}
                                                    {item.duration > 0 && ` · ${Math.floor(item.duration / 60)}min`}
                                                </p>
                                            </div>
                                        </div>
                                        {item.percent_complete > 0 && (
                                            <div className="flex items-center space-x-2 flex-shrink-0">
                                                <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${item.percent_complete >= 90 ? 'bg-green-400' : 'bg-plex-yellow'}`}
                                                        style={{ width: `${Math.min(item.percent_complete, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-gray-500 text-xs w-8 text-right">{item.percent_complete}%</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Last seen info */}
                    <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
                        <span className="text-gray-500 text-xs">
                            Última vez visto: {activity.last_seen ? new Date(activity.last_seen * 1000).toLocaleDateString() : 'Nunca'}
                        </span>
                        {activity.last_played && (
                            <span className="text-gray-500 text-xs truncate ml-4">{activity.last_played}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Payment history by year */}
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-white pl-1">Historial de Pagos Anual</h2>
                {years.map((yearData) => (
                    <div key={yearData.year} className="bg-plex-dark rounded-lg overflow-hidden border border-gray-800 shadow-md">
                        <div className="bg-plex-darker px-5 py-4 flex justify-between items-center border-b border-gray-800/50">
                            <h3 className="text-lg font-bold text-white">{yearData.year}</h3>
                            <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-400">Total año:</span>
                                <span className="text-plex-yellow font-bold text-lg">
                                    {currency}{Number(yearData.total_paid).toFixed(2)}
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-[1px] bg-gray-800 p-4">
                            {MONTHS.map((monthName, idx) => {
                                const payment = yearData.payments[idx + 1];
                                return (
                                    <div
                                        key={idx}
                                        onClick={async () => {
                                            if (!payment) return;
                                            try {
                                                const res = await fetch(
                                                    `/api/monthly-payments/${user.id}/${yearData.year}/toggle/${idx + 1}`,
                                                    { method: 'POST', credentials: 'include' }
                                                );
                                                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                                await loadData();
                                            } catch (e) {
                                                console.error('Error toggling payment:', e);
                                                alert('Error al cambiar el estado del pago.');
                                            }
                                        }}
                                        className={`p-3 text-center flex flex-col justify-center min-h-[80px] ${payment ? 'cursor-pointer hover:brightness-125' : ''} ${payment?.is_paid
                                            ? 'bg-green-900/20 text-green-400'
                                            : payment
                                                ? 'bg-red-900/20 text-red-400'
                                                : 'bg-plex-dark/80 text-gray-600'
                                            } ${idx === 0 ? 'rounded-tl-lg lg:rounded-bl-lg' : ''} ${idx === 11 ? 'rounded-br-lg lg:rounded-tr-lg' : ''} ${idx === 2 ? 'sm:rounded-tr-lg md:rounded-none' : ''} ${idx === 5 ? 'md:rounded-tr-lg lg:rounded-none' : ''}`}
                                        title={payment ? (payment.is_paid ? 'Click para marcar como no pagado' : 'Click para marcar como pagado') : ''}
                                    >
                                        <div className="font-medium text-sm mb-2">{monthName}</div>
                                        {payment ? (
                                            <div className="mt-auto">
                                                {payment.is_paid ? (
                                                    <CheckCircleIcon className="h-6 w-6 mx-auto opacity-80" />
                                                ) : (
                                                    <div className="flex flex-col items-center">
                                                        <XCircleIcon className="h-6 w-6 mx-auto opacity-80" />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mt-auto text-xs opacity-50">—</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
