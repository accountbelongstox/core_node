import { UnifiedUser, UserPreferences } from '../types';
import { api } from '../api';
import { StorageManager } from '../../../core/persistence';
import { LaravelManagerStorageKeys as StorageKeys } from '../persistence/LaravelManagerStorageKeys';
import {
  getActiveAuthNamespace,
  getAuthSnapshot,
  getAuthToken,
  setAuthUser,
} from '../../../core/auth/AuthSession';
import { AUTH_SESSION_CHANGED_EVENT } from '../../../core/auth/AuthRequestCenter';
import { getSharedBaseURL } from '../../../core/integrations/laravel/transport/BaseAPI';
import {
  loginLaravel,
  logoutLaravel,
  refreshLaravelSession,
  registerLaravel,
} from '../../../core/integrations/laravel/LaravelAuthClient';
import { normalizeLaravelUser } from '../auth/UserIdentity';

function extractResponseData(data: any): any {
  return data?.data ?? data;
}

function extractUnifiedUser(data: any): UnifiedUser | null {
  return normalizeLaravelUser(extractResponseData(data));
}

/** The Laravel API every Lm call goes to right now: its session is the "current user". */
function activeBaseUrl(): string {
  return getSharedBaseURL() ?? getActiveAuthNamespace() ?? '';
}

/**
 * UserModel - the signed-in user of the ACTIVE Laravel API. Token and user live
 * in the shared per-API session store (core/auth/AuthSession); switching the
 * endpoint therefore switches the current user with no state to reset here.
 */
export class UserModel {
  private preferences: UserPreferences = {
    theme: 'dark',
    language: 'en',
    favorites: [],
    recentTools: []
  };
  /** `namespace|token` of the session whose profile was last confirmed by the server. */
  private validatedSession = '';

  constructor() {
    this.loadPreferencesFromStorage();
  }

  /**
   * Login against the active API.
   * Throws LaravelAuthError (errorCode from backend error_code) for UI to show localized message.
   */
  async login(username: string, password: string): Promise<void> {
    await loginLaravel(activeBaseUrl(), { username, password });
    this.markValidated();
    await this.loadPreferences();
  }

  async register(
    username: string,
    password: string,
    email?: string,
    nickname?: string,
    registrationCode?: string
  ): Promise<void> {
    await registerLaravel(activeBaseUrl(), { username, password, email, nickname, registrationCode });
    this.markValidated();
    await this.loadPreferences();
  }

  /** Sign out of the active API only. */
  async logout(): Promise<void> {
    await logoutLaravel(activeBaseUrl());
  }

  getUser(): UnifiedUser | null {
    return getAuthSnapshot().user as UnifiedUser | null;
  }

  isLoggedIn(): boolean {
    return getAuthSnapshot().loggedIn;
  }

  hasStoredToken(): boolean {
    return getAuthToken() !== null;
  }

  /**
   * Bring the active API's session up to date once per token: confirm the
   * profile with the server (a refused token ends the session) and load the
   * user's preferences.
   */
  async syncSession(): Promise<void> {
    if (!this.hasStoredToken()) return;
    const key = this.sessionKey();
    if (this.validatedSession !== key) {
      const user = await this.refreshProfile();
      if (!user) return;
    }
    await this.loadPreferences();
  }

  async refreshProfile(): Promise<UnifiedUser | null> {
    const user = await refreshLaravelSession(activeBaseUrl()) as UnifiedUser | null;
    if (user) this.markValidated();
    return user;
  }

  /**
   * Merge a profile/redeem payload into the active API's session.
   */
  applyProfileUser(raw: unknown): UnifiedUser | null {
    const current = this.getUser();
    const next = extractUnifiedUser(raw) ?? normalizeLaravelUser(raw);
    if (!next) {
      return current;
    }

    const merged: UnifiedUser = {
      ...current,
      ...next,
      preferences: next.preferences ?? current?.preferences,
    };
    setAuthUser({ ...merged });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT));
    }

    return merged;
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

      setAuthUser({ ...UnifiedUser });

      if (prefsRes.success && prefsRes.data) {
        this.preferences = { ...this.preferences, ...prefsRes.data };
        this.savePreferences();
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT));
      }

      return true;
    } catch (error) {
      console.warn('Loopback session bootstrap failed:', error);
      return false;
    }
  }

  /**
   * Load the user's preferences from the active API
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

  private sessionKey(): string {
    return `${getActiveAuthNamespace() ?? ''}|${getAuthToken() ?? ''}`;
  }

  private markValidated(): void {
    this.validatedSession = this.sessionKey();
  }

  /**
   * Save preferences
   */
  private savePreferences(): void {
    StorageManager.set(StorageKeys.USER_PREFERENCES, this.preferences);
  }

  private loadPreferencesFromStorage(): void {
    try {
      const savedPreferences = StorageManager.get<UserPreferences | null>(StorageKeys.USER_PREFERENCES, null);
      if (savedPreferences) {
        this.preferences = savedPreferences;
      }
    } catch (error) {
      console.warn('Failed to load UnifiedUser data:', error);
    }
  }
}

// Singleton
export const userModel = new UserModel();
