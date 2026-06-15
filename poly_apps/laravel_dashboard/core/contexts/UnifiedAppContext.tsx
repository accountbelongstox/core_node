/**
 * Unified App Context
 *
 * Integrates all application state:
 * - App State (theme, language, view)
 * - User State (user, auth, preferences)
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
import { ViewType, Language, Theme } from '../../types';
import { User, UserPreferences } from '../types';
import { StorageManager, StorageKeys } from '../persistence';
import {
  readViewFromHash,
  writeViewToHash,
  bindHashListener
} from '../routing/viewRoute';
import { userModel } from '../models';
import { getAuthErrorMessage } from '../utils/authErrors';
import { UnifiedAppContext } from './unifiedAppContext.core';
import type { UnifiedAppContextType, UnifiedAppState } from './unifiedAppContext.core';

/**
 * Default State
 */
const DEFAULT_STATE: UnifiedAppState = {
  activeView: ViewType.MEDIA_BROWSER,
  lang: 'en',
  theme: 'dark',
  user: null,
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
    const savedUser = StorageManager.get<User | null>(StorageKeys.USER, null);
    const savedPreferences = StorageManager.get<UserPreferences>(StorageKeys.SETTINGS, DEFAULT_STATE.preferences);

    // URL hash WINS over storage on first paint so deep-links / bookmarks
    // such as `…/#/ai-tools` open the right view even when localStorage
    // remembers something else. Unknown / absent hash falls through to the
    // saved view, then the default.
    const fromUrl = readViewFromHash();

    return {
      activeView: fromUrl ?? saved.activeView ?? DEFAULT_STATE.activeView,
      lang: saved.lang || DEFAULT_STATE.lang,
      theme: saved.theme || DEFAULT_STATE.theme,
      user: savedUser,
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
      lang: state.lang,
      theme: state.theme
    });

    if (state.user) {
      StorageManager.set(StorageKeys.USER, state.user);
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
  const [state, setState] = useState<UnifiedAppState>(() => {
    const loadedState = loadStateFromStorage();
    console.log('[UnifiedAppContext] Initial state loaded:', loadedState);
    return loadedState;
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Auto-save state to storage
  useEffect(() => {
    saveStateToStorage(state);
  }, [state]);

  // Apply theme to DOM
  useEffect(() => {
    const root = window.document.documentElement;
    if (state.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    console.log('[UnifiedAppContext] Theme applied:', state.theme);
  }, [state.theme]);

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
    setState(prev => ({ ...prev, lang }));
    console.log('[UnifiedAppContext] Language changed to:', lang);

    if (reload) {
      setTimeout(() => {
        console.log('[UnifiedAppContext] Reloading page due to language change');
        window.location.reload();
      }, 300);
    }
  }, []);

  // Set theme with optional reload
  const setTheme = useCallback((theme: Theme, reload = false) => {
    setState(prev => ({ ...prev, theme }));
    console.log('[UnifiedAppContext] Theme changed to:', theme);

    if (reload) {
      setTimeout(() => {
        console.log('[UnifiedAppContext] Reloading page due to theme change');
        window.location.reload();
      }, 300);
    }
  }, []);

  // Toggle theme
  const toggleTheme = useCallback((reload = false) => {
    setState(prev => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark'
    }));

    if (reload) {
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }, []);

  // Toggle language
  const toggleLang = useCallback((reload = false) => {
    setState(prev => ({
      ...prev,
      lang: prev.lang === 'en' ? 'zh' : 'en'
    }));

    if (reload) {
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }, []);

  // Login
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      await userModel.login(username, password);
      const user = userModel.getUser();
      const preferences = userModel.getPreferences();

      setState(prev => ({
        ...prev,
        user,
        isLoggedIn: true,
        preferences,
        loading: false
      }));

      console.log('[UnifiedAppContext] Login successful:', user?.username);
      return true;
    } catch (err: any) {
      const errorCode = err.errorCode as string | undefined;
      const displayMessage = getAuthErrorMessage(errorCode, err.message || 'Login failed', stateRef.current.lang);
      setState(prev => ({ ...prev, loading: false, error: displayMessage }));
      console.error('[UnifiedAppContext] Login failed:', displayMessage);
      return false;
    }
  }, []);

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
      const user = userModel.getUser();
      const preferences = userModel.getPreferences();

      setState(prev => ({
        ...prev,
        user,
        isLoggedIn: true,
        preferences,
        loading: false
      }));

      console.log('[UnifiedAppContext] Registration successful:', user?.username);
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
        user: null,
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
    StorageManager.remove(StorageKeys.APP_STATE);
    StorageManager.remove(StorageKeys.USER);
    StorageManager.remove(StorageKeys.SETTINGS);
    console.log('[UnifiedAppContext] All state reset');
  }, []);

  // Subscribe to storage events for cross-tab sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === StorageKeys.APP_STATE ||
          e.key === StorageKeys.USER ||
          e.key === StorageKeys.SETTINGS) {
        refreshState();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshState]);

  const value: UnifiedAppContextType = {
    // State
    activeView: state.activeView,
    lang: state.lang,
    theme: state.theme,
    user: state.user,
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

    // User Actions
    login,
    register,
    logout,
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
