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

import { ref, computed } from 'vue';
import { AuthType } from '@/services/config/endpoints';
import type { AuthConfig } from '@/types/api';

export const useAuth = () => {
  // 认证状态
  const isAuthenticated = ref(false);
  const currentUser = ref<any>(null);
  const authToken = ref<string | null>(null);
  const apiKey = ref<string | null>(null);

  // 检查是否已认证
  const checkAuthStatus = () => {
    const token = localStorage.getItem('auth_token');
    const key = localStorage.getItem('api_key');
    
    authToken.value = token;
    apiKey.value = key;
    isAuthenticated.value = !!(token || key);
    
    return isAuthenticated.value;
  };

  // 设置 JWT Token
  const setAuthToken = (token: string, tokenKey: string = 'auth_token') => {
    localStorage.setItem(tokenKey, token);
    authToken.value = token;
    isAuthenticated.value = true;
  };

  // 设置 API Key
  const setApiKey = (key: string, keyName: string = 'api_key') => {
    localStorage.setItem(keyName, key);
    apiKey.value = key;
    isAuthenticated.value = true;
  };

  // 清除认证信息
  const clearAuth = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('api_key');
    localStorage.removeItem('access_token');
    localStorage.removeItem('strapi_api_key');
    
    authToken.value = null;
    apiKey.value = null;
    isAuthenticated.value = false;
    currentUser.value = null;
  };

  // 获取认证头信息
  const getAuthHeaders = (authType: string, authConfig: AuthConfig) => {
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

  // 验证 Token 是否有效
  const validateToken = (token: string): boolean => {
    if (!token) return false;
    
    try {
      // 简单的 JWT Token 验证（检查格式）
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      // 检查是否过期（如果有 exp 字段）
      const payload = JSON.parse(atob(parts[1] || ''));
      if (payload.exp && payload.exp < Date.now() / 1000) {
        clearAuth();
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  };

  // 初始化认证状态
  const initAuth = () => {
    checkAuthStatus();
    
    // 验证现有 Token
    if (authToken.value && !validateToken(authToken.value)) {
      clearAuth();
    }
  };

  return {
    // 状态
    isAuthenticated: computed(() => isAuthenticated.value),
    currentUser: computed(() => currentUser.value),
    authToken: computed(() => authToken.value),
    apiKey: computed(() => apiKey.value),
    
    // 方法
    checkAuthStatus,
    setAuthToken,
    setApiKey,
    clearAuth,
    getAuthHeaders,
    validateToken,
    initAuth
  };
}; 