/**
 * CodeMart User Composable
 * 处理用户相关的业务逻辑
 */
import { ref, computed } from 'vue';
import type { User, Developer, DeveloperUpdateInput } from '../types_app_codemart';
import { UserApi } from '../services_app_codemart/user-api';
import { CODEMART_CONSTANTS } from '../constants_app_codemart/codemart-constants';

export function useCodemartUser() {
  const userApi = new UserApi();

  const currentUser = ref<User | null>(null);
  const developer = ref<Developer | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 获取当前用户信息
  const fetchCurrentUser = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await userApi.getCurrentUser();
      currentUser.value = response.data;
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 获取用户信息
  const fetchUser = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await userApi.getUser(id);
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 更新用户信息
  const updateUser = async (id: string, data: Partial<User>) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await userApi.updateUser(id, data);
      if (currentUser.value?.id === id) {
        currentUser.value = response.data;
      }
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 获取开发者信息
  const fetchDeveloper = async (userId: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await userApi.getDeveloperProfile(userId);
      developer.value = response.data;
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 更新开发者信息
  const updateDeveloper = async (userId: string, data: DeveloperUpdateInput) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await userApi.updateDeveloperProfile(userId, data);
      developer.value = response.data;
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 获取用户统计
  const fetchUserStats = async (userId: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await userApi.getUserStats(userId);
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 获取用户信用
  const fetchUserCredit = async (userId: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await userApi.getUserCredit(userId);
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 验证开发者资格
  const validateDeveloperExperience = (years: number): boolean => {
    return years >= CODEMART_CONSTANTS.DEVELOPER.MIN_EXPERIENCE_YEARS;
  };

  const validateDeveloperHourlyRate = (min: number, max: number): boolean => {
    return min >= CODEMART_CONSTANTS.DEVELOPER.MIN_HOURLY_RATE &&
           max <= CODEMART_CONSTANTS.DEVELOPER.MAX_HOURLY_RATE &&
           min < max;
  };

  // Computed properties
  const isLoggedIn = computed(() => currentUser.value !== null);
  const isDeveloper = computed(() => currentUser.value?.role === 'developer');
  const isClient = computed(() => currentUser.value?.role === 'client');
  const isAdmin = computed(() => currentUser.value?.role === 'admin');
  const userDisplayName = computed(() =>
    currentUser.value?.username || currentUser.value?.email || 'User'
  );

  return {
    // State
    currentUser,
    developer,
    loading,
    error,

    // Methods
    fetchCurrentUser,
    fetchUser,
    updateUser,
    fetchDeveloper,
    updateDeveloper,
    fetchUserStats,
    fetchUserCredit,
    validateDeveloperExperience,
    validateDeveloperHourlyRate,

    // Computed
    isLoggedIn,
    isDeveloper,
    isClient,
    isAdmin,
    userDisplayName
  };
}
