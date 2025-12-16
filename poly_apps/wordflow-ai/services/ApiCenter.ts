/**
 * API Center - Unified API Call Management
 * Centralized API operations with error handling, retry logic, and type safety
 */

import { apiManager } from './ApiManager';
import { StorageCenter, StorageKey } from './StorageCenter';

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
  learning_languages?: string[];
  native_language?: string;
  total_words?: number;
  learned_words?: number;
  mastered_words?: number;
  learning_stats?: any;
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
   * Process user avatar URL
   * Backend should return avatar_url, but fallback to constructing it if needed
   */
  private processUserAvatarUrl(user: any): any {
    // If backend already provided avatar_url, use it
    if (user.avatar_url) {
      return user;
    }

    // Fallback: construct URL from avatar path
    if (user.avatar && !user.avatar.startsWith('http')) {
      const baseUrl = apiManager.getCurrentBaseUrl();
      // Backend should serve avatars via /api/files/avatars/{app}/{filename}
      // Extract app name and filename from path like "avatars/appqyv1/avatar_1_xxx.png"
      const parts = user.avatar.split('/');
      if (parts.length >= 3 && parts[0] === 'avatars') {
        const app = parts[1];
        const filename = parts[2];
        user.avatar_url = `${baseUrl}/api/files/avatars/${app}/${filename}`;
      } else {
        // Fallback for unexpected format
        user.avatar_url = `${baseUrl}/api/files/${user.avatar}`;
      }
    } else {
      user.avatar_url = user.avatar;
    }
    return user;
  }

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
        const user = response.data.user || response.data.data?.user;

        console.log('[ApiCenter] Extracted token:', token);
        console.log('[ApiCenter] Extracted user:', user);

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

        // Process avatar URL
        if (user) {
          user = this.processUserAvatarUrl(user);
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
      // Use backend's /user endpoint which returns current user
      const response = await this.request<User>('/user', {
        method: 'GET',
      });

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
   */
  wordGroups = {
    getAll: async (): Promise<ApiResponse<WordGroup[]>> => {
      // Check cache first
      const cached = StorageCenter.cache.get<WordGroup[]>(StorageKey.WORD_GROUPS_CACHE);
      if (cached) {
        return { success: true, data: cached };
      }

      const response = await this.request<WordGroup[]>('/word-groups', {
        method: 'GET',
      });

      if (response.success && response.data) {
        // Cache for 5 minutes
        StorageCenter.cache.set(StorageKey.WORD_GROUPS_CACHE, response.data, 5 * 60 * 1000);
      }

      return response;
    },

    getById: async (id: string): Promise<ApiResponse<WordGroup>> => {
      return this.request<WordGroup>(`/word-groups/${id}`, {
        method: 'GET',
      });
    },

    getWords: async (groupId: string): Promise<ApiResponse<Word[]>> => {
      return this.request<Word[]>(`/word-groups/${groupId}/words`, {
        method: 'GET',
      });
    },
  };

  /**
   * Word APIs
   */
  words = {
    getDetail: async (wordId: string): Promise<ApiResponse<Word>> => {
      return this.request<Word>(`/words/${wordId}`, {
        method: 'GET',
      });
    },

    search: async (query: string, language: string = 'en'): Promise<ApiResponse<Word[]>> => {
      return this.request<Word[]>(`/words/search?q=${encodeURIComponent(query)}&lang=${language}`, {
        method: 'GET',
      });
    },

    translate: async (word: string, fromLang: string, toLang: string): Promise<ApiResponse<any>> => {
      return this.request<any>('/words/translate', {
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
      return this.request<string[]>('/dictionary/languages', {
        method: 'GET',
      });
    },
  };

  /**
   * User APIs
   */
  user = {
    getProfile: async (): Promise<ApiResponse<{ user: User }>> => {
      const response = await this.request<{ user: User }>('/user/profile', {
        method: 'GET',
      }, true);

      if (response.success && response.data?.user) {
        response.data.user = this.processUserAvatarUrl(response.data.user);
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
        response.data.user = this.processUserAvatarUrl(response.data.user);
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
