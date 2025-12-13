import { useState, useEffect, useCallback } from 'react';
import { userModel } from '../core/models';
import { User, UserPreferences } from '../core/types';

/**
 * React Hook for UserModel
 * Provides state management for user authentication and preferences
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(userModel.getUser());
  const [preferences, setPreferences] = useState<UserPreferences>(userModel.getPreferences());
  const [isLoggedIn, setIsLoggedIn] = useState(userModel.isLoggedIn());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Refresh state from model
   */
  const refreshState = useCallback(() => {
    setUser(userModel.getUser());
    setPreferences(userModel.getPreferences());
    setIsLoggedIn(userModel.isLoggedIn());
  }, []);

  /**
   * Login
   */
  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      await userModel.login(email, password);
      refreshState();
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [refreshState]);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await userModel.logout();
      refreshState();
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Logout failed';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [refreshState]);

  /**
   * Update preferences
   */
  const updatePreferences = useCallback(async (prefs: Partial<UserPreferences>) => {
    setLoading(true);
    setError(null);

    try {
      await userModel.updatePreferences(prefs);
      refreshState();
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update preferences';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [refreshState]);

  /**
   * Add recent tool
   */
  const addRecentTool = useCallback((toolId: string) => {
    userModel.addRecentTool(toolId);
    refreshState();
  }, [refreshState]);

  /**
   * Toggle favorite tool
   */
  const toggleFavorite = useCallback((toolId: string) => {
    userModel.toggleFavorite(toolId);
    refreshState();
  }, [refreshState]);

  /**
   * Check if tool is favorite
   */
  const isFavorite = useCallback((toolId: string): boolean => {
    return userModel.isFavorite(toolId);
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Subscribe to storage events for cross-tab sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user' || e.key === 'user_preferences' || e.key === 'auth_token') {
        refreshState();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshState]);

  return {
    // State
    user,
    preferences,
    isLoggedIn,
    loading,
    error,

    // Methods
    login,
    logout,
    updatePreferences,
    addRecentTool,
    toggleFavorite,
    isFavorite,
    clearError,
    refreshState
  };
}
