
import React, { useState, useEffect } from 'react';
import { useApiConfig } from '../../contexts/ApiConfigContext';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { Settings as SettingsIcon, Save, RotateCcw, CheckCircle, AlertCircle, Globe, Key } from 'lucide-react';
import { commonClasses } from '../../styles/theme';

interface SettingsProps {
  lang?: Language;
}

const getOriginUrl = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:8000';
};

const Settings: React.FC<SettingsProps> = ({ lang = 'en' }) => {
  const { config, updateConfig, resetConfig } = useApiConfig();
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [port, setPort] = useState(config.port || 9000);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const t = TRANSLATIONS[lang].settings || {
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
    const t = TRANSLATIONS[lang].settings;
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
      const response = await fetch(`${testUrl}/api_info`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...(apiKey.trim() ? { 'X-API-Key': apiKey.trim() } : {})
        }
      });
      
      if (response.ok) {
        setTestStatus('success');
        setTimeout(() => setTestStatus('idle'), 3000);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setTestStatus('error');
      setTimeout(() => setTestStatus('idle'), 3000);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <SettingsIcon className="w-7 h-7 text-indigo-500" />
          {t.title}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure API endpoints and application settings
        </p>
      </div>

      {/* API Configuration Section */}
      <div className={`${commonClasses.card} p-6 mb-6`}>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-semibold">{t.api_config}</h2>
        </div>

        <div className="space-y-4">
          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
              {t.base_url}
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://43.163.112.77:9000"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Current origin: {getOriginUrl()}
            </p>
          </div>

          {/* Port */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
              API Port
            </label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value) || 9000)}
              placeholder="9000"
              min="1"
              max="65535"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Default: 9000 (Laravel backend port)
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
              {t.api_key} <span className="text-slate-400">(Optional)</span>
            </label>
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
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              API key will be sent in X-API-Key header
            </p>
          </div>

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
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
              title="Reset to current browser origin"
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

      {/* Current Configuration Display */}
      <div className={`${commonClasses.card} p-6`}>
        <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">
          Current Configuration
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Base URL:</span>
            <span className="font-mono text-slate-900 dark:text-white">{config.baseUrl}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">API Port:</span>
            <span className="font-mono text-slate-900 dark:text-white">{config.port || 9000}</span>
          </div>
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
  );
};

export default Settings;

