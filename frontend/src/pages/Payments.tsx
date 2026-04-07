import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, CheckCircleIcon, XCircleIcon, ArrowDownTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  getYearPayments,
  updateMonthPayment,
  getCurrencySettings,
  getMonthlyPrice,
  bulkMarkPaid,
  bulkMarkUnpaid,
  UserYearPayments,
  MonthlyPayment,
} from '../services/api';
import { exportYearPayments } from '../services/api';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

type SelectionMode = 'pay' | 'unpay' | null;

export default function Payments() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [usersPayments, setUsersPayments] = useState<UserYearPayments[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('€');
  const [monthlyPrice, setMonthlyPrice] = useState(0);

  // Selection State
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showUnpayModal, setShowUnpayModal] = useState(false);
  const [bulkMenuMonth, setBulkMenuMonth] = useState<number | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getCurrencySettings().then((res) => setCurrencySymbol(res.data.currency_symbol));
    getMonthlyPrice().then((res) => setMonthlyPrice(res.data.monthly_price));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getYearPayments(year, showInactive, showDeleted);
      setUsersPayments(response.data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  }, [year, showInactive, showDeleted]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Generate unique ID for each cell: "userId-month"
  const getCellId = (userId: number, month: number) => `${userId}-${month}`;

  // Check if a cell is paid based on current data
  const isCellPaid = (userId: number, month: number): boolean => {
    const user = usersPayments.find((u) => u.user_id === userId);
    if (!user) return false;
    const payment = user.payments[month];
    return payment?.is_paid || false;
  };

  const toggleSelection = (userId: number, month: number) => {
    const cellId = getCellId(userId, month);
    const cellIsPaid = isCellPaid(userId, month);

    setSelectedCells((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(cellId)) {
        // Deselect
        newSet.delete(cellId);
        // If no cells left, reset mode
        if (newSet.size === 0) {
          setSelectionMode(null);
        }
        return newSet;
      }

      // Determine mode from first selection
      const newMode: SelectionMode = cellIsPaid ? 'unpay' : 'pay';

      if (prev.size === 0) {
        // First selection sets the mode
        setSelectionMode(newMode);
        newSet.add(cellId);
      } else if (selectionMode === newMode) {
        // Same mode, add to selection
        newSet.add(cellId);
      } else {
        // Different mode - can't mix paid/unpaid selections
        // Clear and start fresh with new mode
        newSet.clear();
        newSet.add(cellId);
        setSelectionMode(newMode);
      }

      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedCells(new Set());
    setSelectionMode(null);
  };

  const handleBulkPay = async () => {
    setIsProcessing(true);
    try {
      const updates = Array.from(selectedCells).map((cellId) => {
        const [userId, month] = cellId.split('-').map(Number);
        return updateMonthPayment(userId, year, month, {
          amount: monthlyPrice,
          is_paid: true,
        });
      });

      await Promise.all(updates);
      await fetchData();
      clearSelection();
      setShowConfirmModal(false);
    } catch (error) {
      console.error('Error processing bulk payments:', error);
      alert('Error al procesar pagos. Por favor intente de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkUnpay = async () => {
    setIsProcessing(true);
    try {
      const updates = Array.from(selectedCells).map((cellId) => {
        const [userId, month] = cellId.split('-').map(Number);
        return updateMonthPayment(userId, year, month, {
          amount: 0,
          is_paid: false,
        });
      });

      await Promise.all(updates);
      await fetchData();
      clearSelection();
      setShowUnpayModal(false);
    } catch (error) {
      console.error('Error removing payments:', error);
      alert('Error al quitar pagos. Por favor intente de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getPayment = (user: UserYearPayments, month: number): MonthlyPayment | null => {
    return user.payments[month] || null;
  };

  const calculateUserTotal = (user: UserYearPayments): number => {
    return Object.values(user.payments).reduce((sum, payment) => {
      return sum + (payment.is_paid ? Number(payment.amount) : 0);
    }, 0);
  };

  const calculateYearTotal = (): number => {
    return usersPayments.reduce((sum, user) => sum + calculateUserTotal(user), 0);
  };

  const filteredUsers = useMemo(
    () => search.trim()
      ? usersPayments.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()))
      : usersPayments,
    [usersPayments, search]
  );

  if (loading && !usersPayments.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="pb-24"> {/* Added padding for floating bar */}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Pagos Mensuales</h1>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-plex-dark border border-gray-700 text-gray-300 text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-plex-yellow transition-colors w-44"
            />
          </div>
          {/* Filters */}
          <div className="flex items-center space-x-4">
            <label className="flex items-center cursor-pointer">
              <span className="text-gray-400 text-sm mr-2">Desactivados</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-9 h-5 rounded-full transition-colors ${showInactive ? 'bg-plex-yellow' : 'bg-gray-600'}`}></div>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showInactive ? 'translate-x-4' : ''}`}></div>
              </div>
            </label>
            <label className="flex items-center cursor-pointer">
              <span className="text-gray-400 text-sm mr-2">Eliminados</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-9 h-5 rounded-full transition-colors ${showDeleted ? 'bg-plex-yellow' : 'bg-gray-600'}`}></div>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showDeleted ? 'translate-x-4' : ''}`}></div>
              </div>
            </label>
          </div>
          {/* Year selector */}
          <div className="flex items-center space-x-2 bg-plex-dark p-1 rounded-lg">
            <button
              onClick={() => setYear(year - 1)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <span className="text-xl font-bold text-white min-w-[60px] text-center">{year}</span>
            <button
              onClick={() => setYear(year + 1)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
          {/* Export CSV */}
          <button
            onClick={() => exportYearPayments(year)}
            className="p-2 text-gray-400 hover:text-plex-yellow hover:bg-gray-700 rounded-lg transition-colors"
            title="Exportar CSV"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Year total */}
      <div className="mb-6 bg-plex-dark rounded-lg p-4 flex items-center justify-between border border-gray-800">
        <span className="text-gray-400">Total recaudado en {year}:</span>
        <span className="text-2xl font-bold text-plex-yellow">
          {currencySymbol}{calculateYearTotal().toFixed(2)}
        </span>
      </div>

      {/* Payments Grid */}
      <div className="bg-plex-dark rounded-lg overflow-hidden border border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-plex-darker border-b border-gray-800">
                <th className="text-left px-4 py-3 text-gray-400 font-medium sticky left-0 bg-plex-darker z-10 min-w-[180px]">
                  Usuario
                </th>
                {MONTHS.map((month, index) => (
                  <th
                    key={index}
                    className="text-center px-1 py-3 text-gray-400 font-medium min-w-[60px] text-sm relative group"
                  >
                    <button
                      onClick={() => setBulkMenuMonth(bulkMenuMonth === index + 1 ? null : index + 1)}
                      className="hover:text-plex-yellow transition-colors"
                    >
                      {month}
                    </button>
                    {bulkMenuMonth === index + 1 && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-plex-darker border border-gray-700 rounded-lg shadow-xl z-30 min-w-[140px]">
                        <button
                          disabled={bulkProcessing}
                          onClick={async () => {
                            setBulkProcessing(true);
                            try { await bulkMarkPaid(year, index + 1); await fetchData(); } finally { setBulkProcessing(false); setBulkMenuMonth(null); }
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-green-400 hover:bg-gray-800 rounded-t-lg disabled:opacity-50"
                        >
                          ✓ Marcar todos pagado
                        </button>
                        <button
                          disabled={bulkProcessing}
                          onClick={async () => {
                            setBulkProcessing(true);
                            try { await bulkMarkUnpaid(year, index + 1); await fetchData(); } finally { setBulkProcessing(false); setBulkMenuMonth(null); }
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-800 rounded-b-lg disabled:opacity-50"
                        >
                          ✗ Marcar todos no pagado
                        </button>
                      </div>
                    )}
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-gray-400 font-medium min-w-[100px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {usersPayments.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron usuarios para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-800/30 transition-colors">
                    {/* User column */}
                    <td className="px-4 py-2 sticky left-0 bg-plex-dark z-10">
                      <div className="flex items-center space-x-3">
                        {user.thumb ? (
                          <img
                            src={user.thumb}
                            alt={user.username}
                            className="w-8 h-8 rounded-full border border-gray-700"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center border border-gray-600">
                            <span className="text-xs text-gray-300 font-bold">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col">
                          <Link
                            to={`/users/${user.user_id}`}
                            className="text-white text-sm font-medium truncate max-w-[120px] inline-block hover:text-plex-yellow transition-colors"
                          >
                            {user.username}
                          </Link>
                          {!user.payments[1] /* Check active status via user object if available, simplified here */ && (
                            // Placeholder for inactive status if needed
                            null
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Month cells */}
                    {MONTHS.map((_, monthIndex) => {
                      const month = monthIndex + 1;
                      const payment = getPayment(user, month);
                      const isPaid = payment?.is_paid || false;
                      const amount = payment ? Number(payment.amount) : 0;
                      const isSelected = selectedCells.has(getCellId(user.user_id, month));
                      const isUnpaySelected = isSelected && selectionMode === 'unpay';

                      return (
                        <td key={month} className="px-1 py-1">
                          <div
                            onClick={() => toggleSelection(user.user_id, month)}
                            className={`
                              h-9 rounded-md flex items-center justify-center cursor-pointer transition-all duration-200 select-none border
                              ${isUnpaySelected
                                ? 'bg-red-500/20 text-red-400 font-bold border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)] transform scale-105'
                                : isSelected
                                  ? 'bg-plex-yellow text-plex-darker font-bold border-plex-yellow shadow-[0_0_10px_rgba(234,179,8,0.3)] transform scale-105'
                                  : isPaid
                                    ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
                                    : 'bg-gray-800/50 text-gray-500 border-transparent hover:bg-gray-700/80 hover:border-gray-600'
                              }
                            `}
                          >
                            <span className="text-xs">
                              {isUnpaySelected ? (
                                <XCircleIcon className="w-5 h-5" />
                              ) : isSelected ? (
                                <CheckCircleIcon className="w-5 h-5" />
                              ) : amount > 0 ? (
                                amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(1)
                              ) : (
                                '-'
                              )}
                            </span>
                          </div>
                        </td>
                      );
                    })}

                    {/* Total column */}
                    <td className="px-4 py-2 text-right">
                      <span className={`font-bold text-sm ${calculateUserTotal(user) > 0 ? 'text-plex-yellow' : 'text-gray-600'}`}>
                        {currencySymbol}{calculateUserTotal(user).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Action Bar */}
      {selectedCells.size > 0 && (
        <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-lg border shadow-2xl rounded-2xl p-4 flex items-center justify-between z-50 animate-in slide-in-from-bottom-5 ${selectionMode === 'unpay'
          ? 'bg-plex-darker border-red-500/50'
          : 'bg-plex-darker border-gray-700'
          }`}>
          <div className="flex items-center space-x-3">
            <div className={`font-bold w-8 h-8 rounded-full flex items-center justify-center ${selectionMode === 'unpay'
              ? 'bg-red-500 text-white'
              : 'bg-plex-yellow text-plex-darker'
              }`}>
              {selectedCells.size}
            </div>
            <span className="text-white font-medium">Seleccionados</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={clearSelection}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            {selectionMode === 'unpay' ? (
              <button
                onClick={() => setShowUnpayModal(true)}
                className="px-6 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              >
                Quitar Pago
              </button>
            ) : (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-6 py-2 bg-plex-yellow text-plex-darker font-bold rounded-xl hover:bg-plex-orange transition-colors shadow-lg shadow-plex-yellow/20"
              >
                Marcar Pagado ({currencySymbol}{monthlyPrice * selectedCells.size})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pay Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-plex-dark border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Confirmar Pagos</h3>
            <p className="text-gray-300 mb-6">
              ¿Estás seguro que quieres marcar <strong className="text-plex-yellow">{selectedCells.size}</strong> meses como pagados?
              <br />
              <br />
              Total a registrar: <strong className="text-white">{currencySymbol}{monthlyPrice * selectedCells.size}</strong>
              <br />
              <span className="text-gray-500 text-sm mt-2 block">
                (Basado en el precio configurado: {currencySymbol}{monthlyPrice}/mes)
              </span>
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkPay}
                disabled={isProcessing}
                className="flex-1 py-3 bg-plex-yellow text-plex-darker rounded-xl hover:bg-plex-orange transition-colors font-bold disabled:opacity-50"
              >
                {isProcessing ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unpay Confirmation Modal */}
      {showUnpayModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-plex-dark border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <XCircleIcon className="h-6 w-6 text-red-400 mr-2" />
              Quitar Pagos
            </h3>
            <p className="text-gray-300 mb-6">
              ¿Estás seguro que quieres <strong className="text-red-400">quitar el pago</strong> de <strong className="text-red-400">{selectedCells.size}</strong> {selectedCells.size === 1 ? 'mes' : 'meses'}?
              <br />
              <br />
              <span className="text-gray-500 text-sm">
                Los meses seleccionados volverán a aparecer como no pagados.
              </span>
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowUnpayModal(false)}
                className="flex-1 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkUnpay}
                disabled={isProcessing}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-bold disabled:opacity-50"
              >
                {isProcessing ? 'Procesando...' : 'Quitar Pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
