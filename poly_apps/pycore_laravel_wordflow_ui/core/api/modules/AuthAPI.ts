import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * AuthAPI - Public Authentication API Module
 * Unified authentication endpoint for all apps
 */
export class AuthAPI extends BaseAPI {
  async login(data: { username: string; password: string }): Promise<APIResponse> {
    return this.post('/login', data);
  }

  async register(data: { 
    username: string; 
    password: string; 
    email?: string; 
    nickname?: string; 
    name?: string;
    registration_code?: string;
  }): Promise<APIResponse> {
    return this.post('/register', data);
  }

  async logout(): Promise<APIResponse> {
    return this.post('/logout');
  }

  async getCurrentUser(): Promise<APIResponse> {
    return this.get('/user');
  }

  async getUserProfile(): Promise<APIResponse> {
    return this.get('/user/profile');
  }

  async updateUserProfile(data: { 
    nickname?: string; 
    name?: string; 
    bio?: string; 
    location?: string; 
    avatar_base64?: string;
    avatar_filename?: string;
  }): Promise<APIResponse> {
    return this.put('/user/profile', data);
  }

  async changePassword(data: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<APIResponse> {
    return this.post('/user/change-password', data);
  }

  async getUserPreferences(): Promise<APIResponse> {
    return this.get('/user/preferences');
  }

  async updateUserPreferences(data: {
    theme?: 'light' | 'dark';
    language?: string;
    favorites?: string[];
    recentTools?: string[];
  }): Promise<APIResponse> {
    return this.put('/user/preferences', data);
  }
}

