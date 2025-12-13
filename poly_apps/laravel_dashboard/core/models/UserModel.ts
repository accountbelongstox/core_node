import { User, UserPreferences } from '../types';
import { api } from '../api';

/**
 * UserModel - 用户模型
 */
export class UserModel {
  private user: User | null = null;
  private preferences: UserPreferences = {
    theme: 'dark',
    language: 'en',
    favorites: [],
    recentTools: []
  };

  constructor() {
    this.load();
  }

  /**
   * Login
   */
  async login(username: string, password: string): Promise<void> {
    const response = await api.appQyV1.login({ username, password });

    if (!response.success) {
      throw new Error(response.error || 'Login failed');
    }

    const token = response.data.token || response.data.data?.token;
    const user = response.data.user || response.data.data?.user;

    if (!token || !user) {
      throw new Error('Invalid response format');
    }

    this.user = user;
    api.setAuthToken(token);

    this.save();
    this.saveToken(token);

    await this.loadPreferences();
  }

  /**
   * Register
   */
  async register(
    username: string,
    password: string,
    email?: string,
    nickname?: string,
    registrationCode?: string
  ): Promise<void> {
    const response = await api.appQyV1.register({
      username,
      password,
      email,
      nickname,
      registration_code: registrationCode
    });

    if (!response.success) {
      throw new Error(response.error || 'Registration failed');
    }

    const token = response.data.token || response.data.data?.token;
    const user = response.data.user || response.data.data?.user;

    if (!token || !user) {
      throw new Error('Invalid response format');
    }

    this.user = user;
    api.setAuthToken(token);

    this.save();
    this.saveToken(token);

    await this.loadPreferences();
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    try {
      await api.appQyV1.logout();
    } catch (error) {
      console.warn('Logout API failed:', error);
    }

    this.user = null;
    api.clearAuth();
    this.clear();
  }

  /**
   * 获取当前用户
   */
  getUser(): User | null {
    return this.user;
  }

  /**
   * 是否已登录
   */
  isLoggedIn(): boolean {
    return this.user !== null;
  }

  /**
   * 获取偏好设置
   */
  getPreferences(): UserPreferences {
    return { ...this.preferences };
  }

  /**
   * 更新偏好设置
   */
  async updatePreferences(prefs: Partial<UserPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...prefs };
    this.savePreferences();

    // 同步到服务器
    try {
      await api.appQyV1.updateUserPreferences(prefs);
    } catch (error) {
      console.warn('Failed to sync preferences:', error);
    }
  }

  /**
   * 添加最近使用工具
   */
  addRecentTool(toolId: string): void {
    const recent = this.preferences.recentTools.filter(id => id !== toolId);
    recent.unshift(toolId);

    // 最多保存10个
    this.preferences.recentTools = recent.slice(0, 10);
    this.savePreferences();
  }

  /**
   * 切换收藏工具
   */
  toggleFavorite(toolId: string): void {
    const favorites = this.preferences.favorites;
    const index = favorites.indexOf(toolId);

    if (index > -1) {
      favorites.splice(index, 1);
    } else {
      favorites.push(toolId);
    }

    this.savePreferences();
  }

  /**
   * 是否已收藏
   */
  isFavorite(toolId: string): boolean {
    return this.preferences.favorites.includes(toolId);
  }

  /**
   * 加载用户偏好
   */
  private async loadPreferences(): Promise<void> {
    try {
      const response = await api.appQyV1.getUserPreferences();
      if (response.success && response.data) {
        this.preferences = { ...this.preferences, ...response.data };
        this.savePreferences();
      }
    } catch (error) {
      console.warn('Failed to load preferences from server:', error);
    }
  }

  /**
   * 保存到localStorage
   */
  private save(): void {
    if (this.user) {
      localStorage.setItem('user', JSON.stringify(this.user));
    }
  }

  /**
   * 保存token
   */
  private saveToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  /**
   * 保存偏好设置
   */
  private savePreferences(): void {
    localStorage.setItem('user_preferences', JSON.stringify(this.preferences));
  }

  /**
   * 从localStorage加载
   */
  private load(): void {
    try {
      // 加载用户
      const userStr = localStorage.getItem('user');
      if (userStr) {
        this.user = JSON.parse(userStr);
      }

      // 加载token
      const token = localStorage.getItem('auth_token');
      if (token) {
        api.setAuthToken(token);
      }

      // 加载偏好
      const prefsStr = localStorage.getItem('user_preferences');
      if (prefsStr) {
        this.preferences = JSON.parse(prefsStr);
      }
    } catch (error) {
      console.warn('Failed to load user data:', error);
    }
  }

  /**
   * 清除数据
   */
  private clear(): void {
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
  }
}

// 单例
export const userModel = new UserModel();
