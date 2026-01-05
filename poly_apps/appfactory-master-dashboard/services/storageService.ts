/**
 * Storage中心化服务
 * 提供类型安全的localStorage封装
 */

// Storage键定义
export const STORAGE_KEYS = {
  LANGUAGE: 'app_language',
  THEME: 'app_theme',
  USER_INFO: 'app_user_info',
  AUTH_TOKEN: 'app_auth_token',
  SETTINGS: 'app_settings',
  API_USER_SELECTED: 'api_user_selected',
  API_AUTO_DETECTED: 'api_auto_detected',
} as const;

// 用户信息类型
export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

// 设置类型
export interface AppSettings {
  language: string;
  theme: 'light' | 'dark';
  notifications: boolean;
  autoRefresh: boolean;
}

// Storage服务类
class StorageService {
  /**
   * 获取存储的值
   */
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue ?? null;
      return JSON.parse(item) as T;
    } catch (error) {
      // catch 代码必要性：必须保留
      // 原因：localStorage 可能失败（存储空间满、隐私模式、跨域等）
      // 需要捕获错误并返回默认值，避免应用崩溃
      console.error(`Error getting item from storage: ${key}`, error);
      return defaultValue ?? null;
    }
  }

  /**
   * 设置存储的值
   */
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // catch 代码必要性：必须保留
      // 原因：localStorage 可能失败（存储空间满、隐私模式、跨域等）
      // 需要捕获错误，避免应用崩溃
      console.error(`Error setting item in storage: ${key}`, error);
    }
  }

  /**
   * 删除存储的值
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      // catch 代码必要性：必须保留
      // 原因：localStorage 可能失败（隐私模式、跨域等）
      // 需要捕获错误，避免应用崩溃
      console.error(`Error removing item from storage: ${key}`, error);
    }
  }

  /**
   * 清空所有存储
   */
  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      // catch 代码必要性：必须保留
      // 原因：localStorage 可能失败（隐私模式、跨域等）
      // 需要捕获错误，避免应用崩溃
      console.error('Error clearing storage', error);
    }
  }

  // === 具体业务方法 ===

  /**
   * 获取当前语言
   */
  getLanguage(): string {
    const lang = this.get<string>(STORAGE_KEYS.LANGUAGE, 'zh');
    return lang ?? 'zh';
  }

  /**
   * 设置当前语言
   */
  setLanguage(language: string): void {
    this.set(STORAGE_KEYS.LANGUAGE, language);
  }

  /**
   * 获取当前主题
   */
  getTheme(): 'light' | 'dark' {
    const theme = this.get<'light' | 'dark'>(STORAGE_KEYS.THEME, 'light');
    return theme ?? 'light';
  }

  /**
   * 设置当前主题
   */
  setTheme(theme: 'light' | 'dark'): void {
    this.set(STORAGE_KEYS.THEME, theme);
  }

  /**
   * Get user info
   * Avatar URLs are generated dynamically at render time using avatarUtils.getAvatarUrl()
   */
  getUserInfo(): UserInfo | null {
    return this.get<UserInfo>(STORAGE_KEYS.USER_INFO);
  }

  /**
   * 设置用户信息
   */
  setUserInfo(userInfo: UserInfo): void {
    this.set(STORAGE_KEYS.USER_INFO, userInfo);
  }

  /**
   * 获取认证Token
   */
  getAuthToken(): string | null {
    return this.get<string>(STORAGE_KEYS.AUTH_TOKEN);
  }

  /**
   * 设置认证Token
   */
  setAuthToken(token: string): void {
    this.set(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  /**
   * 获取应用设置
   */
  getSettings(): AppSettings {
    const defaultSettings: AppSettings = {
      language: 'zh',
      theme: 'light',
      notifications: true,
      autoRefresh: true,
    };
    const settings = this.get<AppSettings>(STORAGE_KEYS.SETTINGS, defaultSettings);
    return settings ?? defaultSettings;
  }

  /**
   * 设置应用设置
   */
  setSettings(settings: AppSettings): void {
    this.set(STORAGE_KEYS.SETTINGS, settings);
  }

  /**
   * 清除用户相关的所有数据（登出时使用）
   */
  clearUserData(): void {
    this.remove(STORAGE_KEYS.USER_INFO);
    this.remove(STORAGE_KEYS.AUTH_TOKEN);
  }
}

// 导出单例
export const storageService = new StorageService();
