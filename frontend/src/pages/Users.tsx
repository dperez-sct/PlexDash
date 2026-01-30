import { useEffect, useState, useMemo } from 'react';
import { ArrowPathIcon, PencilIcon, ChevronUpIcon, ChevronDownIcon, MagnifyingGlassIcon, ClockIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { getUsers, syncPlexUsers, toggleUserActive, updateUser, getUserPaymentHistory, getCurrencySettings, User, UserPaymentHistory } from '../services/api';

type SortField = 'username' | 'email' | 'is_active' | 'notes';
type SortDirection = 'asc' | 'desc';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [sortField, setSortField] = useState<SortField>('username');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyModal, setHistoryModal] = useState<UserPaymentHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const fetchUsers = async (includeDeleted: boolean = showDeleted) => {
    try {
      const response = await getUsers(includeDeleted);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(showDeleted);
    getCurrencySettings().then(res => setCurrencySymbol(res.data.currency_symbol));
  }, [showDeleted]);

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = users.filter(u =>
        u.username.toLowerCase().includes(query) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.notes && u.notes.toLowerCase().includes(query))
      );
    }

    return [...filtered].sort((a, b) => {
      let aVal: string | boolean = '';
      let bVal: string | boolean = '';

      switch (sortField) {
        case 'username':
          aVal = a.username.toLowerCase();
          bVal = b.username.toLowerCase();
          break;
        case 'email':
          aVal = (a.email || '').toLowerCase();
          bVal = (b.email || '').toLowerCase();
          break;
        case 'is_active':
          aVal = a.is_active;
          bVal = b.is_active;
          break;
        case 'notes':
          aVal = (a.notes || '').toLowerCase();
          bVal = (b.notes || '').toLowerCase();
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, sortField, sortDirection, searchQuery]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc'
      ? <ChevronUpIcon className="h-4 w-4 inline ml-1" />
      : <ChevronDownIcon className="h-4 w-4 inline ml-1" />;
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncPlexUsers();
      await fetchUsers();
    } catch (error) {
      console.error('Error syncing users:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleActive = async (userId: number) => {
    try {
      const response = await toggleUserActive(userId);
      setUsers(users.map((u) => (u.id === userId ? response.data : u)));
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  };

  const handleEditNotes = (user: User) => {
    setEditingNotes(user.id);
    setNotesValue(user.notes || '');
  };

  const handleSaveNotes = async () => {
    if (editingNotes === null) return;

    try {
      const response = await updateUser(editingNotes, { notes: notesValue });
      setUsers(users.map((u) => (u.id === editingNotes ? response.data : u)));
    } catch (error) {
      console.error('Error saving notes:', error);
    }

    setEditingNotes(null);
    setNotesValue('');
  };

  const handleCancelEdit = () => {
    setEditingNotes(null);
    setNotesValue('');
  };

  const handleViewHistory = async (userId: number) => {
    setLoadingHistory(true);
    try {
      const response = await getUserPaymentHistory(userId);
      setHistoryModal(response.data);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Usuarios</h1>
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar usuarios..."
              className="bg-plex-dark text-white border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:border-plex-yellow focus:outline-none w-64"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          <label className="flex items-center cursor-pointer">
            <span className="text-gray-400 text-sm mr-3">Mostrar eliminados</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${showDeleted ? 'bg-plex-yellow' : 'bg-gray-600'}`}></div>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${showDeleted ? 'translate-x-4' : ''}`}></div>
            </div>
          </label>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center px-4 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar con Plex'}
          </button>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="bg-plex-dark rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">No se encontraron usuarios</p>
          <p className="text-sm text-gray-500">
            Haz click en "Sincronizar con Plex" para importar usuarios de tu servidor Plex
          </p>
        </div>
      ) : (
        <div className="bg-plex-dark rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th
                  className="text-left px-6 py-4 text-gray-400 font-medium cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort('username')}
                >
                  Usuario<SortIcon field="username" />
                </th>
                <th
                  className="text-left px-6 py-4 text-gray-400 font-medium cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort('email')}
                >
                  Email<SortIcon field="email" />
                </th>
                <th
                  className="text-left px-6 py-4 text-gray-400 font-medium cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort('is_active')}
                >
                  Estado<SortIcon field="is_active" />
                </th>
                <th
                  className="text-left px-6 py-4 text-gray-400 font-medium cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort('notes')}
                >
                  Notas<SortIcon field="notes" />
                </th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.map((user) => (
                <tr key={user.id} className={`border-b border-gray-700/50 hover:bg-gray-800/50 ${user.deleted_from_plex ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {user.thumb ? (
                        <img
                          src={user.thumb}
                          alt={user.username}
                          className={`w-10 h-10 rounded-full mr-3 ${user.deleted_from_plex ? 'grayscale' : ''}`}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-700 mr-3 flex items-center justify-center">
                          <span className="text-gray-400 text-sm">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <span className="text-white">{user.username}</span>
                        {user.deleted_from_plex && (
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">
                            Eliminado
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-300 text-sm">{user.email || '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        user.is_active
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400 text-sm max-w-[200px] truncate">
                        {user.notes || '-'}
                      </span>
                      <button
                        onClick={() => handleEditNotes(user)}
                        className="p-1 text-gray-500 hover:text-plex-yellow"
                        title="Editar notas"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewHistory(user.id)}
                        className="text-sm px-3 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                        title="Ver historial de pagos"
                      >
                        <ClockIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(user.id)}
                        className={`text-sm px-3 py-1 rounded ${
                          user.is_active
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        }`}
                      >
                        {user.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Notes Modal */}
      {editingNotes !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-plex-dark rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Editar Notas</h2>
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              rows={4}
              placeholder="Escribe notas sobre este usuario..."
              className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-plex-yellow focus:outline-none"
            />
            <div className="flex space-x-3 mt-4">
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNotes}
                className="flex-1 px-4 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {(historyModal || loadingHistory) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-plex-dark rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-400">Cargando historial...</div>
              </div>
            ) : historyModal && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    {historyModal.user.thumb ? (
                      <img
                        src={historyModal.user.thumb}
                        alt={historyModal.user.username}
                        className="w-12 h-12 rounded-full mr-4"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-700 mr-4 flex items-center justify-center">
                        <span className="text-gray-400 text-lg">
                          {historyModal.user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl font-bold text-white">{historyModal.user.username}</h2>
                      <p className="text-gray-400 text-sm">{historyModal.user.email || 'Sin email'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setHistoryModal(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Summary */}
                <div className="bg-plex-darker rounded-lg p-4 mb-6">
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">Total pagado (todos los años)</p>
                    <p className="text-3xl font-bold text-plex-yellow">
                      {currencySymbol}{Number(historyModal.total_all_time).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Years */}
                {historyModal.years.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No hay historial de pagos</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {historyModal.years.map((yearData) => (
                      <div key={yearData.year} className="bg-plex-darker rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-white">{yearData.year}</h3>
                          <span className="text-plex-yellow font-medium">
                            Total: {currencySymbol}{Number(yearData.total_paid).toFixed(2)}
                          </span>
                        </div>
                        <div className="grid grid-cols-12 gap-2">
                          {MONTH_NAMES.map((monthName, idx) => {
                            const month = idx + 1;
                            const payment = yearData.payments[month];
                            const isPaid = payment?.is_paid || false;
                            const amount = payment?.amount || 0;
                            return (
                              <div
                                key={month}
                                className={`text-center p-2 rounded ${
                                  isPaid
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
                )}

                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setHistoryModal(null)}
                    className="px-6 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
