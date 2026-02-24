import React, { useEffect, useState } from 'react';
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
  getMonthlyPrice,
  updateMonthlyPrice,
  changeCredentials,
  getNotificationSettings,
  updateNotificationSettings,
  testNotification,
  sendReminders,
  PlexSettingsResponse,
  PlexTestResult,
  getNotificationPreferences,
  updateNotificationPreferences,
  downloadBackup,
  restoreBackup,
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';


function NotificationPreferenceToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <label className="text-gray-300 text-sm font-medium">{label}</label>
        <p className="text-gray-500 text-xs">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-plex-yellow focus:ring-offset-2 focus:ring-offset-gray-900 ${checked ? 'bg-plex-yellow' : 'bg-gray-700'
          }`}
      >
        <span
          className={`${checked ? 'translate-x-6' : 'translate-x-1'
            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
        />
      </button>
    </div>
  );
}

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

  const [currencySymbol, setCurrencySymbol] = useState('€');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencyMessage, setCurrencyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [monthlyPrice, setMonthlyPrice] = useState('0.00');
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceMessage, setPriceMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        const [plexResponse, currencyResponse, priceResponse] = await Promise.all([
          getPlexSettings(),
          getCurrencySettings(),
          getMonthlyPrice(),
        ]);
        setSettings(plexResponse.data);
        setFormData({
          plex_url: plexResponse.data.plex_url || '',
          plex_token: '',
        });
        setCurrencySymbol(currencyResponse.data.currency_symbol);
        setMonthlyPrice(priceResponse.data.monthly_price.toString());
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
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
      // Update the settings state to reflect that token is now configured
      setSettings((prev: PlexSettingsResponse | null) => prev ? { ...prev, plex_url: formData.plex_url, plex_token_configured: true } : null);
      // Clear the token field after saving
      setFormData((prev: any) => ({ ...prev, plex_token: '' }));
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar la configuración' });
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
      setTestResult({ success: false, error: 'Error al probar la conexión' });
    } finally {
      setTesting(false);
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
      <h1 className="text-3xl font-bold text-white mb-8">Ajustes</h1>

      {/* Plex Configuration */}
      <div className="bg-plex-dark rounded-lg p-6 max-w-2xl">
        <h2 className="text-xl font-semibold text-white mb-6">Configuración del Servidor Plex</h2>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg flex items-center ${message.type === 'success'
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
            <label className="block text-gray-400 text-sm mb-2">URL del Servidor Plex</label>
            <input
              type="url"
              value={formData.plex_url}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, plex_url: e.target.value })}
              placeholder="http://localhost:32400"
              required
              className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
            />
            <p className="text-gray-500 text-sm mt-1">
              La URL de tu servidor Plex (ej. http://192.168.1.100:32400)
            </p>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">
              Token de Plex
              {settings?.plex_token_configured && (
                <span className="ml-2 text-green-400 text-xs">(configurado)</span>
              )}
            </label>
            <input
              type="password"
              value={formData.plex_token}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, plex_token: e.target.value })}
              placeholder={settings?.plex_token_configured ? '********' : 'Introduce tu token de Plex'}
              required={!settings?.plex_token_configured}
              className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
            />
            <p className="text-gray-500 text-sm mt-1">
              Tu token de autenticación de Plex.{' '}
              <a
                href="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-plex-yellow hover:underline"
              >
                Cómo encontrar tu token
              </a>
            </p>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Ajustes'}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !settings?.plex_token_configured}
              className="flex items-center px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-5 w-5 mr-2 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Probando...' : 'Probar Conexión'}
            </button>
          </div>
        </form>

        {/* Test Result */}
        {testResult && (
          <div
            className={`mt-6 p-4 rounded-lg ${testResult.success ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}
          >
            {testResult.success ? (
              <div>
                <div className="flex items-center text-green-400 mb-2">
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  ¡Conexión exitosa!
                </div>
                {testResult.server_info && (
                  <div className="text-gray-300 text-sm space-y-1">
                    <p>
                      <span className="text-gray-500">Servidor:</span> {testResult.server_info.name}
                    </p>
                    <p>
                      <span className="text-gray-500">Versión:</span> {testResult.server_info.version}
                    </p>
                    <p>
                      <span className="text-gray-500">Plataforma:</span> {testResult.server_info.platform}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center text-red-400">
                <ExclamationCircleIcon className="h-5 w-5 mr-2" />
                {testResult.error || 'Fallo en la conexión'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Configuration */}
      <div className="bg-plex-dark rounded-lg p-6 max-w-2xl mt-8">
        <h2 className="text-xl font-semibold text-white mb-6">Configuración de Pagos</h2>

        {/* Currency */}
        <div className="mb-8 border-b border-gray-700 pb-8">
          {currencyMessage && (
            <div
              className={`mb-4 p-4 rounded-lg flex items-center ${currencyMessage.type === 'success'
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
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrencySymbol(e.target.value)}
                  placeholder="$"
                  maxLength={5}
                  className="w-32 bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none text-center text-lg"
                />
                <button
                  type="submit"
                  disabled={savingCurrency}
                  className="px-6 py-3 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange transition-colors disabled:opacity-50"
                >
                  {savingCurrency ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
              <p className="text-gray-500 text-sm mt-1">
                Ejemplos: $, €, £, ₿
              </p>
            </div>
          </form>
        </div>

        {/* Monthly Price */}
        <div>
          {priceMessage && (
            <div
              className={`mb-4 p-4 rounded-lg flex items-center ${priceMessage.type === 'success'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
                }`}
            >
              {priceMessage.type === 'success' ? (
                <CheckCircleIcon className="h-5 w-5 mr-2" />
              ) : (
                <ExclamationCircleIcon className="h-5 w-5 mr-2" />
              )}
              {priceMessage.text}
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingPrice(true);
              setPriceMessage(null);
              try {
                const price = parseFloat(monthlyPrice);
                if (isNaN(price) || price < 0) {
                  setPriceMessage({ type: 'error', text: 'Precio inválido' });
                  return;
                }
                await updateMonthlyPrice(price);
                setPriceMessage({ type: 'success', text: 'Precio mensual guardado' });
              } catch {
                setPriceMessage({ type: 'error', text: 'Error al guardar' });
              } finally {
                setSavingPrice(false);
              }
            }}
            className="space-y-6"
          >
            <div>
              <label className="block text-gray-400 text-sm mb-2">Precio Mensual ({currencySymbol})</label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={monthlyPrice}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMonthlyPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-32 bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none text-center text-lg"
                />
                <button
                  type="submit"
                  disabled={savingPrice}
                  className="px-6 py-3 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange transition-colors disabled:opacity-50"
                >
                  {savingPrice ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
              <p className="text-gray-500 text-sm mt-1">
                Este precio se usará para la función de pago rápido.
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Security Configuration */}
      <div className="bg-plex-dark rounded-lg p-6 max-w-2xl mt-8">
        <h2 className="text-xl font-semibold text-white mb-6">Seguridad</h2>

        {credentialsMessage && (
          <div
            className={`mb-4 p-4 rounded-lg flex items-center ${credentialsMessage.type === 'success'
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialsForm({ ...credentialsForm, current_password: e.target.value })}
              required
              className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Nuevo usuario (opcional)</label>
            <input
              type="text"
              value={credentialsForm.new_username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialsForm({ ...credentialsForm, new_username: e.target.value })}
              placeholder={username || ''}
              className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Nueva contraseña (opcional)</label>
            <input
              type="password"
              value={credentialsForm.new_password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialsForm({ ...credentialsForm, new_password: e.target.value })}
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

      {/* Notification Settings */}
      <NotificationSection />

      {/* Backup & Restore */}
      <BackupSection />

      {/* Tautulli Integration */}
      <TautulliSection />
    </div>
  );
}

function NotificationSection() {
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [discordConfigured, setDiscordConfigured] = useState(false);

  const [prefs, setPrefs] = useState({
    notify_on_payment: false,
    notify_on_expense: false,
    notify_monthly_summary: false,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, prefsRes] = await Promise.all([
          getNotificationSettings(),
          getNotificationPreferences(),
        ]);

        setTelegramConfigured(settingsRes.data.telegram_configured);
        setTelegramChatId(settingsRes.data.telegram_chat_id || '');
        setDiscordConfigured(settingsRes.data.discord_configured);

        setPrefs(prefsRes.data);
      } catch (err) {
        console.error('Error loading notification settings', err);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      try {
        await Promise.all([
          updateNotificationSettings({
            ...(telegramToken ? { telegram_bot_token: telegramToken } : {}),
            ...(telegramChatId ? { telegram_chat_id: telegramChatId } : {}),
            ...(discordWebhookUrl ? { discord_webhook_url: discordWebhookUrl } : {}),
          }),
          updateNotificationPreferences(prefs),
        ]);
        setStatus({ type: 'success', msg: 'Configuración guardada correctamente' });
        setTelegramToken('');
        setDiscordWebhookUrl('');
        // Refresh status
        const res = await getNotificationSettings();
        setTelegramConfigured(res.data.telegram_configured);
        setDiscordConfigured(res.data.discord_configured);
      } catch {
        setStatus({ type: 'error', msg: 'Error al guardar la configuración' });
      } finally {
        setSaving(false);
      }
    } catch {
      setStatus({ type: 'error', msg: 'Error al guardar la configuración' });
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const res = await testNotification();
      if (res.data.success) {
        setStatus({ type: 'success', msg: 'Notificación de prueba enviada' });
      } else {
        setStatus({ type: 'error', msg: res.data.error || 'Error al enviar' });
      }
    } catch {
      setStatus({ type: 'error', msg: 'Error al enviar la notificación de prueba' });
    } finally {
      setTesting(false);
    }
  };

  const handleSendReminders = async () => {
    setSending(true);
    setStatus(null);
    try {
      await sendReminders();
      setStatus({ type: 'success', msg: 'Recordatorios enviados' });
    } catch {
      setStatus({ type: 'error', msg: 'Error al enviar los recordatorios' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-plex-dark rounded-lg p-6 max-w-2xl mt-8">
      <h2 className="text-xl font-semibold text-white mb-6">Notificaciones</h2>

      {status && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {status.msg}
        </div>
      )}

      <div className="space-y-4">
        {/* Telegram */}
        <div>
          <h3 className="text-white font-medium mb-2">Telegram</h3>
          {telegramConfigured && (
            <p className="text-green-400 text-sm mb-2">✓ Configurado</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Bot Token</label>
              <input
                type="password"
                placeholder={telegramConfigured ? '••••••••' : 'Ingrese el token del bot'}
                value={telegramToken}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTelegramToken(e.target.value)}
                className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Chat ID</label>
              <input
                type="text"
                placeholder="Ingrese el Chat ID"
                value={telegramChatId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTelegramChatId(e.target.value)}
                className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Discord */}
        <div>
          <h3 className="text-white font-medium mb-2">Discord</h3>
          {discordConfigured && (
            <p className="text-green-400 text-sm mb-2">✓ Configurado</p>
          )}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Webhook URL</label>
            <input
              type="password"
              placeholder={discordConfigured ? '••••••••' : 'Ingrese la URL del webhook'}
              value={discordWebhookUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDiscordWebhookUrl(e.target.value)}
              className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="pt-4 border-t border-gray-700 mt-4">
        <h3 className="text-white font-medium mb-3">Preferencias de Envío</h3>
        <div className="space-y-3">
          <NotificationPreferenceToggle
            label="Notificar nuevos pagos recibidos"
            description="Recibe una alerta cuando un usuario realice un pago o lo marques como pagado."
            checked={prefs.notify_on_payment}
            onChange={(checked) => setPrefs({ ...prefs, notify_on_payment: checked })}
          />
          <NotificationPreferenceToggle
            label="Notificar nuevos gastos"
            description="Recibe una alerta cuando registres un nuevo gasto en la plataforma."
            checked={prefs.notify_on_expense}
            onChange={(checked) => setPrefs({ ...prefs, notify_on_expense: checked })}
          />
          <NotificationPreferenceToggle
            label="Incluir resumen mensual en recordatorios"
            description="Al enviar recordatorios de impago, incluye un resumen financiero del mes."
            checked={prefs.notify_monthly_summary}
            onChange={(checked) => setPrefs({ ...prefs, notify_monthly_summary: checked })}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || (!telegramConfigured && !discordConfigured)}
          className="px-6 py-2 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          {testing ? 'Enviando...' : 'Probar Notificación'}
        </button>
        <button
          onClick={handleSendReminders}
          disabled={sending || (!telegramConfigured && !discordConfigured)}
          className="px-6 py-2 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          {sending ? 'Enviando...' : 'Enviar Recordatorios'}
        </button>
      </div>
    </div>
  );
}


function BackupSection() {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setStatus(null);
    try {
      await downloadBackup();
      setStatus({ type: 'success', msg: 'Backup descargado correctamente' });
    } catch {
      setStatus({ type: 'error', msg: 'Error al descargar el backup' });
    } finally {
      setDownloading(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('⚠️ ¿Estás seguro de restaurar este backup? Los datos existentes podrían ser sobreescritos.')) {
      e.target.value = '';
      return;
    }

    setRestoring(true);
    setStatus(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await restoreBackup(data);
      const r = res.data.restored;
      setStatus({
        type: 'success',
        msg: `Restaurado: ${r.users || 0} usuarios, ${r.payments || 0} pagos, ${r.settings || 0} ajustes, ${r.expenses || 0} gastos`,
      });
    } catch {
      setStatus({ type: 'error', msg: 'Error al restaurar. Asegúrate de que el archivo es un backup válido de PlexDash.' });
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  return (
    <div className="bg-plex-dark rounded-lg p-6 max-w-2xl mt-8">
      <h2 className="text-xl font-semibold text-white mb-4">Backup & Restauración</h2>
      <p className="text-gray-400 text-sm mb-6">
        Descarga una copia de seguridad completa de tus datos (usuarios, pagos, gastos, ajustes) o restaura desde un archivo de backup anterior.
      </p>

      {status && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {status.msg}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="px-6 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange transition-colors disabled:opacity-50"
        >
          {downloading ? 'Descargando...' : '📥 Descargar Backup'}
        </button>

        <label className={`px-6 py-2 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors cursor-pointer ${restoring ? 'opacity-50 pointer-events-none' : ''}`}>
          {restoring ? 'Restaurando...' : '📤 Restaurar Backup'}
          <input
            type="file"
            accept=".json"
            onChange={handleRestore}
            className="hidden"
            disabled={restoring}
          />
        </label>
      </div>
    </div>
  );
}


function TautulliSection() {
  const [tautulliUrl, setTautulliUrl] = useState('');
  const [tautulliApiKey, setTautulliApiKey] = useState('');
  const [killMessage, setKillMessage] = useState('');
  const [warnMode, setWarnMode] = useState('always');
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/settings/tautulli', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setConfigured(data.configured);
          if (data.tautulli_url) setTautulliUrl(data.tautulli_url);
          if (data.kill_message) setKillMessage(data.kill_message);
          if (data.warn_mode) setWarnMode(data.warn_mode);
        }
      } catch { /* ignore */ }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const body: Record<string, string> = {};
      if (tautulliUrl) body.tautulli_url = tautulliUrl;
      if (tautulliApiKey) body.tautulli_api_key = tautulliApiKey;
      body.kill_message = killMessage;
      body.warn_mode = warnMode;
      await fetch('/api/settings/tautulli', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      setConfigured(true);
      setStatus({ type: 'success', msg: 'Configuración de Tautulli guardada' });
    } catch {
      setStatus({ type: 'error', msg: 'Error al guardar la configuración' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const res = await fetch('/api/settings/tautulli/test', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', msg: `✓ Conectado a ${data.server_name || 'Tautulli'}` });
      } else {
        setStatus({ type: 'error', msg: data.detail || 'No se pudo conectar a Tautulli' });
      }
    } catch {
      setStatus({ type: 'error', msg: 'Error al probar la conexión' });
    } finally {
      setTesting(false);
    }
  };

  const webhookUrl = `${window.location.origin}/api/tautulli/check/{plex_id}`;

  return (
    <div className="bg-plex-dark rounded-lg p-6 max-w-2xl mt-8">
      <h2 className="text-xl font-semibold text-white mb-2">Tautulli — Aviso de Pago</h2>
      <p className="text-gray-400 text-sm mb-6">
        Conecta tu servidor Tautulli para avisar a usuarios con pagos pendientes.
        La primera vez que un moroso intente ver algo, se cortará el stream con tu mensaje de aviso.
        Las reproducciones posteriores del mismo día se permiten normalmente.
      </p>

      {status && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {status.msg}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">URL de Tautulli</label>
            <input
              type="text"
              placeholder="http://192.168.1.x:8181"
              value={tautulliUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTautulliUrl(e.target.value)}
              className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">API Key</label>
            <input
              type="password"
              placeholder={configured ? '••••••••' : 'API Key de Tautulli'}
              value={tautulliApiKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTautulliApiKey(e.target.value)}
              className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none"
            />
          </div>
        </div>

        {/* Custom message */}
        <div>
          <label className="block text-gray-400 text-sm mb-1">Mensaje de aviso</label>
          <textarea
            rows={3}
            placeholder="Aviso del administrador de Plex: Hola {username}, tienes {months} mes(es) de donacion pendiente(s)..."
            value={killMessage}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setKillMessage(e.target.value)}
            className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-3 focus:border-plex-yellow focus:outline-none resize-none"
          />
          <p className="text-gray-500 text-xs mt-1">
            Variables disponibles: <code className="text-plex-yellow">{'{username}'}</code> (nombre del usuario), <code className="text-plex-yellow">{'{months}'}</code> (meses sin pagar). Dejalo vacio para usar el mensaje por defecto.
          </p>
        </div>

        {/* Warn mode */}
        <div>
          <label className="block text-gray-400 text-sm mb-2">Modo de aviso</label>
          <div className="space-y-2">
            {[
              { value: 'always', label: 'Siempre cortar', desc: 'Corta cada reproduccion mientras tenga deuda' },
              { value: 'once_per_day', label: 'Una vez al dia', desc: 'Corta solo la primera reproduccion del dia' },
              { value: 'disabled', label: 'Desactivado', desc: 'No corta nunca (solo monitorizacion)' },
            ].map((opt) => (
              <label key={opt.value} className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${warnMode === opt.value ? 'bg-plex-yellow/10 border-plex-yellow/50' : 'bg-plex-darker border-gray-700 hover:border-gray-600'}`}>
                <input
                  type="radio"
                  name="warnMode"
                  value={opt.value}
                  checked={warnMode === opt.value}
                  onChange={() => setWarnMode(opt.value)}
                  className="mt-0.5 mr-3 accent-yellow-500"
                />
                <div>
                  <span className="text-white text-sm font-medium">{opt.label}</span>
                  <p className="text-gray-500 text-xs">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {configured && (
          <div className="bg-plex-darker border border-gray-700 rounded-lg p-4 mt-4">
            <h3 className="text-white font-medium mb-2">📋 Configuración en Tautulli</h3>
            <p className="text-gray-400 text-sm mb-3">
              Para activar el bloqueo automático, configura un <strong className="text-white">Notification Agent</strong> en Tautulli:
            </p>
            <ol className="text-gray-400 text-sm space-y-2 list-decimal list-inside">
              <li>En Tautulli → Settings → Notification Agents → <strong className="text-white">Add a new notification agent</strong> → Script</li>
              <li>Trigger: <strong className="text-plex-yellow">Playback Start</strong></li>
              <li>Usa este endpoint para comprobar el estado del pago:</li>
            </ol>
            <div className="mt-2 bg-gray-900 rounded p-3">
              <code className="text-plex-yellow text-xs break-all">{webhookUrl}</code>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              PlexDash verificará el estado de pago y, si el usuario tiene deuda, Tautulli cortará el stream con un mensaje de aviso.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || !configured}
          className="px-6 py-2 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          {testing ? 'Probando...' : 'Probar Conexión'}
        </button>
      </div>
    </div>
  );
}
