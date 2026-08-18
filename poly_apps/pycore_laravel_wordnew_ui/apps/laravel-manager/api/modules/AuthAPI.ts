import { BaseAPI } from '../../../../core/integrations/laravel/transport/BaseAPI';
import { APIResponse } from '../../types';
import { LARAVEL_API_ROUTE } from '../../../../core/integrations/laravel/transport/ApiContract';

/**
 * AuthAPI - Public Authentication API Module
 * Unified authentication endpoint for all apps
 */
export class AuthAPI extends BaseAPI {
  async login(data: { username: string; password: string }): Promise<APIResponse> {
    return this.post(LARAVEL_API_ROUTE.auth.login, data);
  }

  async register(data: { 
    username: string; 
    password: string; 
    email?: string; 
    nickname?: string; 
    name?: string;
    registration_code?: string;
  }): Promise<APIResponse> {
    return this.post(LARAVEL_API_ROUTE.auth.register, data);
  }

  async logout(): Promise<APIResponse> {
    return this.post(LARAVEL_API_ROUTE.auth.logout);
  }

  async getCurrentUser(): Promise<APIResponse> {
    return this.get(LARAVEL_API_ROUTE.auth.currentUser);
  }

  async getUserProfile(): Promise<APIResponse> {
    return this.get(LARAVEL_API_ROUTE.auth.profile);
  }

  async updateUserProfile(data: { 
    nickname?: string; 
    name?: string; 
    bio?: string; 
    location?: string; 
    avatar_base64?: string;
    avatar_filename?: string;
  }): Promise<APIResponse> {
    return this.put(LARAVEL_API_ROUTE.auth.profile, data);
  }

  async changePassword(data: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<APIResponse> {
    return this.post(LARAVEL_API_ROUTE.auth.password, data);
  }

  async getUserPreferences(): Promise<APIResponse> {
    return this.get(LARAVEL_API_ROUTE.auth.preferences);
  }

  async updateUserPreferences(data: {
    theme?: 'light' | 'dark';
    language?: string;
    favorites?: string[];
    recentTools?: string[];
  }): Promise<APIResponse> {
    return this.put(LARAVEL_API_ROUTE.auth.preferences, data);
  }
}

