import { UnifiedUser, UserPreferences } from '../types';
import { api } from '../api';

/**
 * UserModel - UnifiedUser model
 */
export class UserModel {
  private UnifiedUser: UnifiedUser | null = null;
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
   * Login - Use public authentication endpoint.
   * Throws Error with optional errorCode (from backend error_code) for UI to show localized message.
   */
  async login(username: string, password: string): Promise<void> {
    const response = await api.auth.login({ username, password });

    if (!response.success) {
      const errorCode = response.debugInfo?.error_code;
      const err = new Error(response.error || 'Login failed');
      (err as Error & { errorCode?: string }).errorCode = errorCode;
      throw err;
    }

    const token = response.data.token || response.data.data?.token;
    const UnifiedUser = response.data.UnifiedUser || response.data.data?.UnifiedUser;

    if (!token || !UnifiedUser) {
      throw new Error('Invalid response format');
    }

    this.UnifiedUser = UnifiedUser;
    api.setAuthToken(token);

    this.save();
    this.saveToken(token);

    await this.loadPreferences();
  }

  /**
   * Register - Use public authentication endpoint
   */
  async register(
    username: string,
    password: string,
    email?: string,
    nickname?: string,
    registrationCode?: string
  ): Promise<void> {
    const response = await api.auth.register({
      username,
      password,
      email,
      nickname,
      name: nickname,
      registration_code: registrationCode
    });

    if (!response.success) {
      throw new Error(response.error || 'Registration failed');
    }

    const token = response.data.token || response.data.data?.token;
    const UnifiedUser = response.data.UnifiedUser || response.data.data?.UnifiedUser;

    if (!token || !UnifiedUser) {
      throw new Error('Invalid response format');
    }

    this.UnifiedUser = UnifiedUser;
    api.setAuthToken(token);

    this.save();
    this.saveToken(token);

    await this.loadPreferences();
  }

  /**
   * Logout - Use public authentication endpoint
   */
  async logout(): Promise<void> {
    try {
      await api.auth.logout();
    } catch (error) {
      console.warn('Logout API failed:', error);
    }

    this.UnifiedUser = null;
    api.clearAuth();
    this.clear();
  }

  /**
   * Get the current UnifiedUser
   */
  getUser(): UnifiedUser | null {
    return this.UnifiedUser;
  }

  /**
   * Whether the UnifiedUser is logged in
   */
  isLoggedIn(): boolean {
    return this.UnifiedUser !== null;
  }

  /**
   * Get preferences
   */
  getPreferences(): UserPreferences {
    return { ...this.preferences };
  }

  /**
   * Update preferences
   */
  async updatePreferences(prefs: Partial<UserPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...prefs };
    this.savePreferences();

    // Sync to the server
    try {
      await api.auth.updateUserPreferences(prefs);
    } catch (error) {
      console.warn('Failed to sync preferences:', error);
    }
  }

  /**
   * Add a recently used tool
   */
  addRecentTool(toolId: string): void {
    const recent = this.preferences.recentTools.filter(id => id !== toolId);
    recent.unshift(toolId);

    // Keep at most 10 entries
    this.preferences.recentTools = recent.slice(0, 10);
    this.savePreferences();
  }

  /**
   * Toggle a favorite tool
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
   * Whether the tool is favorited
   */
  isFavorite(toolId: string): boolean {
    return this.preferences.favorites.includes(toolId);
  }

  /**
   * Loopback debug bypass: bind the highest-privilege server UnifiedUser into local
   * state without a Sanctum token (backend dashboard.auth grants access).
   */
  async bootstrapLoopbackSession(): Promise<boolean> {
    try {
      const [profileRes, prefsRes] = await Promise.all([
        api.auth.getUserProfile(),
        api.auth.getUserPreferences(),
      ]);

      if (!profileRes.success || !profileRes.data?.UnifiedUser) {
        return false;
      }

      this.UnifiedUser = profileRes.data.UnifiedUser;
      this.save();

      if (prefsRes.success && prefsRes.data) {
        this.preferences = { ...this.preferences, ...prefsRes.data };
        this.savePreferences();
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('UnifiedUser-session-changed'));
      }

      return true;
    } catch (error) {
      console.warn('Loopback session bootstrap failed:', error);
      return false;
    }
  }

  /**
   * Load UnifiedUser preferences
   */
  private async loadPreferences(): Promise<void> {
    try {
      const response = await api.auth.getUserPreferences();
      if (response.success && response.data) {
        this.preferences = { ...this.preferences, ...response.data };
        this.savePreferences();
      }
    } catch (error) {
      console.warn('Failed to load preferences from server:', error);
    }
  }

  /**
   * Save to localStorage
   */
  private save(): void {
    if (this.UnifiedUser) {
      localStorage.setItem('UnifiedUser', JSON.stringify(this.UnifiedUser));
    }
  }

  /**
   * Save the token
   */
  private saveToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  /**
   * Save preferences
   */
  private savePreferences(): void {
    localStorage.setItem('user_preferences', JSON.stringify(this.preferences));
  }

  /**
   * Load from localStorage
   */
  private load(): void {
    try {
      // Load UnifiedUser
      const userStr = localStorage.getItem('UnifiedUser');
      if (userStr) {
        this.UnifiedUser = JSON.parse(userStr);
      }

      // Load token
      const token = localStorage.getItem('auth_token');
      if (token) {
        api.setAuthToken(token);
      }

      // Load preferences
      const prefsStr = localStorage.getItem('user_preferences');
      if (prefsStr) {
        this.preferences = JSON.parse(prefsStr);
      }
    } catch (error) {
      console.warn('Failed to load UnifiedUser data:', error);
    }
  }

  /**
   * Clear data
   */
  private clear(): void {
    localStorage.removeItem('UnifiedUser');
    localStorage.removeItem('auth_token');
  }
}

// Singleton
export const userModel = new UserModel();

