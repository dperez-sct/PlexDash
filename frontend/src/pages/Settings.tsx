import { useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import {
  getPlexSettings,
  updatePlexSettings,
  testPlexConnection,
  getCurrencySettings,
  updateCurrencySettings,
  changeCredentials,
  PlexSettingsResponse,
  PlexTestResult,
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const [settings, setSettings] = useState<PlexSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<PlexTestResult | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    plex_url: '',
    plex_token: '',
  });

  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencyMessage, setCurrencyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { username, logout } = useAuth();
  const [credentialsForm, setCredentialsForm] = useState({
    current_password: '',
    new_username: '',
    new_password: '',
    confirm_password: '',
  });
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialsMessage, setCredentialsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [plexResponse, currencyResponse] = await Promise.all([
          getPlexSettings(),
          getCurrencySettings(),
        ]);
        setSettings(plexResponse.data);
        setFormData({
          plex_url: plexResponse.data.plex_url || '',
          plex_token: '',
        });
        setCurrencySymbol(currencyResponse.data.currency_symbol);
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setTestResult(null);

    try {
      await updatePlexSettings({
        plex_url: formData.plex_url,
        plex_token: formData.plex_token,
      });
      setMessage({ type: 'success', text: 'Settings saved successfully' });
      // Update the settings state to reflect that token is now configured
      setSettings((prev) => prev ? { ...prev, plex_url: formData.plex_url, plex_token_configured: true } : null);
      // Clear the token field after saving
      setFormData((prev) => ({ ...prev, plex_token: '' }));
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setMessage(null);

    try {
      const response = await testPlexConnection();
      setTestResult(response.data);
    } catch (error) {
      setTestResult({ success: false, error: 'Failed to test connection' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

      {/* Plex Configuration */}
      <div className="bg-plex-dark rounded-lg p-6 max-w-2xl">
        <h2 className="text-xl font-semibold text-white mb-6">Plex Server Configuration</h2>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg flex items-center ${
              message.type === 'success'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircleIcon className="h-5 w-5 mr-2" />
            ) : (
              <ExclamationCircleIcon className="h-5 w-5 mr-2" />
            )}
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Plex Server URL</label>
            <input
              type="url"
              value={formData.plex_url}
              onChange={(e) => setFormData({ ...formData, plex_url: e.target.value })}
              placeholder="http://localhost:32400"
              required
              className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
            />
            <p className="text-gray-500 text-sm mt-1">
              The URL of your Plex Media Server (e.g., http://192.168.1.100:32400)
            </p>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">
              Plex Token
              {settings?.plex_token_configured && (
                <span className="ml-2 text-green-400 text-xs">(configured)</span>
              )}
            </label>
            <input
              type="password"
              value={formData.plex_token}
              onChange={(e) => setFormData({ ...formData, plex_token: e.target.value })}
              placeholder={settings?.plex_token_configured ? '********' : 'Enter your Plex token'}
              required={!settings?.plex_token_configured}
              className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
            />
            <p className="text-gray-500 text-sm mt-1">
              Your Plex authentication token.{' '}
              <a
                href="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-plex-yellow hover:underline"
              >
                How to find your token
              </a>
            </p>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !settings?.plex_token_configured}
              className="flex items-center px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-5 w-5 mr-2 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </form>

        {/* Test Result */}
        {testResult && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              testResult.success ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}
          >
            {testResult.success ? (
              <div>
                <div className="flex items-center text-green-400 mb-2">
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  Connection successful!
                </div>
                {testResult.server_info && (
                  <div className="text-gray-300 text-sm space-y-1">
                    <p>
                      <span className="text-gray-500">Server:</span> {testResult.server_info.name}
                    </p>
                    <p>
                      <span className="text-gray-500">Version:</span> {testResult.server_info.version}
                    </p>
                    <p>
                      <span className="text-gray-500">Platform:</span> {testResult.server_info.platform}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center text-red-400">
                <ExclamationCircleIcon className="h-5 w-5 mr-2" />
                {testResult.error || 'Connection failed'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Currency Configuration */}
      <div className="bg-plex-dark rounded-lg p-6 max-w-2xl mt-8">
        <h2 className="text-xl font-semibold text-white mb-6">Configuración de Divisa</h2>

        {currencyMessage && (
          <div
            className={`mb-4 p-4 rounded-lg flex items-center ${
              currencyMessage.type === 'success'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {currencyMessage.type === 'success' ? (
              <CheckCircleIcon className="h-5 w-5 mr-2" />
            ) : (
              <ExclamationCircleIcon className="h-5 w-5 mr-2" />
            )}
            {currencyMessage.text}
          </div>
        )}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSavingCurrency(true);
            setCurrencyMessage(null);
            try {
              await updateCurrencySettings({ currency_symbol: currencySymbol });
              setCurrencyMessage({ type: 'success', text: 'Símbolo de divisa guardado' });
            } catch {
              setCurrencyMessage({ type: 'error', text: 'Error al guardar' });
            } finally {
              setSavingCurrency(false);
            }
          }}
          className="space-y-6"
        >
          <div>
            <label className="block text-gray-400 text-sm mb-2">Símbolo de Divisa</label>
            <input
              type="text"
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
              placeholder="$"
              maxLength={5}
              className="w-32 bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none text-center text-lg"
            />
            <p className="text-gray-500 text-sm mt-1">
              Ejemplos: $, €, £, ₿
            </p>
          </div>

          <button
            type="submit"
            disabled={savingCurrency}
            className="px-6 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange transition-colors disabled:opacity-50"
          >
            {savingCurrency ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      </div>

      {/* Security Configuration */}
      <div className="bg-plex-dark rounded-lg p-6 max-w-2xl mt-8">
        <h2 className="text-xl font-semibold text-white mb-6">Seguridad</h2>

        {credentialsMessage && (
          <div
            className={`mb-4 p-4 rounded-lg flex items-center ${
              credentialsMessage.type === 'success'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {credentialsMessage.type === 'success' ? (
              <CheckCircleIcon className="h-5 w-5 mr-2" />
            ) : (
              <ExclamationCircleIcon className="h-5 w-5 mr-2" />
            )}
            {credentialsMessage.text}
          </div>
        )}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSavingCredentials(true);
            setCredentialsMessage(null);

            if (credentialsForm.new_password && credentialsForm.new_password !== credentialsForm.confirm_password) {
              setCredentialsMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
              setSavingCredentials(false);
              return;
            }

            try {
              await changeCredentials({
                current_password: credentialsForm.current_password,
                new_username: credentialsForm.new_username || undefined,
                new_password: credentialsForm.new_password || undefined,
              });
              setCredentialsMessage({ type: 'success', text: 'Credenciales actualizadas. Por favor, inicia sesión de nuevo.' });
              setCredentialsForm({ current_password: '', new_username: '', new_password: '', confirm_password: '' });
              setTimeout(() => {
                logout();
                window.location.href = '/login';
              }, 2000);
            } catch {
              setCredentialsMessage({ type: 'error', text: 'Contraseña actual incorrecta' });
            } finally {
              setSavingCredentials(false);
            }
          }}
          className="space-y-6"
        >
          <div>
            <label className="block text-gray-400 text-sm mb-2">Usuario actual</label>
            <p className="text-white">{username}</p>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Contraseña actual *</label>
            <input
              type="password"
              value={credentialsForm.current_password}
              onChange={(e) => setCredentialsForm({ ...credentialsForm, current_password: e.target.value })}
              required
              className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Nuevo usuario (opcional)</label>
            <input
              type="text"
              value={credentialsForm.new_username}
              onChange={(e) => setCredentialsForm({ ...credentialsForm, new_username: e.target.value })}
              placeholder={username || ''}
              className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Nueva contraseña (opcional)</label>
            <input
              type="password"
              value={credentialsForm.new_password}
              onChange={(e) => setCredentialsForm({ ...credentialsForm, new_password: e.target.value })}
              className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Confirmar nueva contraseña</label>
            <input
              type="password"
              value={credentialsForm.confirm_password}
              onChange={(e) => setCredentialsForm({ ...credentialsForm, confirm_password: e.target.value })}
              className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={savingCredentials}
            className="px-6 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange transition-colors disabled:opacity-50"
          >
            {savingCredentials ? 'Guardando...' : 'Actualizar Credenciales'}
          </button>
        </form>
      </div>
    </div>
  );
}
