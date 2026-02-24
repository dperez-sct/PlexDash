import { useEffect, useState } from 'react';
import {
  UsersIcon,
  CurrencyEuroIcon,
  ExclamationCircleIcon,
  UserGroupIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  getDashboardStats, getRecentPayments, getCurrencySettings,
  getMonthlyRevenue, getPaymentSummary, getDebtors, getPlexServerInfo,
  getExpenseSummary,
  DashboardStats, RecentPayment, MonthlyRevenueData, PaymentSummary,
  Debtor, PlexServerInfo, ExpenseSummary,
} from '../services/api';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const CHART_COLORS = { paid: '#e5a00d', unpaid: '#ef4444' };

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState('€');
  const [revenueData, setRevenueData] = useState<MonthlyRevenueData[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [plexInfo, setPlexInfo] = useState<PlexServerInfo | null>(null);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, recentRes, currencyRes, revenueRes, summaryRes, debtorsRes] = await Promise.all([
          getDashboardStats(),
          getRecentPayments(),
          getCurrencySettings(),
          getMonthlyRevenue(currentYear),
          getPaymentSummary(currentYear, currentMonth),
          getDebtors(currentYear),
        ]);
        setStats(statsRes.data);
        setRecentPayments(recentRes.data);
        setCurrencySymbol(currencyRes.data.currency_symbol);
        setRevenueData(revenueRes.data);
        setPaymentSummary(summaryRes.data);
        setDebtors(debtorsRes.data);
        // Plex info & expenses are optional - don't fail if unavailable
        try { const pi = await getPlexServerInfo(); setPlexInfo(pi.data); } catch { }
        try { const es = await getExpenseSummary(0); setExpenseSummary(es.data); } catch { }
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

  // Prepare chart data
  const barData = revenueData.map((d) => ({
    name: MONTH_NAMES[d.month - 1],
    Ingresos: d.total,
  }));

  const donutData = paymentSummary
    ? [
      { name: 'Pagados', value: paymentSummary.paid },
      { name: 'Pendientes', value: paymentSummary.unpaid },
    ]
    : [];

  const totalDonut = (paymentSummary?.paid || 0) + (paymentSummary?.unpaid || 0);

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-white mb-8">Panel de Control</h1>

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
              <p className="text-gray-400 text-sm">Ingresos Totales (Año)</p>
              <p className="text-2xl font-bold text-white mt-1">
                {currencySymbol}{revenueData.reduce((s, d) => s + d.total, 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-plex-yellow/20 p-3 rounded-lg">
              <CurrencyEuroIcon className="h-6 w-6 text-plex-yellow" />
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

      {/* Expenses Summary Row */}
      {expenseSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-plex-dark p-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Gastos Acumulados</p>
                <p className="text-2xl font-bold text-red-400 mt-1">
                  {currencySymbol}{Number(expenseSummary.total_expenses).toFixed(2)}
                </p>
              </div>
              <div className="bg-red-500/20 p-3 rounded-lg">
                <ArrowTrendingDownIcon className="h-6 w-6 text-red-400" />
              </div>
            </div>
          </div>
          <div className="bg-plex-dark p-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Ingresos Acumulados</p>
                <p className="text-2xl font-bold text-green-400 mt-1">
                  {currencySymbol}{Number(expenseSummary.total_income).toFixed(2)}
                </p>
              </div>
              <div className="bg-green-500/20 p-3 rounded-lg">
                <CurrencyEuroIcon className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Bar Chart — Monthly Revenue */}
        <div className="bg-plex-dark rounded-lg p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold text-white mb-4">
            Ingresos Mensuales — {currentYear}
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }}
                  formatter={(value: number) => [`${currencySymbol}${value.toFixed(2)}`, 'Ingresos']}
                />
                <Bar dataKey="Ingresos" fill="#e5a00d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart — Paid vs Unpaid */}
        <div className="bg-plex-dark rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </h2>
          {totalDonut > 0 ? (
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    <Cell fill={CHART_COLORS.paid} />
                    <Cell fill={CHART_COLORS.unpaid} />
                  </Pie>
                  <Legend
                    formatter={(value: string) => <span style={{ color: '#d1d5db' }}>{value}</span>}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No hay datos para este mes
            </div>
          )}
        </div>
      </div>

      {/* Recent Payments + Debtors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-plex-dark rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Pagos Recientes</h2>
          <div className="space-y-4">
            {recentPayments.length > 0 ? (
              recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between bg-plex-darker p-4 rounded-lg hover:bg-[#1a1a2e] transition-colors">
                  <div>
                    <Link to={`/users/${payment.user_id}`} className="text-white font-medium hover:text-plex-yellow transition-colors">
                      {payment.username}
                    </Link>
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

        {/* Debtors Widget */}
        <div className="bg-plex-dark rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <ExclamationCircleIcon className="h-6 w-6 text-red-400 mr-2" />
            Deudores
          </h2>
          <div className="space-y-3">
            {debtors.length > 0 ? (
              debtors.slice(0, 8).map((debtor) => (
                <div key={debtor.user_id} className="flex items-center justify-between bg-plex-darker p-3 rounded-lg hover:bg-[#1a1a2e] transition-colors">
                  <div className="flex items-center space-x-3">
                    {debtor.thumb ? (
                      <img src={debtor.thumb} alt={debtor.username} className="h-8 w-8 rounded-full" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center">
                        <span className="text-xs text-gray-300 font-bold">{debtor.username.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <div>
                      <Link to={`/users/${debtor.user_id}`} className="text-white text-sm font-medium hover:text-plex-yellow transition-colors">
                        {debtor.username}
                      </Link>
                      <p className="text-gray-500 text-xs">{debtor.unpaid_months} mes(es) sin pagar</p>
                    </div>
                  </div>
                  <span className="text-red-400 font-semibold text-sm">
                    {currencySymbol}{Number(debtor.total_debt).toFixed(2)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-green-400 text-center py-4">🎉 Todos al día</div>
            )}
          </div>
        </div>
      </div>

      {/* Plex Server Status */}
      {plexInfo && (
        <div className="bg-plex-dark rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-3">Estado del Servidor Plex</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-plex-darker rounded-lg p-4">
              <p className="text-gray-400 text-sm">Nombre</p>
              <p className="text-white font-medium">{plexInfo.name}</p>
            </div>
            <div className="bg-plex-darker rounded-lg p-4">
              <p className="text-gray-400 text-sm">Versión</p>
              <p className="text-white font-medium">{plexInfo.version}</p>
            </div>
            <div className="bg-plex-darker rounded-lg p-4">
              <p className="text-gray-400 text-sm">Plataforma</p>
              <p className="text-white font-medium">{plexInfo.platform}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
