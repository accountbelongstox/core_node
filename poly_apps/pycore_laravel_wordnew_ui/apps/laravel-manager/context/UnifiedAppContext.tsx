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
import { useLocation, useNavigate } from 'react-router-dom';
import { ViewType, Language, Theme } from '../uiTypes';
import { UnifiedUser, UserPreferences } from '../types';
import { StorageManager } from '../../../core/persistence';
import { LaravelManagerStorageKeys as StorageKeys } from '../persistence/LaravelManagerStorageKeys';
import {
  readViewFromLocation,
  createViewLocation,
  viewToSlug
} from '../routing/viewRoute';
import { userModel } from '../models';
import { laravelAuthErrorText } from '@/shared/auth/laravelAuthI18n';
import { useAuthSnapshot } from '../../../core/auth/useAuthSession';
import i18n from '@/apps/laravel-manager/i18n';
import { useShell } from '../../../shell/ShellContext';
import { AUTH_SESSION_CHANGED_EVENT } from '../../../core/auth/AuthRequestCenter';
import { UnifiedAppContext } from './unifiedAppContext.core';
import type { UnifiedAppContextType, UnifiedAppState } from './unifiedAppContext.core';

/**
 * Default State
 */
const DEFAULT_STATE: UnifiedAppState = {
  activeView: ViewType.SERVER_MANAGER,
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
    const savedPreferences = StorageManager.get<UserPreferences>(StorageKeys.SETTINGS, DEFAULT_STATE.preferences);

    const fromUrl = typeof window !== 'undefined' ? readViewFromLocation(window.location) : null;
    return {
      activeView: fromUrl ?? (saved.activeView && viewToSlug(saved.activeView) ? saved.activeView : DEFAULT_STATE.activeView),
      UnifiedUser: null,
      isLoggedIn: false,
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
  const location = useLocation();
  const navigate = useNavigate();
  const { dark, lang: shellLanguage, setDark, setLang: setShellLanguage } = useShell();
  const language: Language = shellLanguage === 'zh' ? 'zh' : 'en';
  const theme: Theme = dark ? 'dark' : 'light';
  const [state, setState] = useState<UnifiedAppState>(() => {
    const loadedState = loadStateFromStorage();
    console.log('[UnifiedAppContext] Initial state loaded:', loadedState);
    return loadedState;
  });

  const routeView = readViewFromLocation(location);
  const activeView = routeView ?? state.activeView;
  const stateRef = useRef(state);
  stateRef.current = state;

  // The signed-in user belongs to the ACTIVE Laravel API: read it from the shared per-API
  // session store, so an endpoint switch changes it at once. A stored session is confirmed
  // (and its preferences loaded) whenever the API or its token changes.
  const authSnapshot = useAuthSnapshot();
  const authNamespace = authSnapshot.namespace;
  const authHasToken = userModel.hasStoredToken();
  useEffect(() => {
    if (authHasToken) void userModel.syncSession().then(() => {
      setState(prev => ({ ...prev, preferences: userModel.getPreferences() }));
    });
  }, [authNamespace, authHasToken]);

  // Auto-save state to storage
  useEffect(() => {
    saveStateToStorage(state);
  }, [state]);

  useEffect(() => {
    const target = createViewLocation(activeView, location);
    if (target.pathname !== location.pathname || target.search !== location.search || target.hash !== location.hash) {
      navigate(target, { replace: true });
    }
    setState(previous => previous.activeView === activeView ? previous : { ...previous, activeView });
  }, [activeView, location, navigate]);

  const setActiveView = useCallback((view: ViewType) => {
    if (view === activeView) return;
    navigate(createViewLocation(view, location));
  }, [activeView, location, navigate]);

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
      const displayMessage = laravelAuthErrorText(errorCode, err.message || '');
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
      const errorMessage = err.message || i18n.t('uiCommon.auth.registration_failed');
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
      const errorMessage = err.message || i18n.t('uiCommon.auth.logout_failed');
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
      const errorMessage = err.message || i18n.t('uiCommon.auth.update_preferences_failed');
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
    navigate(createViewLocation(DEFAULT_STATE.activeView, location), { replace: true });
    setShellLanguage('en');
    setDark(true);
    StorageManager.remove(StorageKeys.APP_STATE);
    StorageManager.remove(StorageKeys.USER);
    StorageManager.remove(StorageKeys.SETTINGS);
    console.log('[UnifiedAppContext] All state reset');
  }, [setDark, setShellLanguage, navigate, location]);

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
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChanged);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChanged);
    };
  }, [refreshState]);

  const value: UnifiedAppContextType = {
    // State
    activeView,
    lang: language,
    theme,
    UnifiedUser: authSnapshot.user as UnifiedUser | null,
    isLoggedIn: authSnapshot.loggedIn,
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

