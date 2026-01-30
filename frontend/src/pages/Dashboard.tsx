import { useEffect, useState } from 'react';
import {
  UsersIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import StatCard from '../components/StatCard';
import { getDashboardStats, getRecentPayments, getUpcomingDues, getCurrencySettings, DashboardStats, RecentPayment, UpcomingDue } from '../services/api';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [upcomingDues, setUpcomingDues] = useState<UpcomingDue[]>([]);
  const [loading, setLoading] = useState(true);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, recentRes, upcomingRes, currencyRes] = await Promise.all([
          getDashboardStats(),
          getRecentPayments(),
          getUpcomingDues(),
          getCurrencySettings(),
        ]);
        setStats(statsRes.data);
        setRecentPayments(recentRes.data);
        setUpcomingDues(upcomingRes.data);
        setCurrencySymbol(currencyRes.data.currency_symbol);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={stats?.total_users || 0}
          icon={<UsersIcon className="h-6 w-6" />}
          color="blue"
        />
        <StatCard
          title="Active Users"
          value={stats?.active_users || 0}
          icon={<UsersIcon className="h-6 w-6" />}
          color="green"
        />
        <StatCard
          title="Total Revenue"
          value={`${currencySymbol}${Number(stats?.total_revenue || 0).toFixed(2)}`}
          icon={<CurrencyDollarIcon className="h-6 w-6" />}
          color="yellow"
        />
        <StatCard
          title="Pending Payments"
          value={stats?.pending_payments || 0}
          icon={<ClockIcon className="h-6 w-6" />}
          color="yellow"
        />
      </div>

      {stats?.overdue_payments ? (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-8">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-400">
              {stats.overdue_payments} overdue payment(s) require attention
            </span>
          </div>
        </div>
      ) : null}

      {/* Recent Payments & Upcoming Dues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <div className="bg-plex-dark rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Pagos Recientes</h2>
          {recentPayments.length === 0 ? (
            <p className="text-gray-400">No hay pagos recientes</p>
          ) : (
            <div className="space-y-3">
              {recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between py-2 border-b border-gray-700"
                >
                  <div>
                    <p className="text-white">{payment.username}</p>
                    <p className="text-sm text-gray-400">
                      {MONTH_NAMES[payment.month - 1]} {payment.year}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">
                      {currencySymbol}{Number(payment.amount).toFixed(2)}
                    </p>
                    <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                      Pagado
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Dues */}
        <div className="bg-plex-dark rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Pagos Pendientes</h2>
          {upcomingDues.length === 0 ? (
            <p className="text-gray-400">No hay pagos pendientes este mes</p>
          ) : (
            <div className="space-y-3">
              {upcomingDues.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between py-2 border-b border-gray-700"
                >
                  <div>
                    <p className="text-white">{payment.username}</p>
                    <p className="text-sm text-gray-400">
                      {MONTH_NAMES[payment.month - 1]} {payment.year}
                    </p>
                  </div>
                  <p className="text-yellow-400 font-medium">
                    {currencySymbol}{Number(payment.amount).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
