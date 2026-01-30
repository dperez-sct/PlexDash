import { useEffect, useState, useCallback } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import {
  getYearPayments,
  updateMonthPayment,
  getCurrencySettings,
  UserYearPayments,
  MonthlyPayment,
} from '../services/api';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function Payments() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [usersPayments, setUsersPayments] = useState<UserYearPayments[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ userId: number; month: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  useEffect(() => {
    getCurrencySettings().then((res) => setCurrencySymbol(res.data.currency_symbol));
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

  const handleAmountClick = (userId: number, month: number, currentAmount: number) => {
    setEditingCell({ userId, month });
    setEditValue(currentAmount.toString());
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  };

  const handleAmountBlur = async () => {
    if (!editingCell) return;

    const { userId, month } = editingCell;
    const newAmount = parseFloat(editValue) || 0;
    const isPaid = newAmount > 0;

    try {
      await updateMonthPayment(userId, year, month, { amount: newAmount, is_paid: isPaid });
      fetchData();
    } catch (error) {
      console.error('Error updating amount:', error);
    }

    setEditingCell(null);
    setEditValue('');
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAmountBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with year selector */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Pagos Mensuales</h1>
        <div className="flex items-center space-x-6">
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
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setYear(year - 1)}
              className="p-2 bg-plex-dark text-gray-300 rounded-lg hover:bg-gray-700"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <span className="text-xl font-bold text-white min-w-[80px] text-center">{year}</span>
            <button
              onClick={() => setYear(year + 1)}
              className="p-2 bg-plex-dark text-gray-300 rounded-lg hover:bg-gray-700"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Year total */}
      <div className="mb-6 bg-plex-dark rounded-lg p-4 flex items-center justify-between">
        <span className="text-gray-400">Total recaudado en {year}:</span>
        <span className="text-2xl font-bold text-plex-yellow">
          {currencySymbol}{calculateYearTotal().toFixed(2)}
        </span>
      </div>

      {/* Payments Calendar Table */}
      {usersPayments.length === 0 ? (
        <div className="bg-plex-dark rounded-lg p-8 text-center">
          <p className="text-gray-400">No hay usuarios activos</p>
        </div>
      ) : (
        <div className="bg-plex-dark rounded-lg overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-4 py-3 text-gray-400 font-medium sticky left-0 bg-plex-dark z-10 min-w-[150px]">
                  Usuario
                </th>
                {MONTHS.map((month, index) => (
                  <th
                    key={index}
                    className="text-center px-2 py-3 text-gray-400 font-medium min-w-[70px]"
                  >
                    {month}
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-gray-400 font-medium min-w-[100px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {usersPayments.map((user) => (
                <tr key={user.user_id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                  {/* User column */}
                  <td className="px-4 py-2 sticky left-0 bg-plex-dark z-10">
                    <div className="flex items-center space-x-3">
                      {user.thumb ? (
                        <img
                          src={user.thumb}
                          alt={user.username}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                          <span className="text-xs text-gray-300">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-white text-sm font-medium truncate max-w-[100px]">
                        {user.username}
                      </span>
                    </div>
                  </td>

                  {/* Month cells */}
                  {MONTHS.map((_, monthIndex) => {
                    const month = monthIndex + 1;
                    const payment = getPayment(user, month);
                    const isEditing =
                      editingCell?.userId === user.user_id && editingCell?.month === month;
                    const isPaid = payment?.is_paid || false;
                    const amount = payment ? Number(payment.amount) : 0;

                    return (
                      <td key={month} className="px-1 py-1">
                        <div
                          className={`rounded-lg p-2 cursor-pointer transition-colors ${
                            isPaid
                              ? 'bg-green-500/20 hover:bg-green-500/30'
                              : 'bg-gray-700/50 hover:bg-gray-700'
                          }`}
                          onClick={() => handleAmountClick(user.user_id, month, amount)}
                        >
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editValue}
                              onChange={handleAmountChange}
                              onBlur={handleAmountBlur}
                              onKeyDown={handleAmountKeyDown}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className="w-full bg-plex-darker text-white text-center text-sm rounded px-1 py-0.5 border border-plex-yellow focus:outline-none"
                            />
                          ) : (
                            <div
                              className={`text-center text-sm font-medium ${
                                isPaid ? 'text-green-400' : 'text-gray-400'
                              }`}
                            >
                              {currencySymbol}{amount.toFixed(0)}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  {/* Total column */}
                  <td className="px-4 py-2 text-right">
                    <span className="text-plex-yellow font-bold">
                      {currencySymbol}{calculateUserTotal(user).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex items-center space-x-6 text-sm text-gray-400">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/50"></div>
          <span>Pagado</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-gray-700/50 border border-gray-600"></div>
          <span>Pendiente</span>
        </div>
        <div className="text-gray-500">
          Click en celda para editar monto. Se marca como pagado automáticamente si el monto es mayor a 0.
        </div>
      </div>
    </div>
  );
}
