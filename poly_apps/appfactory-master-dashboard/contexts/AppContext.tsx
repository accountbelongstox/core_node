/**
 * Global Application Context
 * Integrates storage, i18n, theme, and user state management
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { storageService, UserInfo, AppSettings } from '../services/storageService';
import { i18nService, SupportedLanguage } from '../services/i18nService';
import { themeService, Theme } from '../services/themeService';

// Context State Interface
interface AppContextState {
  // Language
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  t: (key: string, params?: Record<string, string | number>) => string;

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // User
  user: UserInfo | null;
  setUser: (user: UserInfo | null) => void;
  isAuthenticated: boolean;
  login: (user: UserInfo, token: string) => void;
  logout: () => void;

  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Refresh trigger
  refreshKey: number;
  triggerRefresh: () => void;
}

// Create Context
const AppContext = createContext<AppContextState | undefined>(undefined);

// Provider Props
interface AppProviderProps {
  children: ReactNode;
}

/**
 * App Context Provider
 */
export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  // State
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const saved = storageService.getLanguage();
    return (saved as SupportedLanguage) || 'en';
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    return storageService.getTheme();
  });

  const [user, setUserState] = useState<UserInfo | null>(() => {
    return storageService.getUserInfo();
  });

  const [settings, setSettingsState] = useState<AppSettings>(() => {
    return storageService.getSettings();
  });

  const [refreshKey, setRefreshKey] = useState(0);

  // Initialize services on mount
  useEffect(() => {
    // Initialize i18n
    i18nService.setLanguage(language);

    // Initialize theme
    themeService.initializeTheme(theme);
  }, []);

  // Language handlers
  const setLanguage = useCallback((newLanguage: SupportedLanguage) => {
    setLanguageState(newLanguage);
    i18nService.setLanguage(newLanguage);
    storageService.setLanguage(newLanguage);

    // Update settings
    const newSettings = { ...settings, language: newLanguage };
    setSettingsState(newSettings);
    storageService.setSettings(newSettings);

    // Trigger refresh
    setRefreshKey(prev => prev + 1);
  }, [settings]);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    return i18nService.t(key, params);
  }, [language]); // Re-create when language changes

  // Theme handlers
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    themeService.setTheme(newTheme);
    storageService.setTheme(newTheme);

    // Update settings
    const newSettings = { ...settings, theme: newTheme };
    setSettingsState(newSettings);
    storageService.setSettings(newSettings);

    // Trigger refresh
    setRefreshKey(prev => prev + 1);
  }, [settings]);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [theme, setTheme]);

  // User handlers
  const setUser = useCallback((newUser: UserInfo | null) => {
    setUserState(newUser);
    if (newUser) {
      storageService.setUserInfo(newUser);
    } else {
      storageService.remove('app_user_info');
    }
  }, []);

  const login = useCallback((userInfo: UserInfo, token: string) => {
    setUserState(userInfo);
    storageService.setUserInfo(userInfo);
    storageService.setAuthToken(token);
  }, []);

  const logout = useCallback(() => {
    setUserState(null);
    storageService.clearUserData();
    // Optionally trigger refresh
    setRefreshKey(prev => prev + 1);
  }, []);

  // Settings handlers
  const updateSettings = useCallback((partialSettings: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...partialSettings };
    setSettingsState(newSettings);
    storageService.setSettings(newSettings);

    // Apply language if changed
    if (partialSettings.language && partialSettings.language !== language) {
      setLanguageState(partialSettings.language as SupportedLanguage);
      i18nService.setLanguage(partialSettings.language as SupportedLanguage);
    }

    // Apply theme if changed
    if (partialSettings.theme && partialSettings.theme !== theme) {
      setThemeState(partialSettings.theme);
      themeService.setTheme(partialSettings.theme);
    }

    // Trigger refresh to apply changes
    setRefreshKey(prev => prev + 1);
  }, [settings, language, theme]);

  // Refresh trigger
  const triggerRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // Context value
  const value: AppContextState = {
    language,
    setLanguage,
    t,
    theme,
    setTheme,
    toggleTheme,
    user,
    setUser,
    isAuthenticated: user !== null,
    login,
    logout,
    settings,
    updateSettings,
    refreshKey,
    triggerRefresh,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

/**
 * Hook to use App Context
 */
export const useApp = (): AppContextState => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

/**
 * Hook to use translation only
 */
export const useTranslation = () => {
  const { t, language } = useApp();
  return { t, language };
};

/**
 * Hook to use theme only
 */
export const useTheme = () => {
  const { theme, setTheme, toggleTheme } = useApp();
  return { theme, setTheme, toggleTheme };
};

/**
 * Hook to use auth only
 */
export const useAuth = () => {
  const { user, isAuthenticated, login, logout } = useApp();
  return { user, isAuthenticated, login, logout };
};
