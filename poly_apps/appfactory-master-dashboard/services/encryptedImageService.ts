/**
 * Encrypted Image Service - React-Integrated TypeScript Service
 *
 * Architecture Design:
 * - Uses React Context (PasswordContext) to get password from URL parameters
 * - Automatically clears cache and re-decrypts when password changes
 * - Provides TypeScript type-safe interfaces
 * - Adapts to existing component API calls
 *
 * Architecture Layers:
 * React Components (using usePasswordChange hook)
 *   ↓
 * PasswordContext (React Context API - monitors URL changes via useLocation)
 *   ↓
 * encryptedImageService (singleton service)
 *   ↓
 * EncryptedAppAssetsManager (asset management)
 *   ↓
 * DynamicDecryptionManager (cache management)
 *   ↓
 * ImageDecryptor (XOR decryption)
 *
 * Password Refresh Flow:
 * 1. URL changes → React Router's useLocation detects change
 * 2. PasswordContext extracts password from URL hash (#/path?pp=xxx)
 * 3. PasswordContext updates password state
 * 4. encryptedImageService.setPassword() is called
 * 5. EncryptedAppAssetsManager clears cache
 * 6. Components using usePasswordChange hook detect password change
 * 7. Components re-render and reload images with new password
 */

import { EncryptedAppAssetsManager } from './encryptedAppAssets';
import type { EncryptedAsset } from './dynamicDecryptionManager';
import { getPasswordFromWindowLocation } from '../utils/passwordUtils';

// TypeScript interfaces
interface DecryptedImage {
  blobUrl: string;
  filename: string;
  mimeType: string;
  decrypted: boolean;
}

/**
 * Encrypted Image Service - TypeScript Adapter
 *
 * Features:
 * - Provides TypeScript type-safe interface
 * - Adapts existing component API calls
 * - Automatically compatible with old format paths (.en.png → .en.js)
 * - All actual functionality implemented by EncryptedAppAssetsManager
 */
class EncryptedImageService {
  private assetsManager: EncryptedAppAssetsManager;
  private passwordChangeUnsubscribe: (() => void) | null = null;

  constructor() {
    // Initialize manager (no longer depends on global window object)
    // Uses TypeScript module imports, fully integrated into React architecture
    this.assetsManager = new EncryptedAppAssetsManager();
    
    // Initialize password from URL (will be managed by React Context later)
    // This ensures it works even before PasswordContext is initialized
    // Uses common utility function to extract password from URL (supports both BrowserRouter and HashRouter)
    if (typeof window !== 'undefined') {
      const urlPassword = getPasswordFromWindowLocation();
      
      if (urlPassword) {
        console.log(`[EncryptedImageService] Initializing with password from URL: "${urlPassword}"`);
        this.assetsManager.setPassword(urlPassword);
      }
    }
    
    // Subscribe to password change callbacks (for logging)
    // Actual cache clearing is handled automatically by DynamicDecryptionManager.setPassword
    // React components monitor password changes via usePasswordChange hook and re-render
    this.passwordChangeUnsubscribe = this.assetsManager.onPasswordChange((newPassword) => {
      console.log(`[EncryptedImageService] Password changed to: "${newPassword}"`);
    });
  }

  /**
   * Get internal manager instance (for internal methods)
   */
  private getManager(): EncryptedAppAssetsManager {
    return this.assetsManager;
  }

  /**
   * Normalize file path
   * - Convert old format: .en.png → .en.js
   * - Add leading slash: app_icon1.en.js → /app_icon1.en.js
   */
  private normalizePath(path: string): string {
    let normalized = path;

    // Convert old format
    if (normalized.endsWith('.en.png')) {
      normalized = normalized.replace('.en.png', '.en.js');
    }

    // Add leading slash
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }

