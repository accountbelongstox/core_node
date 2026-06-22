
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  port?: number;
}

interface ApiConfigContextType {
  /** PERSISTED editable configuration (Settings form). NOT the live endpoint. */
  config: ApiConfig;
  /**
   * The base URL requests are ACTUALLY using right now — follows the
   * ApiManager's active endpoint (manual switch + auto-failover). Read this
   * for display/URL building; `config.baseUrl` is only the configured default.
   */
  liveBaseUrl: string;
  updateConfig: (newConfig: Partial<ApiConfig>) => void;
  resetConfig: () => void;
}

import { getDefaultBaseURL, DEFAULT_API_PORT } from '../config/constants';
import { apiManager, API_HEALTH_EVENT } from '../services/ApiManager';
import { buildApiUrl } from '../config/api-endpoints';

const getDefaultBaseUrl = (): string => {
  return getDefaultBaseURL();
};

// No environment variables: apiKey is only ever set via the Settings form
// (persisted in localStorage), never baked in from an env constant.
const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: getDefaultBaseUrl(),
  apiKey: undefined,
  port: DEFAULT_API_PORT
};

const STORAGE_KEY = 'dashboard_api_config';

const ApiConfigContext = createContext<ApiConfigContextType | undefined>(undefined);

export const ApiConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ApiConfig>(() => {
    // Load from localStorage on init
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          baseUrl: parsed.baseUrl || DEFAULT_CONFIG.baseUrl,
          apiKey: parsed.apiKey || DEFAULT_CONFIG.apiKey,
          port: parsed.port || DEFAULT_CONFIG.port
        };
      }
    } catch (error) {
      console.error('Failed to load API config from localStorage:', error);
    }
    return DEFAULT_CONFIG;
  });

  // Save to localStorage whenever config changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save API config to localStorage:', error);
    }
  }, [config]);

  // Live endpoint tracking: the context used to freeze the startup default,
  // which made any consumer display the WRONG base URL after a manual switch
  // or auto-failover. liveBaseUrl follows ApiManager (every health pass and
  // verified switch dispatches API_HEALTH_EVENT).
  const readLiveBaseUrl = (): string => {
    const ep = apiManager.getCurrentEndpoint();
    return ep ? buildApiUrl(ep) : DEFAULT_CONFIG.baseUrl;
  };
  const [liveBaseUrl, setLiveBaseUrl] = useState<string>(readLiveBaseUrl);
  useEffect(() => {
    const onHealth = () => setLiveBaseUrl(readLiveBaseUrl());
    window.addEventListener(API_HEALTH_EVENT, onHealth);
    return () => window.removeEventListener(API_HEALTH_EVENT, onHealth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateConfig = (newConfig: Partial<ApiConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...newConfig
    }));
  };

  const resetConfig = () => {
    setConfig(DEFAULT_CONFIG);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to remove API config from localStorage:', error);
    }
  };

  return (
    <ApiConfigContext.Provider value={{ config, liveBaseUrl, updateConfig, resetConfig }}>
      {children}
    </ApiConfigContext.Provider>
  );
};

export const useApiConfig = (): ApiConfigContextType => {
  const context = useContext(ApiConfigContext);
  if (!context) {
    throw new Error('useApiConfig must be used within ApiConfigProvider');
  }
  return context;
};

