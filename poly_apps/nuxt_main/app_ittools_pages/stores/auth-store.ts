/**
 * IT Tools Authentication Store
 * IT Tools 认证状态管理
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User } from '@/app_ittools_pages/services/auth-api';
import * as authApi from '@/app_ittools_pages/services/auth-api';

const TOKEN_KEY = 'ittools_auth_token';
const REFRESH_TOKEN_KEY = 'ittools_refresh_token';
const USER_KEY = 'ittools_user';

export const useAuthStore = defineStore('ittools-auth', () => {
  // State
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const userDisplayName = computed(() => user.value?.username || 'Guest');
  const userAvatar = computed(() => user.value?.avatar || '');

  /**
   * 从localStorage加载认证信息
   */
  function loadAuthFromStorage() {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken) {
        token.value = storedToken;
      }

      if (storedRefreshToken) {
        refreshToken.value = storedRefreshToken;
      }

      if (storedUser) {
        user.value = JSON.parse(storedUser);
      }
    } catch (err) {
      console.error('Failed to load auth from storage:', err);
    }
  }

  /**
   * 保存认证信息到localStorage
   */
  function saveAuthToStorage() {
    try {
      if (token.value) {
        localStorage.setItem(TOKEN_KEY, token.value);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }

      if (refreshToken.value) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken.value);
      } else {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }

      if (user.value) {
        localStorage.setItem(USER_KEY, JSON.stringify(user.value));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch (err) {
      console.error('Failed to save auth to storage:', err);
    }
  }

  /**
   * 清除认证信息
   */
  function clearAuth() {
    user.value = null;
    token.value = null;
    refreshToken.value = null;
    error.value = null;
    saveAuthToStorage();
  }

  /**
   * 用户登录
   */
  async function login(credentials: authApi.LoginCredentials) {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await authApi.login(credentials);

      if (response.success && response.data) {
        user.value = response.data.user;
        token.value = response.data.token;
        refreshToken.value = response.data.refreshToken || null;
        saveAuthToStorage();
        return true;
      } else {
        error.value = response.error || 'Login failed';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 用户注册
   */
  async function register(registerData: authApi.RegisterData) {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await authApi.register(registerData);

      if (response.success && response.data) {
        user.value = response.data.user;
        token.value = response.data.token;
        refreshToken.value = response.data.refreshToken || null;
        saveAuthToStorage();
        return true;
      } else {
        error.value = response.error || 'Registration failed';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Registration failed';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 用户登出
   */
  async function logout() {
    isLoading.value = true;

    try {
      if (token.value) {
        await authApi.logout(token.value);
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearAuth();
      isLoading.value = false;
    }
  }

  /**
   * 刷新用户信息
   */
  async function fetchCurrentUser() {
    if (!token.value) {
      return false;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await authApi.getCurrentUser(token.value);

      if (response.success && response.data) {
        user.value = response.data.user;
        saveAuthToStorage();
        return true;
      } else {
        error.value = response.error || 'Failed to get user info';
        // 如果token无效，清除认证信息
        if (response.error?.includes('401') || response.error?.includes('Unauthorized')) {
          clearAuth();
        }
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to get user info';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 刷新访问令牌
   */
  async function refreshAccessToken() {
    if (!refreshToken.value) {
      return false;
    }

    isLoading.value = true;

    try {
      const response = await authApi.refreshToken(refreshToken.value);

      if (response.success && response.data) {
        token.value = response.data.token;
        if (response.data.refreshToken) {
          refreshToken.value = response.data.refreshToken;
        }
        saveAuthToStorage();
        return true;
      } else {
        clearAuth();
        return false;
      }
    } catch (err) {
      clearAuth();
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 初始化认证状态
   */
  function initialize() {
    loadAuthFromStorage();

    // 如果有token，尝试刷新用户信息
    if (token.value) {
      fetchCurrentUser();
    }
  }

  return {
    // State
    user,
    token,
    refreshToken,
    isLoading,
    error,

    // Computed
    isAuthenticated,
    userDisplayName,
    userAvatar,

    // Actions
    login,
    register,
    logout,
    fetchCurrentUser,
    refreshAccessToken,
    initialize,
    clearAuth
  };
});
