import { Language, Theme } from '../../types';
import { StorageManager, StorageKeys } from '../storage';

/**
 * Settings Interface
 */
export interface AppSettings {
  theme: Theme;
  language: Language;
  autoSave: boolean;
  notifications: boolean;
}

/**
 * SettingsModel
 * Centralized settings management with storage persistence
 * Handles theme, language, and other app-wide settings
 */
export class SettingsModel {
  private settings: AppSettings;
  private listeners: Set<(settings: AppSettings) => void> = new Set();

  constructor() {
    this.settings = this.loadFromStorage();
  }

  /**
   * Load settings from storage
   */
  private loadFromStorage(): AppSettings {
    const defaults: AppSettings = {
      theme: 'dark',
      language: 'en',
      autoSave: true,
      notifications: true
    };

    return StorageManager.get<AppSettings>(StorageKeys.SETTINGS, defaults);
  }

  /**
   * Save settings to storage
   */
  private saveToStorage(): void {
    StorageManager.set(StorageKeys.SETTINGS, this.settings);
    this.notifyListeners();
  }

  /**
   * Add change listener
   */
  addListener(listener: (settings: AppSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.settings);
      } catch (error) {
        console.error('[SettingsModel] Error in listener:', error);
      }
    });
  }

  /**
   * Get all settings
   */
  getSettings(): AppSettings {
    return { ...this.settings };
  }

  /**
   * Get theme
   */
  getTheme(): Theme {
    return this.settings.theme;
  }

  /**
   * Set theme
   */
  setTheme(theme: Theme, reload = false): void {
    this.settings.theme = theme;
    this.saveToStorage();
    StorageManager.set(StorageKeys.THEME, theme);
    console.log('[SettingsModel] Theme changed to:', theme);

    if (reload) {
      setTimeout(() => {
        console.log('[SettingsModel] Reloading page due to theme change');
        window.location.reload();
      }, 300);
    }
  }

  /**
   * Toggle theme
   */
  toggleTheme(reload = false): Theme {
    const newTheme: Theme = this.settings.theme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme, reload);
    return newTheme;
  }

  /**
   * Get language
   */
  getLanguage(): Language {
    return this.settings.language;
  }

  /**
   * Set language
   */
  setLanguage(language: Language, reload = false): void {
    this.settings.language = language;
    this.saveToStorage();
    StorageManager.set(StorageKeys.LANGUAGE, language);
    console.log('[SettingsModel] Language changed to:', language);

    if (reload) {
      setTimeout(() => {
        console.log('[SettingsModel] Reloading page due to language change');
        window.location.reload();
      }, 300);
    }
  }

  /**
   * Toggle language
   */
  toggleLanguage(reload = false): Language {
    const newLang: Language = this.settings.language === 'en' ? 'zh' : 'en';
    this.setLanguage(newLang, reload);
    return newLang;
  }

  /**
   * Update multiple settings at once
   */
  updateSettings(updates: Partial<AppSettings>, reload = false): void {
    this.settings = { ...this.settings, ...updates };
    this.saveToStorage();
    console.log('[SettingsModel] Settings updated:', updates);

    if (reload) {
      setTimeout(() => {
        console.log('[SettingsModel] Reloading page due to settings change');
        window.location.reload();
      }, 300);
    }
  }

  /**
   * Reset settings to default
   */
  resetToDefault(reload = false): void {
    this.settings = {
      theme: 'dark',
      language: 'en',
      autoSave: true,
      notifications: true
    };
    this.saveToStorage();
    console.log('[SettingsModel] Settings reset to default');

    if (reload) {
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }

  /**
   * Export settings as JSON
   */
  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings from JSON
   */
  importSettings(json: string, reload = false): boolean {
    try {
      const imported = JSON.parse(json) as Partial<AppSettings>;
      this.updateSettings(imported, reload);
      return true;
    } catch (error) {
      console.error('[SettingsModel] Failed to import settings:', error);
      return false;
    }
  }
}

export const settingsModel = new SettingsModel();
