/**
 * API Center - Unified API Call Management
 * Centralized API operations with error handling, retry logic, and type safety
 */

import { apiManager } from './ApiManager';
import { StorageCenter, StorageKey } from './StorageCenter';
import { UserDataCenter } from './UserDataCenter';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code?: string;
    message: string;
  };
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  password: string;
  password_confirmation?: string;
  email?: string;
  nickname?: string;
  invite_code?: string;
}

export interface User {
  id: string;
  username: string;
  nickname?: string;
  email?: string;
  avatar?: string;
  avatar_url?: string;
  learning_languages?: string[];
  native_language?: string;
  total_words?: number;
  learned_words?: number;
  mastered_words?: number;
  learning_stats?: any;
  isPro?: boolean;
}

export interface WordGroup {
  id: string;
  name: string;
  description?: string;
  wordCount: number;
  coverImage?: string;
  language: string;
}

export interface Word {
  id: string;
  word: string;
  pronunciation?: string;
  definitions: string[];
  examples?: string[];
  audioUrl?: string;
  imageUrl?: string;
}

class ApiCenterClass {
  private defaultTimeout = 30000; // 30 seconds

  /**
   * Generic request method with unified error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useAuth: boolean = true
  ): Promise<ApiResponse<T>> {
    try {
      const baseUrl = apiManager.getCurrentBaseUrl();
      const url = `${baseUrl}/api/app_qy_v1${endpoint}`;

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...options.headers,
      };

      // Add auth token if required
      if (useAuth) {
        const token = StorageCenter.auth.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      let responseData: any;

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = { data: await response.text() };
      }

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: responseData.code || `HTTP_${response.status}`,
            message: responseData.message || `Request failed with status ${response.status}`,
          },
        };
      }

      // Handle different response formats
      if (responseData.success !== undefined) {
        return responseData;
      }

      // Laravel format: { data: {...}, message: "..." }
      return {
        success: true,
        data: responseData.data || responseData,
        message: responseData.message,
      };

    } catch (error: any) {
      console.error(`[ApiCenter] Request failed for ${endpoint}:`, error);

      if (error.name === 'AbortError') {
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: 'Request timeout',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error.message || 'Network error occurred',
        },
      };
    }
  }

  /**
   * User Profile APIs
   */

