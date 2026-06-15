/**
 * User Model - User data management and business logic
 */

import { ApiCenter, User, ApiResponse } from '../services/ApiCenter';
import { StorageCenter } from '../services/StorageCenter';

export interface UserStats {
  total_words: number;
  learned_words: number;
  mastered_words: number;
  review_due_words: number;
  today_new_words: number;
  today_review_words: number;
  streak_days: number;
  study_days: number;
}

export interface UserProfile extends User {
  learning_stats?: {
    stats?: UserStats;
  };
}

class UserModelClass {
  private currentUser: UserProfile | null = null;

  /**
   * Initialize user from storage
   */
  async init(): Promise<void> {
    this.currentUser = await StorageCenter.auth.getUser();
  }

  /**
   * Get current user
   */
  getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  /**
   * Set current user
   */
  async setCurrentUser(user: UserProfile | null): Promise<void> {
    this.currentUser = user;
    if (user) {
      await StorageCenter.auth.setUser(user);
    } else {
      await StorageCenter.auth.removeUser();
    }
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    const hasToken = await StorageCenter.auth.hasToken();
    return this.currentUser !== null && hasToken;
  }

  /**
   * Load user profile from API
   */
  async loadProfile(): Promise<ApiResponse<UserProfile>> {
    const response = await ApiCenter.user.getProfile();

    if (response.success && response.data) {
      await this.setCurrentUser(response.data as unknown as UserProfile);
    }

    return response as unknown as ApiResponse<UserProfile>;
  }

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<User>): Promise<ApiResponse<UserProfile>> {
    const response = await ApiCenter.user.updateProfile(data);

    if (response.success && response.data) {
      await this.setCurrentUser({ ...this.currentUser!, ...response.data });
    }

    return response as unknown as ApiResponse<UserProfile>;
  }

  /**
   * Upload avatar
   */
  async uploadAvatar(file: File): Promise<ApiResponse<{ avatar_url: string }>> {
    const response = await ApiCenter.user.updateAvatar(file);

    if (response.success && response.data) {
      this.currentUser = {
        ...this.currentUser!,
        avatar: response.data.avatar_url,
      };
      await StorageCenter.auth.setUser(this.currentUser);
    }

    return response;
  }

  /**
   * Get user stats
   */
  getUserStats(): UserStats | null {
    if (!this.currentUser?.learning_stats?.stats) {
      return null;
    }
    return this.currentUser.learning_stats.stats;
  }

  /**
   * Get learning languages
   */
  getLearningLanguages(): string[] {
    return this.currentUser?.learning_languages || ['en'];
  }

  /**
   * Get native language
   */
  getNativeLanguage(): string {
    return this.currentUser?.native_language || 'zh';
  }

  /**
   * Get user display name
   */
  getDisplayName(): string {
    if (!this.currentUser) return 'Guest';
    return this.currentUser.nickname || this.currentUser.username || 'User';
  }

  /**
   * Get avatar URL
   */
  getAvatarUrl(): string {
    // Priority 1: Use avatar_url if available (backend-provided full URL)
    if (this.currentUser?.avatar_url) {
      return this.currentUser.avatar_url;
    }

    // Priority 2: Use avatar field (for backward compatibility)
    if (this.currentUser?.avatar) {
      // If avatar starts with http, it's already a full URL
      if (this.currentUser.avatar.startsWith('http')) {
        return this.currentUser.avatar;
      }
      // Otherwise, it might be a relative path that needs construction
      // This should not happen if processUserAvatarUrl worked correctly
      console.warn('[UserModel] Avatar field exists but avatar_url is missing');
    }

    // Priority 3: Fallback to UI Avatars
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.getDisplayName())}&background=3b82f6&color=fff`;
  }

  /**
   * Clear user data (logout)
   */
  async clear(): Promise<void> {
    this.currentUser = null;
    await StorageCenter.auth.clearAuth();
  }

  /**
   * Calculate completion percentage
   */
  getCompletionPercentage(): number {
    const stats = this.getUserStats();
    if (!stats || stats.total_words === 0) return 0;

    return Math.round((stats.learned_words / stats.total_words) * 100);
  }

  /**
   * Get learning streak
   */
  getStreak(): number {
    const stats = this.getUserStats();
    return stats?.streak_days || 0;
  }

  /**
   * Check if user is pro
   */
  isPro(): boolean {
    return this.currentUser?.isPro || false;
  }
}

export const UserModel = new UserModelClass();
