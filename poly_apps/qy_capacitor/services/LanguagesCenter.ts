/**
 * Languages Center - Unified Supported Languages Management
 * Centralized management of supported languages with long-term caching
 */

import { SupportedLanguage } from '../types';
import { ApiCenter } from './ApiCenter';
import { StorageCenter, StorageKey } from './StorageCenter';

type LanguagesListener = (languages: SupportedLanguage[]) => void;

/**
 * Built-in offline fallback. The app must stay usable when the backend is
 * unreachable (e.g. `TypeError: Failed to fetch`) and no 24h cache exists,
 * so the supported-languages list is never empty.
 */
const DEFAULT_SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', native_name: 'English', voice_id: 'en-US-JennyNeural', has_tts: true, flag: '🇺🇸' },
  { code: 'zh', name: 'Chinese', native_name: '中文', voice_id: 'zh-CN-XiaoxiaoNeural', has_tts: true, flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', native_name: '日本語', voice_id: 'ja-JP-NanamiNeural', has_tts: true, flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', native_name: '한국어', voice_id: 'ko-KR-SunHiNeural', has_tts: true, flag: '🇰🇷' },
  { code: 'es', name: 'Spanish', native_name: 'Español', voice_id: 'es-ES-ElviraNeural', has_tts: true, flag: '🇪🇸' },
  { code: 'fr', name: 'French', native_name: 'Français', voice_id: 'fr-FR-DeniseNeural', has_tts: true, flag: '🇫🇷' },
  { code: 'de', name: 'German', native_name: 'Deutsch', voice_id: 'de-DE-KatjaNeural', has_tts: true, flag: '🇩🇪' },
  { code: 'ru', name: 'Russian', native_name: 'Русский', voice_id: 'ru-RU-SvetlanaNeural', has_tts: true, flag: '🇷🇺' },
  { code: 'ar', name: 'Arabic', native_name: 'العربية', voice_id: 'ar-EG-SalmaNeural', has_tts: true, flag: '🇸🇦' },
  { code: 'pt', name: 'Portuguese', native_name: 'Português', voice_id: 'pt-BR-FranciscaNeural', has_tts: true, flag: '🇧🇷' },
];

class LanguagesCenterClass {
  // Seeded with the built-in fallback so the list is never empty offline.
  private supportedLanguages: SupportedLanguage[] = [...DEFAULT_SUPPORTED_LANGUAGES];
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
    const cached = await StorageCenter.cache.get<SupportedLanguage[]>(
      StorageKey.SUPPORTED_LANGUAGES_CACHE
    );

    // Unified format: cached data is always an array
    if (cached && Array.isArray(cached) && cached.length > 0) {
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
    const cached = await StorageCenter.cache.get<SupportedLanguage[]>(
      StorageKey.SUPPORTED_LANGUAGES_CACHE
    );
    
    // Unified format: cached data is always an array
    if (cached && Array.isArray(cached) && cached.length > 0) {
      console.log('[LanguagesCenter] Returning cached languages:', cached.length);
      this.supportedLanguages = cached;
      this.notifyListeners();
      return cached;
    }

    this.loading = true;
    console.log('[LanguagesCenter] Fetching from API...');

    try {
      const response = await ApiCenter.system.getSupportedLanguages();

      if (response.success && response.data && Array.isArray(response.data)) {
        // Unified format: response.data is always SupportedLanguage[]
        this.supportedLanguages = response.data;

        // Cache for 24 hours (languages don't change often)
        // Note: ApiCenter.dictionary.getSupportedLanguages() already caches, but we cache here too for redundancy
        await StorageCenter.cache.set(
          StorageKey.SUPPORTED_LANGUAGES_CACHE,
          response.data,
          24 * 60 * 60 * 1000 // 24 hours
        );

        console.log('[LanguagesCenter] Fetched', response.data.length, 'languages from API');
        this.notifyListeners();

        return response.data;
      } else {
        // Don't log errors for public API - it's not critical if it fails
        // Just return cached data or empty array
        const errorCode = response.error?.code;
        if (errorCode !== 'AUTH_REQUIRED') {
          // Only log non-auth errors (auth errors are expected for public API)
          console.warn('[LanguagesCenter] API returned error (non-critical):', response.error?.message);
        }
        return this.supportedLanguages;
      }
    } catch (error: any) {
      // Public API failure is non-critical (offline / backend down). Keep the
      // app usable: ensure the built-in fallback list is present, never empty.
      console.warn('[LanguagesCenter] Fetch failed (non-critical, using fallback):', error?.message || 'Network error');
      if (!this.supportedLanguages || this.supportedLanguages.length === 0) {
        this.supportedLanguages = [...DEFAULT_SUPPORTED_LANGUAGES];
        this.notifyListeners();
      }
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
      lang.native_name?.toLowerCase().includes(lowerQuery) ||
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

    return preferNative && lang.native_name ? lang.native_name : lang.name;
  }

  /**
   * Subscribe to languages changes
   */
  subscribe(listener: LanguagesListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current data (ensure it's always an array)
    const languages = Array.isArray(this.supportedLanguages) ? [...this.supportedLanguages] : [];
    listener(languages);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Force refresh (invalidate cache and fetch)
   */
  async refresh(): Promise<SupportedLanguage[]> {
    console.log('[LanguagesCenter] Forcing refresh...');
    await StorageCenter.cache.invalidate(StorageKey.SUPPORTED_LANGUAGES_CACHE);
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
  async invalidateCache(): Promise<void> {
    await StorageCenter.cache.invalidate(StorageKey.SUPPORTED_LANGUAGES_CACHE);
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.supportedLanguages = [];
    this.initialized = false;
    await this.invalidateCache();
    this.notifyListeners();
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    // Ensure it's always an array before spreading
    const languagesCopy = Array.isArray(this.supportedLanguages) ? [...this.supportedLanguages] : [];
    this.listeners.forEach(listener => listener(languagesCopy));
  }
}

export const LanguagesCenter = new LanguagesCenterClass();
