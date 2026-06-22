/**
 * WordflowStorage — unified storage management for the wordflow end.
 *
 * Ported from poly_apps/qy_capacitor/services/StorageCenter.ts. Uses Capacitor
 * Preferences on native and localStorage on web (the shell aliases
 * @capacitor/preferences to a localStorage-backed shim, so on web every value
 * lands in localStorage).
 *
 * KEY NAMESPACING: all storage keys are `wf_`-prefixed so the wordflow end never
 * collides with the laravel-manager / pycore-manager ends sharing this shell's
 * localStorage. The UserDataCenter avatar post-processing from the original app
 * is intentionally dropped — WordflowApi consumes raw backend shapes.
 */

import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

export enum StorageKey {
  // Auth
  AUTH_TOKEN = 'wf_auth_token',
  USER_DATA = 'wf_user_data',

  // API
  API_CURRENT_ENDPOINT = 'wf_api_current_endpoint',
  API_AUTO_DETECTED = 'wf_api_auto_detected',
  API_USER_MODIFIED = 'wf_api_user_modified',

  // Settings
  APP_SETTINGS = 'wf_app_settings',
  ACTIVE_GROUP_ID = 'wf_active_group_id',

  // Language
  APP_LANGUAGE = 'wf_app_language',
  LEARNING_LANGUAGE = 'wf_learning_language',
  NATIVE_LANGUAGE = 'wf_native_language',

  // Cache
  WORD_GROUPS_CACHE = 'wf_word_groups_cache',
  DICTIONARY_CACHE = 'wf_dictionary_cache',
  SUPPORTED_LANGUAGES_CACHE = 'wf_supported_languages_cache',
  USER_PROFILE_CACHE = 'wf_user_profile_cache',
  RECOMMENDED_LIBRARIES_CACHE = 'wf_recommended_libraries_cache',
  LEARNING_STATS_CACHE = 'wf_learning_stats_cache',
  DAILY_WORDS_CACHE = 'wf_daily_words_cache',
  REVIEW_QUEUE_CACHE = 'wf_review_queue_cache',
  SELECTED_COLLECTIONS_CACHE = 'wf_selected_collections_cache',

  // Local learning history (persisted, not TTL caches)
  QUIZ_HISTORY = 'wf_quiz_history',
  READING_PROGRESS = 'wf_reading_progress',
  DICTIONARY_HISTORY = 'wf_dictionary_history',
  DICTIONARY_FAVORITES = 'wf_dictionary_favorites',

  // Saved Credentials
  SAVED_USERNAME = 'wf_saved_username',
  SAVED_PASSWORD = 'wf_saved_password',
}

class WordflowStorageClass {
  private isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Set item with JSON serialization. Preferences on native, localStorage on web.
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
      console.error(`[WordflowStorage] Failed to set ${key}:`, error);
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Get item with JSON deserialization.
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
      console.error(`[WordflowStorage] Failed to get ${key}:`, error);
      try {
        const item = localStorage.getItem(key);
        if (item === null) {
          return defaultValue !== undefined ? defaultValue : null;
        }
        return JSON.parse(item) as T;
      } catch {
        return defaultValue !== undefined ? defaultValue : null;
      }
    }
  }

  /**
   * Remove item.
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
      console.error(`[WordflowStorage] Failed to remove ${key}:`, error);
      try {
        localStorage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Check if key exists.
   */
  async has(key: StorageKey): Promise<boolean> {
    try {
      if (this.isNative()) {
        const result = await Preferences.get({ key });
        return result.value !== null;
      }
      return localStorage.getItem(key) !== null;
    } catch {
      return localStorage.getItem(key) !== null;
    }
  }

  /**
   * Auth-specific helpers.
   */
  auth = {
    setToken: async (token: string) => await this.set(StorageKey.AUTH_TOKEN, token),
    getToken: async () => await this.get<string>(StorageKey.AUTH_TOKEN),
    removeToken: async () => await this.remove(StorageKey.AUTH_TOKEN),
    hasToken: async () => await this.has(StorageKey.AUTH_TOKEN),

    setUser: async (user: any) => await this.set(StorageKey.USER_DATA, user),
    getUser: async () => await this.get<any>(StorageKey.USER_DATA),
    removeUser: async () => await this.remove(StorageKey.USER_DATA),

    clearAuth: async () => {
      await this.remove(StorageKey.AUTH_TOKEN);
      await this.remove(StorageKey.USER_DATA);
    },
  };

  /**
   * Settings-specific helpers.
   */
  settings = {
    get: async () => await this.get<any>(StorageKey.APP_SETTINGS),
    set: async (settings: any) => await this.set(StorageKey.APP_SETTINGS, settings),

    getActiveGroupId: async () => await this.get<string>(StorageKey.ACTIVE_GROUP_ID, 'g1'),
    setActiveGroupId: async (id: string) => await this.set(StorageKey.ACTIVE_GROUP_ID, id),
  };

  /**
   * Language-specific helpers.
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
   * Cache-specific helpers with expiration.
   */
  cache = {
    set: async <T>(key: StorageKey, value: T, ttlMs?: number) => {
      const cacheData = { value, timestamp: Date.now(), ttl: ttlMs };
      return await this.set(key, cacheData);
    },

    get: async <T>(key: StorageKey): Promise<T | null> => {
      const cacheData = await this.get<any>(key);
      if (!cacheData) return null;
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
        this.remove(StorageKey.RECOMMENDED_LIBRARIES_CACHE),
        this.remove(StorageKey.LEARNING_STATS_CACHE),
        this.remove(StorageKey.DAILY_WORDS_CACHE),
        this.remove(StorageKey.REVIEW_QUEUE_CACHE),
        this.remove(StorageKey.SELECTED_COLLECTIONS_CACHE),
      ]);
    }
  };
}

export const StorageCenter = new WordflowStorageClass();
export const wordflowStorage = StorageCenter;
