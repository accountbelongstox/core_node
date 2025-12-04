// IT Tools Auth Composable
// Provides authentication state and guards for protected tools

import { ref, computed, onMounted } from 'vue';
import { LocalStorageManager } from '@/common/utils/localStorage';

const AUTH_STORAGE_KEY = 'ittools_auth_token';
const USER_STORAGE_KEY = 'ittools_user';

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  role: 'user' | 'admin' | 'premium';
  permissions: string[];
}

export function useAuth() {
  const isAuthenticated = ref(false);
  const currentUser = ref<AuthUser | null>(null);
  const authToken = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Check if user has required role
  const hasRole = (requiredRole: 'user' | 'admin' | 'premium'): boolean => {
    if (!currentUser.value) return false;
    
    const roleHierarchy = { user: 1, premium: 2, admin: 3 };
    const userLevel = roleHierarchy[currentUser.value.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
  };

  // Check if user can access a tool
  const canAccessTool = (tool: { requiresAuth?: boolean; requiredRole?: 'user' | 'admin' | 'premium' }): boolean => {
    // If tool doesn't require auth, allow access
    if (!tool.requiresAuth) return true;
    
    // If not authenticated, deny access
    if (!isAuthenticated.value) return false;
    
    // If specific role required, check it
    if (tool.requiredRole) {
      return hasRole(tool.requiredRole);
    }
    
    // Otherwise allow authenticated users
    return true;
  };

  // Tools that require authentication
  const protectedToolIds = new Set([
    'online_translation',
    'ai_chat',
    'ai_code_generator',
    'ai_image_generator',
    'premium_pdf_tools'
  ]);

  const isProtectedTool = (toolId: string): boolean => {
    return protectedToolIds.has(toolId);
  };

  // Load auth state from storage
  const loadAuthState = () => {
    const savedToken = LocalStorageManager.getItem<string>(AUTH_STORAGE_KEY);
    const savedUser = LocalStorageManager.getItem<AuthUser>(USER_STORAGE_KEY);
    
    if (savedToken && savedUser) {
      authToken.value = savedToken;
      currentUser.value = savedUser;
      isAuthenticated.value = true;
    }
  };

  // Login
  const login = async (credentials: { username: string; password: string }): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;

    try {
      // This would call the actual login API
      // For now, simulate a login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      
      authToken.value = data.token;
      currentUser.value = data.user;
      isAuthenticated.value = true;

      LocalStorageManager.setItem(AUTH_STORAGE_KEY, data.token);
      LocalStorageManager.setItem(USER_STORAGE_KEY, data.user);

      return true;
    } catch (err: any) {
      error.value = err.message || 'Login failed';
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  // Logout
  const logout = () => {
    authToken.value = null;
    currentUser.value = null;
    isAuthenticated.value = false;
    
    LocalStorageManager.removeItem(AUTH_STORAGE_KEY);
    LocalStorageManager.removeItem(USER_STORAGE_KEY);
  };

  // Get auth headers for API requests
  const getAuthHeaders = (): Record<string, string> => {
    if (!authToken.value) return {};
    
    return {
      'Authorization': `Bearer ${authToken.value}`
    };
  };

  // Initialize on mount
  onMounted(() => {
    loadAuthState();
  });

  return {
    // State
    isAuthenticated: computed(() => isAuthenticated.value),
    currentUser: computed(() => currentUser.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    
    // Methods
    login,
    logout,
    hasRole,
    canAccessTool,
    isProtectedTool,
    getAuthHeaders,
    loadAuthState
  };
}

export default useAuth;

