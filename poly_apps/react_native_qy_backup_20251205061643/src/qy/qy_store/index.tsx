/**
 * QY App Store
 * Global state management with AsyncStorage persistence
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode, getTheme, Theme } from '@/common/theme';
import { AppSettings } from '@/qy/qy_types';
import { getCurrentLanguage, changeLanguage } from '@/common/i18n';

interface StoreState {
  theme: ThemeMode;
  themeData: Theme;
  settings: AppSettings | null;
  isInitialized: boolean;
}

interface StoreContextValue extends StoreState {
  setTheme: (mode: ThemeMode) => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  initialize: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

const STORAGE_KEYS = {
  THEME: '@qy_theme',
  SETTINGS: '@qy_settings',
};

const defaultSettings: AppSettings = {
  language: 'zh-CN',
  theme: {
    mode: 'light',
    accentColor: '#2196F3',
    eyeProtection: false,
  },
  pronunciation: {
    defaultEngine: 'us',
    speed: 1.0,
    phoneticFormat: 'kk',
    ttsEngine: 'google',
    volume: 80,
    autoPlay: {
      onWordClick: true,
      onLearning: true,
      onExample: false,
      onContinuous: true,
    },
  },
  learning: {
    dailyWordGoal: 20,
    dailyReviewGoal: 50,
    defaultMode: 'reading',
    readingSpeed: 3,
    readingInterval: 0,
    repeatCount: 1,
    instantReviewEnabled: true,
  },
  review: {
    algorithm: 'ebbinghaus',
    reminderTimes: ['08:00', '20:00'],
    allowEarlyReview: true,
    earlyReviewDays: 3,
    overdueHandling: 'accumulate',
    completionStandard: 80,
  },
  notifications: {
    dailyReminder: true,
    reviewReminder: true,
    achievementNotification: true,
    doNotDisturb: false,
  },
  dataSync: {
    autoSync: true,
    syncFrequency: 'realtime',
    wifiOnly: true,
  },
};

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [themeData, setThemeData] = useState<Theme>(getTheme('light'));
  const [settings, setSettingsState] = useState<AppSettings | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load persisted state
  const loadPersistedState = async () => {
    try {
      // Load theme
      const savedTheme = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
      if (savedTheme) {
        const themeMode = savedTheme as ThemeMode;
        setThemeState(themeMode);
        setThemeData(getTheme(themeMode));
      }

      // Load settings
      const savedSettings = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettingsState(parsed);
        
        // Apply language
        if (parsed.language) {
          await changeLanguage(parsed.language);
        }
      } else {
        setSettingsState(defaultSettings);
        await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
      }
    } catch (error) {
      console.error('Failed to load persisted state:', error);
      setSettingsState(defaultSettings);
    }
  };

  // Initialize store
  const initialize = async () => {
    await loadPersistedState();
    setIsInitialized(true);
  };

  // Set theme
  const setTheme = async (mode: ThemeMode) => {
    setThemeState(mode);
    setThemeData(getTheme(mode));
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, mode);
    
    // Update settings
    if (settings) {
      const updated = { ...settings, theme: { ...settings.theme, mode } };
      setSettingsState(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    }
  };

  // Update settings
  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings } as AppSettings;
    setSettingsState(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    
    // Apply language change if needed
    if (newSettings.language && newSettings.language !== settings?.language) {
      await changeLanguage(newSettings.language);
    }
  };

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, []);

  const value: StoreContextValue = {
    theme,
    themeData,
    settings,
    isInitialized,
    setTheme,
    updateSettings,
    initialize,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = (): StoreContextValue => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
};

