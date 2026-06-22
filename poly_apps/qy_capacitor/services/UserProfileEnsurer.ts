/**
 * User Profile Ensurer
 * Automatically ensures user has minimum required profile data (avatar, nickname)
 * Generates missing data and updates backend
 */

import { ApiCenter } from './ApiCenter';
import { User } from '../types';
import { StorageCenter } from './StorageCenter';
import { compressAvatarDataUrl } from './imageCompression';

export interface ProfileEnsureResult {
  updated: boolean;
  fields: string[];
  user?: User;
}

class UserProfileEnsurerClass {
  private readonly AVATAR_STYLES = [
    'lorelei',
    'avataaars',
    'bottts',
    'pixel-art',
    'adventurer',
    'big-smile',
    'personas',
    'fun-emoji',
  ];

  private readonly DICEBEAR_API_BASE = 'https://api.dicebear.com/9.x';

  /**
   * Ensure user profile has minimum required data
   * If missing, generate and update backend immediately
   */
  async ensureUserProfile(user: User): Promise<ProfileEnsureResult> {
    console.log('[UserProfileEnsurer] Checking user profile:', user.username);

    const needsUpdate: string[] = [];
    const updates: any = {};

    if (!user.nickname || user.nickname.trim() === '') {
      console.log('[UserProfileEnsurer] Missing nickname, generating...');
      updates.nickname = this.generateNickname(user);
      needsUpdate.push('nickname');
    }

    if (!user.avatar || user.avatar === 'avatars/1.png' || user.avatar.trim() === '') {
      console.log('[UserProfileEnsurer] Missing avatar, generating...');
      const avatarData = await this.generateAvatar(user);
      if (avatarData) {
        updates.avatar_base64 = avatarData.base64;
        updates.avatar_filename = avatarData.filename;
        needsUpdate.push('avatar');
      }
    }

    if (needsUpdate.length === 0) {
      console.log('[UserProfileEnsurer] Profile complete, no updates needed');
      return { updated: false, fields: [] };
    }

    console.log('[UserProfileEnsurer] Updating backend with:', needsUpdate);

    try {
      const response = await ApiCenter.user.updateProfile(updates);

      if (response.success && response.data?.user) {
        const updatedUser = response.data.user;

        StorageCenter.auth.setUser(updatedUser);

        console.log('[UserProfileEnsurer] Profile updated successfully:', needsUpdate);

        return {
          updated: true,
          fields: needsUpdate,
          user: updatedUser,
        };
      }

      console.error('[UserProfileEnsurer] Backend update failed:', response.error);
      return { updated: false, fields: needsUpdate };
    } catch (error) {
      console.error('[UserProfileEnsurer] Update error:', error);
      return { updated: false, fields: needsUpdate };
    }
  }

  /**
   * Generate nickname from username/email
   */
  private generateNickname(user: User): string {
    if (user.name && user.name.trim() !== '') {
      return user.name.split(' ')[0];
    }

    if (user.username) {
      const clean = user.username.replace(/[^a-zA-Z0-9]/g, '');
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    if (user.email) {
      const localPart = user.email.split('@')[0];
      const clean = localPart.replace(/[^a-zA-Z0-9]/g, '');
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    return 'User' + Math.floor(Math.random() * 10000);
  }

  /**
   * Generate avatar using DiceBear API
   */
  private async generateAvatar(user: User): Promise<{ base64: string; filename: string } | null> {
    const seed = user.username || user.email || `user${user.id}`;
    const style = this.AVATAR_STYLES[Math.floor(Math.random() * this.AVATAR_STYLES.length)];

    const url = `${this.DICEBEAR_API_BASE}/${style}/png?seed=${encodeURIComponent(seed)}&size=256&backgroundColor=b6e3f4,c0aede,d1d4f9`;

    console.log('[UserProfileEnsurer] Generating avatar:', url);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.error('[UserProfileEnsurer] Avatar generation failed:', response.status);
        return null;
      }

      const blob = await response.blob();
      const rawBase64 = await this.blobToBase64(blob);

      // Defensively downscale/compress before sending as avatar_base64 so the
      // payload is always bounded (aligned with the backend avatar contract).
      let base64 = rawBase64;
      try {
        const compressed = await compressAvatarDataUrl(rawBase64, `avatar_${user.id}`);
        base64 = compressed.dataUrl;
      } catch (compressErr) {
        console.warn('[UserProfileEnsurer] Avatar compression skipped:', compressErr);
      }

      const filename = `avatar_${user.id}_${Date.now()}.png`;

      console.log('[UserProfileEnsurer] Avatar generated successfully');

      return {
        base64: base64,
        filename: filename,
      };
    } catch (error) {
      console.error('[UserProfileEnsurer] Avatar generation error:', error);
      return null;
    }
  }

  /**
   * Convert Blob to Base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Generate avatar URL for preview (without saving)
   */
  generateAvatarUrl(seed: string, style: string = 'lorelei'): string {
    return `${this.DICEBEAR_API_BASE}/${style}/png?seed=${encodeURIComponent(seed)}&size=256&backgroundColor=b6e3f4,c0aede,d1d4f9`;
  }

  /**
   * Get random avatar style
   */
  getRandomStyle(): string {
    return this.AVATAR_STYLES[Math.floor(Math.random() * this.AVATAR_STYLES.length)];
  }

  /**
   * Get all available styles
   */
  getAllStyles(): string[] {
    return [...this.AVATAR_STYLES];
  }
}

export const UserProfileEnsurer = new UserProfileEnsurerClass();
