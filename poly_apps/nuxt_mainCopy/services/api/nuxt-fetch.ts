// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import { getApiConfig, AuthType } from '../config/endpoints';
import type { ApiResponse, ApiError, RequestConfig, AuthConfig, ApiConfig, DataSource } from '@/types/api';

// Nuxt 4 原生 $fetch 配置类型
export interface NuxtFetchOptions {
  method?: string;
  query?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  baseURL?: string;
  timeout?: number;
  server?: boolean;
  lazy?: boolean;
  immediate?: boolean;
  default?: () => any;
  transform?: (input: any) => any | Promise<any>;
  pick?: string[];
  watch?: any[] | false;
  deep?: boolean;
  dedupe?: 'cancel' | 'defer';
  onRequest?: (context: any) => void;
  onRequestError?: (context: any) => void;
  onResponse?: (context: any) => void;
  onResponseError?: (context: any) => void;
}

// 创建认证头
const createAuthHeaders = (authType: string, authConfig: AuthConfig): Record<string, string> => {
  const headers: Record<string, string> = {};

  switch (authType) {
    case AuthType.JWT:
      const token = localStorage.getItem(authConfig.tokenKey || 'auth_token');
      if (token) {
        const headerKey = authConfig.headerKey || 'Authorization';
        const prefix = authConfig.prefix || 'Bearer';
        headers[headerKey] = `${prefix} ${token}`;
      }
      break;

    case AuthType.API_KEY:
      const apiKey = localStorage.getItem(authConfig.apiKey || 'api_key');
      if (apiKey) {
        const headerKey = authConfig.headerKey || 'X-API-Key';
        headers[headerKey] = apiKey;
      }
      break;

    case AuthType.BEARER:
      const bearerToken = localStorage.getItem(authConfig.tokenKey || 'auth_token');
      if (bearerToken) {
        const headerKey = authConfig.headerKey || 'Authorization';
        headers[headerKey] = `Bearer ${bearerToken}`;
      }
      break;

    case AuthType.BASIC:
      if (authConfig.username && authConfig.password) {
        const credentials = btoa(`${authConfig.username}:${authConfig.password}`);
        headers['Authorization'] = `Basic ${credentials}`;
      }
      break;

    case AuthType.CUSTOM:
      if (authConfig.customHeaders) {
        Object.assign(headers, authConfig.customHeaders);
      }
      break;
  }

  return headers;
};

// 创建 Nuxt $fetch 配置
export const createNuxtFetchOptions = (
  dataSource: DataSource,
  customOptions: NuxtFetchOptions = {}
): NuxtFetchOptions => {
  const config = getApiConfig();
  const apiConfig = config[dataSource];
  
  // 合并默认配置和自定义配置
  const defaultOptions: NuxtFetchOptions = {
    baseURL: apiConfig.BASE_URL,
    timeout: apiConfig.TIMEOUT,
    headers: {
      ...apiConfig.HEADERS,
      'X-API-Identifier': apiConfig.API_IDENTIFIER,
      ...createAuthHeaders(apiConfig.AUTH_TYPE, apiConfig.AUTH_CONFIG)
    },
    server: true,
    lazy: false,
    immediate: true,
    deep: false,
    dedupe: 'cancel'
  };

  return {
    ...defaultOptions,
    ...customOptions,
    headers: {
      ...defaultOptions.headers,
      ...customOptions.headers
    }
  };
};

// 通用 API 请求函数
export const apiRequest = async <T = any>(
  dataSource: DataSource,
  url: string,
  options: NuxtFetchOptions = {}
): Promise<ApiResponse<T>> => {
  try {
    const fetchOptions = createNuxtFetchOptions(dataSource, options);
    const fullUrl = `${fetchOptions.baseURL}${url}`;
    
    // 使用 Nuxt 4 的 $fetch
    const response = await $fetch<ApiResponse<T>>(fullUrl, {
      method: (fetchOptions.method || 'GET') as any,
      query: fetchOptions.query,
      body: fetchOptions.body,
      headers: fetchOptions.headers,
      timeout: fetchOptions.timeout,
      onRequest: fetchOptions.onRequest,
      onRequestError: fetchOptions.onRequestError,
      onResponse: fetchOptions.onResponse,
      onResponseError: fetchOptions.onResponseError
    });

    return response;
  } catch (error: any) {
    const apiError: ApiError = {
      code: error.response?.status || 500,
      message: error.response?._data?.message || error.message || 'Network error',
      details: error.response?._data
    };
    throw apiError;
  }
};

// 获取 API 配置信息
export const getApiInfo = (dataSource: DataSource) => {
  const config = getApiConfig();
  const apiConfig = config[dataSource];
  
  return {
    identifier: apiConfig.API_IDENTIFIER,
    authType: apiConfig.AUTH_TYPE,
    baseUrl: apiConfig.BASE_URL,
    timeout: apiConfig.TIMEOUT,
    authConfig: apiConfig.AUTH_CONFIG
  };
}; 