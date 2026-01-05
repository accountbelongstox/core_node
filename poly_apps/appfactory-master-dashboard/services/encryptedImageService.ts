/**
 * Encrypted Image Service - Lightweight TypeScript Adapter
 *
 * 这是一个轻量级适配器，直接使用 EncryptedAppAssetsManager
 * 不重复实现任何加密逻辑，只提供 TypeScript 类型和接口
 *
 * 架构：
 * encryptedImageService (TS适配器)
 *   ↓
 * EncryptedAppAssetsManager (资源管理)
 *   ↓
 * ImageDecryptor (XOR解密)
 */

// 全局类型声明
declare const EncryptedAppAssetsManager: any;

// TypeScript 接口
interface DecryptedImage {
  blobUrl: string;
  filename: string;
  mimeType: string;
  decrypted: boolean;
}

/**
 * 加密图片服务 - TypeScript 适配器
 *
 * 功能：
 * - 提供 TypeScript 类型安全的接口
 * - 适配现有组件的 API 调用
 * - 自动兼容旧格式路径 (.en.png → .en.js)
 * - 所有实际功能由 EncryptedAppAssetsManager 实现
 */
class EncryptedImageService {
  private assetsManager: any = null;

  constructor() {
    this.initializeManager();
  }

  /**
   * 初始化 EncryptedAppAssetsManager
   * 如果不存在，等待 DOM 加载完成后重试
   */
  private initializeManager() {
    if (typeof window === 'undefined') return;

    if (typeof EncryptedAppAssetsManager !== 'undefined') {
      this.assetsManager = new EncryptedAppAssetsManager();
    } else {
      // 延迟初始化，等待脚本加载
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initializeManager());
      }
    }
  }

  /**
   * 标准化文件路径
   * - 转换旧格式: .en.png → .en.js
   * - 添加前导斜杠: app_icon1.en.js → /app_icon1.en.js
   */
  private normalizePath(path: string): string {
    let normalized = path;

    // 转换旧格式
    if (normalized.endsWith('.en.png')) {
      normalized = normalized.replace('.en.png', '.en.js');
    }

    // 添加前导斜杠
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }

    return normalized;
  }

  /**
   * 提取索引号（从 app1 → 1）
   */
  private extractIndex(appId: string): number | null {
    const match = appId.match(/app(\d+)/);
    if (!match) return null;

    const index = parseInt(match[1]);
    return (index >= 1 && index <= 5) ? index : null;
  }

  /**
   * 加载加密图片文件
   */
  async loadEncryptedImage(filename: string): Promise<DecryptedImage> {
    if (!this.assetsManager) {
      console.error('[EncryptedImageService] EncryptedAppAssetsManager not initialized');
      return this.createErrorImage(filename);
    }

    try {
      const normalizedPath = this.normalizePath(filename);
      const asset = await this.assetsManager.loadEncryptedFile(normalizedPath);

      return {
        blobUrl: asset.blobUrl,
        filename: asset.originalName || normalizedPath,
        mimeType: 'image/png',
        decrypted: true
      };
    } catch (error) {
      console.error(`[EncryptedImageService] Failed to load ${filename}:`, error);
      return this.createErrorImage(filename);
    }
  }

  /**
   * 按索引加载图标 (1-5)
   */
  async loadIconByIndex(index: number): Promise<string | null> {
    if (!this.assetsManager) return null;
    if (index < 1 || index > 5) return null;

    try {
      const asset = await this.assetsManager.loadIcon(index);
      return asset.blobUrl;
    } catch (error) {
      console.error(`[EncryptedImageService] Failed to load icon ${index}:`, error);
      return null;
    }
  }

  /**
   * 按索引加载启动画面 (1-5)
   */
  async loadSplashByIndex(index: number): Promise<string | null> {
    if (!this.assetsManager) return null;
    if (index < 1 || index > 5) return null;

    try {
      const asset = await this.assetsManager.loadSplash(index);
      return asset.blobUrl;
    } catch (error) {
      console.error(`[EncryptedImageService] Failed to load splash ${index}:`, error);
      return null;
    }
  }

  /**
   * 加载 App 图标
   * 支持：
   * - 直接路径: '/app_icon1.en.js'
   * - 旧格式: 'app_icon1.en.png' (自动转换)
   * - App ID推断: 'app1' → 加载 icon 1
   */
  async loadAppIcon(appId: string, iconFilename?: string): Promise<string | null> {
    // 如果提供了文件名，直接加载
    if (iconFilename) {
      const result = await this.loadEncryptedImage(iconFilename);
      return result.blobUrl;
    }

    // 从 appId 推断索引
    const index = this.extractIndex(appId);
    if (index) {
      return this.loadIconByIndex(index);
    }

    return null;
  }

  /**
   * 加载 App 启动画面
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
   * 加载所有图标 (1-5)
   */
  async loadAllIcons(): Promise<(string | null)[]> {
    if (!this.assetsManager) {
      return [null, null, null, null, null];
    }

    try {
      const assets = await this.assetsManager.loadAllIcons();
      return assets.map((asset: any) => asset.blobUrl);
    } catch (error) {
      console.error('[EncryptedImageService] Failed to load all icons:', error);
      return [null, null, null, null, null];
    }
  }

  /**
   * 加载所有启动画面 (1-5)
   */
  async loadAllSplashes(): Promise<(string | null)[]> {
    if (!this.assetsManager) {
      return [null, null, null, null, null];
    }

    try {
      const assets = await this.assetsManager.loadAllSplashes();
      return assets.map((asset: any) => asset.blobUrl);
    } catch (error) {
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
   * 检查是否为有效的加密资源
   */
  isValidEncryptedAsset(filename: string): boolean {
    const normalized = this.normalizePath(filename);
    const assets = this.getHardcodedAssets();
    const allAssets = [...assets.icons, ...assets.splashes];
    return allAssets.includes(normalized);
  }

  /**
   * 清除缓存和撤销 Blob URLs
   */
  revokeAllUrls(): void {
    if (this.assetsManager?.revokeAllUrls) {
      this.assetsManager.revokeAllUrls();
    }
  }

  /**
   * 设置密码（更新底层管理器）
   */
  setDefaultPassword(password: string): void {
    if (this.assetsManager?.setPassword) {
      this.assetsManager.setPassword(password);
    }
  }

  /**
   * 设置基础路径（已弃用，保留接口兼容性）
   */
  setBasePath(_path: string): void {
    console.warn('[EncryptedImageService] setBasePath is deprecated - files are in /public/ root');
  }

  /**
   * 创建错误占位图
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

// 导出单例实例
export const encryptedImageService = new EncryptedImageService();
