/**
 * Settings Center - Unified Settings Management
 * Manages app settings with auto-save and reactive updates
 */

import { StorageCenter, StorageKey } from './StorageCenter';
import { StateManager, GlobalState } from './StateManager';
import { EventBus } from './EventBus';

export interface DisplaySettings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: string;
  compactMode: boolean;
  showAnimations: boolean;
}

export interface LanguageSettings {
  appInterface: string | string[]; // Support both single string and array for multi-select
  learningLanguage: string;
  learningLanguages: string[]; // Array of language codes user is learning (GLOBAL setting, synced to backend)
  nativeLanguage: string;
  autoDetect: boolean;
}

export interface AudioSettings {
  autoPlay: boolean;
  playbackSpeed: number;
  volume: number;
  voice: string;
}

export interface LearningSettings {
  dailyGoal: number;
  reviewInterval: number;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  showHints: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  dailyReminder: boolean;
  achievementAlerts: boolean;
  soundEnabled: boolean;
}

export interface AppSettings {
  language: LanguageSettings;
  display: DisplaySettings;
  audio: AudioSettings;
  learning: LearningSettings;
  notifications: NotificationSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: {
    appInterface: 'en',
    learningLanguage: 'en',
    learningLanguages: [], // Empty by default, user selects their learning languages
    nativeLanguage: 'zh',
    autoDetect: false
  },
  display: {
    theme: 'auto',
    fontSize: 'medium',
    fontFamily: 'system',
    compactMode: false,
    showAnimations: true
  },
  audio: {
    autoPlay: true,
    playbackSpeed: 1.0,
    volume: 0.8,
    voice: 'default'
  },
  learning: {
    dailyGoal: 20,
    reviewInterval: 4,
    difficultyLevel: 'medium',
    showHints: true
  },
  notifications: {
    enabled: true,
    dailyReminder: true,
    achievementAlerts: true,
    soundEnabled: true
  }
};

type SettingsChangeListener = (settings: AppSettings) => void;

class SettingsCenterClass {
  private settings: AppSettings = DEFAULT_SETTINGS;
  private listeners: Set<SettingsChangeListener> = new Set();

  /**
   * Initialize settings from storage
   */
  initialize(): AppSettings {
    const stored = StorageCenter.settings.get();
    if (stored) {
      this.settings = { ...DEFAULT_SETTINGS, ...stored };
    } else {
      this.settings = DEFAULT_SETTINGS;
      this.save();
    }

    this.applyTheme();

    // Apply the persisted UI language to LanguageCenter on startup (mirrors
    // applyTheme). Dynamic import avoids a circular dependency. Without this the
    // app reset to English on every reload regardless of the saved language.
    const langValue = this.settings.language.appInterface;
    const lang = Array.isArray(langValue) && langValue.length > 0
      ? langValue[0]
      : (typeof langValue === 'string' ? langValue : 'en');
    if (lang) {
      document.documentElement.lang = lang;
      import('../i18n/LanguageCenter').then(({ LanguageCenter }) => {
        LanguageCenter.setLanguage(lang as any);
      });
    }

    return this.settings;
  }

  /**
   * Get current settings
   */
  get(): AppSettings {
    return { ...this.settings };
  }

  /**
   * Update settings (partial)
   */
  update(partial: Partial<AppSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...partial };

    this.save();
    this.notifyListeners();

    // Auto-apply language change to LanguageCenter
    if (partial.language?.appInterface) {
      const lang = Array.isArray(partial.language.appInterface)
        ? partial.language.appInterface[0]
        : partial.language.appInterface;
      if (lang) {
        // Dynamically import LanguageCenter to avoid circular dependency
        import('../i18n/LanguageCenter').then(({ LanguageCenter }) => {
          LanguageCenter.setLanguage(lang as any);
          console.log('[SettingsCenter] Language updated in LanguageCenter:', lang);
        });
      }
    }

