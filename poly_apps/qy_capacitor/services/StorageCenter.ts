/**
 * Storage Center - Unified Storage Management
 * Centralized storage operations with Capacitor Preferences (native) and localStorage (web) compatibility
 * Supports both native and web platforms with automatic fallback
 */

import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { UserDataCenter } from './UserDataCenter';

export enum StorageKey {
  // Auth
  AUTH_TOKEN = 'auth_token',
  USER_DATA = 'user_data',

  // API
  API_CURRENT_ENDPOINT = 'api_current_endpoint',
  API_AUTO_DETECTED = 'api_auto_detected',
  API_USER_MODIFIED = 'api_user_modified',

  // Settings
  APP_SETTINGS = 'app_settings',
  PLAYLIST_SETTINGS = 'playlist_settings',
  ACTIVE_GROUP_ID = 'active_group_id',

  // Language
  APP_LANGUAGE = 'app_language',
  LEARNING_LANGUAGE = 'learning_language',
  NATIVE_LANGUAGE = 'native_language',

  // Learning Progress
  LEARNING_STATS = 'learning_stats',
  WORD_PROGRESS = 'word_progress',
  SESSION_HISTORY = 'session_history',

  // Cache
  WORD_GROUPS_CACHE = 'word_groups_cache',
  STUDY_GROUPS_CACHE = 'study_groups_cache',
  DICTIONARY_CACHE = 'dictionary_cache',
  SUPPORTED_LANGUAGES_CACHE = 'supported_languages_cache',
  USER_PROFILE_CACHE = 'user_profile_cache',
  VOCABULARY_LIBRARY_CACHE = 'vocabulary_library_cache',
  AUDIO_REQUESTS_CACHE = 'audio_requests_cache',

  // UI State
  THEME = 'theme',
  SIDEBAR_STATE = 'sidebar_state',

  // Tools
  DICTIONARY_HISTORY = 'dictionary_history',
  DICTIONARY_FAVORITES = 'dictionary_favorites',
  RECENT_TOOLS = 'recent_tools',

  // Quiz & Learning History
  QUIZ_HISTORY = 'quiz_history',
  READING_PROGRESS = 'reading_progress',

  // Recommended Libraries
  RECOMMENDED_LIBRARIES_CACHE = 'recommended_libraries_cache',
  SELECTED_LIBRARIES = 'selected_libraries',

  // Saved Credentials (for auto-fill on login)
  SAVED_USERNAME = 'saved_username',
  SAVED_PASSWORD = 'saved_password',
}

