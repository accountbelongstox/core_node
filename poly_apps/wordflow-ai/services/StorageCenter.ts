/**
 * Storage Center - Unified Local Storage Management
 * Centralized storage operations with type safety and error handling
 */

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
}

class StorageCenterClass {
  /**
   * Set item in localStorage with JSON serialization
   */
  set<T>(key: StorageKey, value: T): boolean {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error(`[StorageCenter] Failed to set ${key}:`, error);
      return false;
    }
  }

  /**
   * Get item from localStorage with JSON deserialization
   */
  get<T>(key: StorageKey, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue !== undefined ? defaultValue : null;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`[StorageCenter] Failed to get ${key}:`, error);
      return defaultValue !== undefined ? defaultValue : null;
    }
  }

  /**
   * Remove item from localStorage
   */
  remove(key: StorageKey): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`[StorageCenter] Failed to remove ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all storage
   */
  clear(): boolean {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('[StorageCenter] Failed to clear storage:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  has(key: StorageKey): boolean {
    return localStorage.getItem(key) !== null;
  }

  /**
   * Get multiple keys at once
   */
  getMultiple<T>(keys: StorageKey[]): Record<string, T | null> {
    const result: Record<string, T | null> = {};
    keys.forEach(key => {
      result[key] = this.get<T>(key);
    });
    return result;
  }

  /**
   * Set multiple keys at once
   */
  setMultiple(items: Partial<Record<StorageKey, any>>): boolean {
    try {
      Object.entries(items).forEach(([key, value]) => {
        this.set(key as StorageKey, value);
      });
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
    setToken: (token: string) => this.set(StorageKey.AUTH_TOKEN, token),
    getToken: () => this.get<string>(StorageKey.AUTH_TOKEN),
    removeToken: () => this.remove(StorageKey.AUTH_TOKEN),
    hasToken: () => this.has(StorageKey.AUTH_TOKEN),

    setUser: (user: any) => {
      // Process user data before storing to ensure avatar_url is correct
      const processedUser = UserDataCenter.processUserData(user);
      console.log('[StorageCenter] Storing user with processed avatar_url:', processedUser.avatar_url);
      return this.set(StorageKey.USER_DATA, processedUser);
    },

    getUser: () => {
      const user = this.get<any>(StorageKey.USER_DATA);
      if (!user) return null;

      // Re-process user data when loading from storage
      // This ensures avatar_url is reconstructed if API base URL changed
      const processedUser = UserDataCenter.processUserData(user);
      console.log('[StorageCenter] Loading user with re-processed avatar_url:', processedUser.avatar_url);

      return processedUser;
    },

    removeUser: () => this.remove(StorageKey.USER_DATA),

    clearAuth: () => {
      this.remove(StorageKey.AUTH_TOKEN);
      this.remove(StorageKey.USER_DATA);
    }
  };

  /**
   * Settings-specific helpers
   */
  settings = {
    get: () => this.get<any>(StorageKey.APP_SETTINGS),
    set: (settings: any) => this.set(StorageKey.APP_SETTINGS, settings),

    getPlaylist: () => this.get<any>(StorageKey.PLAYLIST_SETTINGS),
    setPlaylist: (settings: any) => this.set(StorageKey.PLAYLIST_SETTINGS, settings),

    getActiveGroupId: () => this.get<string>(StorageKey.ACTIVE_GROUP_ID, 'g1'),
    setActiveGroupId: (id: string) => this.set(StorageKey.ACTIVE_GROUP_ID, id),
  };

  /**
   * Language-specific helpers
   */
  language = {
    getAppLanguage: () => this.get<string>(StorageKey.APP_LANGUAGE, 'en'),
    setAppLanguage: (lang: string) => this.set(StorageKey.APP_LANGUAGE, lang),

    getLearningLanguage: () => this.get<string>(StorageKey.LEARNING_LANGUAGE, 'en'),
    setLearningLanguage: (lang: string) => this.set(StorageKey.LEARNING_LANGUAGE, lang),

    getNativeLanguage: () => this.get<string>(StorageKey.NATIVE_LANGUAGE, 'zh'),
    setNativeLanguage: (lang: string) => this.set(StorageKey.NATIVE_LANGUAGE, lang),
  };

  /**
   * Cache-specific helpers with expiration
   */
  cache = {
    set: <T>(key: StorageKey, value: T, ttlMs?: number) => {
      const cacheData = {
        value,
        timestamp: Date.now(),
        ttl: ttlMs
      };
      return this.set(key, cacheData);
    },

    get: <T>(key: StorageKey): T | null => {
      const cacheData = this.get<any>(key);
      if (!cacheData) return null;

      // Check expiration
      if (cacheData.ttl) {
        const now = Date.now();
        if (now - cacheData.timestamp > cacheData.ttl) {
          this.remove(key);
          return null;
        }
      }

      return cacheData.value as T;
    },

    invalidate: (key: StorageKey) => this.remove(key),

    invalidateAll: () => {
      this.remove(StorageKey.WORD_GROUPS_CACHE);
      this.remove(StorageKey.DICTIONARY_CACHE);
      this.remove(StorageKey.SUPPORTED_LANGUAGES_CACHE);
      this.remove(StorageKey.USER_PROFILE_CACHE);
    }
  };
}

export const StorageCenter = new StorageCenterClass();
