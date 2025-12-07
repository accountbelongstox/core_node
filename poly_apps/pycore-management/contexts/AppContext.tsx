import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, Theme, AppSettings } from '../types';
import { getTranslation } from '../services/translations';

interface AppContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  t: (key: string) => string;
}

const defaultSettings: AppSettings = {
  language: 'en',
  theme: 'dark', // Default to Dark Mode
  notifications: true,
  refreshRate: 5,
};

const AppContext = createContext<AppContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
  t: (k) => k,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('pycore_settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('pycore_settings', JSON.stringify(settings));
    
    // Apply Theme
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (settings.theme === 'auto') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }
    } else {
      root.classList.add(settings.theme);
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const t = (key: string) => getTranslation(settings.language, key);

  return (
    <AppContext.Provider value={{ settings, updateSettings, t }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