    return normalized;
  }

  /**
   * Extract index number (from app1 → 1)
   */
  private extractIndex(appId: string): number | null {
    const match = appId.match(/app(\d+)/);
    if (!match) return null;

    const index = parseInt(match[1]);
    return (index >= 1 && index <= 5) ? index : null;
  }

  /**
   * Load encrypted image file
   */
  async loadEncryptedImage(filename: string): Promise<DecryptedImage> {
    const manager = this.getManager();

    try {
      const normalizedPath = this.normalizePath(filename);
      const asset = await manager.loadEncryptedFile(normalizedPath);

      return {
        blobUrl: asset.blobUrl,
        filename: asset.originalName ? asset.originalName : normalizedPath,
        mimeType: 'image/png',
        decrypted: true
      };
    } catch (error) {
      // catch block is necessary: must be kept
      // Reason: Async file loading may fail (network error, file not found, decryption failure, etc.)
      // Need to catch errors and return error image to avoid application crash
      console.error(`[EncryptedImageService] Failed to load ${filename}:`, error);
      return this.createErrorImage(filename);
    }
  }

  /**
   * Load icon by index (1-5)
   */
  async loadIconByIndex(index: number): Promise<string | null> {
    if (index < 1 || index > 5) return null;

    const manager = this.getManager();

    try {
      const asset = await manager.loadIcon(index);
      return asset.blobUrl;
    } catch (error) {
      // Error handling is necessary: must be kept
      // Reason: Async file loading may fail, need to catch errors and return null
      console.error(`[EncryptedImageService] Failed to load icon ${index}:`, error);
      return null;
    }
  }

  /**
   * Load splash screen by index (1-5)
   */
  async loadSplashByIndex(index: number): Promise<string | null> {
    if (index < 1 || index > 5) return null;

    const manager = this.getManager();

    try {
      const asset = await manager.loadSplash(index);
      return asset.blobUrl;
    } catch (error) {
      // Error handling is necessary: must be kept
      // Reason: Async file loading may fail, need to catch errors and return null
      console.error(`[EncryptedImageService] Failed to load splash ${index}:`, error);
      return null;
    }
  }

  /**
   * Load App icon
   * Supports:
   * - Direct path: '/app_icon1.en.js'
   * - Old format: 'app_icon1.en.png' (auto-converted)
   * - App ID inference: 'app1' → load icon 1
   */
  async loadAppIcon(appId: string, iconFilename?: string): Promise<string | null> {
    // If filename is provided, load directly
    if (iconFilename) {
      const result = await this.loadEncryptedImage(iconFilename);
      return result.blobUrl;
    }

    // Infer index from appId
    const index = this.extractIndex(appId);
    if (index) {
      return this.loadIconByIndex(index);
    }

    return null;
  }

  /**
   * Load App splash screen
   */
  async loadAppSplash(appId: string, splashFilename?: string): Promise<string | null> {
    if (splashFilename) {
      const result = await this.loadEncryptedImage(splashFilename);
      return result.blobUrl;
    }

    const index = this.extractIndex(appId);
    if (index) {
      return this.loadSplashByIndex(index);
    }

    return null;
  }

  /**
   * Load all icons (1-5)
   */
  async loadAllIcons(): Promise<(string | null)[]> {
    const manager = this.getManager();

    try {
      const assets = await manager.loadAllIcons();
      return assets.map((asset: EncryptedAsset) => asset.blobUrl);
    } catch (error) {
      // Error handling is necessary: must be kept
      // Reason: Batch loading may partially fail, need to catch errors and return empty array
      console.error('[EncryptedImageService] Failed to load all icons:', error);
      return [null, null, null, null, null];
    }
  }

  /**
   * Load all splash screens (1-5)
   */
  async loadAllSplashes(): Promise<(string | null)[]> {
    const manager = this.getManager();

    try {
      const assets = await manager.loadAllSplashes();
      return assets.map((asset: EncryptedAsset) => asset.blobUrl);
    } catch (error) {
      // Error handling is necessary: must be kept
      // Reason: Batch loading may partially fail, need to catch errors and return empty array
      console.error('[EncryptedImageService] Failed to load all splashes:', error);
      return [null, null, null, null, null];
    }
  }

  /**
   * Get hardcoded asset list
   */
  getHardcodedAssets() {
    return {
      icons: [
        '/encrypted_assets/app_icon1.en.js',
        '/encrypted_assets/app_icon2.en.js',
        '/encrypted_assets/app_icon3.en.js',
        '/encrypted_assets/app_icon4.en.js',
        '/encrypted_assets/app_icon5.en.js'
      ],
      splashes: [
        '/encrypted_assets/app_splash1.en.js',
        '/encrypted_assets/app_splash2.en.js',
        '/encrypted_assets/app_splash3.en.js',
        '/encrypted_assets/app_splash4.en.js',
        '/encrypted_assets/app_splash5.en.js'
      ]
    };
  }

  /**
   * Check if filename is a valid encrypted asset
   */
  isValidEncryptedAsset(filename: string): boolean {
    const normalized = this.normalizePath(filename);
    const assets = this.getHardcodedAssets();
    const allAssets = [...assets.icons, ...assets.splashes];
    return allAssets.includes(normalized);
  }

  /**
   * Clear cache and revoke all Blob URLs
   */
  revokeAllUrls(): void {
    this.assetsManager.revokeAllUrls();
  }

  /**
   * Set password (updates underlying manager)
   * Note: Usually called by PasswordContext, components should use usePasswordChange hook
   */
  setPassword(password: string): void {
    this.assetsManager.setPassword(password);
  }

  /**
   * Set base path (deprecated, kept for interface compatibility)
   */
  setBasePath(_path: string): void {
    console.warn('[EncryptedImageService] setBasePath is deprecated - files are in /public/ root');
  }

  /**
   * Create error placeholder image
   */
  private createErrorImage(filename: string): DecryptedImage {
    const errorBlob = new Blob([''], { type: 'text/plain' });
    const errorUrl = URL.createObjectURL(errorBlob);

    return {
      blobUrl: errorUrl,
      filename,
      mimeType: 'image/png',
      decrypted: false
    };
  }
}

// Export singleton instance
export const encryptedImageService = new EncryptedImageService();
