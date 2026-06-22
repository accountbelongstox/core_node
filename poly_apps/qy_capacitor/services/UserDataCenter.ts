/**
 * User Data Center - Unified User Data Management
 * Centralized user data processing and normalization
 */

import { apiManager } from './ApiManager';
import { User } from '../types';

/**
 * User Data Center Class
 * Handles all user data processing, normalization, and avatar URL construction
 */
class UserDataCenterClass {
  /**
   * Process and normalize user data
   * Ensures avatar_url is always properly constructed
   */
  processUserData(user: any): User {
    if (!user) return user;

    // Clone user to avoid mutation
    const processedUser = { ...user };

    // Process avatar URL
    processedUser.avatar_url = this.getAvatarUrl(user);

    return processedUser;
  }

  /**
   * Get properly formatted avatar URL
   * Priority: avatar_url > avatar (construct URL) > default
   */
  getAvatarUrl(user: any): string {
    // Priority 1: Use avatar_url if it's already a full URL
    if (user?.avatar_url && user.avatar_url.startsWith('http')) {
      return user.avatar_url;
    }

    // Priority 2: Construct URL from avatar field
    if (user?.avatar) {
      // If avatar is already a full URL, use it
      if (user.avatar.startsWith('http')) {
        return user.avatar;
      }

      // Construct URL from relative path
      const baseUrl = apiManager.getCurrentBaseUrl();

      // Expected format: "avatars/appqyv1/avatar_xxx.png"
      const parts = user.avatar.split('/');

      if (parts.length >= 3 && parts[0] === 'avatars') {
        const app = parts[1];
        const filename = parts.slice(2).join('/'); // Handle nested paths
        return `${baseUrl}/api/files/avatars/${app}/${filename}`;
      }

      // Fallback: Treat as generic file path
      return `${baseUrl}/api/files/${user.avatar}`;
    }

    // Priority 3: Default avatar based on user name
    const displayName = user?.nickname || user?.name || user?.username || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff&size=200`;
  }

  /**
   * Validate and repair user data
   * Ensures all critical fields are present and valid
   */
  validateUserData(user: any): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!user) {
      issues.push('User data is null or undefined');
      return { valid: false, issues };
    }

    // Check required fields
    if (!user.username && !user.id) {
      issues.push('Missing username and id');
    }

    // Validate avatar_url format
    if (user.avatar_url && !user.avatar_url.startsWith('http')) {
      issues.push('Invalid avatar_url format (not a full URL)');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Merge user data updates
   * Safely merges partial user updates with existing user data
   */
  mergeUserData(existingUser: User, updates: Partial<User>): User {
    const merged = {
      ...existingUser,
      ...updates
    };

    // Re-process to ensure avatar_url is correct
    return this.processUserData(merged);
  }

  /**
   * Get display name from user data
   */
  getDisplayName(user: any): string {
    if (!user) return 'Guest';
    return user.nickname || user.name || user.username || 'User';
  }

  /**
   * Get user initials for avatar fallback
   */
  getUserInitials(user: any): string {
    const displayName = this.getDisplayName(user);
    const parts = displayName.split(' ');

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    return displayName.substring(0, 2).toUpperCase();
  }

  /**
   * Debug user data
   * Logs user data for troubleshooting
   */
  debugUserData(user: any, source: string = 'Unknown') {
    console.group(`[UserDataCenter] Debug User Data (${source})`);
    console.log('Username:', user?.username);
    console.log('ID:', user?.id);
    console.log('Avatar:', user?.avatar);
    console.log('Avatar URL:', user?.avatar_url);
    console.log('Display Name:', this.getDisplayName(user));

    const validation = this.validateUserData(user);
    console.log('Validation:', validation);

    if (!validation.valid) {
      console.warn('Issues found:', validation.issues);
    }

    console.groupEnd();
  }
}

export const UserDataCenter = new UserDataCenterClass();
