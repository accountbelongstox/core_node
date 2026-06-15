/**
 * Word Groups Center - Unified Word Groups Management
 * Centralized management of word groups with caching and reactive updates
 */

import { WordGroup } from '../types';
import { ApiCenter } from './ApiCenter';
import { StorageCenter, StorageKey } from './StorageCenter';
import { StateManager } from './StateManager';
import { EventBus } from './EventBus';

type WordGroupsListener = (groups: WordGroup[]) => void;

class WordGroupsCenterClass {
  private groups: WordGroup[] = [];
  private listeners: Set<WordGroupsListener> = new Set();
  private loading: boolean = false;
  private lastFetchTime: number = 0;
  private FETCH_COOLDOWN = 30000; // 30 seconds cooldown between fetches

  /**
   * Initialize - load from cache
   */
  async initialize(): Promise<void> {
    const cached = await StorageCenter.cache.get<WordGroup[]>(StorageKey.WORD_GROUPS_CACHE);
    if (cached) {
      console.log('[WordGroupsCenter] Loaded from cache:', cached.length, 'groups');
      this.groups = cached;
      this.notifyListeners();
    }

    // Only fetch fresh data if user is authenticated
    const token = await StorageCenter.auth.getToken();
    if (token) {
      // Fetch fresh data in background. Failures here are environmental
      // (offline / backend down); keep the cached/empty state and warn.
      this.fetchAll(true).catch(err => {
        console.warn('[WordGroupsCenter] Background fetch failed (handled, using cached/empty):', err?.message || err);
      });
    } else {
      console.log('[WordGroupsCenter] User not authenticated, skipping API fetch');
    }
  }

  /**
   * Fetch all word groups from API
   * @param forceRefresh - Skip cache and force API call
   */
  async fetchAll(forceRefresh: boolean = false): Promise<WordGroup[]> {
    // Check authentication first - this API requires login
    const token = await StorageCenter.auth.getToken();
    if (!token) {
      console.log('[WordGroupsCenter] No authentication token, skipping API call');
      // Return cached data if available, otherwise empty array
      const cached = await StorageCenter.cache.get<WordGroup[]>(StorageKey.WORD_GROUPS_CACHE);
      if (cached) {
        this.groups = cached;
        this.notifyListeners();
        return cached;
      }
      return this.groups;
    }

    // Prevent concurrent fetches
    if (this.loading) {
      console.log('[WordGroupsCenter] Fetch already in progress, returning cached data');
      return this.groups;
    }

    // Check cooldown
    const now = Date.now();
    if (!forceRefresh && (now - this.lastFetchTime) < this.FETCH_COOLDOWN) {
      console.log('[WordGroupsCenter] Within cooldown period, returning cached data');
      return this.groups;
    }

    // Check cache first (unless forced refresh)
    if (!forceRefresh) {
      const cached = await StorageCenter.cache.get<WordGroup[]>(StorageKey.WORD_GROUPS_CACHE);
      if (cached && cached.length > 0) {
        console.log('[WordGroupsCenter] Returning cached groups:', cached.length);
        this.groups = cached;
        this.notifyListeners();
        return cached;
      }
    }

    this.loading = true;
    console.log('[WordGroupsCenter] Fetching from API...');

    try {
      const response = await ApiCenter.wordGroups.getAll();

      if (response.success && response.data) {
        this.groups = response.data;
        this.lastFetchTime = Date.now();

        // Cache for 5 minutes
        StorageCenter.cache.set(StorageKey.WORD_GROUPS_CACHE, response.data, 5 * 60 * 1000);

        console.log('[WordGroupsCenter] Fetched', response.data.length, 'groups from API');
        this.notifyListeners();

        // Emit event for other components
        EventBus.emit('wordgroups-updated', response.data);

        return response.data;
      } else {
        // Expected when offline or backend down. Degrade gracefully:
        // keep last good / cached groups, never throw to consumers.
        console.warn('[WordGroupsCenter] API returned error (handled, using cached/empty):', response.error?.message || response.error);
        return this.groups; // Return cached data on error
      }
    } catch (error: any) {
      // Network/offline failure is environmental and already returned as a
      // safe value; warn instead of surfacing a red console error.
      console.warn('[WordGroupsCenter] Fetch failed (handled, using cached/empty):', error?.message || error);
      return this.groups; // Return cached data on error
    } finally {
      this.loading = false;
    }
  }

  /**
   * Get all word groups (from memory)
   */
  getAll(): WordGroup[] {
    return [...this.groups];
  }

  /**
   * Get word group by ID
   */
  getById(id: string): WordGroup | undefined {
    return this.groups.find(g => g.id === id);
  }

  /**
   * Get word groups by language
   */
  getByLanguage(language: string): WordGroup[] {
    return this.groups.filter(g => g.language === language);
  }

  /**
   * Search word groups by name
   */
  search(query: string): WordGroup[] {
    const lowerQuery = query.toLowerCase();
    return this.groups.filter(g =>
      g.name.toLowerCase().includes(lowerQuery) ||
      g.description?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get word groups by type
   */
  getByType(type: string): WordGroup[] {
    return this.groups.filter(g => g.type === type);
  }

  /**
   * Get featured word groups (with progress > 0 or marked as featured)
   */
  getFeatured(): WordGroup[] {
    return this.groups.filter(g => g.progress > 0).slice(0, 5);
  }

  /**
   * Get recently accessed word groups
   */
  getRecent(limit: number = 5): WordGroup[] {
    // For now, return groups sorted by progress (groups being studied)
    return [...this.groups]
      .sort((a, b) => b.progress - a.progress)
      .slice(0, limit);
  }

  /**
   * Subscribe to word groups changes
   */
  subscribe(listener: WordGroupsListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current data
    listener([...this.groups]);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Invalidate cache and force refresh
   */
  async refresh(): Promise<WordGroup[]> {
    console.log('[WordGroupsCenter] Forcing refresh...');
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    this.lastFetchTime = 0; // Reset cooldown
    return this.fetchAll(true);
  }

  /**
   * Add a new word group (optimistic update)
   */
  async addGroup(group: WordGroup): Promise<boolean> {
    // Optimistically add to local state
    this.groups = [group, ...this.groups];
    this.notifyListeners();

    // TODO: Call API to persist
    // await ApiCenter.wordGroups.create(group);

    // Invalidate cache
    await this.invalidateCache();

    return true;
  }

  /**
   * Update word group progress
   */
  async updateProgress(groupId: string, progress: number): Promise<void> {
    const index = this.groups.findIndex(g => g.id === groupId);
    if (index !== -1) {
      this.groups[index] = { ...this.groups[index], progress };
      this.notifyListeners();

      // Update cache
      await StorageCenter.cache.set(StorageKey.WORD_GROUPS_CACHE, this.groups, 5 * 60 * 1000);
    }
  }

  /**
   * Check if currently loading
   */
  isLoading(): boolean {
    return this.loading;
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.groups.length;
  }

  /**
   * Invalidate cache
   */
  async invalidateCache(): Promise<void> {
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    this.lastFetchTime = 0;
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.groups = [];
    await this.invalidateCache();
    this.notifyListeners();
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const groupsCopy = [...this.groups];
    this.listeners.forEach(listener => listener(groupsCopy));
  }
}

export const WordGroupsCenter = new WordGroupsCenterClass();
