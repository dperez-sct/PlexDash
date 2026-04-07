import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowPathIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  XMarkIcon,
  CheckCircleIcon,
  UserPlusIcon,
  BanknotesIcon,
  CheckIcon,
  UserMinusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
  getUsers,
  syncPlexUsers,
  toggleUserActive,
  updateUser,
  getUserPaymentHistory,
  getCurrencySettings,
  getMonthlyPrice,
  inviteUser,
  removeUserAccess,
  reactivateUser,
  createQuickPayment,
  User,
  UserPaymentHistory
} from '../services/api';

// type SortField = 'username' | 'email' | 'is_active' | 'notes';
// type SortDirection = 'asc' | 'desc'; // Unused for now

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [noteContent, setNoteContent] = useState('');
  // const [showDeleted, setShowDeleted] = useState(false); // Unused for now
  // const [sortField, setSortField] = useState<SortField>('username');
  // const [sortDirection, setSortDirection] = useState<SortDirection>('asc'); // Unused for now
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'deleted'>('all');
  const [sortBy, setSortBy] = useState<'username' | 'status'>('username');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [historyModal, setHistoryModal] = useState<UserPaymentHistory | null>(null);
  // const [loadingHistory, setLoadingHistory] = useState(false); // Unused for now

  const [currencySymbol, setCurrencySymbol] = useState('€');
  const [monthlyPrice, setMonthlyPrice] = useState(0);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [processingPayment, setProcessingPayment] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [usersResponse, currencyResponse, priceResponse] = await Promise.all([
        getUsers(true),
        getCurrencySettings(),
        getMonthlyPrice(),
      ]);
      setUsers(usersResponse.data);
      setCurrencySymbol(currencyResponse.data.currency_symbol);
      setMonthlyPrice(priceResponse.data.monthly_price);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncPlexUsers();
      await fetchData();
    } catch (error) {
      console.error('Error syncing users:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await toggleUserActive(user.id);
      setUsers(users.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u)));
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  };

  const startEditingNote = (user: User) => {
    setEditingNote(user.id);
    setNoteContent(user.notes || '');
  };

  const saveNote = async (userId: number) => {
    try {
      await updateUser(userId, { notes: noteContent });
      setUsers(users.map((u) => (u.id === userId ? { ...u, notes: noteContent } : u)));
      setEditingNote(null);
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const handleViewHistory = async (userId: number) => {
    // setLoadingHistory(true);
    try {
      const response = await getUserPaymentHistory(userId);
      setHistoryModal(response.data);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    } finally {
      // setLoadingHistory(false);
    }
  };

  const handleQuickPay = async (user: User) => {
    if (!monthlyPrice || monthlyPrice <= 0) {
      alert("Por favor, configura el precio mensual en Ajustes primero.");
      return;
    }

    if (!confirm(`¿Registrar pago de ${currencySymbol}${monthlyPrice} para ${user.username}?`)) {
      return;
    }

    setProcessingPayment(user.id);
    try {
      await createQuickPayment(user.id);
      alert("Pago registrado correctamente");
      // Optionally refresh history if open or stats
    } catch (error: any) {
      console.error('Error processing quick payment:', error);
      alert(error.response?.data?.detail || "Error al registrar el pago");
    } finally {
      setProcessingPayment(null);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteMessage(null);

    try {
      await inviteUser(inviteEmail);
      setInviteMessage({ type: 'success', text: `Invitación enviada a ${inviteEmail}` });
      setInviteEmail('');
      handleSync(); // Refresh list to show pending user if applicable
      setTimeout(() => setShowInviteModal(false), 2000);
    } catch (error: any) {
      setInviteMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Error al enviar invitación'
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveAccess = async (user: User) => {
    if (!confirm(`¿Estás seguro que quieres quitar el acceso a la biblioteca para ${user.username}? Esta acción dejará de compartir el servidor con este usuario.`)) {
      return;
    }

    try {
      await removeUserAccess(user.id);
      setUsers(users.map((u) => (u.id === user.id ? { ...u, deleted_from_plex: true, is_active: false } : u)));
    } catch (error) {
      console.error('Error removing user access:', error);
      alert('Error al quitar acceso. Asegúrate que la conexión con Plex es correcta.');
    }
  };

  const handleReactivateUser = async (user: User) => {
    if (!confirm(`¿Quieres reactivar a ${user.username} y darle acceso a todas las bibliotecas nuevamente?`)) {
      return;
    }

    try {
      await reactivateUser(user.id);
      setUsers(users.map((u) => (u.id === user.id ? { ...u, deleted_from_plex: false, is_active: true } : u)));
      alert(`Usuario ${user.username} reactivado correctamente.`);
    } catch (error) {
      console.error('Error reactivating user:', error);
      alert('Error al reactivar usuario.');
    }
  };

  const filteredUsers = useMemo(() => {
    const filtered = users.filter((user) => {
      const matchesSearch =
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.notes && user.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      if (filter === 'active') return matchesSearch && user.is_active && !user.deleted_from_plex;
      if (filter === 'inactive') return matchesSearch && !user.is_active && !user.deleted_from_plex;
      if (filter === 'deleted') return matchesSearch && user.deleted_from_plex;

      return matchesSearch && !user.deleted_from_plex;
    });

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'username') cmp = a.username.localeCompare(b.username);
      if (sortBy === 'status') cmp = Number(b.is_active) - Number(a.is_active);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [users, searchTerm, filter, sortBy, sortDir]);

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filters or sort changes — handled inline via useEffect
  useEffect(() => { setPage(1); }, [searchTerm, filter, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Usuarios</h1>
        <div className="flex space-x-2 sm:space-x-4">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base"
          >
            <UserPlusIcon className="h-5 w-5 sm:mr-2" />
            <span className="hidden sm:inline">Invitar Usuario</span>
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center px-3 sm:px-4 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange transition-colors disabled:opacity-50 text-sm sm:text-base"
          >
            <ArrowPathIcon className={`h-5 w-5 sm:mr-2 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Sincronizar con Plex'}</span>
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar usuarios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-plex-dark text-white border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:border-plex-yellow focus:outline-none"
          />
        </div>
        <div className="flex space-x-2">
          {['all', 'active', 'inactive', 'deleted'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg capitalize ${filter === f
                ? 'bg-plex-yellow text-plex-darker font-medium'
                : 'bg-plex-dark text-gray-400 hover:text-white'
                }`}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : f === 'inactive' ? 'Inactivos' : 'Eliminados'}
            </button>
          ))}
        </div>
      </div>

      {/* Users List */}
      <div className="bg-plex-dark rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[700px]">
          <thead className="bg-plex-darker text-gray-400 uppercase text-xs">
            <tr>
              <th
                className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors"
                onClick={() => { if (sortBy === 'username') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy('username'); setSortDir('asc'); } }}
              >
                Usuario {sortBy === 'username' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors"
                onClick={() => { if (sortBy === 'status') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy('status'); setSortDir('asc'); } }}
              >
                Estado {sortBy === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="px-6 py-4">Notas</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {paginatedUsers.map((user) => (
              <tr key={user.id} className="hover:bg-plex-darker/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <img
                      src={user.thumb || 'https://www.plex.tv/wp-content/uploads/2021/08/plex-avatar-default.png'}
                      alt={user.username}
                      className="h-10 w-10 rounded-full mr-4"
                    />
                    <div>
                      <div className="text-white font-medium cursor-pointer hover:text-plex-yellow transition-colors" onClick={() => navigate(`/users/${user.id}`)}>{user.username}</div>
                      <div className="text-gray-500 text-sm">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {user.deleted_from_plex ? (
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/50 text-red-400">
                        Eliminado de Plex
                      </span>
                      <button
                        onClick={() => handleReactivateUser(user)}
                        className="text-xs text-blue-400 hover:text-blue-300 underline"
                      >
                        Reactivar (Dar Acceso)
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleToggleActive(user)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${user.is_active
                        ? 'bg-green-900/50 text-green-400 hover:bg-green-900/70'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </button>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingNote === user.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        className="bg-plex-darker text-white border border-gray-700 rounded px-2 py-1 text-sm focus:border-plex-yellow focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => saveNote(user.id)} className="text-green-400 hover:text-green-300">
                        <CheckIcon className="h-5 w-5" />
                      </button>
                      <button onClick={() => setEditingNote(null)} className="text-red-400 hover:text-red-300">
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="group flex items-center space-x-2">
                      <span className="text-gray-300 text-sm truncate max-w-[200px]">
                        {user.notes || '-'}
                      </span>
                      <button
                        onClick={() => startEditingNote(user)}
                        className="text-gray-500 hover:text-plex-yellow opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-3">
                    <button
                      onClick={() => handleQuickPay(user)}
                      disabled={!!processingPayment}
                      title={`Pago Rápido (${currencySymbol}${monthlyPrice})`}
                      className="text-green-400 hover:text-green-300 disabled:opacity-50"
                    >
                      {processingPayment === user.id ? (
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      ) : (
                        <BanknotesIcon className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleViewHistory(user.id)}
                      className="text-plex-yellow hover:text-plex-orange"
                      title="Ver Historial"
                    >
                      <ClockIcon className="h-5 w-5" />
                    </button>
                    {!user.deleted_from_plex && (
                      <button
                        onClick={() => handleRemoveAccess(user)}
                        className="text-red-400 hover:text-red-300"
                        title="Quitar Acceso (Dejar de compartir)"
                      >
                        <UserMinusIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-gray-500 text-sm">
            {filteredUsers.length} usuarios · página {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-plex-dark text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span className="text-gray-400 text-sm px-2">{page} / {totalPages}</span>
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

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-plex-dark rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Invitar Usuario a Plex</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleInviteUser}>
              <div className="mb-4">
                <label className="block text-gray-400 text-sm mb-2">Correo Electrónico</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="usuario@ejemplo.com"
                  className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-plex-yellow focus:outline-none"
                  required
                />
              </div>

              {inviteMessage && (
                <div className={`mb-4 p-3 rounded text-sm ${inviteMessage.type === 'success' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                  }`}>
                  {inviteMessage.text}
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange transition-colors disabled:opacity-50"
                >
                  {inviting ? 'Enviando...' : 'Enviar Invitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-plex-dark rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Historial de Pagos</h3>
              <button onClick={() => setHistoryModal(null)} className="text-gray-400 hover:text-white">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6 flex items-center">
              <img
                src={historyModal.user.thumb || 'https://www.plex.tv/wp-content/uploads/2021/08/plex-avatar-default.png'}
                alt={historyModal.user.username}
                className="h-12 w-12 rounded-full mr-4"
              />
              <div>
                <div className="text-white font-medium text-lg">{historyModal.user.username}</div>
                <div className="text-gray-500">{historyModal.user.email}</div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-plex-darker p-4 rounded-lg">
                <div className="text-gray-400 text-sm mb-1">Total Pagado (Histórico)</div>
                <div className="text-2xl font-bold text-plex-yellow">
                  {currencySymbol}{historyModal.total_all_time.toFixed(2)}
                </div>
              </div>

              {historyModal.years.map((yearData) => (
                <div key={yearData.year} className="border border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-plex-darker px-4 py-3 flex justify-between items-center">
                    <span className="font-bold text-white">{yearData.year}</span>
                    <span className="text-green-400 font-medium">
                      {currencySymbol}{yearData.total_paid.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 p-4">
                    {Object.entries(yearData.payments).map(([month, payment]) => {
                      const amount = payment.amount;
                      const isPaid = payment.is_paid || payment.amount > 0;
                      // @ts-ignore
                      const monthName = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][parseInt(month) - 1];

                      return (
                        <div
                          key={month}
                          className={`text-center p-2 rounded ${isPaid
                            ? 'bg-green-500/20 border border-green-500/30'
                            : 'bg-gray-700/30 border border-gray-700/50'
                            }`}
                          title={isPaid && payment?.paid_at ? `Pagado: ${new Date(payment.paid_at).toLocaleDateString()}` : 'No pagado'}
                        >
                          <p className="text-xs text-gray-400">{monthName}</p>
                          {isPaid ? (
                            <CheckCircleIcon className="h-5 w-5 mx-auto text-green-400 mt-1" />
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">-</p>
                          )}
                          <p className={`text-xs mt-1 ${isPaid ? 'text-green-400' : 'text-gray-500'}`}>
                            {amount > 0 ? `${currencySymbol}${amount}` : '-'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setHistoryModal(null)}
                className="px-6 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
