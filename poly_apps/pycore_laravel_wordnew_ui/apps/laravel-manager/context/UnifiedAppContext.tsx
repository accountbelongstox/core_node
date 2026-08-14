/**
 * Unified App Context
 *
 * Integrates all application state:
 * - App State (theme, language, view)
 * - UnifiedUser State (UnifiedUser, auth, preferences)
 * - Storage Management (centralized storage)
 * - Auto Refresh (settings changes trigger page reload)
 *
 * Design Principles:
 * 1. Single Source of Truth
 * 2. Auto Persistence
 * 3. Type Safe
 * 4. Immediate Effect
 */

import React, { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { ViewType, Language, Theme } from '../uiTypes';
import { UnifiedUser, UserPreferences } from '../types';
import { StorageManager } from '../../../core/persistence';
import { LaravelManagerStorageKeys as StorageKeys } from '../persistence/LaravelManagerStorageKeys';
import {
  readViewFromHash,
  writeViewToHash,
  bindHashListener
} from '../routing/viewRoute';
import { userModel } from '../models';
import { getAuthErrorMessage } from '../utils/authErrors';
import { useShell } from '../../../shell/ShellContext';
import { UnifiedAppContext } from './unifiedAppContext.core';
import type { UnifiedAppContextType, UnifiedAppState } from './unifiedAppContext.core';

/**
 * Default State
 */
const DEFAULT_STATE: UnifiedAppState = {
  activeView: ViewType.MEDIA_BROWSER,
  UnifiedUser: null,
  isLoggedIn: false,
  preferences: {
    theme: 'dark',
    language: 'en',
    favorites: [],
    recentTools: []
  },
  loading: false,
  error: null
};

/**
 * Load State from Storage
 */
const loadStateFromStorage = (): UnifiedAppState => {
  try {
    const saved = StorageManager.get<Partial<UnifiedAppState>>(StorageKeys.APP_STATE, {});
    const savedUser = StorageManager.get<UnifiedUser | null>(StorageKeys.USER, null);
    const savedPreferences = StorageManager.get<UserPreferences>(StorageKeys.SETTINGS, DEFAULT_STATE.preferences);

    // URL hash WINS over storage on first paint so deep-links / bookmarks
    // such as `…/#/ai-tools` open the right view even when localStorage
    // remembers something else. Unknown / absent hash falls through to the
    // saved view, then the default.
    const fromUrl = readViewFromHash();
    return {
      activeView: fromUrl ?? saved.activeView ?? DEFAULT_STATE.activeView,
      UnifiedUser: savedUser,
      isLoggedIn: !!savedUser,
      preferences: savedPreferences,
      loading: false,
      error: null
    };
  } catch (error) {
    console.error('[UnifiedAppContext] Failed to load state:', error);
    return DEFAULT_STATE;
  }
};

/**
 * Save State to Storage
 */
const saveStateToStorage = (state: UnifiedAppState): void => {
  try {
    StorageManager.set(StorageKeys.APP_STATE, {
      activeView: state.activeView,
    });

    if (state.UnifiedUser) {
      StorageManager.set(StorageKeys.USER, state.UnifiedUser);
    } else {
      StorageManager.remove(StorageKeys.USER);
    }

    StorageManager.set(StorageKeys.SETTINGS, state.preferences);

    console.log('[UnifiedAppContext] State saved');
  } catch (error) {
    console.error('[UnifiedAppContext] Failed to save state:', error);
  }
};

/**
 * Provider Props
 */
interface UnifiedAppProviderProps {
  children: ReactNode;
}

/**
 * Unified App Provider
 */
export const UnifiedAppProvider: React.FC<UnifiedAppProviderProps> = ({ children }) => {
  const { dark, lang: shellLanguage, setDark, setLang: setShellLanguage } = useShell();
  const language: Language = shellLanguage === 'zh' ? 'zh' : 'en';
  const theme: Theme = dark ? 'dark' : 'light';
  const [state, setState] = useState<UnifiedAppState>(() => {
    const loadedState = loadStateFromStorage();
    console.log('[UnifiedAppContext] Initial state loaded:', loadedState);
    return loadedState;
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const storedUser = userModel.getUser();
    const restore = async (): Promise<void> => {
      let restoredUser = storedUser;
      if (storedUser && !stateRef.current.UnifiedUser) {
        setState(prev => ({ ...prev, UnifiedUser: storedUser, isLoggedIn: true }));
      }
      if (!userModel.hasStoredToken()) return;
      if (storedUser) {
        restoredUser = await userModel.refreshProfile();
      } else {
        const restored = await userModel.bootstrapLoopbackSession();
        restoredUser = restored ? userModel.getUser() : null;
      }
      if (restoredUser) {
        setState(prev => ({ ...prev, UnifiedUser: restoredUser, isLoggedIn: true }));
      }
    };
    void restore();
  }, []);

  // Auto-save state to storage
  useEffect(() => {
    saveStateToStorage(state);
  }, [state]);

  // ── Routing: activeView ⇄ URL hash ─────────────────────────────────
  // Every `setActiveView` call (sidebar click, deep nav, programmatic) flows
  // through this single context, so wiring the URL here means every route
  // change reflects in the address bar automatically — no caller has to
  // know about routing. The hash form (`#/ai-tools`) avoids depending on a
  // Laravel rewrite for deep links. Both sides early-return on equality so
  // there's no state↔URL feedback loop.
  useEffect(() => {
    writeViewToHash(state.activeView);
  }, [state.activeView]);

  useEffect(() => {
    return bindHashListener((next) => {
      setState(prev => (prev.activeView === next ? prev : { ...prev, activeView: next }));
    });
  }, []);

  // Set active view
  const setActiveView = useCallback((view: ViewType) => {
    setState(prev => ({ ...prev, activeView: view }));
    console.log('[UnifiedAppContext] Active view changed to:', view);
  }, []);

  // Set language with optional reload
  const setLang = useCallback((lang: Language, reload = false) => {
    setShellLanguage(lang);
    console.log('[UnifiedAppContext] Language changed to:', lang);

    if (reload) {
      setTimeout(() => {
        console.log('[UnifiedAppContext] Reloading page due to language change');
        window.location.reload();
      }, 300);
    }
  }, [setShellLanguage]);

  // Set theme with optional reload
  const setTheme = useCallback((theme: Theme, reload = false) => {
    setDark(theme === 'dark');
    console.log('[UnifiedAppContext] Theme changed to:', theme);

    if (reload) {
      setTimeout(() => {
        console.log('[UnifiedAppContext] Reloading page due to theme change');
        window.location.reload();
      }, 300);
    }
  }, [setDark]);

  // Toggle theme
  const toggleTheme = useCallback((reload = false) => {
    setDark(!dark);

    if (reload) {
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }, [dark, setDark]);

  // Toggle language
  const toggleLang = useCallback((reload = false) => {
    setShellLanguage(language === 'en' ? 'zh' : 'en');

    if (reload) {
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }, [language, setShellLanguage]);

  // Login
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      await userModel.login(username, password);
      const UnifiedUser = userModel.getUser();
      const preferences = userModel.getPreferences();

      setState(prev => ({
        ...prev,
        UnifiedUser,
        isLoggedIn: true,
        preferences,
        loading: false
      }));

      console.log('[UnifiedAppContext] Login successful:', UnifiedUser?.username);
      return true;
    } catch (err: any) {
      const errorCode = err.errorCode as string | undefined;
      const displayMessage = getAuthErrorMessage(errorCode, err.message || 'Login failed', language);
      setState(prev => ({ ...prev, loading: false, error: displayMessage }));
      console.error('[UnifiedAppContext] Login failed:', displayMessage);
      return false;
    }
  }, [language]);

  // Register
  const register = useCallback(async (
    username: string,
    password: string,
    email?: string,
    nickname?: string,
    registrationCode?: string
  ): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      await userModel.register(username, password, email, nickname, registrationCode);
      const UnifiedUser = userModel.getUser();
      const preferences = userModel.getPreferences();

      setState(prev => ({
        ...prev,
        UnifiedUser,
        isLoggedIn: true,
        preferences,
        loading: false
      }));

      console.log('[UnifiedAppContext] Registration successful:', UnifiedUser?.username);
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Registration failed';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      console.error('[UnifiedAppContext] Registration failed:', errorMessage);
      return false;
    }
  }, []);

  // Logout
  const logout = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      await userModel.logout();

      setState(prev => ({
        ...prev,
        UnifiedUser: null,
        isLoggedIn: false,
        preferences: DEFAULT_STATE.preferences,
        loading: false
      }));

      console.log('[UnifiedAppContext] Logout successful');
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Logout failed';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      console.error('[UnifiedAppContext] Logout failed:', errorMessage);
      return false;
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<boolean> => {
    const user = await userModel.refreshProfile();
    if (!user) return false;
    setState(prev => ({ ...prev, UnifiedUser: user, isLoggedIn: true }));
    return true;
  }, []);

  // Update preferences
  const updatePreferences = useCallback(async (prefs: Partial<UserPreferences>): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      await userModel.updatePreferences(prefs);
      const preferences = userModel.getPreferences();

      setState(prev => ({
        ...prev,
        preferences,
        loading: false
      }));

      console.log('[UnifiedAppContext] Preferences updated');
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update preferences';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      console.error('[UnifiedAppContext] Update preferences failed:', errorMessage);
      return false;
    }
  }, []);

  // Add recent tool
  const addRecentTool = useCallback((toolId: string) => {
    userModel.addRecentTool(toolId);
    const preferences = userModel.getPreferences();
    setState(prev => ({ ...prev, preferences }));
  }, []);

  // Toggle favorite
  const toggleFavorite = useCallback((toolId: string) => {
    userModel.toggleFavorite(toolId);
    const preferences = userModel.getPreferences();
    setState(prev => ({ ...prev, preferences }));
  }, []);

  // Check if favorite
  const isFavorite = useCallback((toolId: string): boolean => {
    return userModel.isFavorite(toolId);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Refresh state
  const refreshState = useCallback(() => {
    const loadedState = loadStateFromStorage();
    setState(loadedState);
    console.log('[UnifiedAppContext] State refreshed');
  }, []);

  // Reset all
  const resetAll = useCallback(() => {
    setState(DEFAULT_STATE);
    setShellLanguage('en');
    setDark(true);
    StorageManager.remove(StorageKeys.APP_STATE);
    StorageManager.remove(StorageKeys.USER);
    StorageManager.remove(StorageKeys.SETTINGS);
    console.log('[UnifiedAppContext] All state reset');
  }, [setDark, setShellLanguage]);

  // Subscribe to storage events for cross-tab sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === StorageKeys.APP_STATE ||
          e.key === StorageKeys.USER ||
          e.key === StorageKeys.SETTINGS) {
        refreshState();
      }
    };

    const handleSessionChanged = () => {
      refreshState();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('UnifiedUser-session-changed', handleSessionChanged);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('UnifiedUser-session-changed', handleSessionChanged);
    };
  }, [refreshState]);

  const value: UnifiedAppContextType = {
    // State
    activeView: state.activeView,
    lang: language,
    theme,
    UnifiedUser: state.UnifiedUser,
    isLoggedIn: state.isLoggedIn,
    preferences: state.preferences,
    loading: state.loading,
    error: state.error,

    // App Actions
    setActiveView,
    setLang,
    setTheme,
    toggleTheme,
    toggleLang,

    // UnifiedUser Actions
    login,
    register,
    logout,
    refreshUser,
    updatePreferences,
    addRecentTool,
    toggleFavorite,
    isFavorite,

    // Utility Actions
    clearError,
    refreshState,
    resetAll
  };

  return (
    <UnifiedAppContext.Provider value={value}>
      {children}
    </UnifiedAppContext.Provider>
  );
};

