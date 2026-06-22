/**
 * Compatibility Hooks for Migration
 * Migration compatibility Hooks
 *
 * These hooks provide backward compatibility so existing code can smoothly migrate to UnifiedAppContext
 * These hooks provide backward compatibility for smooth migration to UnifiedAppContext
 */

import { useUnifiedApp } from '../core/contexts/useUnifiedApp';

/**
 * useAppState - compatible with the legacy AppStateContext
 *
 * @deprecated Use useUnifiedApp instead
 * @deprecated Use useUnifiedApp instead
 */
export function useAppState() {
  const unified = useUnifiedApp();

  return {
    // State
    activeView: unified.activeView,
    lang: unified.lang,
    theme: unified.theme,
    isLoggedIn: unified.isLoggedIn,

    // Methods
    setActiveView: unified.setActiveView,
    setLang: unified.setLang,
    setTheme: unified.setTheme,
    toggleTheme: unified.toggleTheme,
    toggleLang: unified.toggleLang,
    setIsLoggedIn: (isLoggedIn: boolean) => {
      // Legacy support - does nothing as login state is managed by user actions
      console.warn('[useAppState] setIsLoggedIn is deprecated, use login/logout instead');
    },

    // Batch update
    updateState: (updates: any) => {
      if (updates.activeView) unified.setActiveView(updates.activeView);
      if (updates.lang) unified.setLang(updates.lang);
      if (updates.theme) unified.setTheme(updates.theme);
    },

    // Reset
    resetState: unified.resetAll
  };
}

/**
 * useUser - compatible with the legacy useUser hook
 *
 * @deprecated Use useUnifiedApp instead
 * @deprecated Use useUnifiedApp instead
 */
export function useUser() {
  const unified = useUnifiedApp();

  return {
    // State
    user: unified.user,
    preferences: unified.preferences,
    isLoggedIn: unified.isLoggedIn,
    loading: unified.loading,
    error: unified.error,

    // Methods
    login: unified.login,
    register: unified.register,
    logout: unified.logout,
    updatePreferences: unified.updatePreferences,
    addRecentTool: unified.addRecentTool,
    toggleFavorite: unified.toggleFavorite,
    isFavorite: unified.isFavorite,
    clearError: unified.clearError,
    refreshState: unified.refreshState
  };
}

/**
 * Re-export useUnifiedApp as the recommended hook
 */
export { useUnifiedApp };
