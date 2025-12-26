/**
 * Auth Model - Authentication business logic
 */

import { ApiCenter, LoginCredentials, RegisterData, ApiResponse } from '../services/ApiCenter';
import { StorageCenter } from '../services/StorageCenter';
import { UserModel } from './UserModel';

export interface LoginResult {
  success: boolean;
  user?: any;
  token?: string;
  error?: {
    code?: string;
    message: string;
  };
}

export interface RegisterResult {
  success: boolean;
  user?: any;
  token?: string;
  error?: {
    code?: string;
    message: string;
  };
}

class AuthModelClass {
  /**
   * Login with credentials
   */
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    try {
      console.log('[AuthModel] Logging in with credentials:', credentials);
      const response = await ApiCenter.auth.login(credentials);

      console.log('[AuthModel] Received response:', response);

      if (response.success && response.data) {
        console.log('[AuthModel] Login successful, user:', response.data.user);

        // Set user in UserModel
        UserModel.setCurrentUser(response.data.user);

        const result = {
          success: true,
          user: response.data.user,
          token: response.data.token,
        };
        console.log('[AuthModel] Returning result:', result);
        return result;
      }

      console.log('[AuthModel] Login failed:', response.error);
      return {
        success: false,
        error: response.error || { message: 'Login failed' },
      };
    } catch (error: any) {
      console.error('[AuthModel] Login error:', error);
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error.message || 'An unexpected error occurred',
        },
      };
    }
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<RegisterResult> {
    try {
      const response = await ApiCenter.auth.register(data);

      if (response.success && response.data) {
        // Set user in UserModel
        UserModel.setCurrentUser(response.data.user);

        return {
          success: true,
          user: response.data.user,
          token: response.data.token,
        };
      }

      // Map backend error messages to user-friendly error codes
      let errorMessage = 'Registration failed';
      let errorCode = 'REGISTRATION_ERROR';

      if (response.error) {
        const errorMsg = typeof response.error === 'string' 
          ? response.error 
          : response.error.message || 'Registration failed';
        
        const lowerMsg = errorMsg.toLowerCase();

        if (lowerMsg.includes('email already exists') || lowerMsg.includes('email exists')) {
          errorCode = 'EMAIL_EXISTS';
          errorMessage = errorMsg;
        } else if (lowerMsg.includes('username already exists') || lowerMsg.includes('username exists')) {
          errorCode = 'USERNAME_EXISTS';
          errorMessage = errorMsg;
        } else if (lowerMsg.includes('phone') && lowerMsg.includes('exists')) {
          errorCode = 'PHONE_EXISTS';
          errorMessage = errorMsg;
        } else if (lowerMsg.includes('invite code') && (lowerMsg.includes('invalid') || lowerMsg.includes('not found'))) {
          errorCode = 'INVITE_CODE_INVALID';
          errorMessage = errorMsg;
        } else if (lowerMsg.includes('invite code') && (lowerMsg.includes('expired') || lowerMsg.includes('used'))) {
          errorCode = 'INVITE_CODE_EXPIRED';
          errorMessage = errorMsg;
        } else {
          errorMessage = errorMsg;
        }
      }

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    } catch (error: any) {
      console.error('[AuthModel] Register error:', error);
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error.message || 'An unexpected error occurred',
        },
      };
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<ApiResponse<void>> {
    try {
      const response = await ApiCenter.auth.logout();

      // Clear user data regardless of API response
      UserModel.clear();
      StorageCenter.auth.clearAuth();
      StorageCenter.cache.invalidateAll();

      return response;
    } catch (error: any) {
      console.error('[AuthModel] Logout error:', error);

      // Still clear local data
      UserModel.clear();
      StorageCenter.auth.clearAuth();
      StorageCenter.cache.invalidateAll();

      return {
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: error.message || 'Logout error occurred',
        },
      };
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return UserModel.isLoggedIn();
  }

  /**
   * Get auth token
   */
  getToken(): string | null {
    return StorageCenter.auth.getToken();
  }

  /**
   * Refresh token
   */
  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    const response = await ApiCenter.auth.refreshToken();

    if (response.success && response.data) {
      StorageCenter.auth.setToken(response.data.token);
    }

    return response;
  }

  /**
   * Validate current session
   */
  async validateSession(): Promise<boolean> {
    if (!this.isAuthenticated()) {
      return false;
    }

    try {
      const response = await ApiCenter.auth.getProfile();

      if (response.success && response.data) {
        UserModel.setCurrentUser(response.data);
        return true;
      }

      // Session invalid, clear auth
      this.clearAuth();
      return false;
    } catch (error) {
      console.error('[AuthModel] Session validation error:', error);
      this.clearAuth();
      return false;
    }
  }

  /**
   * Clear authentication data
   */
  clearAuth(): void {
    UserModel.clear();
    StorageCenter.auth.clearAuth();
    StorageCenter.cache.invalidateAll();
  }

  /**
   * Auto-login check on app start
   */
  async initializeAuth(): Promise<boolean> {
    const token = this.getToken();

    if (!token) {
      return false;
    }

    // Try to load user profile
    const response = await UserModel.loadProfile();

    if (response.success) {
      return true;
    }

    // Token invalid, clear auth
    this.clearAuth();
    return false;
  }
}

export const AuthModel = new AuthModelClass();
