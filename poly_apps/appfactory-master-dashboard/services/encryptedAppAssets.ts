/**
 * Encrypted App Assets Manager
 *
 * Architecture:
 * - Backend Encryption: /scripts/_daemon_tools/image_encryptor.cjs
 * - Frontend Decryption: services/imageDecryptor.ts
 *
 * Hardcoded 10 encrypted image files:
 * - Icons: app_icon1-5.en.js
 * - Splashes: app_splash1-5.en.js
 *
 * Asset Directory: /public/encrypted_assets/
 * 
 * React Integration:
 * - Extends DynamicDecryptionManager for automatic password change detection
 * - Automatically re-decrypts when password changes via React Context
 * - Clears cache and reloads images when password changes
 * - Password changes are detected through PasswordContext -> encryptedImageService.setPassword()
 */

import { DynamicDecryptionManager, EncryptedAsset } from './dynamicDecryptionManager';
import { ImageDecryptor } from './imageDecryptor';

export interface EncryptedAppAssetsManagerOptions {
  password?: string;
}

export class EncryptedAppAssetsManager extends DynamicDecryptionManager {
  private decryptor: ImageDecryptor;
  private password: string;

  // Hardcoded file paths (cannot dynamically scan)
  // Files are in encrypted_assets/ directory (mapped from build dist/public)
  public readonly ENCRYPTED_ASSETS = {
    icons: [
      '/encrypted_assets/app_icon1.en.js',
      '/encrypted_assets/app_icon2.en.js',
      '/encrypted_assets/app_icon3.en.js',
      '/encrypted_assets/app_icon4.en.js',
      '/encrypted_assets/app_icon5.en.js',
    ],
    splashes: [
      '/encrypted_assets/app_splash1.en.js',
      '/encrypted_assets/app_splash2.en.js',
      '/encrypted_assets/app_splash3.en.js',
      '/encrypted_assets/app_splash4.en.js',
      '/encrypted_assets/app_splash5.en.js',
    ],
  };

  constructor(options: EncryptedAppAssetsManagerOptions = {}) {
    super({ password: options.password ?? '' });

    // Initialize decryptor with current password
    this.password = this.getCurrentPassword();
    this.decryptor = new ImageDecryptor({ password: this.password });
  }

  /**
   * Override onPasswordChanged to update decryptor password
   */
  protected onPasswordChanged(newPassword: string): void {
    console.log(`[EncryptedAppAssetsManager] Password changed, updating decryptor and clearing cache`);
    this.password = newPassword;
    this.decryptor.setPassword(newPassword);

    // Call parent to clear cache
    super.onPasswordChanged(newPassword);
  }

  /**
   * Load encrypted file with caching
   */
  async loadEncryptedFile(filePath: string): Promise<EncryptedAsset> {
    // Check if password has changed (dynamic decryption)
    const currentPassword = this.getCurrentPassword();
    if (currentPassword !== this.password) {
      console.log(`[EncryptedAppAssetsManager] Password changed during load, clearing cache for ${filePath}`);
      this.onPasswordChanged(currentPassword);
    }

    // Create cache key that includes password to prevent using wrong password's cache
    const cacheKey = `${filePath}:${this.password}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (this.loading.has(cacheKey)) {
      return await this.loading.get(cacheKey)!;
    }

    const loadPromise = this._loadAndDecrypt(filePath);
    this.loading.set(cacheKey, loadPromise);

    try {
      const result = await loadPromise;
      this.loading.delete(cacheKey);
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      this.loading.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Internal method to load and decrypt file
   */
  private async _loadAndDecrypt(filePath: string): Promise<EncryptedAsset> {
    const response = await fetch(filePath);

    if (!response.ok) {
      throw new Error(`Failed to load ${filePath}: ${response.status}`);
    }

    const fileContent = await response.text();

    const encryptedMatch = fileContent.match(/const encrypted = "(.+?)";/);
    if (!encryptedMatch) {
      throw new Error(`Invalid encrypted file format: ${filePath}`);
    }

    const metadataMatch = fileContent.match(/const metadata = (\{[\s\S]+?\});/);
    let extension = '.png';
    if (metadataMatch) {
      const metadata = JSON.parse(metadataMatch[1]);
      extension = metadata.extension || '.png';
    }

    const encryptedData = encryptedMatch[1];
    const imageUrl = await this.decryptor.decryptImageToURL(
      encryptedData,
      this.decryptor.extensionToMimeType(extension)
    );

    const originalName = filePath.replace('.en.js', extension);

    return {
      filePath: filePath,
      originalName: originalName,
      blobUrl: imageUrl,
    };
  }

  /**
   * Load icon by index (1-5)
   */
  async loadIcon(index: number): Promise<EncryptedAsset> {
    if (index < 1 || index > 5) {
      throw new Error('Icon index must be between 1 and 5');
    }

    return await this.loadEncryptedFile(this.ENCRYPTED_ASSETS.icons[index - 1]);
  }

  /**
   * Load splash by index (1-5)
   */
  async loadSplash(index: number): Promise<EncryptedAsset> {
    if (index < 1 || index > 5) {
      throw new Error('Splash index must be between 1 and 5');
    }

    return await this.loadEncryptedFile(this.ENCRYPTED_ASSETS.splashes[index - 1]);
  }

  /**
   * Load all icons
   */
  async loadAllIcons(): Promise<EncryptedAsset[]> {
    const promises = this.ENCRYPTED_ASSETS.icons.map((filePath) => this.loadEncryptedFile(filePath));

    return await Promise.all(promises);
  }

  /**
   * Load all splashes
   */
  async loadAllSplashes(): Promise<EncryptedAsset[]> {
    const promises = this.ENCRYPTED_ASSETS.splashes.map((filePath) => this.loadEncryptedFile(filePath));

    return await Promise.all(promises);
  }

  /**
   * Load all assets (icons and splashes)
   */
  async loadAll(): Promise<{ icons: EncryptedAsset[]; splashes: EncryptedAsset[] }> {
    const [icons, splashes] = await Promise.all([this.loadAllIcons(), this.loadAllSplashes()]);

    return { icons, splashes };
  }

  /**
   * Apply decrypted image to img element (legacy support)
   */
  async applyToImageElement(imgElement: HTMLImageElement, index: number, type: 'icon' | 'splash' = 'icon'): Promise<HTMLImageElement> {
    const asset = type === 'icon' ? await this.loadIcon(index) : await this.loadSplash(index);

    imgElement.src = asset.blobUrl;
    return imgElement;
  }

  /**
   * Revoke all blob URLs (alias for clearCache)
   */
  revokeAllUrls(): void {
    // Use parent's clearCache which handles blob URL revocation
    this.clearCache();
  }

  /**
   * Set password (override to ensure decryptor is updated)
   */
  setPassword(newPassword: string): void {
    // Use parent's setPassword which handles password change detection
    super.setPassword(newPassword);
  }
}

