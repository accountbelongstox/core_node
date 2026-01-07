import { apiClient } from './client';
import { User } from '../../types/models';
import { ApiWrapper } from '../../utils/apiWrapper';

export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
  displayName?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordReset {
  token: string;
  newPassword: string;
}

/**
 * User Authentication Service
 * For regular users (public endpoints for registration/login)
 */
export const userAuthService = {
  async register(data: RegisterRequest): Promise<User> {
    const response = await apiClient.post<{ success: boolean; user: User; sessionToken?: string }>('/users/register', data);
    if (response.success && response.data) {
      const result = response.data as any;
      // top-router returns { success: true, user: {...}, sessionToken: "..." }
      if (result.user) {
        if (result.sessionToken) {
          localStorage.setItem('token', result.sessionToken);
        }
        return result.user;
      }
      // Fallback: if response.data is directly a User object
      return result as User;
    }
    throw new Error(response.message || 'Failed to register user');
  },

  async login(data: LoginRequest): Promise<{ token: string; user: User }> {
    const response = await apiClient.post<{ success: boolean; user: User; sessionToken?: string; token?: string }>('/users/login', data);
    if (response.success && response.data) {
      const result = response.data as any;
      // top-router returns { success: true, user: {...}, sessionToken: "..." }
      const token = result.sessionToken || result.token || '';
      const user = result.user || result;
      if (token) {
        localStorage.setItem('token', token);
      }
      return { token, user };
    }
    throw new Error(response.message || 'Failed to login');
  },

  async logout(): Promise<void> {
    const response = await apiClient.post('/users/logout');
    if (!response.success) {
      throw new Error(response.message || 'Failed to logout');
    }
    localStorage.removeItem('token');
  },

  async getProfile(): Promise<User> {
    return ApiWrapper.wrap(
      () => apiClient.get<User>('/users/profile'),
      'errorContextGetProfile',
      true
    ) as Promise<User>;
  },

  async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    const response = await apiClient.post('/users/password/reset-request', data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to request password reset');
    }
  },

  async resetPassword(data: PasswordReset): Promise<void> {
    const response = await apiClient.post('/users/password/reset', data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to reset password');
    }
  },
};

