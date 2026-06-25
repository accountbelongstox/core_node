import React, { useState, useEffect } from 'react';
import { useApiConfig } from '../../contexts/ApiConfigContext';
import { useAppState } from '../../contexts/AppStateContext';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { Settings as SettingsIcon, Save, RotateCcw, CheckCircle, AlertCircle, Globe, Key, Shield, User, Server, Database, Code, Info, Mail, HardDrive, Clock, Lock, Bell, Palette, Languages, Upload, Eye, EyeOff, Trash2, Download, Plus, RefreshCw, Moon, Sun } from 'lucide-react';
import { commonClasses } from '../../styles/theme';
import { InlineSpinner, LoadingBlock, AlertBox, Field } from '../common';
import { useUser } from '../../hooks/useUser';
import { useUserRole } from '../../hooks/useUserRole';
import { api } from '../../core/api';
import { ServerConfig, EnvironmentInfo } from '../../core/api/modules/SystemConfigAPI';
import { getOriginUrl } from '../../config/constants';
import { apiManager, HealthCheckResult } from '../../services/ApiManager';
import { recheckApiEndpointsNow } from '../../services/ApiHealthRecheck';
import {
  ApiEndpoint, addCustomEndpoint, removeCustomEndpoint, isCustomEndpoint, buildApiUrl,
} from '../../config/api-endpoints';

interface SettingsProps {
  lang?: Language;
}

type SettingsTab = 'server' | 'user' | 'api' | 'other';