  /**
   * Authentication APIs
   */
  auth = {
    login: async (credentials: LoginCredentials): Promise<ApiResponse<{ user: User; token: string }>> => {
      const response = await this.request<any>('/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }, false);

      console.log('[ApiCenter] Login response:', response);

      if (response.success && response.data) {
        // Store token and user data
        // Laravel backend returns: { success, data: { user, login_token, ... }, token }
        const token = response.data.login_token || response.data.token || response.token;
        let user = response.data.user || response.data.data?.user;

        console.log('[ApiCenter] Extracted token:', token);
        console.log('[ApiCenter] Extracted user (before processing):', user);

        // Process user data through UserDataCenter
        if (user) {
          user = UserDataCenter.processUserData(user);
          console.log('[ApiCenter] Extracted user (after UserDataCenter processing):', user);
        }

        if (token) {
          StorageCenter.auth.setToken(token);
        }
        if (user) {
          StorageCenter.auth.setUser(user);
        }

        const result = {
          success: true,
          data: { user, token },
        };
        console.log('[ApiCenter] Returning result:', result);
        return result;
      }

      console.log('[ApiCenter] Login failed, returning response:', response);
      return response;
    },

    register: async (data: RegisterData): Promise<ApiResponse<{ user: User; token: string }>> => {
      const response = await this.request<any>('/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }, false);

      if (response.success && response.data) {
        // Laravel backend returns: { success, data: { user, token, ... } }
        const token = response.data.token || response.data.login_token || response.token;
        let user = response.data.user || response.data.data?.user;

        // Process user data through UserDataCenter
        if (user) {
          user = UserDataCenter.processUserData(user);
        }

        if (token) {
          StorageCenter.auth.setToken(token);
        }
        if (user) {
          StorageCenter.auth.setUser(user);
        }

        return {
          success: true,
          data: { user, token },
        };
      }

      // Normalize error message from backend
      if (!response.success && response.error) {
        const errorMsg = typeof response.error === 'string' 
          ? response.error 
          : response.error.message || response.message || 'Registration failed';
        
        response.error = {
          code: response.code || 'REGISTRATION_ERROR',
          message: errorMsg,
        };
      }

      return response;
    },

    logout: async (): Promise<ApiResponse<void>> => {
      const response = await this.request<void>('/logout', {
        method: 'POST',
      });

      if (response.success) {
        StorageCenter.auth.clearAuth();
        StorageCenter.cache.invalidateAll();
      }

      return response;
    },

    getProfile: async (): Promise<ApiResponse<User>> => {
      // Check cache first (cache for 5 minutes)
      const cached = StorageCenter.cache.get<User>(StorageKey.USER_PROFILE_CACHE);
      if (cached) {
        console.log('[ApiCenter] Returning cached user profile');
        return { success: true, data: cached };
      }

      // Use backend's /user endpoint which returns current user
      const response = await this.request<User>('/user', {
        method: 'GET',
      });

      // Cache immediately after successful fetch
      if (response.success && response.data) {
        StorageCenter.cache.set(StorageKey.USER_PROFILE_CACHE, response.data, 5 * 60 * 1000); // 5 minutes
        console.log('[ApiCenter] Cached user profile');
      }

      return response;
    },

    refreshToken: async (): Promise<ApiResponse<{ token: string }>> => {
      // Note: Backend may not have refresh endpoint yet
      // TODO: Implement refresh token endpoint in backend
      console.warn('[ApiCenter] Refresh token endpoint not implemented in backend');
      return {
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Refresh token not implemented',
        },
      };
    },
  };

  /**
   * Word Group APIs
   * Backend uses: query_all_groups, query_group_by_gid, query_gwords
   */
  wordGroups = {
    getAll: async (): Promise<ApiResponse<WordGroup[]>> => {
      // Check cache first
      const cached = StorageCenter.cache.get<WordGroup[]>(StorageKey.WORD_GROUPS_CACHE);
      if (cached) {
        return { success: true, data: cached };
      }

      // Backend route: /query_all_groups
      const response = await this.request<WordGroup[]>('/query_all_groups', {
        method: 'GET',
      });

      if (response.success && response.data) {
        // Cache for 5 minutes
        StorageCenter.cache.set(StorageKey.WORD_GROUPS_CACHE, response.data, 5 * 60 * 1000);
      }

      return response;
    },

    getById: async (id: string): Promise<ApiResponse<WordGroup>> => {
      // Backend route: /query_group_by_gid?gid={id}
      return this.request<WordGroup>(`/query_group_by_gid?gid=${encodeURIComponent(id)}`, {
        method: 'GET',
      });
    },

    getWords: async (groupId: string): Promise<ApiResponse<Word[]>> => {
      // Backend route: /query_gwords?gid={groupId}
      return this.request<Word[]>(`/query_gwords?gid=${encodeURIComponent(groupId)}`, {
        method: 'GET',
      });
    },
  };

  /**
   * Word APIs
   * Backend uses: query_word, query_translation
   */
  words = {
    getDetail: async (wordId: string): Promise<ApiResponse<Word>> => {
      return this.request<Word>(`/words/${wordId}`, {
        method: 'GET',
      });
    },

    search: async (query: string, language: string = 'en'): Promise<ApiResponse<Word[]>> => {
      // Backend route: /query_word?word={query}
      return this.request<Word[]>(`/query_word?word=${encodeURIComponent(query)}&lang=${language}`, {
        method: 'GET',
      });
    },

    translate: async (word: string, fromLang: string, toLang: string): Promise<ApiResponse<any>> => {
      // Backend route: /query_translation (POST)
      return this.request<any>('/query_translation', {
        method: 'POST',
        body: JSON.stringify({ word, from: fromLang, to: toLang }),
      });
    },
  };

  /**
   * Learning Progress APIs
   */
  learning = {
    getStats: async (userId?: string): Promise<ApiResponse<any>> => {
      const endpoint = userId ? `/learning/stats/${userId}` : '/learning/stats';
      return this.request<any>(endpoint, {
        method: 'GET',
      });
    },

    recordProgress: async (wordId: string, correct: boolean): Promise<ApiResponse<void>> => {
      return this.request<void>('/learning/progress', {
        method: 'POST',
        body: JSON.stringify({ word_id: wordId, correct }),
      });
    },

    getReviewQueue: async (): Promise<ApiResponse<Word[]>> => {
      return this.request<Word[]>('/learning/review-queue', {
        method: 'GET',
      });
    },
  };

  /**
   * Quiz APIs
   */
  quiz = {
    generate: async (groupId: string, count: number = 10): Promise<ApiResponse<any>> => {
      return this.request<any>('/quiz/generate', {
        method: 'POST',
        body: JSON.stringify({ group_id: groupId, count }),
      });
    },

    submit: async (quizId: string, answers: any[]): Promise<ApiResponse<any>> => {
      return this.request<any>('/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({ quiz_id: quizId, answers }),
      });
    },
  };

