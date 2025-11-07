import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { BaseThemeConfig } from '@/theme/base-theme.config';

export interface BaseUser {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BaseStoreState {
  user: BaseUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export function createBaseStore(storeName: string, initialTheme?: BaseThemeConfig) {
  return defineStore(storeName, () => {
    const user = ref<BaseUser | null>(null);
    const isAuthenticated = ref(false);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const theme = ref<BaseThemeConfig | undefined>(initialTheme);

    const isLoading = computed(() => loading.value);
    const hasError = computed(() => error.value !== null);
    const currentUser = computed(() => user.value);

    function setUser(newUser: BaseUser | null) {
      user.value = newUser;
      isAuthenticated.value = !!newUser;
    }

    function setLoading(state: boolean) {
      loading.value = state;
    }

    function setError(message: string | null) {
      error.value = message;
    }

    function clearError() {
      error.value = null;
    }

    function setTheme(newTheme: BaseThemeConfig) {
      theme.value = newTheme;
    }

    async function login(credentials: { username: string; password: string }): Promise<boolean> {
      setLoading(true);
      clearError();

      try {
        throw new Error('login method must be implemented by sub-store');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed');
        return false;
      } finally {
        setLoading(false);
      }
    }

    async function logout(): Promise<void> {
      setUser(null);
      clearError();
    }

    async function fetchUser(): Promise<void> {
      setLoading(true);
      clearError();

      try {
        throw new Error('fetchUser method must be implemented by sub-store');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch user');
      } finally {
        setLoading(false);
      }
    }

    function reset() {
      user.value = null;
      isAuthenticated.value = false;
      loading.value = false;
      error.value = null;
    }

    return {
      user,
      isAuthenticated,
      loading,
      error,
      theme,
      isLoading,
      hasError,
      currentUser,
      setUser,
      setLoading,
      setError,
      clearError,
      setTheme,
      login,
      logout,
      fetchUser,
      reset,
    };
  });
}

export type BaseStore = ReturnType<typeof createBaseStore>;