    // Auto-refresh on critical changes
    if (this.shouldRefresh(oldSettings, this.settings)) {
      this.refresh();
    }
  }

  /**
   * Update specific section
   */
  updateSection<K extends keyof AppSettings>(
    section: K,
    value: Partial<AppSettings[K]>
  ): void {
    const oldSettings = { ...this.settings };
    this.settings[section] = { ...this.settings[section], ...value };

    this.save();
    this.notifyListeners();

    // Auto-apply language change to LanguageCenter
    if (section === 'language' && (value as any).appInterface) {
      const lang = Array.isArray((value as any).appInterface)
        ? (value as any).appInterface[0]
        : (value as any).appInterface;
      if (lang) {
        // Dynamically import LanguageCenter to avoid circular dependency
        import('../i18n/LanguageCenter').then(({ LanguageCenter }) => {
          LanguageCenter.setLanguage(lang as any);
          console.log('[SettingsCenter] Language updated in LanguageCenter:', lang);
        });
      }
    }

    if (this.shouldRefresh(oldSettings, this.settings)) {
      this.refresh();
    }
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.settings = DEFAULT_SETTINGS;
    this.save();
    this.notifyListeners();
    this.refresh();
  }

  /**
   * Save to storage
   */
  private save(): void {
    StorageCenter.settings.set(this.settings);

    // Also save to StateManager
    StateManager.set(GlobalState.SETTINGS, this.settings);
  }

  /**
   * Add change listener
   */
  onChange(listener: SettingsChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.settings));
  }

  /**
   * Check if page refresh is needed
   */
  private shouldRefresh(oldSettings: AppSettings, newSettings: AppSettings): boolean {
    // Theme change
    if (oldSettings.display.theme !== newSettings.display.theme) {
      return true;
    }

    // Language change - handle both string and array
    const oldLang = Array.isArray(oldSettings.language.appInterface) 
      ? oldSettings.language.appInterface.join(',') 
      : oldSettings.language.appInterface;
    const newLang = Array.isArray(newSettings.language.appInterface)
      ? newSettings.language.appInterface.join(',')
      : newSettings.language.appInterface;
    if (oldLang !== newLang) {
      return true;
    }

    // Font size change
    if (oldSettings.display.fontSize !== newSettings.display.fontSize) {
      return true;
    }

    return false;
  }

  /**
   * Refresh page with settings
   */
  private refresh(): void {
    this.applyTheme();
    this.applyFontSize();
    this.applyLanguage();

    // Emit event for components to react to settings changes
    EventBus.emit('settings-changed', this.settings);
  }

  /**
   * Apply theme
   */
  private applyTheme(): void {
    const theme = this.settings.display.theme;
    const isDark = theme === 'dark' ||
                   (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    StorageCenter.set(StorageKey.THEME, theme);
  }

  /**
   * Apply font size
   */
  private applyFontSize(): void {
    const size = this.settings.display.fontSize;
    const root = document.documentElement;

    root.classList.remove('text-sm', 'text-base', 'text-lg');

    switch (size) {
      case 'small':
        root.classList.add('text-sm');
        break;
      case 'large':
        root.classList.add('text-lg');
        break;
      default:
        root.classList.add('text-base');
    }
  }

  /**
   * Apply language
   */
  private applyLanguage(): void {
    const langValue = this.settings.language.appInterface;
    // Use first language if array, or the string value
    const lang = Array.isArray(langValue) && langValue.length > 0 
      ? langValue[0] 
      : (typeof langValue === 'string' ? langValue : 'en');
    document.documentElement.lang = lang;
    StorageCenter.language.setAppLanguage(lang);
  }

  /**
   * Quick access methods
   */
  theme = {
    get: () => this.settings.display.theme,
    set: (theme: 'light' | 'dark' | 'auto') => {
      this.updateSection('display', { theme });
    },
    toggle: () => {
      const current = this.settings.display.theme;
      const next = current === 'light' ? 'dark' : 'light';
      this.updateSection('display', { theme: next });
    }
  };

  language = {
    get: () => {
      const lang = this.settings.language.appInterface;
      // Return first language if array, or the string value
      return Array.isArray(lang) && lang.length > 0 ? lang[0] : (typeof lang === 'string' ? lang : 'en');
    },
    set: (lang: string | string[]) => {
      this.updateSection('language', { appInterface: lang });
    }
  };

  fontSize = {
    get: () => this.settings.display.fontSize,
    set: (size: 'small' | 'medium' | 'large') => {
      this.updateSection('display', { fontSize: size });
    }
  };
}

export const SettingsCenter = new SettingsCenterClass();
