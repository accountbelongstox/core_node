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
      console.error('Error clearing storage', error);
    }
  }

  // === 具体业务方法 ===

  /**
   * 获取当前语言
   */
  getLanguage(): string {
    return this.get<string>(STORAGE_KEYS.LANGUAGE, 'zh') || 'zh';
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
    return this.get<'light' | 'dark'>(STORAGE_KEYS.THEME, 'light') || 'light';
  }

  /**
   * 设置当前主题
   */
  setTheme(theme: 'light' | 'dark'): void {
    this.set(STORAGE_KEYS.THEME, theme);
  }

  /**
   * 获取用户信息
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
    return this.get<AppSettings>(STORAGE_KEYS.SETTINGS, {
      language: 'zh',
      theme: 'light',
      notifications: true,
      autoRefresh: true,
    }) || {
      language: 'zh',
      theme: 'light',
      notifications: true,
      autoRefresh: true,
    };
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
