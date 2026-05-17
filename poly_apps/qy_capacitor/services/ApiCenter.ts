/**
 * API Center - Unified API Call Management
 * Centralized API operations with error handling, retry logic, and type safety
 */

import { apiManager } from './ApiManager';
import { StorageCenter, StorageKey } from './StorageCenter';
import { UserDataCenter } from './UserDataCenter';
import { inferLanguageFromWords, BackendGroupData, BackendGroupsResponse } from './languageUtils';
import { SupportedLanguage } from '../types';

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

export interface VocabularyRecommendation {
  id: number;
  name: string;
  description?: string;
  word_count: number;
  level?: string;
  category?: string;
  language_code: string;
  is_selected?: boolean;
}

export interface SelectedCollection {
  id: number;
  collection_id: number;
  name: string;
  description?: string;
  word_count: number;
  level?: string;
  category?: string;
  selected_at: string;
}

export interface VocabularyLibrary {
  id: number;
  name: string;
  description?: string;
  word_count: number;
  language_code: string;
  is_public: boolean;
  is_selected?: boolean;
  created_at?: string;
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
        const token = await StorageCenter.auth.getToken();
        if (!token) {
          // Don't make API call if authentication is required but no token exists
          console.warn(`[ApiCenter] Authentication required for ${endpoint} but no token found. Skipping request.`);
          return {
            success: false,
            error: {
              code: 'AUTH_REQUIRED',
              message: 'Authentication required. Please login first.',
            },
          };
        }
        headers['Authorization'] = `Bearer ${token}`;
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
          await StorageCenter.auth.setToken(token);
        }
        if (user) {
          await StorageCenter.auth.setUser(user);
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
          await StorageCenter.auth.setToken(token);
        }
        if (user) {
          await StorageCenter.auth.setUser(user);
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
        await StorageCenter.auth.clearAuth();
        await StorageCenter.cache.invalidateAll();
      }

      return response;
    },

    getProfile: async (): Promise<ApiResponse<User>> => {
      // Check cache first (cache for 5 minutes)
      const cached = await StorageCenter.cache.get<User>(StorageKey.USER_PROFILE_CACHE);
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
        await StorageCenter.cache.set(StorageKey.USER_PROFILE_CACHE, response.data, 5 * 60 * 1000); // 5 minutes
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

    forgotPassword: async (email: string): Promise<ApiResponse<{ message: string }>> => {
      return await this.request<{ message: string }>('/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }, false);
    },

    resetPassword: async (email: string, token: string, password: string, password_confirmation: string): Promise<ApiResponse<{ message: string }>> => {
      return await this.request<{ message: string }>('/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          token,
          password,
          password_confirmation
        }),
      }, false);
    },
  };

  /**
   * Word Group APIs
   * Backend uses: query_all_groups, query_group_by_gid, query_group_by_name, query_gwords,
   *              query_gcontent, query_gfrequency, create_group, delete_group_by_gid, delete_group_by_name
   */
  wordGroups = {
    getAll: async (): Promise<ApiResponse<WordGroup[]>> => {
      // Check cache first
      const cached = await StorageCenter.cache.get<WordGroup[]>(StorageKey.WORD_GROUPS_CACHE);
      if (cached) {
        console.log('[ApiCenter] Returning cached word groups');
        return { success: true, data: cached };
      }

      try {
        // Backend route: /query_all_groups
        // Backend returns: { success, data: { uid, total, groups: [...] } }
        const response = await this.request<BackendGroupsResponse>('/query_all_groups', {
          method: 'GET',
        });

        if (!response.success) {
          return {
            success: false,
            error: {
              message: response.error?.message || 'Failed to fetch word groups',
              code: response.error?.code
            }
          };
        }

        // Validate response structure
        if (!response.data || !response.data.groups || !Array.isArray(response.data.groups)) {
          console.error('[ApiCenter] Invalid response structure:', response);
          return {
            success: false,
            error: {
              message: 'Invalid response structure from backend',
              code: 'INVALID_RESPONSE'
            }
          };
        }

        const backendGroups = response.data.groups;
        console.log(`[ApiCenter] Received ${backendGroups.length} groups from backend`);

        // Map backend format to frontend format
        const frontendGroups: WordGroup[] = backendGroups.map((bg: BackendGroupData) => ({
          id: bg.gid,
          name: bg.gname,
          count: bg.total_words || 0,
          type: bg.type || 'user',
          progress: bg.progress || 0,
          coverImage: bg.cover_image || '📚',
          language: bg.language || inferLanguageFromWords(bg.gwords || []) || 'en',
          description: bg.description,
        }));

        // Cache for 5 minutes
        if (frontendGroups.length > 0) {
          await StorageCenter.cache.set(StorageKey.WORD_GROUPS_CACHE, frontendGroups, 5 * 60 * 1000);
          console.log(`[ApiCenter] Cached ${frontendGroups.length} word groups`);
        }

        return { success: true, data: frontendGroups };

      } catch (error: any) {
        console.error('[ApiCenter] Error fetching word groups:', error);
        return {
          success: false,
          error: {
            message: error.message || 'Unknown error occurred',
            code: 'FETCH_ERROR'
          }
        };
      }
    },

    getById: async (id: string): Promise<ApiResponse<WordGroup>> => {
      // Backend route: /query_group_by_gid?gid={id}
      return this.request<WordGroup>(`/query_group_by_gid?gid=${encodeURIComponent(id)}`, {
        method: 'GET',
      });
    },

    getByName: async (name: string): Promise<ApiResponse<WordGroup>> => {
      // Backend route: /query_group_by_name
      return this.request<WordGroup>('/query_group_by_name', {
        method: 'POST',
        body: JSON.stringify({ group_name: name }),
      });
    },

    getWords: async (groupId: string): Promise<ApiResponse<Word[]>> => {
      // Backend route: /query_gwords?gid={groupId}
      return this.request<Word[]>(`/query_gwords?gid=${encodeURIComponent(groupId)}`, {
        method: 'GET',
      });
    },

    getContent: async (groupId: string): Promise<ApiResponse<any>> => {
      // Backend route: /query_gcontent
      return this.request<any>('/query_gcontent', {
        method: 'POST',
        body: JSON.stringify({ gid: groupId }),
      });
    },

    getFrequency: async (groupId: string): Promise<ApiResponse<any>> => {
      // Backend route: /query_gfrequency
      return this.request<any>('/query_gfrequency', {
        method: 'POST',
        body: JSON.stringify({ gid: groupId }),
      });
    },

    create: async (data: {
      name: string;
      description?: string;
      language: string;
    }): Promise<ApiResponse<{ group_id: string; message: string }>> => {
      // Backend route: /create_group
      const response = await this.request<{ group_id: string; message: string }>('/create_group', {
        method: 'POST',
        body: JSON.stringify({
          group_name: data.name,
          description: data.description,
          language: data.language,
        }),
      });

      // Invalidate cache after creating
      if (response.success) {
        await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
      }

      return response;
    },

    delete: async (groupId: string): Promise<ApiResponse<{ message: string }>> => {
      // Backend route: /delete_group_by_gid
      const response = await this.request<{ message: string }>('/delete_group_by_gid', {
        method: 'POST',
        body: JSON.stringify({ gid: groupId }),
      });

      // Invalidate cache after deletion
      if (response.success) {
        await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
      }

      return response;
    },

    deleteByName: async (name: string): Promise<ApiResponse<{ message: string }>> => {
      // Backend route: /delete_group_by_name
      const response = await this.request<{ message: string }>('/delete_group_by_name', {
        method: 'POST',
        body: JSON.stringify({ group_name: name }),
      });

      // Invalidate cache after deletion
      if (response.success) {
        await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
      }

      return response;
    },

    getAllByManager: async (): Promise<ApiResponse<WordGroup[]>> => {
      // Backend route: /get_all_groups_by_manager
      return this.request<WordGroup[]>('/get_all_groups_by_manager', {
        method: 'GET',
      });
    },

    // Add library to group
    // Backend route: /group/add_library
    addLibraryToGroup: async (data: {
      gid: string;
      library_id: number;
    }): Promise<ApiResponse<{ words_added: number; message: string }>> => {
      const response = await this.request<{ words_added: number; message: string }>('/group/add_library', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      // Invalidate cache after adding library
      if (response.success) {
        await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
      }

      return response;
    },
  };

  /**
   * Word APIs
   * Backend uses: query_word, query_translation, daily words, lookup, word_exists, etc
   */
  words = {
    getDetail: async (wordId: string): Promise<ApiResponse<Word>> => {
      return this.request<Word>(`/words/${wordId}`, {
        method: 'GET',
      });
    },

    getDailyWords: async (count: number = 10): Promise<ApiResponse<Word[]>> => {
      return this.request<Word[]>(`/words/daily?count=${count}`, {
        method: 'GET',
      });
    },

    search: async (query: string, language: string = 'en'): Promise<ApiResponse<Word[]>> => {
      // Backend route: /query_word?word={query}
      return this.request<Word[]>(`/qurey_word?word=${encodeURIComponent(query)}&lang=${language}`, {
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

    // Word Lookup APIs
    lookup: async (word: string, language?: string): Promise<ApiResponse<any>> => {
      const params = new URLSearchParams({ word });
      if (language) params.append('language', language);
      return this.request<any>(`/lookup?${params.toString()}`, {
        method: 'GET',
      });
    },

    batchLookup: async (words: string[]): Promise<ApiResponse<any>> => {
      return this.request<any>('/lookup/batch', {
        method: 'POST',
        body: JSON.stringify({ words }),
      });
    },

    // Word Existence Check APIs
    wordExists: async (word: string): Promise<ApiResponse<{ exists: boolean }>> => {
      return this.request<{ exists: boolean }>('/word_exists', {
        method: 'POST',
        body: JSON.stringify({ word }),
      });
    },

    batchWordExists: async (words: string[]): Promise<ApiResponse<any>> => {
      return this.request<any>('/qurey_words', {
        method: 'POST',
        body: JSON.stringify({ words }),
      });
    },

    // Public Word Lookup (no auth)
    publicLookup: async (word: string): Promise<ApiResponse<any>> => {
      return this.request<any>(`/words/public/${encodeURIComponent(word)}`, {
        method: 'GET',
      }, false);
    },

    // Enhanced Word Query
    queryEnhanced: async (word: string, options?: any): Promise<ApiResponse<any>> => {
      return this.request<any>(`/word/${encodeURIComponent(word)}/enhanced`, {
        method: 'POST',
        body: JSON.stringify(options || {}),
      });
    },

    // Word Data Submission APIs
    submitTranslation: async (word: string, data: any): Promise<ApiResponse<any>> => {
      return this.request<any>(`/word/${encodeURIComponent(word)}/translation`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    submitAudio: async (word: string, audioData: any): Promise<ApiResponse<any>> => {
      return this.request<any>(`/word/${encodeURIComponent(word)}/audio`, {
        method: 'POST',
        body: JSON.stringify(audioData),
      });
    },

    submitImages: async (word: string, images: any): Promise<ApiResponse<any>> => {
      return this.request<any>(`/word/${encodeURIComponent(word)}/images`, {
        method: 'POST',
        body: JSON.stringify(images),
      });
    },

    submitCompleteData: async (word: string, data: any): Promise<ApiResponse<any>> => {
      return this.request<any>(`/word/${encodeURIComponent(word)}/complete`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  };

  /**
   * Learning Progress APIs
   * Backend: learning/stats, learning/progress, learning/words, learning/languages, etc
   */
  learning = {
    getStats: async (userId?: string, language?: string): Promise<ApiResponse<any>> => {
      const params = new URLSearchParams();
      if (userId) params.append('user_id', userId);
      if (language) params.append('language', language);

      const queryString = params.toString();
      const endpoint = `/learning/stats${queryString ? `?${queryString}` : ''}`;

      return this.request<any>(endpoint, {
        method: 'GET',
      });
    },

    updateProgress: async (data: {
      word_id?: string;
      group_id?: string;
      language?: string;
      mastery_level?: number;
      correct?: boolean;
      time_spent?: number;
    }): Promise<ApiResponse<void>> => {
      return this.request<void>('/learning/progress', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getReviewQueue: async (): Promise<ApiResponse<Word[]>> => {
      return this.request<Word[]>('/learning/review-queue', {
        method: 'GET',
      });
    },

    getWordCards: async (params?: {
      group_id?: string;
      language?: string;
      limit?: number;
    }): Promise<ApiResponse<Word[]>> => {
      const queryParams = new URLSearchParams();
      if (params?.group_id) queryParams.append('group_id', params.group_id);
      if (params?.language) queryParams.append('language', params.language);
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      const queryString = queryParams.toString();
      const endpoint = `/learning/words${queryString ? `?${queryString}` : ''}`;

      return this.request<Word[]>(endpoint, {
        method: 'GET',
      });
    },

    // Mark word as learned
    markWordAsLearned: async (wordId: string): Promise<ApiResponse<void>> => {
      return this.request<void>(`/words/${wordId}/learn`, {
        method: 'POST',
      });
    },

    // Mark word as reviewed
    markWordAsReviewed: async (wordId: string): Promise<ApiResponse<void>> => {
      return this.request<void>(`/words/${wordId}/review`, {
        method: 'POST',
      });
    },

    // Toggle word favorite
    toggleWordFavorite: async (wordId: string): Promise<ApiResponse<void>> => {
      return this.request<void>(`/words/${wordId}/favorite`, {
        method: 'POST',
      });
    },

    // Learning Languages Management
    getUserLanguages: async (): Promise<ApiResponse<{ languages: string[] }>> => {
      return this.request<{ languages: string[] }>('/learning/languages', {
        method: 'GET',
      });
    },

    setUserLanguages: async (languages: string[]): Promise<ApiResponse<{ message: string }>> => {
      return this.request<{ message: string }>('/learning/languages', {
        method: 'POST',
        body: JSON.stringify({ languages }),
      });
    },

    // Get vocabulary recommendations
    getRecommendations: async (params?: {
      lang_codes?: string[];
      level?: string;
      category?: string;
    }): Promise<ApiResponse<{
      data: VocabularyRecommendation[];
      total: number;
      filters: {
        levels: string[];
        categories: string[];
      };
    }>> => {
      const queryParams = new URLSearchParams();
      if (params?.lang_codes) {
        params.lang_codes.forEach(code => queryParams.append('lang_codes[]', code));
      }
      if (params?.level) queryParams.append('level', params.level);
      if (params?.category) queryParams.append('category', params.category);

      const queryString = queryParams.toString();
      const endpoint = `/learning/recommendations${queryString ? `?${queryString}` : ''}`;

      return this.request<{
        data: VocabularyRecommendation[];
        total: number;
        filters: { levels: string[]; categories: string[] };
      }>(endpoint, {
        method: 'GET',
      });
    },

    // Select/deselect vocabulary collection
    selectCollection: async (collectionId: number, action: 'select' | 'deselect' = 'select'): Promise<ApiResponse<{ message: string }>> => {
      return this.request<{ message: string }>('/learning/collections/select', {
        method: 'POST',
        body: JSON.stringify({
          collection_id: collectionId,
          action: action,
        }),
      });
    },

    // Get user's selected collections
    getSelectedCollections: async (): Promise<ApiResponse<{
      data: SelectedCollection[];
      total: number;
    }>> => {
      return this.request<{
        data: SelectedCollection[];
        total: number;
      }>('/learning/collections/selected', {
        method: 'GET',
      });
    },

    // Get vocabulary libraries (public + user-created)
    getLibraries: async (langCode?: string): Promise<ApiResponse<{
      public_libraries: VocabularyLibrary[];
      user_libraries: VocabularyLibrary[];
      lang_code: string;
    }>> => {
      const queryParams = new URLSearchParams();
      if (langCode) queryParams.append('lang_code', langCode);

      const queryString = queryParams.toString();
      const endpoint = `/learning/libraries${queryString ? `?${queryString}` : ''}`;

      return this.request<{
        public_libraries: VocabularyLibrary[];
        user_libraries: VocabularyLibrary[];
        lang_code: string;
      }>(endpoint, {
        method: 'GET',
      });
    },

    // Select/deselect vocabulary library
    selectLibrary: async (
      collectionId: number,
      langCode: string,
      action: 'select' | 'deselect' = 'select'
    ): Promise<ApiResponse<{ message: string }>> => {
      return this.request<{ message: string }>('/learning/libraries/select', {
        method: 'POST',
        body: JSON.stringify({
          collection_id: collectionId,
          lang_code: langCode,
          action: action,
        }),
      });
    },

    // Delete vocabulary library
    deleteLibrary: async (libraryId: string): Promise<ApiResponse<{ message: string }>> => {
      return this.request<{ message: string }>(`/learning/libraries/${libraryId}`, {
        method: 'DELETE',
      });
    },
  };

  /**
   * Document Upload APIs
   */
  documents = {
    upload: async (
      file: File,
      onProgress?: (progress: number) => void
    ): Promise<ApiResponse<{ library_id: string; word_count: number; message: string }>> => {
      const formData = new FormData();
      formData.append('document', file);

      const baseUrl = apiManager.getCurrentBaseUrl();
      const url = `${baseUrl}/api/app_qy_v1/learning/upload`;

      const token = await StorageCenter.auth.getToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();

        // Upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            const percentComplete = (e.loaded / e.total) * 100;
            onProgress(percentComplete);
          }
        });

        // Upload complete
        xhr.addEventListener('load', () => {
          try {
            const data = JSON.parse(xhr.responseText);

            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({
                success: true,
                data: data.data || data,
                message: data.message,
              });
            } else {
              resolve({
                success: false,
                error: {
                  code: data.code || `HTTP_${xhr.status}`,
                  message: data.message || 'Upload failed',
                },
              });
            }
          } catch (error: any) {
            resolve({
              success: false,
              error: {
                code: 'PARSE_ERROR',
                message: 'Failed to parse response',
              },
            });
          }
        });

        // Upload error
        xhr.addEventListener('error', () => {
          resolve({
            success: false,
            error: {
              code: 'NETWORK_ERROR',
              message: 'Network error occurred',
            },
          });
        });

        // Upload timeout
        xhr.addEventListener('timeout', () => {
          resolve({
            success: false,
            error: {
              code: 'TIMEOUT',
              message: 'Upload timeout',
            },
          });
        });

        xhr.open('POST', url);
        Object.entries(headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value as string);
        });
        xhr.timeout = 5 * 60 * 1000; // 5 minutes for large files
        xhr.send(formData);
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

    getSupportedLanguages: async (): Promise<ApiResponse<SupportedLanguage[]>> => {
      // Check cache first (cache for 24 hours - languages don't change often)
      const cached = await StorageCenter.cache.get<SupportedLanguage[]>(StorageKey.SUPPORTED_LANGUAGES_CACHE);
      if (cached && Array.isArray(cached)) {
        console.log('[ApiCenter] Returning cached supported languages');
        return { success: true, data: cached };
      }

      // Fetch from API (public endpoint, no auth required)
      // Backend now returns: {success: true, data: SupportedLanguage[]}
      // Unified format - no transformation needed
      const response = await this.request<SupportedLanguage[]>('/system/supported-languages', {
        method: 'GET',
      }, false); // Public API, no authentication required

      // Cache immediately after successful fetch
      if (response.success && response.data && Array.isArray(response.data)) {
        await StorageCenter.cache.set(StorageKey.SUPPORTED_LANGUAGES_CACHE, response.data, 24 * 60 * 60 * 1000); // 24 hours
        console.log('[ApiCenter] Cached', response.data.length, 'supported languages');
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
      const cached = await StorageCenter.cache.get<{ user: User }>(StorageKey.USER_PROFILE_CACHE);
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
        await StorageCenter.cache.set(StorageKey.USER_PROFILE_CACHE, response.data, 5 * 60 * 1000); // 5 minutes
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

      const token = await StorageCenter.auth.getToken();
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

    getInitializationStatus: async (): Promise<ApiResponse<{ initialized: boolean }>> => {
      return this.request<{ initialized: boolean }>('/user/initialization-status', {
        method: 'GET',
      });
    },

    initialize: async (data?: any): Promise<ApiResponse<{ message: string }>> => {
      return this.request<{ message: string }>('/user/initialize', {
        method: 'POST',
        body: JSON.stringify(data || {}),
      });
    },

    getStatistics: async (): Promise<ApiResponse<{
      total_words_learned: number;
      mastered_words: number;
      current_streak: number;
      total_study_time: number;
    }>> => {
      return this.request<{
        total_words_learned: number;
        mastered_words: number;
        current_streak: number;
        total_study_time: number;
      }>('/user/statistics', {
        method: 'GET',
      }, true);
    },

    getRetentionStats: async (): Promise<ApiResponse<any[]>> => {
      // Use learning stats API for retention stats
      try {
        const response = await this.learning.getStats();
        if (response.success && response.data) {
          // Transform stats to retention stats format if needed
          return {
            success: true,
            data: response.data.retention_stats || [],
          };
        }
        return { success: false, error: { message: 'Failed to fetch retention stats' } };
      } catch (error) {
        return { success: false, error: { message: 'Error fetching retention stats' } };
      }
    },
  };

  /**
   * Personal Dictionary APIs
   * Backend: create_personal_dictionary, query_personal_dictionary, etc.
   */
  personalDictionary = {
    create: async (data: {
      word: string;
      definition?: string;
      example?: string;
      notes?: string;
      language?: string;
    }): Promise<ApiResponse<{ id: string; message: string }>> => {
      return this.request<{ id: string; message: string }>('/create_personal_dictionary', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    query: async (params?: {
      word?: string;
      language?: string;
      limit?: number;
      offset?: number;
    }): Promise<ApiResponse<any[]>> => {
      return this.request<any[]>('/query_personal_dictionary', {
        method: 'POST',
        body: JSON.stringify(params || {}),
      });
    },

    queryByWords: async (words: string[]): Promise<ApiResponse<any[]>> => {
      return this.request<any[]>('/query_personal_dictionary_by_words', {
        method: 'POST',
        body: JSON.stringify({ words }),
      });
    },

    deleteById: async (id: string): Promise<ApiResponse<{ message: string }>> => {
      return this.request<{ message: string }>('/delete_personal_dictionary_by_id', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
    },

    deleteAll: async (): Promise<ApiResponse<{ message: string }>> => {
      return this.request<{ message: string }>('/delete_personal_all_dictionary', {
        method: 'POST',
      });
    },
  };

  /**
   * Vocabulary Library Public APIs
   * Backend: /vocabulary/statistics, /vocabulary/libraries/recommended, /vocabulary/libraries
   */
  vocabulary = {
    getStatistics: async (): Promise<ApiResponse<{
      total_libraries: number;
      total_words: number;
      languages: string[];
    }>> => {
      return this.request<{
        total_libraries: number;
        total_words: number;
        languages: string[];
      }>('/vocabulary/statistics', {
        method: 'GET',
      }, false); // Public API, no auth required
    },

    getRecommendedLibraries: async (params?: {
      language?: string;
      level?: string;
      limit?: number;
    }): Promise<ApiResponse<any[]>> => {
      const queryParams = new URLSearchParams();
      if (params?.language) queryParams.append('language', params.language);
      if (params?.level) queryParams.append('level', params.level);
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      const queryString = queryParams.toString();
      const endpoint = `/vocabulary/libraries/recommended${queryString ? `?${queryString}` : ''}`;

      return this.request<any[]>(endpoint, {
        method: 'GET',
      }, false); // Public API, no auth required
    },

    getLibraries: async (params?: {
      language?: string;
      category?: string;
      per_page?: number;
      page?: number;
    }): Promise<ApiResponse<any[]>> => {
      const queryParams = new URLSearchParams();
      if (params?.language) queryParams.append('language', params.language);
      if (params?.category) queryParams.append('category', params.category);
      if (params?.per_page) queryParams.append('per_page', params.per_page.toString());
      if (params?.page) queryParams.append('page', params.page.toString());

      const queryString = queryParams.toString();
      const endpoint = `/vocabulary/libraries${queryString ? `?${queryString}` : ''}`;

      return this.request<any[]>(endpoint, {
        method: 'GET',
      }, false); // Public API, no auth required
    },

    getLibraryWords: async (
      libraryId: number,
      params?: {
        page?: number;
        per_page?: number;
      }
    ): Promise<ApiResponse<{
      library: {
        id: number;
        name: string;
        total_words: number;
        language: string;
      };
      words: Array<{
        index: number;
        word: string;
      }>;
      pagination: {
        current_page: number;
        per_page: number;
        total: number;
        last_page: number;
        has_more: boolean;
      };
    }>> => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.per_page) queryParams.append('per_page', params.per_page.toString());

      const queryString = queryParams.toString();
      const endpoint = `/vocabulary/libraries/${libraryId}/words${queryString ? `?${queryString}` : ''}`;

      return this.request<any>(endpoint, {
        method: 'GET',
      }, false); // Public API
    },
  };

  /**
   * System Management APIs
   * Backend: /system/initialize, /system/initialization-status, etc.
   */
  system = {
    initialize: async (data?: any): Promise<ApiResponse<{ message: string }>> => {
      return this.request<{ message: string }>('/system/initialize', {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }, false);
    },

    getInitializationStatus: async (): Promise<ApiResponse<{
      initialized: boolean;
      database_ready: boolean;
      vocabulary_ready: boolean;
    }>> => {
      return this.request<{
        initialized: boolean;
        database_ready: boolean;
        vocabulary_ready: boolean;
      }>('/system/initialization-status', {
        method: 'GET',
      }, false);
    },

    processVocabulary: async (data?: any): Promise<ApiResponse<{ message: string }>> => {
      return this.request<{ message: string }>('/system/process-vocabulary', {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }, false);
    },

    getVocabularyStatus: async (): Promise<ApiResponse<{
      processed: boolean;
      total_words: number;
      processed_words: number;
    }>> => {
      return this.request<{
        processed: boolean;
        total_words: number;
        processed_words: number;
      }>('/system/vocabulary-status', {
        method: 'GET',
      }, false);
    },

    getDictionaryStatistics: async (): Promise<ApiResponse<{
      total_words: number;
      languages: any;
      last_updated: string;
    }>> => {
      return this.request<{
        total_words: number;
        languages: any;
        last_updated: string;
      }>('/system/dictionary-statistics', {
        method: 'GET',
      }, false);
    },

    getSystemStatistics: async (): Promise<ApiResponse<{
      languages: Array<{
        language_code: string;
        words: number;
        sentences: number;
        articles: number;
        audio: number;
      }>;
      summary: {
        total_languages: number;
        total_words: number;
        total_sentences: number;
        total_articles: number;
        total_audio: number;
      };
      articles?: any;
      tts_queue?: any;
    }>> => {
      return this.request<{
        languages: Array<{
          language_code: string;
          words: number;
          sentences: number;
          articles: number;
          audio: number;
        }>;
        summary: {
          total_languages: number;
          total_words: number;
          total_sentences: number;
          total_articles: number;
          total_audio: number;
        };
        articles?: any;
        tts_queue?: any;
      }>('/system/statistics', {
        method: 'GET',
      }, false);
    },

    getSystemStatisticsSummary: async (): Promise<ApiResponse<{
      total_languages: number;
      total_words: number;
      total_sentences: number;
      total_articles: number;
      total_audio: number;
    }>> => {
      return this.request<{
        total_languages: number;
        total_words: number;
        total_sentences: number;
        total_articles: number;
        total_audio: number;
      }>('/system/statistics/summary', {
        method: 'GET',
      }, false);
    },

    getSystemStatisticsLanguages: async (): Promise<ApiResponse<Array<{
      language_code: string;
      words: number;
      sentences: number;
      articles: number;
      audio: number;
    }>>> => {
      return this.request<Array<{
        language_code: string;
        words: number;
        sentences: number;
        articles: number;
        audio: number;
      }>>('/system/statistics/languages', {
        method: 'GET',
      }, false);
    },

    getSystemStatisticsQueues: async (forceRefresh: boolean = false): Promise<ApiResponse<{
      tts: {
        pending: number;
        processing: number;
        completed: number;
        failed: number;
        total: number;
      };
      translation: {
        total_words: number;
        complete_words: number;
        completion_rate: number;
        total_sentences?: number;
        complete_sentences?: number;
        sentence_completion_rate?: number;
        missing_breakdown: {
          translation: number;
          phonetic: number;
          audio: number;
          images: number;
          sentence_translation?: number;
          sentence_audio?: number;
        };
        missing_percentages: {
          translation: number;
          phonetic: number;
          audio: number;
          images: number;
          sentence_translation?: number;
          sentence_audio?: number;
        };
      };
      audio_storage: {
        total_size_bytes: number;
        total_size_mb: number;
        total_size_gb: number;
        total_files: number;
        zero_byte_files?: number;
        formatted_size: string;
        warning?: string;
        scanned_directories?: string[];
        errors?: string[];
      };
    }>> => {
      const url = forceRefresh 
        ? '/system/statistics/queues?force_refresh=1'
        : '/system/statistics/queues';
      return this.request<{
        tts: {
          pending: number;
          processing: number;
          completed: number;
          failed: number;
          total: number;
        };
        translation: {
          total_words: number;
          complete_words: number;
          completion_rate: number;
          total_sentences?: number;
          complete_sentences?: number;
          sentence_completion_rate?: number;
          missing_breakdown: {
            translation: number;
            phonetic: number;
            audio: number;
            images: number;
            sentence_translation?: number;
            sentence_audio?: number;
          };
          missing_percentages: {
            translation: number;
            phonetic: number;
            audio: number;
            images: number;
            sentence_translation?: number;
            sentence_audio?: number;
          };
        };
        audio_storage: {
          total_size_bytes: number;
          total_size_mb: number;
          total_size_gb: number;
          total_files: number;
          formatted_size: string;
        };
      }>(url, {
        method: 'GET',
      }, false);
    },

    getLanguageByCode: async (code: string): Promise<ApiResponse<any>> => {
      return this.request<any>(`/system/supported-languages/${code}`, {
        method: 'GET',
      }, false);
    },

    getSupportedLanguages: async (): Promise<ApiResponse<SupportedLanguage[]>> => {
      // Use dictionary API for supported languages (which calls system API)
      return this.dictionary.getSupportedLanguages();
    },

    reinitialize: async (clientToken: string, data?: any): Promise<ApiResponse<{ message: string }>> => {
      // This endpoint requires client.token middleware
      return this.request<{ message: string }>('/system/reinitialize', {
        method: 'POST',
        headers: {
          'X-Client-Token': clientToken,
        },
        body: JSON.stringify(data || {}),
      }, false);
    },

    getUntranslatedWords: async (params?: {
      language?: string;
      limit?: number;
    }): Promise<ApiResponse<any[]>> => {
      const queryParams = new URLSearchParams();
      if (params?.language) queryParams.append('language', params.language);
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      const queryString = queryParams.toString();
      const endpoint = `/untranslated${queryString ? `?${queryString}` : ''}`;

      return this.request<any[]>(endpoint, {
        method: 'GET',
      });
    },

    getUntranslatedWordsByPriority: async (params?: {
      language?: string;
      limit?: number;
    }): Promise<ApiResponse<any[]>> => {
      const queryParams = new URLSearchParams();
      if (params?.language) queryParams.append('language', params.language);
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      const queryString = queryParams.toString();
      const endpoint = `/untranslated/priority${queryString ? `?${queryString}` : ''}`;

      return this.request<any[]>(endpoint, {
        method: 'GET',
      });
    },
  };

  /**
   * Word Operation APIs
   * Backend: /up_learned, /up_read, /up_weight, /up_reviewed
   */
  wordOperations = {
    markAsLearned: async (data: {
      word_id?: string;
      word?: string;
      language?: string;
    }): Promise<ApiResponse<{ message: string }>> => {
      return this.request<{ message: string }>('/up_learned', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    markAsRead: async (data: {
      word_id?: string;
      word?: string;
      language?: string;
    }): Promise<ApiResponse<{ message: string }>> => {
      return this.request<{ message: string }>('/up_read', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    updateWeight: async (data: {
      word_id?: string;
      word?: string;
      weight: number;
      language?: string;
    }): Promise<ApiResponse<{ message: string }>> => {
      return this.request<{ message: string }>('/up_weight', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    markAsReviewed: async (data: {
      word_id?: string;
      word?: string;
      language?: string;
    }): Promise<ApiResponse<{ message: string }>> => {
      return this.request<{ message: string }>('/up_reviewed', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  };

  /**
   * AI Tools - Translation APIs
   * Backend: /ai_tools/translation/*
   */
  translation = {
    getLanguages: async (): Promise<ApiResponse<any[]>> => {
      return this.request<any[]>('/ai_tools/translation/languages', {
        method: 'GET',
      }, false);
    },

    getTypes: async (): Promise<ApiResponse<any[]>> => {
      return this.request<any[]>('/ai_tools/translation/types', {
        method: 'GET',
      }, false);
    },

    getModels: async (): Promise<ApiResponse<any[]>> => {
      return this.request<any[]>('/ai_tools/translation/models', {
        method: 'GET',
      }, false);
    },

    getTemplates: async (): Promise<ApiResponse<any[]>> => {
      return this.request<any[]>('/ai_tools/translation/templates', {
        method: 'GET',
      }, false);
    },

    translate: async (data: {
      text: string;
      from_language: string;
      to_language: string;
      model?: string;
      template?: string;
    }): Promise<ApiResponse<{ translation: string; task_id?: string }>> => {
      return this.request<{ translation: string; task_id?: string }>('/ai_tools/translation/translate', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    batchTranslate: async (data: {
      texts: string[];
      from_language: string;
      to_language: string;
      model?: string;
    }): Promise<ApiResponse<{ translations: string[]; task_id?: string }>> => {
      return this.request<{ translations: string[]; task_id?: string }>('/ai_tools/translation/batch', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    simpleTranslateWithGoogle: async (data: {
      text: string;
      from_language: string;
      to_language: string;
    }): Promise<ApiResponse<{ translation: string }>> => {
      return this.request<{ translation: string }>('/ai_tools/translation/simple/google', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    learningMode: async (data: {
      text: string;
      from_language: string;
      to_language: string;
      difficulty_level?: string;
    }): Promise<ApiResponse<any>> => {
      return this.request<any>('/ai_tools/translation/learning', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getTaskStatus: async (taskId: string): Promise<ApiResponse<{
      status: string;
      progress?: number;
      result?: any;
    }>> => {
      return this.request<{
        status: string;
        progress?: number;
        result?: any;
      }>(`/ai_tools/translation/task/${taskId}`, {
        method: 'GET',
      });
    },

    processNextTask: async (): Promise<ApiResponse<{ message: string }>> => {
      return this.request<{ message: string }>('/ai_tools/translation/process-next', {
        method: 'POST',
      });
    },
  };

  /**
   * AI Tools - Text-to-Speech (TTS) APIs
   * Backend: /ai_tools/tts/*
   */
  tts = {
    getLanguages: async (): Promise<ApiResponse<any[]>> => {
      return this.request<any[]>('/ai_tools/tts/languages', {
        method: 'GET',
      }, false);
    },

    getVoices: async (language?: string): Promise<ApiResponse<any[]>> => {
      const queryParams = new URLSearchParams();
      if (language) queryParams.append('language', language);

      const queryString = queryParams.toString();
      const endpoint = `/ai_tools/tts/voices${queryString ? `?${queryString}` : ''}`;

      return this.request<any[]>(endpoint, {
        method: 'GET',
      }, false);
    },

    getOptions: async (): Promise<ApiResponse<any>> => {
      return this.request<any>('/ai_tools/tts/options', {
        method: 'GET',
      }, false);
    },

    getAudioUrl: (language: string, type: string, filename: string, speed?: string): string => {
      const baseUrl = apiManager.getCurrentBaseUrl();
      if (speed) {
        return `${baseUrl}/api/app_qy_v1/ai_tools/tts/audio/${language}/${type}/${speed}/${filename}`;
      }
      return `${baseUrl}/api/app_qy_v1/ai_tools/tts/audio/${language}/${type}/${filename}`;
    },

    generate: async (data: {
      text: string;
      language: string;
      voice?: string;
      speed?: number;
      pitch?: number;
    }): Promise<ApiResponse<{ audio_url: string; filename: string }>> => {
      return this.request<{ audio_url: string; filename: string }>('/ai_tools/tts/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    batchGenerate: async (data: {
      texts: string[];
      language: string;
      voice?: string;
      speed?: number;
    }): Promise<ApiResponse<{ audio_urls: string[]; task_id?: string }>> => {
      return this.request<{ audio_urls: string[]; task_id?: string }>('/ai_tools/tts/batch-generate', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  };

  /**
   * AI Tools - Article Processing APIs
   * Backend: /ai_tools/article/*
   */
  article = {
    getTaskStatus: async (taskId: string): Promise<ApiResponse<{
      status: string;
      progress?: number;
      result?: any;
    }>> => {
      return this.request<{
        status: string;
        progress?: number;
        result?: any;
      }>(`/ai_tools/article/task/${taskId}`, {
        method: 'GET',
      }, false);
    },

    submit: async (data: {
      title: string;
      content: string;
      language?: string;
      difficulty_level?: string;
    }): Promise<ApiResponse<{ task_id: string; message: string }>> => {
      return this.request<{ task_id: string; message: string }>('/ai_tools/article/submit', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    preview: async (data: {
      content: string;
      language?: string;
    }): Promise<ApiResponse<{ parsed_words: any[]; word_count: number }>> => {
      return this.request<{ parsed_words: any[]; word_count: number }>('/ai_tools/article/preview', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  };

  /**
   * Miscellaneous APIs
   */
  misc = {
    getInvitationCode: async (): Promise<ApiResponse<{ masked_code: string }>> => {
      return this.request<{ masked_code: string }>('/invitation-code', {
        method: 'GET',
      }, false);
    },
  };
}

export const ApiCenter = new ApiCenterClass();
