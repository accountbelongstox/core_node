/**
 * Global Application Context
 * Integrates storage, i18n, theme, and user state management
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { storageService, UserInfo, AppSettings, STORAGE_KEYS } from '../services/storageService';
import { i18nService, SupportedLanguage } from '../services/i18nService';
import { themeService, Theme } from '../services/themeService';
import { modelService } from '../services/modelService';
import { 
  MOCK_PROMOTION_TRACKS, 
  MOCK_APP_RELEASES, 
  MOCK_PROMOTERS, 
  MOCK_PROMOTION_RECORDS, 
  MOCK_CS,
  MOCK_APPS,
  MOCK_TECH,
  MOCK_APP_REQUESTS,
  MOCK_CS_APP_REVENUE,
  MOCK_DAILY_STATS,
  MOCK_NOTIFICATIONS,
  MOCK_BUGS,
  MOCK_BUILDS,
  MOCK_CHAT_SESSIONS,
  MOCK_CHAT_MESSAGES,
  MOCK_SCRIPT_TEMPLATES,
  MOCK_PAYMENT_VERIFICATION_REQUESTS,
} from '../constants';

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
    return (saved as SupportedLanguage) || 'zh';
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

  // Initialize services on mount and when language/theme changes
  useEffect(() => {
    // Initialize i18n
    i18nService.setLanguage(language);

    // Initialize theme
    themeService.initializeTheme(theme);

    // Initialize all modelService data from central data source (constants.ts)
    // All data should be accessed through modelService, not directly from constants
    if (!modelService.getApps() || modelService.getApps()?.length === 0) {
      modelService.setApps(MOCK_APPS);
    }
    // Always initialize with centralized MOCK_CS to ensure Chinese names are used
    // This ensures we always use the latest data from constants.ts
    const currentCSTeam = modelService.getCSTeam() || [];
    if (currentCSTeam.length === 0 || currentCSTeam.length !== MOCK_CS.length) {
      // Initialize or reset to centralized data
      modelService.setCSTeam(MOCK_CS);
    } else {
      // Update names from centralized data to ensure Chinese names
      const updatedCSTeam = currentCSTeam.map(cs => {
        const mockCS = MOCK_CS.find(m => m.id === cs.id);
        return mockCS ? { ...cs, name: mockCS.name } : cs;
      });
      modelService.setCSTeam(updatedCSTeam);
    }
    if (!modelService.getTechTeam() || modelService.getTechTeam()?.length === 0) {
      modelService.setTechTeam(MOCK_TECH);
    }
    if (!modelService.getPromotionTracks() || modelService.getPromotionTracks()?.length === 0) {
      modelService.setPromotionTracks(MOCK_PROMOTION_TRACKS);
    }
    if (!modelService.getAppReleases() || modelService.getAppReleases()?.length === 0) {
      modelService.setAppReleases(MOCK_APP_RELEASES);
    }
    if (!modelService.getPromoters() || modelService.getPromoters()?.length === 0) {
      modelService.setPromoters(MOCK_PROMOTERS);
    }
    if (!modelService.getPromotionRecords() || modelService.getPromotionRecords()?.length === 0) {
      modelService.setPromotionRecords(MOCK_PROMOTION_RECORDS);
    }
    if (!modelService.getAppRequests() || modelService.getAppRequests()?.length === 0) {
      modelService.setAppRequests(MOCK_APP_REQUESTS);
    }
    if (!modelService.getCSAppRevenue() || modelService.getCSAppRevenue()?.length === 0) {
      modelService.setCSAppRevenue(MOCK_CS_APP_REVENUE);
    }
    if (!modelService.getDailyStats() || modelService.getDailyStats()?.length === 0) {
      modelService.setDailyStats(MOCK_DAILY_STATS);
    }
    if (!modelService.getNotifications() || modelService.getNotifications()?.length === 0) {
      modelService.setNotifications(MOCK_NOTIFICATIONS);
    }
    if (!modelService.getBugs() || modelService.getBugs()?.length === 0) {
      modelService.setBugs(MOCK_BUGS);
    }
    if (!modelService.getBuilds() || modelService.getBuilds()?.length === 0) {
      modelService.setBuilds(MOCK_BUILDS);
    }
    // Always refresh chat sessions from MOCK data to ensure appId and appName are present
    // Force sync with MOCK data to ensure all sessions have appId and appName
    const currentSessions = modelService.getChatSessions() || [];
    const updatedSessions = MOCK_CHAT_SESSIONS.map(mockSession => {
      const existingSession = currentSessions.find(s => s.id === mockSession.id);
      if (existingSession) {
        // Merge existing session data with mock data, prioritizing mock appId and appName
        return {
          ...existingSession,
          appId: mockSession.appId || existingSession.appId,
          appName: mockSession.appName || existingSession.appName,
          // Preserve other fields from existing session
          lastMessage: existingSession.lastMessage || mockSession.lastMessage,
          lastMessageTime: existingSession.lastMessageTime || mockSession.lastMessageTime,
          unreadCount: existingSession.unreadCount !== undefined ? existingSession.unreadCount : mockSession.unreadCount,
          status: existingSession.status || mockSession.status,
        };
      }
      // If session doesn't exist, use mock data directly
      return mockSession;
    });
    // Always set sessions to ensure consistency
    modelService.setChatSessions(updatedSessions);
    if (!modelService.getChatMessages() || modelService.getChatMessages()?.length === 0) {
      modelService.setChatMessages(MOCK_CHAT_MESSAGES);
    }
    if (!modelService.getScriptTemplates() || modelService.getScriptTemplates()?.length === 0) {
      modelService.setScriptTemplates(MOCK_SCRIPT_TEMPLATES);
    }
    if (!modelService.getPaymentVerificationRequests() || modelService.getPaymentVerificationRequests()?.length === 0) {
      modelService.setPaymentVerificationRequests(MOCK_PAYMENT_VERIFICATION_REQUESTS);
    }
  }, [language, theme]);

  // Listen to storage changes for immediate updates
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.LANGUAGE && e.newValue) {
        const newLang = JSON.parse(e.newValue) as SupportedLanguage;
        if (newLang !== language) {
          setLanguageState(newLang);
          i18nService.setLanguage(newLang);
          setRefreshKey(prev => prev + 1);
        }
      }
      if (e.key === STORAGE_KEYS.THEME && e.newValue) {
        const newTheme = JSON.parse(e.newValue) as Theme;
        if (newTheme !== theme) {
          setThemeState(newTheme);
          themeService.setTheme(newTheme);
          setRefreshKey(prev => prev + 1);
        }
      }
      if (e.key === STORAGE_KEYS.SETTINGS && e.newValue) {
        const newSettings = JSON.parse(e.newValue) as AppSettings;
        setSettingsState(newSettings);
        setRefreshKey(prev => prev + 1);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [language, theme]);

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