const Settings: React.FC<SettingsProps> = ({ lang: langProp }) => {
  const { lang, theme, setLang, setTheme } = useAppState();
  const { config, updateConfig, resetConfig } = useApiConfig();
  const { user } = useUser();
  const { isAdmin, isSuperAdmin, roleLevel, roleName } = useUserRole();

  const [activeTab, setActiveTab] = useState<SettingsTab>('api');
  
  // API Configuration State
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [port, setPort] = useState(config.port || 9000);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Endpoint switcher state (shared with the top API-Endpoints switcher via the
  // merged built-in + custom list in config/api-endpoints).
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>(() => apiManager.getAllEndpoints());
  const [currentEndpoint, setCurrentEndpoint] = useState<ApiEndpoint | null>(() => apiManager.getCurrentEndpoint());
  const [health, setHealth] = useState<Map<string, HealthCheckResult>>(new Map());
  const [probing, setProbing] = useState(false);
  // Add-endpoint form
  const [addProtocol, setAddProtocol] = useState<'http' | 'https'>('http');
  const [addUrl, setAddUrl] = useState('');
  const [addPort, setAddPort] = useState<string>('9000');
  const [addDesc, setAddDesc] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const reloadEndpoints = () => {
    setEndpoints(apiManager.getAllEndpoints());
    setCurrentEndpoint(apiManager.getCurrentEndpoint());
    const m = new Map<string, HealthCheckResult>();
    apiManager.getAllHealthResults().forEach(r => m.set(r.endpoint.id, r));
    setHealth(m);
  };

  useEffect(() => {
    reloadEndpoints();
    const onHealth = () => reloadEndpoints();
    window.addEventListener('api-health-initialized', onHealth);
    window.addEventListener('api-endpoints-changed', onHealth);
    return () => {
      window.removeEventListener('api-health-initialized', onHealth);
      window.removeEventListener('api-endpoints-changed', onHealth);
    };
  }, []);

  const [switchingEndpoint, setSwitchingEndpoint] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  /**
   * Probe-before-switch (same path as the top switcher): the target endpoint
   * is verified first; only a healthy one is persisted + applied (then the
   * page reloads). A dead target changes nothing — no more "switched to a
   * dead endpoint and the page hangs".
   */
  const handleSelectEndpoint = async (id: string) => {
    if (!id || id === currentEndpoint?.id || switchingEndpoint) return;
    setSwitchingEndpoint(true);
    setSwitchError(null);
    try {
      const res = await apiManager.switchEndpoint(id);
      if (res.ok) {
        window.location.reload();
      } else {
        const desc = res.endpoint?.description ?? id;
        setSwitchError(`${desc} is unreachable (${res.result?.error ?? 'health check failed'}). Kept the current endpoint.`);
        reloadEndpoints();
      }
    } finally {
      setSwitchingEndpoint(false);
    }
  };

  const handleRecheckEndpoints = async () => {
    if (probing) return;
    setProbing(true);
    try { await recheckApiEndpointsNow(); }
    finally { setProbing(false); reloadEndpoints(); }
  };

  const handleAddEndpoint = () => {
    setAddError(null);
    const res = addCustomEndpoint({
      url: addUrl,
      protocol: addProtocol,
      port: addPort.trim() ? Number(addPort) : undefined,
      description: addDesc,
    });
    if (!res.ok) { setAddError(res.error); return; }
    setAddUrl(''); setAddDesc(''); setAddError(null);
    window.dispatchEvent(new CustomEvent('api-endpoints-changed'));
    reloadEndpoints();
  };

  const handleRemoveEndpoint = (id: string) => {
    if (removeCustomEndpoint(id)) {
      window.dispatchEvent(new CustomEvent('api-endpoints-changed'));
      reloadEndpoints();
    }
  };

  // Server Configuration State
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [environmentInfo, setEnvironmentInfo] = useState<EnvironmentInfo | null>(null);
  const [serverConfigLoading, setServerConfigLoading] = useState(false);
  const [serverConfigError, setServerConfigError] = useState<string | null>(null);
  const [serverConfigForm, setServerConfigForm] = useState<Partial<ServerConfig>>({});
  const [serverSaveStatus, setServerSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // User Profile State
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [userProfileLoading, setUserProfileLoading] = useState(false);
  const [userProfileForm, setUserProfileForm] = useState<any>({});
  const [userPrefsForm, setUserPrefsForm] = useState<any>({});
  const [userSaveStatus, setUserSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  
  // Password Change State
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [passwordSaveStatus, setPasswordSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  // Avatar Upload State
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploadStatus, setAvatarUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  
  // Other Settings State
  // theme / setTheme come from useAppState() above (global app theme); a local
  // useState here shadowed them (duplicate declaration → build error) and was
  // disconnected from the real theme, so it is removed.
  const [language, setLanguage] = useState<string>('en');
  const [notifications, setNotifications] = useState({ email: true, push: false, sms: false });

  const currentLang = langProp || lang;
  const t = TRANSLATIONS[currentLang].settings || {
    title: 'Settings',
    api_config: 'API Configuration',
    base_url: 'Base URL',
    api_key: 'API Key',
    save: 'Save',
    reset: 'Reset to Default',
    test_connection: 'Test Connection',
    saved: 'Settings saved successfully',
    reset_success: 'Settings reset to default',
    test_success: 'Connection successful',
    test_error: 'Connection failed'
  };

  useEffect(() => {
    setBaseUrl(config.baseUrl);
    setApiKey(config.apiKey || '');
    setPort(config.port || 9000);
  }, [config]);

  // Load server configuration when server tab is active
  useEffect(() => {
    if (activeTab === 'server' && isAdmin && !serverConfig) {
      loadServerConfig();
    }
  }, [activeTab, isAdmin]);

  // Load user profile when user tab is active
  useEffect(() => {
    if (activeTab === 'user' && user && !userProfile) {
      loadUserProfile();
    }
  }, [activeTab, user]);

  const loadServerConfig = async () => {
    if (!isAdmin) return;
    
    setServerConfigLoading(true);
    setServerConfigError(null);
    
    try {
      const [configRes, envRes] = await Promise.all([
        api.systemConfig.getServerConfig(),
        api.systemConfig.getEnvironment()
      ]);

      if (configRes.success && configRes.data) {
        setServerConfig(configRes.data);
        setServerConfigForm({
          app: configRes.data.app
        });
      }

      if (envRes.success && envRes.data) {
        setEnvironmentInfo(envRes.data);
      }
    } catch (error: any) {
      setServerConfigError(error.message || 'Failed to load server configuration');
    } finally {
      setServerConfigLoading(false);
    }
  };

  const loadUserProfile = async () => {
    if (!user) return;
    
    setUserProfileLoading(true);
    
    try {
      const [profileRes, prefsRes] = await Promise.all([
        api.auth.getUserProfile(),
        api.auth.getUserPreferences()
      ]);

      if (profileRes.success && profileRes.data?.user) {
        setUserProfile(profileRes.data.user);
        setUserProfileForm({
          nickname: profileRes.data.user.nickname || '',
          name: profileRes.data.user.name || '',
          bio: profileRes.data.user.bio || '',
          location: profileRes.data.user.location || '',
        });
      }

      if (prefsRes.success && prefsRes.data) {
        setUserPreferences(prefsRes.data);
        setUserPrefsForm(prefsRes.data);
      }
    } catch (error: any) {
      console.error('Failed to load user profile:', error);
    } finally {
      setUserProfileLoading(false);
    }
  };

  const handleSaveServerConfig = async () => {
    if (!isSuperAdmin) {
      setServerSaveStatus('error');
      setTimeout(() => setServerSaveStatus('idle'), 2000);
      return;
    }

    setServerSaveStatus('saving');
    
    try {
      const response = await api.systemConfig.updateServerConfig(serverConfigForm);
      
      if (response.success) {
        setServerSaveStatus('success');
        await loadServerConfig();
        setTimeout(() => setServerSaveStatus('idle'), 2000);
      } else {
        throw new Error(response.error || 'Failed to update server configuration');
      }
    } catch (error: any) {
      setServerSaveStatus('error');
      setTimeout(() => setServerSaveStatus('idle'), 2000);
    }
  };

  const handleSaveUserProfile = async () => {
    setUserSaveStatus('saving');
    
    try {
      const [profileRes, prefsRes] = await Promise.all([
        api.auth.updateUserProfile(userProfileForm),
        api.auth.updateUserPreferences(userPrefsForm)
      ]);

      if (profileRes.success && prefsRes.success) {
        setUserSaveStatus('success');
        await loadUserProfile();
        setTimeout(() => setUserSaveStatus('idle'), 2000);
      } else {
        throw new Error('Failed to update user profile');
      }
    } catch (error: any) {
      setUserSaveStatus('error');
      setTimeout(() => setUserSaveStatus('idle'), 2000);
    }
  };

  const handleSave = () => {
    try {
      const hostname = baseUrl.trim().replace(/^https?:\/\//, '').replace(/:\d+$/, '');
      const protocol = baseUrl.trim().startsWith('https') ? 'https' : 'http';
      const finalUrl = `${protocol}://${hostname}:${port}`;

      updateConfig({
        baseUrl: finalUrl,
        apiKey: apiKey.trim() || undefined,
        port: port
      });
      setBaseUrl(finalUrl);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleReset = () => {
    if (confirm(t.messages?.confirm_reset || 'Are you sure you want to reset to default settings?')) {
      resetConfig();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleResetToOrigin = () => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const finalUrl = `${protocol}//${hostname}:${port}`;

    updateConfig({
      baseUrl: finalUrl,
      apiKey: config.apiKey,
      port: port
    });
    setBaseUrl(finalUrl);
    setSaveStatus('success');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    try {
      const testUrl = baseUrl.trim() || config.baseUrl;
      const oldBaseURL = api.systemConfig['baseURL'];

      api.systemConfig['baseURL'] = testUrl;
      if (apiKey.trim()) {
        api.systemConfig.setHeader('X-API-Key', apiKey.trim());
      }

      const response = await api.systemConfig.getApiInfo();

      api.systemConfig['baseURL'] = oldBaseURL;

      if (response.success) {
        setTestStatus('success');
        setTimeout(() => setTestStatus('idle'), 3000);
      } else {
        throw new Error(response.error || 'Connection failed');
      }
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setTestStatus('error');
      setTimeout(() => setTestStatus('idle'), 3000);
    }
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode; requiresAuth?: boolean; requiresAdmin?: boolean }> = [
    { id: 'api', label: 'API Configuration', icon: <Globe className="w-4 h-4" /> },
    { id: 'user', label: 'User Settings', icon: <User className="w-4 h-4" />, requiresAuth: true },
    { id: 'server', label: 'Server Settings', icon: <Server className="w-4 h-4" />, requiresAuth: true, requiresAdmin: true },
    { id: 'other', label: 'Other Settings', icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  const visibleTabs = tabs.filter(tab => {
    if (tab.requiresAuth && !user) return false;
    if (tab.requiresAdmin && !isAdmin) return false;
    return true;
  });

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <SettingsIcon className="w-7 h-7 text-indigo-500" />
          {t.title}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure application settings and preferences
        </p>
      </div>

      {/* User Role Info */}
      {user && (
        <div className={`${commonClasses.card} p-4 mb-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                {isSuperAdmin ? <Shield className="w-5 h-5 text-white" /> : <User className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{user.username}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {roleName}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Level: {roleLevel}
                {isAdmin && <span className="ml-2 text-indigo-500">• Admin</span>}
                {isSuperAdmin && <span className="ml-2 text-purple-500">• Super Admin</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'api' && (
          <div className="space-y-6">
            {/* Active Endpoint — dropdown switcher, consistent with the top
                "API Endpoints" switcher. Built-in + custom endpoints are merged
                (deduped) and shared with the header switcher. */}
            <div className={`${commonClasses.card} p-6`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-indigo-500" />
                  <h2 className="text-lg font-semibold">API Endpoint</h2>
                </div>
                <button
                  onClick={handleRecheckEndpoints}
                  disabled={probing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50 transition-colors"
                  title="Re-detect: checks the current endpoint first; sweeps all only if it is down"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
                  Re-detect
                </button>
              </div>

              {/* Dropdown of all endpoints (built-in + custom) */}
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                Active endpoint
              </label>
              <select
                value={currentEndpoint?.id || ''}
                onChange={(e) => handleSelectEndpoint(e.target.value)}
                disabled={switchingEndpoint}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-60"
              >
                {endpoints.map((ep) => {
                  const h = health.get(ep.id);
                  const dot = h ? (h.isHealthy ? '🟢' : '🔴') : '⚪';
                  const tag = isCustomEndpoint(ep.id) ? ' [custom]' : '';
                  return (
                    <option key={ep.id} value={ep.id}>
                      {dot} {ep.description} — {ep.protocol}://{ep.url}{ep.port ? `:${ep.port}` : ''}{tag}
                    </option>
                  );
                })}
              </select>
              {switchingEndpoint && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Testing endpoint before switching…
                </p>
              )}
              {switchError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {switchError}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Endpoints are health-checked before switching; an unreachable endpoint is never applied. Current origin: {getOriginUrl()}
              </p>

              {/* Custom endpoints list (removable) */}
              {endpoints.some(ep => isCustomEndpoint(ep.id)) && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Your endpoints</h3>
                  <div className="space-y-1.5">
                    {endpoints.filter(ep => isCustomEndpoint(ep.id)).map((ep) => (
                      <div key={ep.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 dark:text-white truncate">{ep.description}</div>
                          <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                            {ep.protocol}://{ep.url}{ep.port ? `:${ep.port}` : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveEndpoint(ep.id)}
                          className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Remove this endpoint"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add a new endpoint (saved to localStorage; no duplicates) */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Add endpoint</h3>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Protocol</label>
                    <select
                      value={addProtocol}
                      onChange={(e) => setAddProtocol(e.target.value as 'http' | 'https')}
                      className="px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                    >
                      <option value="http">http</option>
                      <option value="https">https</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-[11px] text-slate-500 mb-1">Host / IP</label>
                    <input
                      type="text"
                      value={addUrl}
                      onChange={(e) => setAddUrl(e.target.value)}
                      placeholder="192.168.50.10 or api.example.com"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-[11px] text-slate-500 mb-1">Port</label>
                    <input
                      type="number"
                      value={addPort}
                      onChange={(e) => setAddPort(e.target.value)}
                      placeholder="9000"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[11px] text-slate-500 mb-1">Label (optional)</label>
                    <input
                      type="text"
                      value={addDesc}
                      onChange={(e) => setAddDesc(e.target.value)}
                      placeholder="My server"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                  <button
                    onClick={handleAddEndpoint}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
                {addError && (
                  <div className="mt-2 flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5" /> {addError}
                  </div>
                )}
              </div>
            </div>

            {/* API Configuration Section (advanced / manual override) */}
            <div className={`${commonClasses.card} p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-semibold">{t.api_config}</h2>
                <span className="text-xs text-slate-400">(manual override)</span>
              </div>

              <div className="space-y-4">
                {/* Base URL */}
                <Field label={t.base_url} hint={`Current origin: ${getOriginUrl()}`}>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://43.163.112.77:9000"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </Field>

                {/* Port */}
                <Field label="API Port">
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value) || 9000)}
                    placeholder="9000"
                    min="1"
                    max="65535"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </Field>

                {/* API Key */}
                <Field label={<>{t.api_key} <span className="text-slate-400">(Optional)</span></>}>
                  <div className="relative">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter API key (optional)"
                      className="w-full px-4 py-2 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                    <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </Field>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {t.save}
                  </button>
                  <button
                    onClick={handleTestConnection}
                    disabled={testStatus === 'testing'}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    {testStatus === 'testing' ? (
                      <>
                        <InlineSpinner size={16} />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Globe className="w-4 h-4" />
                        {t.test_connection}
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleResetToOrigin}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    Reset to Origin
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t.reset}
                  </button>
                </div>

                {/* Status Messages */}
                {saveStatus === 'success' && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    {t.saved}
                  </div>
                )}
                {testStatus === 'success' && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    {t.test_success}
                  </div>
                )}
                {testStatus === 'error' && (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {t.test_error}
                  </div>
                )}
              </div>
            </div>

            {/* Current Configuration Display — LIVE values. Base URL/port come
                from the ApiManager's active endpoint (kept fresh via the
                api-health-initialized listener), NOT from the frozen startup
                config: the old display showed the .env default even after the
                switcher had moved every request to another endpoint. */}
            <div className={`${commonClasses.card} p-6`}>
              <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">
                Current Configuration
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Base URL (live):</span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {currentEndpoint ? buildApiUrl(currentEndpoint) : config.baseUrl}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">API Port:</span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {currentEndpoint?.port ?? config.port ?? 9000}
                  </span>
                </div>
                {currentEndpoint && config.baseUrl !== buildApiUrl(currentEndpoint) && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Configured default:</span>
                    <span className="font-mono text-slate-400 dark:text-slate-500">{config.baseUrl}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Browser Origin:</span>
                  <span className="font-mono text-slate-900 dark:text-white">{getOriginUrl()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">API Key:</span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {config.apiKey ? '••••••••' : 'Not set'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'server' && (
          <div className="space-y-6">
            {!isAdmin ? (
              <div className={`${commonClasses.card} p-6 text-center`}>
                <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                  Server settings require administrator access. Please login with an admin account.
                </p>
              </div>
            ) : serverConfigLoading ? (
              <div className={`${commonClasses.card} p-6`}>
                <LoadingBlock label="Loading server configuration..." />
              </div>
            ) : serverConfigError ? (
              <div className={`${commonClasses.card} p-6`}>
                <AlertBox variant="error">{serverConfigError}</AlertBox>
                <button
                  onClick={loadServerConfig}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  Retry
                </button>
              </div>
            ) : serverConfig ? (
              <>
                {/* Server Configuration Form */}
                <div className={`${commonClasses.card} p-6`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Server className="w-5 h-5 text-indigo-500" />
                      <h2 className="text-lg font-semibold">Server Configuration</h2>
                    </div>
                    {isSuperAdmin && (
                      <button
                        onClick={handleSaveServerConfig}
                        disabled={serverSaveStatus === 'saving'}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                      >
                        {serverSaveStatus === 'saving' ? (
                          <>
                            <InlineSpinner size={16} />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save Changes
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {serverSaveStatus === 'success' && (
                    <div className="mb-4 flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Configuration saved successfully
                    </div>
                  )}

                  {serverSaveStatus === 'error' && (
                    <div className="mb-4 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      Failed to save configuration
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* App Configuration */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Code className="w-4 h-4" />
                        Application Settings
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="App Name">
                          <input
                            type="text"
                            value={serverConfigForm.app?.name || serverConfig.app.name}
                            onChange={(e) => setServerConfigForm({
                              ...serverConfigForm,
                              app: { ...serverConfigForm.app, name: e.target.value } as any
                            })}
                            disabled={!isSuperAdmin}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </Field>
                        <Field label="Timezone">
                          <input
                            type="text"
                            value={serverConfigForm.app?.timezone || serverConfig.app.timezone}
                            onChange={(e) => setServerConfigForm({
                              ...serverConfigForm,
                              app: { ...serverConfigForm.app, timezone: e.target.value } as any
                            })}
                            disabled={!isSuperAdmin}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </Field>
                        <Field label="Locale">
                          <input
                            type="text"
                            value={serverConfigForm.app?.locale || serverConfig.app.locale}
                            onChange={(e) => setServerConfigForm({
                              ...serverConfigForm,
                              app: { ...serverConfigForm.app, locale: e.target.value } as any
                            })}
                            disabled={!isSuperAdmin}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </Field>
                        <Field label="App URL">
                          <input
                            type="url"
                            value={serverConfigForm.app?.url || serverConfig.app.url}
                            onChange={(e) => setServerConfigForm({
                              ...serverConfigForm,
                              app: { ...serverConfigForm.app, url: e.target.value } as any
                            })}
                            disabled={!isSuperAdmin}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </Field>
                      </div>
                    </div>

                    {/* Read-only Information */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        System Information
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Environment:</span>
                          <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.app.env}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Debug Mode:</span>
                          <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.app.debug ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">PHP Version:</span>
                          <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.server.php_version}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Laravel Version:</span>
                          <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.server.laravel_version}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Database:</span>
                          <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.database.default}</span>
                        </div>
                      </div>
                    </div>

                    {/* Environment Info */}
                    {environmentInfo && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Database className="w-4 h-4" />
                          Environment Details
                        </h3>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-2 text-sm">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Memory Limit:</span>
                              <span className="ml-2 font-mono text-slate-900 dark:text-white">{environmentInfo.php.memory_limit}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Max Execution Time:</span>
                              <span className="ml-2 font-mono text-slate-900 dark:text-white">{environmentInfo.php.max_execution_time}s</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Upload Max Filesize:</span>
                              <span className="ml-2 font-mono text-slate-900 dark:text-white">{environmentInfo.php.upload_max_filesize}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Post Max Size:</span>
                              <span className="ml-2 font-mono text-slate-900 dark:text-white">{environmentInfo.php.post_max_size}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Paths Information */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        System Paths
                      </h3>
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-2 text-sm">
                        {Object.entries(serverConfig.paths).map(([key, path]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span className="font-mono text-slate-900 dark:text-white text-xs">{path}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Database Connections */}
                    {serverConfig.database && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Database className="w-4 h-4" />
                          Database Configuration
                        </h3>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-3 text-sm">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Default Connection:</span>
                            <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.database.default}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Available Connections:</span>
                            <div className="mt-2 space-y-1">
                              {Object.entries(serverConfig.database.connections || {}).map(([name, conn]: [string, any]) => (
                                <div key={name} className="flex items-center gap-2 text-xs">
                                  <span className="font-mono text-slate-600 dark:text-slate-400">{name}:</span>
                                  <span className="text-slate-500 dark:text-slate-400">{conn.driver || 'unknown'}</span>
                                  {conn.database && <span className="text-slate-400 dark:text-slate-500">({conn.database})</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cache Configuration */}
                    {serverConfig.cache && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <HardDrive className="w-4 h-4" />
                          Cache Configuration
                        </h3>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 text-sm">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Default Store:</span>
                            <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.cache.default}</span>
                          </div>
                          <div className="mt-2">
                            <span className="text-slate-500 dark:text-slate-400">Available Stores:</span>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {Object.keys(serverConfig.cache.stores || {}).map((name) => (
                                <span key={name} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Session Configuration */}
                    {serverConfig.session && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Session Configuration
                        </h3>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Driver:</span>
                            <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.session.driver}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Lifetime:</span>
                            <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.session.lifetime} minutes</span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Encrypt:</span>
                            <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.session.encrypt ? 'Yes' : 'No'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Expire on Close:</span>
                            <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.session.expire_on_close ? 'Yes' : 'No'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Queue Configuration */}
                    {serverConfig.queue && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <HardDrive className="w-4 h-4" />
                          Queue Configuration
                        </h3>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 text-sm">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Default Connection:</span>
                            <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.queue.default}</span>
                          </div>
                          <div className="mt-2">
                            <span className="text-slate-500 dark:text-slate-400">Available Connections:</span>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {Object.keys(serverConfig.queue.connections || {}).map((name) => (
                                <span key={name} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Mail Configuration */}
                    {serverConfig.mail && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Mail Configuration
                        </h3>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 text-sm">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Default Mailer:</span>
                            <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.mail.default}</span>
                          </div>
                          <div className="mt-2">
                            <span className="text-slate-500 dark:text-slate-400">Available Mailers:</span>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {Object.entries(serverConfig.mail.mailers || {}).map(([name, mailer]: [string, any]) => (
                                <span key={name} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                                  {name} <span className="text-slate-400">({mailer.transport})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sanctum Configuration */}
                    {serverConfig.sanctum && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          Sanctum Configuration
                        </h3>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Token Expiration:</span>
                            <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.sanctum.expiration} minutes</span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Token Prefix:</span>
                            <span className="ml-2 font-mono text-slate-900 dark:text-white">{serverConfig.sanctum.token_prefix || 'None'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {activeTab === 'user' && (
          <div className="space-y-6">
            {!user ? (
              <div className={`${commonClasses.card} p-6 text-center`}>
                <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                  Please login to view and edit your profile settings.
                </p>
              </div>
            ) : userProfileLoading ? (
              <div className={`${commonClasses.card} p-6`}>
                <LoadingBlock label="Loading user profile..." />
              </div>
            ) : userProfile ? (
              <>
                {/* User Profile Form */}
                <div className={`${commonClasses.card} p-6`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-indigo-500" />
                      <h2 className="text-lg font-semibold">User Profile</h2>
                    </div>
                    <button
                      onClick={handleSaveUserProfile}
                      disabled={userSaveStatus === 'saving'}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      {userSaveStatus === 'saving' ? (
                        <>
                          <InlineSpinner size={16} />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>

                  {userSaveStatus === 'success' && (
                    <div className="mb-4 flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Profile updated successfully
                    </div>
                  )}

                  {userSaveStatus === 'error' && (
                    <div className="mb-4 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      Failed to update profile
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Username" hint="Username cannot be changed">
                        <input
                          type="text"
                          value={userProfile.username || ''}
                          disabled
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                        />
                      </Field>
                      <Field label="Email">
                        <input
                          type="email"
                          value={userProfile.email || ''}
                          disabled
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                        />
                      </Field>
                      <Field label="Nickname">
                        <input
                          type="text"
                          value={userProfileForm.nickname || ''}
                          onChange={(e) => setUserProfileForm({ ...userProfileForm, nickname: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </Field>
                      <Field label="Full Name">
                        <input
                          type="text"
                          value={userProfileForm.name || ''}
                          onChange={(e) => setUserProfileForm({ ...userProfileForm, name: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </Field>
                      <Field label="Bio" className="col-span-2">
                        <textarea
                          value={userProfileForm.bio || ''}
                          onChange={(e) => setUserProfileForm({ ...userProfileForm, bio: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </Field>
                      <Field label="Location">
                        <input
                          type="text"
                          value={userProfileForm.location || ''}
                          onChange={(e) => setUserProfileForm({ ...userProfileForm, location: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                {/* User Preferences */}
                {userPreferences && (
                  <div className={`${commonClasses.card} p-6`}>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <SettingsIcon className="w-5 h-5 text-indigo-500" />
                      User Preferences
                    </h2>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Theme">
                          <select
                            value={userPrefsForm.theme || 'dark'}
                            onChange={(e) => setUserPrefsForm({ ...userPrefsForm, theme: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                          >
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                          </select>
                        </Field>
                        <Field label="Language">
                          <input
                            type="text"
                            value={userPrefsForm.language || 'en'}
                            onChange={(e) => setUserPrefsForm({ ...userPrefsForm, language: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                          />
                        </Field>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {activeTab === 'other' && (
          <div className="space-y-6">
            {/* Appearance & Language */}
            <div className={`${commonClasses.card} p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <Palette className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-semibold">Appearance &amp; Language</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Language */}
                <Field
                  label={<span className="flex items-center gap-1.5"><Languages className="w-4 h-4" /> Language</span>}
                  hint="Applies across the dashboard UI."
                >
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value as Language)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="en">English</option>
                    <option value="zh">中文 (Chinese)</option>
                  </select>
                </Field>

                {/* Theme */}
                <Field
                  label={<span className="flex items-center gap-1.5">{theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} Theme</span>}
                  hint="Light or dark color scheme."
                >
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* Notifications (local preference) */}
            <div className={`${commonClasses.card} p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-semibold">Notifications</h2>
              </div>
              <div className="space-y-2">
                {([['email', 'Email notifications'], ['push', 'Push notifications'], ['sms', 'SMS notifications']] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
                    <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                    <input
                      type="checkbox"
                      checked={(notifications as any)[key]}
                      onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })}
                      className="w-4 h-4 accent-indigo-600"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
