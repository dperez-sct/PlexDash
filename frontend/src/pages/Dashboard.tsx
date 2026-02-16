import { useEffect, useState } from 'react';
import {
  UsersIcon,
  CurrencyDollarIcon,
  ExclamationCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { getDashboardStats, getRecentPayments, getCurrencySettings, DashboardStats, RecentPayment } from '../services/api';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, recentRes, currencyRes] = await Promise.all([
          getDashboardStats(),
          getRecentPayments(),
          getCurrencySettings(),
        ]);
        setStats(statsRes.data);
        setRecentPayments(recentRes.data);
        setCurrencySymbol(currencyRes.data.currency_symbol);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Error al cargar datos del panel. Por favor, recargue la página.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Panel de Control</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-plex-dark p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Usuarios Totales</p>
              <p className="text-2xl font-bold text-white mt-1">{stats?.total_users || 0}</p>
            </div>
            <div className="bg-blue-500/20 p-3 rounded-lg">
              <UsersIcon className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-plex-dark p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Usuarios Activos</p>
              <p className="text-2xl font-bold text-white mt-1">{stats?.active_users || 0}</p>
            </div>
            <div className="bg-green-500/20 p-3 rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-plex-dark p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Ingresos Totales (Mes)</p>
              <p className="text-2xl font-bold text-white mt-1">
                {currencySymbol}{Number(stats?.total_revenue || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-plex-yellow/20 p-3 rounded-lg">
              <CurrencyDollarIcon className="h-6 w-6 text-plex-yellow" />
            </div>
          </div>
        </div>

        <div className="bg-plex-dark p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Pagos Pendientes</p>
              <p className="text-2xl font-bold text-white mt-1">{stats?.pending_payments || 0}</p>
            </div>
            <div className="bg-red-500/20 p-3 rounded-lg">
              <ExclamationCircleIcon className="h-6 w-6 text-red-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <div className="bg-plex-dark rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Pagos Recientes</h2>
          <div className="space-y-4">
            {recentPayments.length > 0 ? (
              recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between bg-plex-darker p-4 rounded-lg">
                  <div>
                    <p className="text-white font-medium">{payment.username}</p>
                    <p className="text-gray-400 text-sm">
                      {MONTH_NAMES[payment.month - 1] || 'Mes desconocido'} {payment.year}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-medium">
                      {currencySymbol}{Number(payment.amount).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(payment.paid_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-400 text-center py-4">No hay pagos recientes</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
