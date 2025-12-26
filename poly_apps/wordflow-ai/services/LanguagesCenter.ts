/**
 * Languages Center - Unified Supported Languages Management
 * Centralized management of supported languages with long-term caching
 */

import { SupportedLanguage } from '../types';
import { ApiCenter } from './ApiCenter';
import { StorageCenter, StorageKey } from './StorageCenter';

type LanguagesListener = (languages: SupportedLanguage[]) => void;

class LanguagesCenterClass {
  private supportedLanguages: SupportedLanguage[] = [];
  private listeners: Set<LanguagesListener> = new Set();
  private loading: boolean = false;
  private initialized: boolean = false;

  /**
   * Initialize - load from cache
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[LanguagesCenter] Already initialized');
      return;
    }

    // Try to load from 24-hour cache
    const cached = StorageCenter.cache.get<SupportedLanguage[]>(
      StorageKey.SUPPORTED_LANGUAGES_CACHE
    );

    if (cached && cached.length > 0) {
      console.log('[LanguagesCenter] Loaded from cache:', cached.length, 'languages');
      this.supportedLanguages = cached;
      this.initialized = true;
      this.notifyListeners();
      return;
    }

    // No cache, fetch from API
    await this.fetchSupportedLanguages();
    this.initialized = true;
  }

  /**
   * Fetch supported languages from API
   * Cached for 24 hours
   */
  async fetchSupportedLanguages(): Promise<SupportedLanguage[]> {
    if (this.loading) {
      console.log('[LanguagesCenter] Fetch already in progress');
      return this.supportedLanguages;
    }

    // Check cache first (24 hours)
    const cached = StorageCenter.cache.get<SupportedLanguage[]>(
      StorageKey.SUPPORTED_LANGUAGES_CACHE
    );
    if (cached && cached.length > 0) {
      console.log('[LanguagesCenter] Returning cached languages:', cached.length);
      this.supportedLanguages = cached;
      this.notifyListeners();
      return cached;
    }

    this.loading = true;
    console.log('[LanguagesCenter] Fetching from API...');

    try {
      const response = await ApiCenter.system.getSupportedLanguages();

      if (response.success && response.data) {
        this.supportedLanguages = response.data;

        // Cache for 24 hours (languages don't change often)
        StorageCenter.cache.set(
          StorageKey.SUPPORTED_LANGUAGES_CACHE,
          response.data,
          24 * 60 * 60 * 1000 // 24 hours
        );

        console.log('[LanguagesCenter] Fetched', response.data.length, 'languages from API');
        this.notifyListeners();

        return response.data;
      } else {
        console.error('[LanguagesCenter] API returned error:', response.error);
        return this.supportedLanguages;
      }
    } catch (error) {
      console.error('[LanguagesCenter] Fetch failed:', error);
      return this.supportedLanguages;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Get all supported languages
   */
  getAll(): SupportedLanguage[] {
    return [...this.supportedLanguages];
  }

  /**
   * Get language by code
   */
  getByCode(code: string): SupportedLanguage | undefined {
    return this.supportedLanguages.find(lang => lang.code === code);
  }

  /**
   * Get languages by codes (batch)
   */
  getByCodes(codes: string[]): SupportedLanguage[] {
    return this.supportedLanguages.filter(lang => codes.includes(lang.code));
  }

  /**
   * Search languages by name
   */
  search(query: string): SupportedLanguage[] {
    const lowerQuery = query.toLowerCase();
    return this.supportedLanguages.filter(lang =>
      lang.name.toLowerCase().includes(lowerQuery) ||
      lang.nativeName?.toLowerCase().includes(lowerQuery) ||
      lang.code.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get popular languages (if flagged in API response)
   */
  getPopular(): SupportedLanguage[] {
    return this.supportedLanguages.filter(lang => (lang as any).popular === true);
  }

  /**
   * Check if language is supported
   */
  isSupported(code: string): boolean {
    return this.supportedLanguages.some(lang => lang.code === code);
  }

  /**
   * Get language name by code (with fallback)
   */
  getLanguageName(code: string, preferNative: boolean = false): string {
    const lang = this.getByCode(code);
    if (!lang) return code.toUpperCase();

    return preferNative && lang.nativeName ? lang.nativeName : lang.name;
  }

  /**
   * Subscribe to languages changes
   */
  subscribe(listener: LanguagesListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current data
    listener([...this.supportedLanguages]);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Force refresh (invalidate cache and fetch)
   */
  async refresh(): Promise<SupportedLanguage[]> {
    console.log('[LanguagesCenter] Forcing refresh...');
    StorageCenter.cache.invalidate(StorageKey.SUPPORTED_LANGUAGES_CACHE);
    return this.fetchSupportedLanguages();
  }

  /**
   * Check if currently loading
   */
  isLoading(): boolean {
    return this.loading;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.supportedLanguages.length;
  }

  /**
   * Invalidate cache
   */
  invalidateCache(): void {
    StorageCenter.cache.invalidate(StorageKey.SUPPORTED_LANGUAGES_CACHE);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.supportedLanguages = [];
    this.initialized = false;
    this.invalidateCache();
    this.notifyListeners();
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const languagesCopy = [...this.supportedLanguages];
    this.listeners.forEach(listener => listener(languagesCopy));
  }
}

export const LanguagesCenter = new LanguagesCenterClass();
