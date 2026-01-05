/**
 * Dynamic Decryption Manager - Base Class for Dynamic Password-Based Decryption
 * 
 * Architecture Design:
 * - Provides dynamic decryption capabilities that automatically re-decrypt data when password changes
 * - Integrated with React Context for password management
 * - Automatically clears cache when password changes to ensure fresh decryption
 * - Supports multiple password parameter names: password, pwd, pp
 * 
 * React Integration:
 * - Password changes are detected via React Context (PasswordContext)
 * - Cache clearing is automatic when setPassword() is called
 * - Components using usePasswordChange hook will automatically re-render
 * 
 * Usage:
 *   class MyDecryptor extends DynamicDecryptionManager {
 *     async decryptData(data, password) {
 *       // Your decryption logic
 *     }
 *   }
 */

export interface EncryptedAsset {
  filePath: string;
  originalName: string;
  blobUrl: string;
}

export type PasswordChangeCallback = (newPassword: string) => void;

export abstract class DynamicDecryptionManager {
  protected cache: Map<string, EncryptedAsset>;
  protected loading: Map<string, Promise<EncryptedAsset>>;
  protected currentPassword: string;
  private passwordChangeCallbacks: Set<PasswordChangeCallback>;

  constructor(options: { password?: string } = {}) {
    this.cache = new Map();
    this.loading = new Map();
    this.currentPassword = options.password ?? '';
    this.passwordChangeCallbacks = new Set();
  }

  /**
   * Called when password changes - override in subclasses
   */
  protected onPasswordChanged(newPassword: string): void {
    // Clear cache when password changes
    this.clearCache();

    // Notify registered callbacks
    this.passwordChangeCallbacks.forEach((callback) => {
      try {
        callback(newPassword);
      } catch (error) {
        console.error('[DynamicDecryptionManager] Error in password change callback:', error);
      }
    });
  }

  /**
   * Register a callback for password changes
   */
  onPasswordChange(callback: PasswordChangeCallback): () => void {
    this.passwordChangeCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.passwordChangeCallbacks.delete(callback);
    };
  }

  /**
   * Clear all cached decrypted data
   */
  clearCache(): void {
    // Revoke all blob URLs before clearing
    for (const asset of this.cache.values()) {
      if (asset && asset.blobUrl && typeof URL !== 'undefined') {
        try {
          URL.revokeObjectURL(asset.blobUrl);
        } catch (error) {
          console.warn('[DynamicDecryptionManager] Error revoking blob URL:', error);
        }
      }
    }

    this.cache.clear();
    this.loading.clear();
  }

  /**
   * Get current password
   */
  getCurrentPassword(): string {
    return this.currentPassword;
  }

  /**
   * Manually set password (will trigger cache clear)
   */
  setPassword(newPassword: string): void {
    if (newPassword !== this.currentPassword) {
      this.currentPassword = newPassword;
      this.onPasswordChanged(newPassword);
    }
  }

  /**
   * Cleanup - call this when destroying the instance
   */
  destroy(): void {
    this.clearCache();
    this.passwordChangeCallbacks.clear();
  }
}

