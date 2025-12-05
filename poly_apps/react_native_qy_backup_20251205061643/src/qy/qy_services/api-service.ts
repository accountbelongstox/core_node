/**
 * QY API Service
 * Supports API with mock fallback
 */

import { ApiBase, ApiResponse } from '@/common/services/api-base';
import { getMockData, mockApiResponse } from '@/common/mock';
import { WordGroup, Word, MemoryRecord, User, Statistics, DictionaryData } from '@/qy/qy_types';

const apiBase = ApiBase.getInstance();

// Endpoint keys
export const API_ENDPOINTS = {
  // User
  USER_PROFILE: 'user.profile',
  USER_UPDATE: 'user.update',
  
  // Word Groups
  WORD_GROUPS_LIST: 'wordGroups.list',
  WORD_GROUP_CREATE: 'wordGroups.create',
  WORD_GROUP_UPDATE: 'wordGroups.update',
  WORD_GROUP_DELETE: 'wordGroups.delete',
  WORD_GROUP_DETAIL: 'wordGroups.detail',
  
  // Words
  WORDS_LIST: 'words.list',
  WORD_DETAIL: 'words.detail',
  
  // Memory
  MEMORY_RECORDS: 'memory.records',
  MEMORY_UPDATE: 'memory.update',
  MEMORY_STATISTICS: 'memory.statistics',
  
  // Dictionary
  DICTIONARY_LOOKUP: 'dictionary.lookup',
  
  // Statistics
  STATISTICS: 'statistics.get',
} as const;

/**
 * Check if API is available
 */
const isApiAvailable = (): boolean => {
  return apiBase.getActiveApi() !== null;
};

/**
 * Make API request with mock fallback
 */
const requestWithMock = async <T>(
  endpointKey: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: any;
    params?: Record<string, string | number>;
    query?: Record<string, string | number>;
    mockKey?: string;
  } = {}
): Promise<ApiResponse<T>> => {
  const { mockKey, ...requestOptions } = options;
  
  try {
    if (isApiAvailable()) {
      return await apiBase.request<T>(endpointKey, requestOptions);
    }
  } catch (error) {
    console.warn(`API request failed for ${endpointKey}, using mock data:`, error);
  }
  
  // Use mock data
  if (mockKey) {
    const mockData = getMockData<T>(mockKey);
    if (mockData) {
      return mockApiResponse(mockData);
    }
  }
  
  // Default error response
  return {
    success: false,
    error: {
      code: 'MOCK_FALLBACK',
      message: 'API unavailable, mock data not found',
    },
  };
};

// User API
export const userApi = {
  getProfile: async (): Promise<ApiResponse<User>> => {
    return requestWithMock<User>(API_ENDPOINTS.USER_PROFILE, {
      mockKey: 'user',
    });
  },
  
  updateProfile: async (data: Partial<User>): Promise<ApiResponse<User>> => {
    return requestWithMock<User>(API_ENDPOINTS.USER_UPDATE, {
      method: 'PUT',
      body: data,
      mockKey: 'user',
    });
  },
};

// Word Groups API
export const wordGroupApi = {
  list: async (): Promise<ApiResponse<WordGroup[]>> => {
    return requestWithMock<WordGroup[]>(API_ENDPOINTS.WORD_GROUPS_LIST, {
      mockKey: 'wordGroups',
    });
  },
  
  create: async (data: Partial<WordGroup>): Promise<ApiResponse<WordGroup>> => {
    return requestWithMock<WordGroup>(API_ENDPOINTS.WORD_GROUP_CREATE, {
      method: 'POST',
      body: data,
      mockKey: 'wordGroups',
    });
  },
  
  update: async (id: string, data: Partial<WordGroup>): Promise<ApiResponse<WordGroup>> => {
    return requestWithMock<WordGroup>(API_ENDPOINTS.WORD_GROUP_UPDATE, {
      method: 'PUT',
      params: { id },
      body: data,
      mockKey: 'wordGroups',
    });
  },
  
  delete: async (id: string): Promise<ApiResponse<void>> => {
    return requestWithMock<void>(API_ENDPOINTS.WORD_GROUP_DELETE, {
      method: 'DELETE',
      params: { id },
    });
  },
  
  getDetail: async (id: string): Promise<ApiResponse<WordGroup>> => {
    return requestWithMock<WordGroup>(API_ENDPOINTS.WORD_GROUP_DETAIL, {
      params: { id },
      mockKey: 'wordGroups',
    });
  },
};

// Words API
export const wordApi = {
  list: async (groupId?: string): Promise<ApiResponse<Word[]>> => {
    return requestWithMock<Word[]>(API_ENDPOINTS.WORDS_LIST, {
      query: groupId ? { groupId } : undefined,
      mockKey: 'words',
    });
  },
  
  getDetail: async (id: string): Promise<ApiResponse<Word>> => {
    return requestWithMock<Word>(API_ENDPOINTS.WORD_DETAIL, {
      params: { id },
      mockKey: 'words',
    });
  },
};

// Memory API
export const memoryApi = {
  getRecords: async (): Promise<ApiResponse<MemoryRecord[]>> => {
    return requestWithMock<MemoryRecord[]>(API_ENDPOINTS.MEMORY_RECORDS, {
      mockKey: 'memoryRecords',
    });
  },
  
  update: async (wordId: string, data: Partial<MemoryRecord>): Promise<ApiResponse<MemoryRecord>> => {
    return requestWithMock<MemoryRecord>(API_ENDPOINTS.MEMORY_UPDATE, {
      method: 'PUT',
      params: { wordId },
      body: data,
      mockKey: 'memoryRecords',
    });
  },
  
  getStatistics: async (): Promise<ApiResponse<Statistics>> => {
    return requestWithMock<Statistics>(API_ENDPOINTS.MEMORY_STATISTICS, {
      mockKey: 'statistics',
    });
  },
};

// Dictionary API
export const dictionaryApi = {
  lookup: async (word: string): Promise<ApiResponse<DictionaryData>> => {
    return requestWithMock<DictionaryData>(API_ENDPOINTS.DICTIONARY_LOOKUP, {
      query: { word },
      mockKey: 'dictionary',
    });
  },
};

// Statistics API
export const statisticsApi = {
  get: async (): Promise<ApiResponse<Statistics>> => {
    return requestWithMock<Statistics>(API_ENDPOINTS.STATISTICS, {
      mockKey: 'statistics',
    });
  },
};

