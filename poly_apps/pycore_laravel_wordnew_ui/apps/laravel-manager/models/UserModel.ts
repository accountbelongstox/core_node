import { UnifiedUser, UserPreferences } from '../types';
import { api } from '../api';
import { StorageManager } from '../../../core/persistence';
import { LaravelManagerStorageKeys as StorageKeys } from '../persistence/LaravelManagerStorageKeys';
import { getAuthToken } from '../../../core/auth/AuthSession';
import { normalizeLaravelUser } from '../auth/UserIdentity';

function extractResponseData(data: any): any {
  return data?.data ?? data;
}

function extractAuthToken(data: any): string | null {
  const payload = extractResponseData(data);
  return typeof payload?.token === 'string' && payload.token !== '' ? payload.token : null;
}

function extractUnifiedUser(data: any): UnifiedUser | null {
  return normalizeLaravelUser(extractResponseData(data));
}

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
    let token: string | null = null;
    let UnifiedUser: UnifiedUser | null = null;

    if (!response.success) {
      const errorCode = response.debugInfo?.error_code;
      const err = new Error(response.error || 'Login failed');
      (err as Error & { errorCode?: string }).errorCode = errorCode;
      throw err;
    }

    token = extractAuthToken(response.data);
    UnifiedUser = extractUnifiedUser(response.data);

    if (!token || !UnifiedUser) {
      throw new Error('Invalid response format');
    }

    this.UnifiedUser = UnifiedUser;
    api.setAuthToken(token);

    await this.refreshProfile();

    this.save();

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
    let token: string | null = null;
    let UnifiedUser: UnifiedUser | null = null;

    if (!response.success) {
      throw new Error(response.error || 'Registration failed');
    }

    token = extractAuthToken(response.data);
    UnifiedUser = extractUnifiedUser(response.data);

    if (!token || !UnifiedUser) {
      throw new Error('Invalid response format');
    }

    this.UnifiedUser = UnifiedUser;
    api.setAuthToken(token);

    await this.refreshProfile();

    this.save();

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

  hasStoredToken(): boolean {
    return getAuthToken() !== null;
  }

  async refreshProfile(): Promise<UnifiedUser | null> {
    const response = await api.auth.getUserProfile();
    const user = response.success ? extractUnifiedUser(response.data) : null;
    if (user) {
      this.UnifiedUser = user;
      this.save();
    }
    return user;
  }

  /**
   * Merge a profile/redeem payload into the local session (storage + memory).
   */
  applyProfileUser(raw: unknown): UnifiedUser | null {
    const next = extractUnifiedUser(raw) ?? normalizeLaravelUser(raw);
    if (!next) {
      return this.UnifiedUser;
    }

    this.UnifiedUser = {
      ...this.UnifiedUser,
      ...next,
      preferences: next.preferences ?? this.UnifiedUser?.preferences,
    };
    this.save();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('UnifiedUser-session-changed'));
    }

    return this.UnifiedUser;
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
      const UnifiedUser = extractUnifiedUser(profileRes.data);

      if (!profileRes.success || UnifiedUser === null) {
        return false;
      }

      this.UnifiedUser = UnifiedUser;
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
      StorageManager.set(StorageKeys.USER, this.UnifiedUser);
    }
  }

  /**
   * Save preferences
   */
  private savePreferences(): void {
    StorageManager.set(StorageKeys.USER_PREFERENCES, this.preferences);
  }

  /**
   * Load from localStorage
   */
  private load(): void {
    try {
      // Load UnifiedUser
      const savedUser = StorageManager.get<UnifiedUser | null>(StorageKeys.USER, null);
      if (savedUser) {
        this.UnifiedUser = savedUser;
      } else {
        const legacyUser = StorageManager.getLegacyRaw('UnifiedUser');
        if (legacyUser) {
          this.UnifiedUser = JSON.parse(legacyUser);
          this.save();
          StorageManager.removeLegacyRaw(['UnifiedUser']);
        }
      }

      // Load token
      let token = getAuthToken();
      if (!token) {
        token = StorageManager.getLegacyRaw('auth_token');
        if (token) {
          StorageManager.removeLegacyRaw(['auth_token']);
        }
      }
      if (token) {
        api.setAuthToken(token);
      }

      // Load preferences
      const savedPreferences = StorageManager.get<UserPreferences | null>(StorageKeys.USER_PREFERENCES, null);
      if (savedPreferences) {
        this.preferences = savedPreferences;
      } else {
        const legacyPreferences = StorageManager.getLegacyRaw('user_preferences');
        if (legacyPreferences) {
          this.preferences = JSON.parse(legacyPreferences);
          this.savePreferences();
          StorageManager.removeLegacyRaw(['user_preferences']);
        }
      }
    } catch (error) {
      console.warn('Failed to load UnifiedUser data:', error);
    }
  }

  /**
   * Clear data
   */
  private clear(): void {
    StorageManager.remove(StorageKeys.USER);
  }
}

// Singleton
export const userModel = new UserModel();