class StorageCenterClass {
  /**
   * Check if running on native platform
   */
  private isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Set item with JSON serialization
   * Uses Capacitor Preferences on native, localStorage on web
   */
  async set<T>(key: StorageKey, value: T): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      
      if (this.isNative()) {
        await Preferences.set({ key, value: serialized });
      } else {
        localStorage.setItem(key, serialized);
      }
      return true;
    } catch (error) {
      console.error(`[StorageCenter] Failed to set ${key}:`, error);
      // Fallback to localStorage if Preferences fails
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (fallbackError) {
        console.error(`[StorageCenter] Fallback also failed for ${key}:`, fallbackError);
        return false;
      }
    }
  }

  /**
   * Get item with JSON deserialization
   * Uses Capacitor Preferences on native, localStorage on web
   */
  async get<T>(key: StorageKey, defaultValue?: T): Promise<T | null> {
    try {
      let item: string | null = null;
      
      if (this.isNative()) {
        const result = await Preferences.get({ key });
        item = result.value;
      } else {
        item = localStorage.getItem(key);
      }
      
      if (item === null) {
        return defaultValue !== undefined ? defaultValue : null;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`[StorageCenter] Failed to get ${key}:`, error);
      // Fallback to localStorage if Preferences fails
      try {
        const item = localStorage.getItem(key);
        if (item === null) {
          return defaultValue !== undefined ? defaultValue : null;
        }
        return JSON.parse(item) as T;
      } catch (fallbackError) {
        console.error(`[StorageCenter] Fallback also failed for ${key}:`, fallbackError);
        return defaultValue !== undefined ? defaultValue : null;
      }
    }
  }

  /**
   * Remove item
   * Uses Capacitor Preferences on native, localStorage on web
   */
  async remove(key: StorageKey): Promise<boolean> {
    try {
      if (this.isNative()) {
        await Preferences.remove({ key });
      } else {
        localStorage.removeItem(key);
      }
      return true;
    } catch (error) {
      console.error(`[StorageCenter] Failed to remove ${key}:`, error);
      // Fallback to localStorage if Preferences fails
      try {
        localStorage.removeItem(key);
        return true;
      } catch (fallbackError) {
        console.error(`[StorageCenter] Fallback also failed for ${key}:`, fallbackError);
        return false;
      }
    }
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<boolean> {
    try {
      if (this.isNative()) {
        await Preferences.clear();
      } else {
        localStorage.clear();
      }
      return true;
    } catch (error) {
      console.error('[StorageCenter] Failed to clear storage:', error);
      // Fallback to localStorage if Preferences fails
      try {
        localStorage.clear();
        return true;
      } catch (fallbackError) {
        console.error('[StorageCenter] Fallback also failed:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Check if key exists
   */
  async has(key: StorageKey): Promise<boolean> {
    try {
      if (this.isNative()) {
        const result = await Preferences.get({ key });
        return result.value !== null;
      } else {
        return localStorage.getItem(key) !== null;
      }
    } catch (error) {
      // Fallback to localStorage
      return localStorage.getItem(key) !== null;
    }
  }

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    try {
      if (this.isNative()) {
        const result = await Preferences.keys();
        return result.keys;
      } else {
        return Object.keys(localStorage);
      }
    } catch (error) {
      console.error('[StorageCenter] Failed to get keys:', error);
      // Fallback to localStorage
      return Object.keys(localStorage);
    }
  }

  /**
   * Get multiple keys at once
   */
  async getMultiple<T>(keys: StorageKey[]): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {};
    await Promise.all(
      keys.map(async (key) => {
        result[key] = await this.get<T>(key);
      })
    );
    return result;
  }

  /**
   * Set multiple keys at once
   */
  async setMultiple(items: Partial<Record<StorageKey, any>>): Promise<boolean> {
    try {
      await Promise.all(
        Object.entries(items).map(([key, value]) =>
          this.set(key as StorageKey, value)
        )
      );
      return true;
    } catch (error) {
      console.error('[StorageCenter] Failed to set multiple items:', error);
      return false;
    }
  }

  /**
   * Auth-specific helpers
   */
  auth = {
    setToken: async (token: string) => await this.set(StorageKey.AUTH_TOKEN, token),
    getToken: async () => await this.get<string>(StorageKey.AUTH_TOKEN),
    removeToken: async () => await this.remove(StorageKey.AUTH_TOKEN),
    hasToken: async () => await this.has(StorageKey.AUTH_TOKEN),

    setUser: async (user: any) => {
      // Process user data before storing to ensure avatar_url is correct
      const processedUser = UserDataCenter.processUserData(user);
      console.log('[StorageCenter] Storing user with processed avatar_url:', processedUser.avatar_url);
      return await this.set(StorageKey.USER_DATA, processedUser);
    },

    getUser: async () => {
      const user = await this.get<any>(StorageKey.USER_DATA);
      if (!user) return null;

      // Re-process user data when loading from storage
      // This ensures avatar_url is reconstructed if API base URL changed
      const processedUser = UserDataCenter.processUserData(user);
      console.log('[StorageCenter] Loading user with re-processed avatar_url:', processedUser.avatar_url);

      return processedUser;
    },

    removeUser: async () => await this.remove(StorageKey.USER_DATA),

    clearAuth: async () => {
      await this.remove(StorageKey.AUTH_TOKEN);
      await this.remove(StorageKey.USER_DATA);
    },

    // Saved credentials for auto-fill
    saveCredentials: async (username: string, password: string) => {
      await Promise.all([
        this.set(StorageKey.SAVED_USERNAME, username),
        this.set(StorageKey.SAVED_PASSWORD, password),
      ]);
      console.log('[StorageCenter] Credentials saved');
    },

    getCredentials: async () => {
      const [username, password] = await Promise.all([
        this.get<string>(StorageKey.SAVED_USERNAME),
        this.get<string>(StorageKey.SAVED_PASSWORD),
      ]);
      return { username: username || '', password: password || '' };
    },

    clearCredentials: async () => {
      await Promise.all([
        this.remove(StorageKey.SAVED_USERNAME),
        this.remove(StorageKey.SAVED_PASSWORD),
      ]);
      console.log('[StorageCenter] Credentials cleared');
    },
  };

  /**
   * Settings-specific helpers
   */
  settings = {
    get: async () => await this.get<any>(StorageKey.APP_SETTINGS),
    set: async (settings: any) => await this.set(StorageKey.APP_SETTINGS, settings),

    getPlaylist: async () => await this.get<any>(StorageKey.PLAYLIST_SETTINGS),
    setPlaylist: async (settings: any) => await this.set(StorageKey.PLAYLIST_SETTINGS, settings),

    getActiveGroupId: async () => await this.get<string>(StorageKey.ACTIVE_GROUP_ID, 'g1'),
    setActiveGroupId: async (id: string) => await this.set(StorageKey.ACTIVE_GROUP_ID, id),
  };

  /**
   * Language-specific helpers
   */
  language = {
    getAppLanguage: async () => await this.get<string>(StorageKey.APP_LANGUAGE, 'en'),
    setAppLanguage: async (lang: string) => await this.set(StorageKey.APP_LANGUAGE, lang),

    getLearningLanguage: async () => await this.get<string>(StorageKey.LEARNING_LANGUAGE, 'en'),
    setLearningLanguage: async (lang: string) => await this.set(StorageKey.LEARNING_LANGUAGE, lang),

    getNativeLanguage: async () => await this.get<string>(StorageKey.NATIVE_LANGUAGE, 'zh'),
    setNativeLanguage: async (lang: string) => await this.set(StorageKey.NATIVE_LANGUAGE, lang),
  };

  /**
   * Synchronous learning-progress helpers (localStorage-backed).
   * Consumers read/write these results synchronously.
   */
  private getSync<T>(key: StorageKey, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item) as T;
    } catch {
      return defaultValue;
    }
  }

  private setSync<T>(key: StorageKey, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`[StorageCenter] Failed to set ${key}:`, error);
    }
  }

  learning = {
    getWordProgress: (): Record<string, any> =>
      this.getSync<Record<string, any>>(StorageKey.WORD_PROGRESS, {}),
    setWordProgress: (progress: Record<string, any>): void =>
      this.setSync(StorageKey.WORD_PROGRESS, progress),
    clearWordProgress: (): void => {
      try {
        localStorage.removeItem(StorageKey.WORD_PROGRESS);
      } catch (error) {
        console.error('[StorageCenter] Failed to clear word progress:', error);
      }
    },

    getSessionHistory: (): any[] =>
      this.getSync<any[]>(StorageKey.SESSION_HISTORY, []),
    setSessionHistory: (history: any[]): void =>
      this.setSync(StorageKey.SESSION_HISTORY, history),
    clearSessionHistory: (): void => {
      try {
        localStorage.removeItem(StorageKey.SESSION_HISTORY);
      } catch (error) {
        console.error('[StorageCenter] Failed to clear session history:', error);
      }
    },
  };

  /**
   * Cache-specific helpers with expiration
   */
  cache = {
    set: async <T>(key: StorageKey, value: T, ttlMs?: number) => {
      const cacheData = {
        value,
        timestamp: Date.now(),
        ttl: ttlMs
      };
      return await this.set(key, cacheData);
    },

    get: async <T>(key: StorageKey): Promise<T | null> => {
      const cacheData = await this.get<any>(key);
      if (!cacheData) return null;

      // Check expiration
      if (cacheData.ttl) {
        const now = Date.now();
        if (now - cacheData.timestamp > cacheData.ttl) {
          await this.remove(key);
          return null;
        }
      }

      return cacheData.value as T;
    },

    invalidate: async (key: StorageKey) => await this.remove(key),

    invalidateAll: async () => {
      await Promise.all([
        this.remove(StorageKey.WORD_GROUPS_CACHE),
        this.remove(StorageKey.DICTIONARY_CACHE),
        this.remove(StorageKey.SUPPORTED_LANGUAGES_CACHE),
        this.remove(StorageKey.USER_PROFILE_CACHE),
      ]);
    }
  };
}

export const StorageCenter = new StorageCenterClass();
