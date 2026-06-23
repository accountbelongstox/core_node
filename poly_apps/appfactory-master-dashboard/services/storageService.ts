/**
 * Centralized Storage Service
 * Provides type-safe localStorage wrapper
 */

// Storage key definitions
export const STORAGE_KEYS = {
  LANGUAGE: 'app_language',
  THEME: 'app_theme',
  USER_INFO: 'app_user_info',
  AUTH_TOKEN: 'app_auth_token',
  SETTINGS: 'app_settings',
  API_USER_SELECTED: 'api_user_selected',
  API_AUTO_DETECTED: 'api_auto_detected',
} as const;

// User information type
export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

// Settings type
export interface AppSettings {
  language: string;
  theme: 'light' | 'dark';
  notifications: boolean;
  autoRefresh: boolean;
}

// Storage service class
class StorageService {
  /**
   * Get stored value
   */
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue ?? null;
      return JSON.parse(item) as T;
    } catch (error) {
      // Error handling is necessary and must be kept
      // Reason: localStorage may fail (storage full, private mode, cross-origin, etc.)
      // Need to catch errors and return default value to prevent application crash
      console.error(`Error getting item from storage: ${key}`, error);
      return defaultValue ?? null;
    }
  }

  /**
   * Set stored value
   */
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Error handling is necessary and must be kept
      // Reason: localStorage may fail (storage full, private mode, cross-origin, etc.)
      // Need to catch errors to prevent application crash
      console.error(`Error setting item in storage: ${key}`, error);
    }
  }

  /**
   * Remove stored value
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      // Error handling is necessary and must be kept
      // Reason: localStorage may fail (private mode, cross-origin, etc.)
      // Need to catch errors to prevent application crash
      console.error(`Error removing item from storage: ${key}`, error);
    }
  }

  /**
   * Clear all storage
   */
  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      // Error handling is necessary and must be kept
      // Reason: localStorage may fail (private mode, cross-origin, etc.)
      // Need to catch errors to prevent application crash
      console.error('Error clearing storage', error);
    }
  }

  // === Business-specific methods ===

  /**
   * Get current language
   */
  getLanguage(): string {
    const lang = this.get<string>(STORAGE_KEYS.LANGUAGE, 'zh');
    return lang ?? 'zh';
  }

  /**
   * Set current language
   */
  setLanguage(language: string): void {
    this.set(STORAGE_KEYS.LANGUAGE, language);
  }

  /**
   * Get current theme
   */
  getTheme(): 'light' | 'dark' {
    const theme = this.get<'light' | 'dark'>(STORAGE_KEYS.THEME, 'light');
    return theme ?? 'light';
  }

  /**
   * Set current theme
   */
  setTheme(theme: 'light' | 'dark'): void {
    this.set(STORAGE_KEYS.THEME, theme);
  }

  /**
   * Get user info
   * Avatar URLs are generated dynamically at render time using avatarUtils.getAvatarUrl()
   */
  getUserInfo(): UserInfo | null {
    return this.get<UserInfo>(STORAGE_KEYS.USER_INFO);
  }

  /**
   * Set user info
   */
  setUserInfo(userInfo: UserInfo): void {
    this.set(STORAGE_KEYS.USER_INFO, userInfo);
  }

  /**
   * Get authentication token
   */
  getAuthToken(): string | null {
    return this.get<string>(STORAGE_KEYS.AUTH_TOKEN);
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.set(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  /**
   * Get application settings
   */
  getSettings(): AppSettings {
    const defaultSettings: AppSettings = {
      language: 'zh',
      theme: 'light',
      notifications: true,
      autoRefresh: true,
    };
    const settings = this.get<AppSettings>(STORAGE_KEYS.SETTINGS, defaultSettings);
    return settings ?? defaultSettings;
  }

  /**
   * Set application settings
   */
  setSettings(settings: AppSettings): void {
    this.set(STORAGE_KEYS.SETTINGS, settings);
  }

  /**
   * Clear all user-related data (used when logging out)
   */
  clearUserData(): void {
    this.remove(STORAGE_KEYS.USER_INFO);
    this.remove(STORAGE_KEYS.AUTH_TOKEN);
  }
}

// Export singleton
export const storageService = new StorageService();