  /**
   * Settings APIs
   */
  settings = {
    get: async (): Promise<ApiResponse<any>> => {
      return this.request<any>('/settings', {
        method: 'GET',
      });
    },

    update: async (settings: any): Promise<ApiResponse<void>> => {
      return this.request<void>('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    },
  };

  /**
   * Dictionary APIs
   */
  dictionary = {
    lookup: async (word: string, language: string = 'en'): Promise<ApiResponse<Word>> => {
      return this.request<Word>(`/dictionary/${language}/${encodeURIComponent(word)}`, {
        method: 'GET',
      });
    },

    getSupportedLanguages: async (): Promise<ApiResponse<string[]>> => {
      // Check cache first (cache for 24 hours - languages don't change often)
      const cached = StorageCenter.cache.get<any>(StorageKey.SUPPORTED_LANGUAGES_CACHE);
      if (cached) {
        console.log('[ApiCenter] Returning cached supported languages');
        return { success: true, data: cached };
      }

      // Fetch from API
      const response = await this.request<string[]>('/dictionary/languages', {
        method: 'GET',
      });

      // Cache immediately after successful fetch
      if (response.success && response.data) {
        StorageCenter.cache.set(StorageKey.SUPPORTED_LANGUAGES_CACHE, response.data, 24 * 60 * 60 * 1000); // 24 hours
        console.log('[ApiCenter] Cached supported languages');
      }

      return response;
    },
  };

  /**
   * User APIs
   */
  user = {
    getProfile: async (): Promise<ApiResponse<{ user: User }>> => {
      // Check cache first (cache for 5 minutes)
      const cached = StorageCenter.cache.get<{ user: User }>(StorageKey.USER_PROFILE_CACHE);
      if (cached) {
        console.log('[ApiCenter] Returning cached user profile');
        return { success: true, data: cached };
      }

      // Fetch from API
      const response = await this.request<{ user: User }>('/user/profile', {
        method: 'GET',
      }, true);

      // Cache immediately after successful fetch
      if (response.success && response.data?.user) {
        StorageCenter.cache.set(StorageKey.USER_PROFILE_CACHE, response.data, 5 * 60 * 1000); // 5 minutes
        console.log('[ApiCenter] Cached user profile');
        response.data.user = UserDataCenter.processUserData(response.data.user);
      }

      return response;
    },

    updateProfile: async (data: {
      nickname?: string;
      name?: string;
      bio?: string;
      location?: string;
      native_language?: string;
      learning_languages?: string[];
      avatar_base64?: string;
      avatar_filename?: string;
    }): Promise<ApiResponse<{ user: User }>> => {
      const response = await this.request<{ user: User }>('/user/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }, true);

      if (response.success && response.data?.user) {
        response.data.user = UserDataCenter.processUserData(response.data.user);
      }

      return response;
    },

    updateAvatar: async (file: File): Promise<ApiResponse<{ avatar_url: string }>> => {
      const formData = new FormData();
      formData.append('avatar', file);

      const baseUrl = apiManager.getCurrentBaseUrl();
      const url = `${baseUrl}/api/app_qy_v1/user/avatar`;

      const token = StorageCenter.auth.getToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: data.code || `HTTP_${response.status}`,
            message: data.message || 'Upload failed',
          },
        };
      }

      return {
        success: true,
        data: data.data || data,
      };
    },
  };
}

export const ApiCenter = new ApiCenterClass();
