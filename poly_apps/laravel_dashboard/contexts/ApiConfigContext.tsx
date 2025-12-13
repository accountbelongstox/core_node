
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
}

interface ApiConfigContextType {
  config: ApiConfig;
  updateConfig: (newConfig: Partial<ApiConfig>) => void;
  resetConfig: () => void;
}

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.nexus-orbit.io',
  apiKey: import.meta.env.VITE_API_KEY || undefined
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
          apiKey: parsed.apiKey || DEFAULT_CONFIG.apiKey
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
    <ApiConfigContext.Provider value={{ config, updateConfig, resetConfig }}>
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

