import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});


// Add auth token to requests - REMOVED (using cookies)
api.interceptors.request.use((config) => {
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  username: string;
  message: string;
}

export interface ChangeCredentialsRequest {
  current_password: string;
  new_username?: string;
  new_password?: string;
}

export const login = (data: LoginRequest) => api.post<LoginResponse>('/auth/login', data);
export const logout = () => api.post('/auth/logout');
export const getMe = () => api.get<{ username: string }>('/auth/me');
export const changeCredentials = (data: ChangeCredentialsRequest) => api.post('/auth/change-credentials', data);

export interface User {
  id: number;
  plex_id: string;
  username: string;
  email: string;
  thumb?: string;
  notes?: string;
  is_active: boolean;
  deleted_from_plex: boolean;
  created_at: string;
}

export interface Subscription {
  id: number;
  user_id: number;
  plan_name: string;
  amount: number;
  currency: string;
  status: string;
  start_date: string;
  next_payment_date?: string;
  created_at: string;
}

export interface Payment {
  id: number;
  user_id: number;
  subscription_id?: number;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  notes?: string;
  due_date?: string;
  paid_at?: string;
  created_at: string;
}

export interface DashboardStats {
  total_users: number;
  active_users: number;
  total_revenue: number;
  pending_payments: number;
  overdue_payments: number;
}

// Users
export const getUsers = (includeDeleted: boolean = false) =>
  api.get<User[]>('/users/', { params: { include_deleted: includeDeleted } });
export const getUser = (id: number) => api.get<User>(`/users/${id}`);
export const updateUser = (id: number, data: { notes?: string }) => api.put<User>(`/users/${id}`, data);
export const toggleUserActive = (id: number) => api.put<User>(`/users/${id}/toggle-active`);
export const syncPlexUsers = () => api.post('/users/sync');
export const createSubscription = (userId: number, data: Partial<Subscription>) =>
  api.post<Subscription>(`/users/${userId}/subscription`, data);

// Payments
export const getPayments = (params?: { status?: string; user_id?: number }) =>
  api.get<Payment[]>('/payments/', { params });
export const createPayment = (data: Partial<Payment>) => api.post<Payment>('/payments', data);
export const updatePayment = (id: number, data: Partial<Payment>) =>
  api.put<Payment>(`/payments/${id}`, data);
export const markPaymentPaid = (id: number) => api.put<Payment>(`/payments/${id}/mark-paid`);
export const deletePayment = (id: number) => api.delete(`/payments/${id}`);
export const createQuickPayment = (userId: number) => api.post(`/payments/quick/${userId}`);

export const removeUserAccess = (userId: number) => api.delete(`/users/${userId}/access`);
export const reactivateUser = (userId: number) => api.post(`/users/${userId}/reactivate`);

// Dashboard
export interface RecentPayment {
  id: number;
  user_id: number;
  username: string;
  amount: number;
  year: number;
  month: number;
  paid_at: string;
}

export interface UpcomingDue {
  id: number;
  user_id: number;
  username: string;
  amount: number;
  year: number;
  month: number;
}

export const getDashboardStats = () => api.get<DashboardStats>('/dashboard/stats');
export const getRecentPayments = () => api.get<RecentPayment[]>('/dashboard/recent-payments');
export const getUpcomingDues = () => api.get<UpcomingDue[]>('/dashboard/upcoming-dues');

// Settings
export interface PlexSettings {
  plex_url: string;
  plex_token: string;
}

export interface PlexSettingsResponse {
  plex_url: string | null;
  plex_token_configured: boolean;
}

export interface PlexTestResult {
  success: boolean;
  error?: string;
  server_info?: {
    name: string;
    version: string;
    platform: string;
  };
}

// Monthly Payments
export interface MonthlyPayment {
  id: number;
  user_id: number;
  year: number;
  month: number;
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string | null;
}

export interface UserYearPayments {
  user_id: number;
  username: string;
  thumb: string | null;
  payments: { [month: number]: MonthlyPayment };
}

export const getPlexSettings = () => api.get<PlexSettingsResponse>('/settings/plex');
export const updatePlexSettings = (data: PlexSettings) => api.put('/settings/plex', data);
export const testPlexConnection = () => api.post<PlexTestResult>('/settings/plex/test');

// Currency Settings
export interface CurrencySettings {
  currency_symbol: string;
}

export const getCurrencySettings = () => api.get<CurrencySettings>('/settings/currency');
export const updateCurrencySettings = (data: CurrencySettings) => api.put('/settings/currency', data);

// Monthly Payments API
export const getYearPayments = (year: number, includeInactive: boolean = false, includeDeleted: boolean = false) =>
  api.get<UserYearPayments[]>(`/monthly-payments/${year}`, {
    params: { include_inactive: includeInactive, include_deleted: includeDeleted }
  });

export const updateMonthPayment = (
  userId: number,
  year: number,
  month: number,
  data: { amount?: number; is_paid?: boolean }
) => api.put<MonthlyPayment>(`/monthly-payments/${userId}/${year}/${month}`, data);

export const toggleMonthPaid = (userId: number, year: number, month: number) =>
  api.post<MonthlyPayment>(`/monthly-payments/${userId}/${year}/toggle/${month}`);

// User Payment History
export interface YearPaymentData {
  year: number;
  payments: {
    [month: number]: {
      id: number;
      month: number;
      amount: number;
      is_paid: boolean;
      paid_at: string | null;
    }
  };
  total_paid: number;
}

export interface UserPaymentHistory {
  user: {
    id: number;
    username: string;
    email: string;
    thumb: string | null;
    is_active: boolean;
    deleted_from_plex: boolean;
    kill_stream_enabled: boolean;
    warn_count: number;
    last_warned_at: string | null;
    created_at: string;
    notes?: string;
  };
  years: YearPaymentData[];
  total_all_time: number;
}

export const getUserPaymentHistory = (userId: number) =>
  api.get<UserPaymentHistory>(`/monthly-payments/user/${userId}/history`);

// Monthly Price Settings
export interface MonthlyPriceResponse {
  monthly_price: number;
}

export const getMonthlyPrice = () => api.get<MonthlyPriceResponse>('/settings/price');
export const updateMonthlyPrice = (price: number) => api.put('/settings/price', { monthly_price: price });

// Invite User
export const inviteUser = (email: string) => api.post<User>('/users/invite', { email });

// ---- Dashboard Charts ----
export interface MonthlyRevenueData {
  month: number;
  total: number;
  paid_count: number;
  unpaid_count: number;
}

export interface PaymentSummary {
  paid: number;
  unpaid: number;
  total_amount: number;
}

export const getMonthlyRevenue = (year: number) =>
  api.get<MonthlyRevenueData[]>(`/dashboard/monthly-revenue/${year}`);

export const getPaymentSummary = (year: number, month: number) =>
  api.get<PaymentSummary>(`/dashboard/payment-summary/${year}/${month}`);

// ---- Audit Log ----
export interface AuditLogEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogResponse {
  total: number;
  page: number;
  limit: number;
  logs: AuditLogEntry[];
}

export const getAuditLogs = (page: number = 1, limit: number = 50) =>
  api.get<AuditLogResponse>('/audit/logs', { params: { page, limit } });

// ---- CSV Export ----
export const exportYearPayments = async (year: number) => {
  const response = await api.get(`/monthly-payments/${year}/export`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `pagos_${year}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ---- Notification Settings ----
export interface NotificationSettingsResponse {
  telegram_configured: boolean;
  telegram_chat_id: string | null;
  discord_configured: boolean;
}

export const getNotificationSettings = () =>
  api.get<NotificationSettingsResponse>('/settings/notifications');

export const updateNotificationSettings = (data: {
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  discord_webhook_url?: string;
}) => api.put('/settings/notifications', data);

export const testNotification = () => api.post('/settings/notifications/test');

export const sendReminders = () => api.post('/settings/notifications/send-reminders');

// ---- Bulk Payment Actions ----
export const bulkMarkPaid = (year: number, month: number) =>
  api.post(`/monthly-payments/${year}/${month}/bulk-pay`);

export const bulkMarkUnpaid = (year: number, month: number) =>
  api.post(`/monthly-payments/${year}/${month}/bulk-unpay`);

// ---- Debtors ----
export interface Debtor {
  user_id: number;
  username: string;
  thumb: string | null;
  unpaid_months: number;
  total_debt: number;
  months: number[];
}

export const getDebtors = (year?: number) =>
  api.get<Debtor[]>('/dashboard/debtors', { params: year ? { year } : {} });

// ---- Plex Server Info ----
export interface PlexServerInfo {
  name: string;
  version: string;
  platform: string;
}

export const getPlexServerInfo = () => api.get<PlexServerInfo>('/dashboard/plex-info');

// ---- Backup & Restore ----
export const downloadBackup = async () => {
  const response = await api.get('/settings/backup', { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'plexdash_backup.json');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const restoreBackup = (data: Record<string, unknown>) =>
  api.post('/settings/restore', data);

// ---- Expenses ----
export interface Expense {
  id: number;
  name: string;
  category: string;
  amount: number;
  is_recurring: boolean;
  recurrence: string;
  date: string;
  notes: string | null;
  created_at: string | null;
}

export interface ExpenseCreate {
  name: string;
  category: string;
  amount: number;
  is_recurring: boolean;
  recurrence: string;
  date: string;
  notes?: string;
}

export interface ExpenseSummary {
  total_expenses: number;
  total_income: number;
  net_profit: number;
  monthly_avg_expense: number;
  by_category: Record<string, number>;
}

export const getExpenses = (category?: string, year?: number) => {
  const params: Record<string, string> = {};
  if (category) params.category = category;
  if (year) params.year = String(year);
  return api.get<Expense[]>('/expenses/', { params });
};

export const createExpense = (data: ExpenseCreate) =>
  api.post<Expense>('/expenses/', data);

export const updateExpense = (id: number, data: Partial<ExpenseCreate>) =>
  api.put<Expense>(`/expenses/${id}`, data);

export const deleteExpense = (id: number) =>
  api.delete(`/expenses/${id}`);

export const getExpenseSummary = (year: number) =>
  api.get<ExpenseSummary>(`/expenses/summary/${year}`);

// ---- Notification Preferences ----
export interface NotificationPreferences {
  notify_on_payment: boolean;
  notify_on_expense: boolean;
  notify_monthly_summary: boolean;
}

export const getNotificationPreferences = () =>
  api.get<NotificationPreferences>('/settings/notification-preferences');

export const updateNotificationPreferences = (data: Partial<NotificationPreferences>) =>
  api.put('/settings/notification-preferences', data);

export default api;
