import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
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
  access_token: string;
  token_type: string;
  username: string;
}

export interface ChangeCredentialsRequest {
  current_password: string;
  new_username?: string;
  new_password?: string;
}

export const login = (data: LoginRequest) => api.post<LoginResponse>('/auth/login', data);
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
  payments: { [month: number]: {
    id: number;
    month: number;
    amount: number;
    is_paid: boolean;
    paid_at: string | null;
  }};
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
    created_at: string;
  };
  years: YearPaymentData[];
  total_all_time: number;
}

export const getUserPaymentHistory = (userId: number) =>
  api.get<UserPaymentHistory>(`/monthly-payments/user/${userId}/history`);

export default api;
