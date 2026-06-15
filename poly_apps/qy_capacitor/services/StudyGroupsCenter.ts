/**
 * StudyGroupsCenter - Study Groups Management Center
 *
 * Features:
 * - Manages the user's Study Groups
 * - A Study Group is how a user organizes a study plan; it can contain multiple Word Groups
 * - Provides reactive updates, smart caching, and automatic initialization
 *
 * Difference from WordGroupsCenter:
 * - WordGroupsCenter: manages word libraries (system- or user-created vocabulary collections)
 * - StudyGroupsCenter: manages study plans (user-organized study groups containing multiple word groups)
 */

import type {
  StudyGroup,
  ApiResponse
} from '../types';
import { StorageCenter, StorageKey } from './StorageCenter';
import { apiManager } from './ApiManager';

type StudyGroupsListener = (groups: StudyGroup[]) => void;

class StudyGroupsCenterClass {
  private studyGroups: StudyGroup[] = [];
  private listeners: Set<StudyGroupsListener> = new Set();
  private isInitialized = false;
  private isLoading = false;
  private lastFetchTime = 0;
  private CACHE_DURATION = 3 * 60 * 1000; // 3 minutes
  private FETCH_COOLDOWN = 15000; // 15 seconds

  /**
   * Initialize the study groups center
   * Loads from cache first, then fetches the latest data from the API
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[StudyGroupsCenter] Already initialized');
      return;
    }

    console.log('[StudyGroupsCenter] Initializing...');

    // Load from cache
    const cached = StorageCenter.cache.get<StudyGroup[]>(StorageKey.STUDY_GROUPS_CACHE) as unknown as StudyGroup[] | null;
    if (cached && cached.length > 0) {
      this.studyGroups = cached;
      this.notifyListeners();
      console.log(`[StudyGroupsCenter] Loaded ${cached.length} groups from cache`);
    }

    // Fetch the latest data from the API
    try {
      await this.fetchAll(true);
      this.isInitialized = true;
      console.log('[StudyGroupsCenter] Initialization complete');
    } catch (error: any) {
      // Offline / backend down is expected and non-fatal: degrade to the
      // cached (or empty) state and never throw out of initialize().
      console.warn('[StudyGroupsCenter] Failed to initialize (handled, using cached/empty):', error?.message || error);
      // If cached data exists, still mark as initialized
      if (this.studyGroups.length > 0) {
        this.isInitialized = true;
      }
    }
  }

  /**
   * Fetch all study groups
   * @param forceRefresh Force a refresh, ignoring the cache and debounce
   */
  async fetchAll(forceRefresh: boolean = false): Promise<StudyGroup[]> {
    const now = Date.now();

    // Debounce: if a request was made within the last 15 seconds, return the cache directly
    if (!forceRefresh && (now - this.lastFetchTime) < this.FETCH_COOLDOWN) {
      console.log('[StudyGroupsCenter] Fetch throttled, returning cached data');
      return this.studyGroups;
    }

    // If a load is already in progress, return the current data
    if (this.isLoading) {
      console.log('[StudyGroupsCenter] Already loading, returning current data');
      return this.studyGroups;
    }

    this.isLoading = true;
    this.lastFetchTime = now;

    try {
      console.log('[StudyGroupsCenter] Fetching study groups from API...');

      // Call the API (backend response format: { uid, total, groups })
      const response = await this.callApi<{ uid?: number; total: number; groups: any[] }>('/api/app_qy_v1/query_all_groups');

      if (response.success && response.data) {
        // Convert backend fields to the frontend format (gid->id, gname->name, etc.)
        const rawGroups = response.data.groups || [];
        this.studyGroups = rawGroups.map((g: any) => ({
          id: g.gid || g.id,
          uid: g.uid,
          name: g.gname || g.name,
          description: g.description,
          language: g.language,
          is_language_default: g.is_language_default,
          is_default: g.is_default || g.is_language_default,
          total_word_groups: g.total_word_groups || 0,
          total_words: g.total_words || 0,
          learned_words: g.learned_words || 0,
          progress: g.progress || 0,
          daily_goal: g.daily_goal || 50,
          study_mode: g.study_mode || 'sequential',
          cover_image: g.cover_url || g.cover_image,
          color: g.color || '#3B82F6',
          icon: g.icon || '📚',
          sort_order: g.sort_order || 0,
          created_at: g.created_at,
          updated_at: g.updated_at,
          last_studied_at: g.last_studied_at
        }));

        // Save to cache
        StorageCenter.cache.set(
          StorageKey.STUDY_GROUPS_CACHE,
          this.studyGroups,
          this.CACHE_DURATION
        );

        // Notify all subscribers
        this.notifyListeners();

        console.log(`[StudyGroupsCenter] Fetched ${this.studyGroups.length} study groups`);
      }

      return this.studyGroups;
    } catch (error: any) {
      // Keep last good / cached state on offline / backend failure.
      console.warn('[StudyGroupsCenter] Failed to fetch study groups (handled, using cached/empty):', error?.message || error);
      return this.studyGroups;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Refresh data (force fetch from the API)
   */
  async refresh(): Promise<void> {
    console.log('[StudyGroupsCenter] Manual refresh triggered');
    await this.fetchAll(true);
  }

  /**
   * Create the default study group for the specified language
   * @param language Language code (e.g. 'en', 'zh', 'ja')
   */
  async createLanguageGroup(language: string): Promise<StudyGroup | null> {
    try {
      console.log('[StudyGroupsCenter] Creating language study group:', language);

      const response = await this.callApi<any>('/api/app_qy_v1/study_groups/create_for_language', {
        method: 'POST',
        body: JSON.stringify({ language })
      });

      if (response.success && response.data) {
        const rawGroup = response.data;

        // Convert backend fields to the frontend format
        const newGroup: StudyGroup = {
          id: rawGroup.id || rawGroup.gid,
          uid: rawGroup.uid,
          name: rawGroup.name || rawGroup.gname,
          description: rawGroup.description,
          language: rawGroup.language,
          is_language_default: rawGroup.is_language_default,
          is_default: rawGroup.is_default || rawGroup.is_language_default,
          total_word_groups: rawGroup.total_word_groups || 0,
          total_words: rawGroup.total_words || 0,
          learned_words: rawGroup.learned_words || 0,
          progress: rawGroup.progress || 0,
          daily_goal: rawGroup.daily_goal || 50,
          study_mode: rawGroup.study_mode || 'sequential',
          cover_image: rawGroup.cover_url || rawGroup.cover_image,
          color: rawGroup.color || '#3B82F6',
          icon: rawGroup.icon || '📚',
          sort_order: rawGroup.sort_order || 0,
          created_at: rawGroup.created_at,
          updated_at: rawGroup.updated_at,
          last_studied_at: rawGroup.last_studied_at
        };

        // Update the local cache
        const index = this.studyGroups.findIndex(g => g.id === newGroup.id);
        if (index >= 0) {
          this.studyGroups[index] = newGroup;
        } else {
          this.studyGroups.push(newGroup);
        }

        // Sort by language and sort_order
        this.studyGroups.sort((a, b) => {
          if (a.language !== b.language) {
            return a.language.localeCompare(b.language);
          }
          return a.sort_order - b.sort_order;
        });

        this.notifyListeners();
        this.updateCache();

        console.log('[StudyGroupsCenter] Language study group created:', newGroup.id);
        return newGroup;
      }

      return null;
    } catch (error: any) {
      console.warn('[StudyGroupsCenter] Failed to create language group (handled):', error?.message || error);
      return null;
    }
  }

  /**
   * Fetch all study groups for the specified language
   * @param language Language code
   */
  async getByLanguage(language: string): Promise<StudyGroup[]> {
    try {
      console.log('[StudyGroupsCenter] Fetching study groups for language:', language);

      const response = await this.callApi<{ language: string; study_groups: any[]; total: number }>(
        `/api/app_qy_v1/study_groups/by_language/${language}`
      );

      if (response.success && response.data) {
        const rawGroups = response.data.study_groups || [];

        // Convert backend fields to the frontend format
        const groups: StudyGroup[] = rawGroups.map((g: any) => ({
          id: g.id || g.gid,
          uid: g.uid,
          name: g.name || g.gname,
          description: g.description,
          language: g.language,
          is_language_default: g.is_language_default,
          is_default: g.is_default || g.is_language_default,
          total_word_groups: g.total_word_groups || 0,
          total_words: g.total_words || 0,
          learned_words: g.learned_words || 0,
          progress: g.progress || 0,
          daily_goal: g.daily_goal || 50,
          study_mode: g.study_mode || 'sequential',
          cover_image: g.cover_url || g.cover_image,
          color: g.color || '#3B82F6',
          icon: g.icon || '📚',
          sort_order: g.sort_order || 0,
          created_at: g.created_at,
          updated_at: g.updated_at,
          last_studied_at: g.last_studied_at
        }));

        // Update the groups for the corresponding language in the local cache
        this.studyGroups = this.studyGroups.filter(g => g.language !== language);
        this.studyGroups.push(...groups);

        this.notifyListeners();
        this.updateCache();

        return groups;
      }

      return [];
    } catch (error: any) {
      console.warn('[StudyGroupsCenter] Failed to fetch groups by language (handled, empty fallback):', error?.message || error);
      return [];
    }
  }

  /**
   * Get the default study group (deprecated, use getLanguageDefaultGroup)
   * @deprecated Use getLanguageDefaultGroup(language) instead
   */
  async getDefaultGroup(): Promise<StudyGroup | null> {
    console.warn('[StudyGroupsCenter] getDefaultGroup() is deprecated, use getLanguageDefaultGroup(language)');

    // Return the default group of the first language for compatibility
    const defaultGroups = this.studyGroups.filter(g => g.is_language_default);
    return defaultGroups.length > 0 ? defaultGroups[0] : null;
  }

  /**
   * Get the default study group for the specified language
   * @param language Language code
   */
  getLanguageDefaultGroup(language: string): StudyGroup | undefined {
    return this.studyGroups.find(g => g.language === language && g.is_language_default);
  }

  /**
   * Subscribe to study group changes
   */
  subscribe(listener: StudyGroupsListener): () => void {
    this.listeners.add(listener);

    // Invoke immediately once, passing the current data
    listener([...this.studyGroups]);

    // Return the unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get all current study groups (synchronous)
   */
  getAll(): StudyGroup[] {
    return [...this.studyGroups];
  }

  /**
   * Find a study group by ID (synchronous)
   */
  findById(id: string): StudyGroup | undefined {
    return this.studyGroups.find(g => g.id === id);
  }

  /**
   * Get the default group (synchronous)
   */
  findDefault(): StudyGroup | undefined {
    return this.studyGroups.find(g => g.is_default);
  }

  /**
   * Filter study groups by language (synchronous)
   * @param language Language code
   */
  filterByLanguage(language: string): StudyGroup[] {
    return this.studyGroups.filter(g => g.language === language);
  }

  /**
   * Search study groups
   */
  search(query: string): StudyGroup[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return this.studyGroups;

    return this.studyGroups.filter(group =>
      group.name.toLowerCase().includes(lowerQuery) ||
      (group.description && group.description.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      total: this.studyGroups.length,
      totalWords: this.studyGroups.reduce((sum, g) => sum + g.total_words, 0),
      learnedWords: this.studyGroups.reduce((sum, g) => sum + g.learned_words, 0),
      totalWordGroups: this.studyGroups.reduce((sum, g) => sum + g.total_word_groups, 0),
      averageProgress: this.studyGroups.length > 0
        ? this.studyGroups.reduce((sum, g) => sum + g.progress, 0) / this.studyGroups.length
        : 0
    };
  }

  // ========== Private Methods ==========

  /**
   * Notify all subscribers
   */
  private notifyListeners(): void {
    const groupsCopy = [...this.studyGroups];
    this.listeners.forEach(listener => {
      try {
        listener(groupsCopy);
      } catch (error) {
        console.error('[StudyGroupsCenter] Error in listener:', error);
      }
    });
  }

  /**
   * Update the cache
   */
  private updateCache(): void {
    StorageCenter.cache.set(
      StorageKey.STUDY_GROUPS_CACHE,
      this.studyGroups,
      this.CACHE_DURATION
    );
  }

  /**
   * API call helper method
   */
  private async callApi<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      // Get the token
      const token = StorageCenter.auth.getToken();
      if (!token) {
        return {
          success: false,
          data: {} as T,
          message: 'Not logged in'
        };
      }

      // Use ApiManager to get the currently active base URL
      const baseUrl = apiManager.getCurrentBaseUrl();
      const url = `${baseUrl}${endpoint}`;

      // Make the request
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options?.headers
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: {} as T,
          message: data.message || 'Request failed'
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message
      };
    } catch (error: any) {
      // Network/offline failure is environmental: return a structured
      // failure the callers already handle; warn instead of red error.
      console.warn('[StudyGroupsCenter] API call failed (handled):', error?.message || error);
      return {
        success: false,
        data: {} as T,
        message: error instanceof Error ? error.message : 'Network error'
      };
    }
  }
}

// Export the singleton
export const StudyGroupsCenter = new StudyGroupsCenterClass();
