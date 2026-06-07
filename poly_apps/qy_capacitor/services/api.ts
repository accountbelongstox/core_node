
import { MOCK_USER, MOCK_WORD_GROUPS, MOCK_WORDS_EN, MOCK_WORDS_JP, SUPPORTED_LANGUAGES, MOCK_QUIZ_QUESTIONS, MOCK_RETENTION_STATS } from './mockData';
import { User, Word, WordGroup, AppSettings, QuizQuestion, RetentionStat, CourseAnalysis } from '../types';
import { apiManager } from './ApiManager';
import { StorageCenter, StorageKey } from './StorageCenter';
import { inferLanguageFromWords, BackendGroupData } from './languageUtils';

const USE_MOCK_FALLBACK = true;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class ApiService {
  private token: string | null = null;
  private currentLanguage: string = 'en';

  setToken(token: string) {
    this.token = token;
    StorageCenter.set(StorageKey.AUTH_TOKEN, token);
  }

  setLanguage(lang: string) {
    this.currentLanguage = lang;
  }

  // Generic fetch wrapper with Fallback Logic
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const controller = new AbortController();
      // Increase timeout for critical endpoints like language list
      const isCriticalEndpoint = endpoint.includes('/system/supported-languages');
      const timeout = isCriticalEndpoint ? 5000 : 1500;
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const baseUrl = apiManager.getCurrentBaseUrl();

      // Read the auth token from storage per request (mirrors ApiCenter). The
      // in-memory this.token is never hydrated on reload, so relying on it sent
      // `Bearer null` and the backend rejected every authenticated call.
      const token = this.token || (await StorageCenter.auth.getToken());
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-App-Language': this.currentLanguage,
        ...(options.headers as Record<string, string>),
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${baseUrl}/api/app_qy_v1${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      return data.data;

    } catch (error) {
      // For critical endpoints like language list, don't use mock fallback
      // This ensures we always get real data from backend
      if (endpoint.includes('/system/supported-languages')) {
        console.error(`[ApiService] Failed to fetch supported languages from backend:`, error);
        throw error; // Re-throw to let caller handle the error
      }
      
      console.warn(`[MockDataCenter] API unavailable for ${endpoint}. Serving mock data.`);
      if (USE_MOCK_FALLBACK) {
        return this.getMockResponse<T>(endpoint);
      }
      throw error;
    }
  }

  private async getMockResponse<T>(endpoint: string): Promise<T> {
    await delay(400); // Simulate subtle latency for realism

    if (endpoint.includes('/login')) {
      return { token: 'mock-jwt-token', user: MOCK_USER } as unknown as T;
    }
    if (endpoint === '/user/profile') return MOCK_USER as unknown as T;
    if (endpoint === '/system/supported-languages') return SUPPORTED_LANGUAGES as unknown as T;

    // Word Groups (updated to backend routes)
    if (endpoint === '/query_all_groups' || endpoint === '/word-groups') {
       return MOCK_WORD_GROUPS as unknown as T;
    }
    if (endpoint.includes('/query_gwords') || endpoint.includes('/word-groups/')) {
      return (this.currentLanguage === 'jp' ? MOCK_WORDS_JP : MOCK_WORDS_EN) as unknown as T;
    }

    if (endpoint.includes('/words')) {
      return (this.currentLanguage === 'jp' ? MOCK_WORDS_JP : MOCK_WORDS_EN) as unknown as T;
    }
    if (endpoint === '/quiz/generate') {
      return MOCK_QUIZ_QUESTIONS as unknown as T;
    }
    if (endpoint === '/user/stats/retention') {
      return MOCK_RETENTION_STATS as unknown as T;
    }
    if (endpoint.includes('/words/detail/')) {
        return MOCK_WORDS_EN[0] as unknown as T;
    }
    if (endpoint.includes('/analysis')) {
        // Mock Analysis
        return {
           groupId: 'g1',
           totalWords: 3000,
           knownWords: 450,
           newWords: 2550,
           estimatedDays: 128,
           similarity: 15
        } as unknown as T;
    }

    return {} as T;
  }

  // Public Methods
  async login(email: string, password: string) {
    const result = await this.request<{token: string, user: User}>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    // Clear user profile cache on login to ensure fresh data
    if (result && result.user) {
      StorageCenter.cache.invalidate(StorageKey.USER_PROFILE_CACHE);
      // Cache the new user profile immediately
      StorageCenter.cache.set(StorageKey.USER_PROFILE_CACHE, result.user, 5 * 60 * 1000);
    }
    
    return result;
  }

  async getUserProfile() {
    // Check cache first (cache for 5 minutes)
    const cached = StorageCenter.cache.get<User>(StorageKey.USER_PROFILE_CACHE);
    if (cached) {
      console.log('[ApiService] Returning cached user profile');
      return cached;
    }

    // Fetch from API
    const user = await this.request<User>('/user/profile');
    
    // Cache immediately after successful fetch
    if (user) {
      StorageCenter.cache.set(StorageKey.USER_PROFILE_CACHE, user, 5 * 60 * 1000); // 5 minutes
      console.log('[ApiService] Cached user profile');
    }
    
    return user;
  }

  async getSupportedLanguages() {
    // Check cache first (cache for 24 hours - languages don't change often)
    const cached = StorageCenter.cache.get<any>(StorageKey.SUPPORTED_LANGUAGES_CACHE);
    if (cached) {
      console.log('[ApiService] Returning cached supported languages');
      return cached;
    }

    // Fetch from API
    const languages = await this.request('/system/supported-languages');
    
    // Cache immediately after successful fetch
    if (languages) {
      StorageCenter.cache.set(StorageKey.SUPPORTED_LANGUAGES_CACHE, languages, 24 * 60 * 60 * 1000); // 24 hours
      console.log('[ApiService] Cached supported languages');
    }
    
    return languages;
  }

  async getWordGroups() {
    // Check cache first (cache for 5 minutes)
    const cached = StorageCenter.cache.get<WordGroup[]>(StorageKey.WORD_GROUPS_CACHE);
    if (cached) {
      console.log('[ApiService] Returning cached word groups');
      return cached;
    }

    try {
      // Fetch from API
      // Backend returns: { success, data: { uid, total, groups: [...] } }
      // But request() method extracts data.data, so we get: { uid, total, groups: [...] }
      const response = await this.request<{ uid: string; total: number; groups: BackendGroupData[] }>('/query_all_groups');

      // Extract and transform groups
      let groups: WordGroup[] = [];

      if (response && response.groups && Array.isArray(response.groups)) {
        console.log(`[ApiService] Received ${response.groups.length} groups from backend`);

        groups = response.groups.map((bg: BackendGroupData) => ({
          id: bg.gid,
          name: bg.gname,
          count: bg.total_words || 0,
          type: bg.type || 'user',
          progress: bg.progress || 0,
          coverImage: bg.cover_image || '📚',
          language: bg.language || inferLanguageFromWords(bg.gwords || []) || 'en',
          description: bg.description,
        }));
      } else if (Array.isArray(response)) {
        // Fallback: if response is array (old mock format)
        console.warn('[ApiService] Received array response (old format), using as-is');
        groups = response as any as WordGroup[];
      } else {
        console.error('[ApiService] Unexpected response format:', response);
        throw new Error('Unexpected response format from backend');
      }

      // Cache immediately after successful fetch
      if (groups && Array.isArray(groups) && groups.length > 0) {
        StorageCenter.cache.set(StorageKey.WORD_GROUPS_CACHE, groups, 5 * 60 * 1000); // 5 minutes
        console.log(`[ApiService] Cached ${groups.length} word groups`);
      }

      return groups;
    } catch (error) {
      console.error('[ApiService] Failed to fetch word groups:', error);
      // Return empty array instead of throwing to allow app to continue
      return [];
    }
  }

  async getWordsForGroup(groupId: string) {
    return this.request<Word[]>(`/query_gwords?gid=${encodeURIComponent(groupId)}`);
  }
  
  async getWordDetail(wordId: string) {
    return this.request<Word>(`/words/detail/${wordId}`);
  }

  async getQuizSession() {
    return this.request<QuizQuestion[]>('/quiz/generate');
  }

  async getRetentionStats() {
    return this.request<RetentionStat[]>('/user/stats/retention');
  }

  async analyzeCourse(groupId: string) {
      return this.request<CourseAnalysis>(`/word-groups/${groupId}/analysis`);
  }

  async addToLibrary(groupId: string) {
      // Mock action
      await delay(500);
      return true;
  }

  async syncSettings(settings: AppSettings) {
    console.log('Syncing settings to backend...', settings);
    return true;
  }

  /**
   * Cache management methods
   */
  clearCache(key?: StorageKey) {
    if (key) {
      StorageCenter.cache.invalidate(key);
      console.log(`[ApiService] Cleared cache for ${key}`);
    } else {
      StorageCenter.cache.invalidateAll();
      console.log('[ApiService] Cleared all caches');
    }
  }

  /**
   * Force refresh supported languages (clear cache and fetch)
   */
  async refreshSupportedLanguages() {
    StorageCenter.cache.invalidate(StorageKey.SUPPORTED_LANGUAGES_CACHE);
    return this.getSupportedLanguages();
  }

  /**
   * Force refresh user profile (clear cache and fetch)
   */
  async refreshUserProfile() {
    StorageCenter.cache.invalidate(StorageKey.USER_PROFILE_CACHE);
    return this.getUserProfile();
  }

  /**
   * Force refresh word groups (clear cache and fetch)
   */
  async refreshWordGroups() {
    StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return this.getWordGroups();
  }
}

export const api = new ApiService();
