import { apiClient } from './client';
import { LoginRequest, LoginResponse, User } from '../../types/models';
import { ApiWrapper } from '../../utils/apiWrapper';

export const authService = {
  async login(request: LoginRequest): Promise<LoginResponse | null> {
    return ApiWrapper.wrap(
      () => apiClient.post<LoginResponse>('/web/auth/login', request),
      'errorContextLogin',
      true
    ).then((data) => {
      if (data) {
        // top-router returns { success: true, token: "...", user: {...} }
        const token = (data as any).token || '';
        if (token) {
          localStorage.setItem('token', token);
        }
        return data;
      }
      return null;
    });
  },

  async logout(): Promise<void> {
    localStorage.removeItem('token');
  },

  async getProfile(): Promise<User | null> {
    return ApiWrapper.wrap(
      () => apiClient.get<User>('/users/profile'),
      'errorContextGetProfile',
      true
    );
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  },

  getToken(): string | null {
    return localStorage.getItem('token');
  }
};

