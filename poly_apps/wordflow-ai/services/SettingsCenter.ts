/**
 * Settings Center - Unified Settings Management
 * Manages app settings with auto-save and reactive updates
 */

import { StorageCenter, StorageKey } from './StorageCenter';
import { StateManager, GlobalState } from './StateManager';

export interface DisplaySettings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: string;
  compactMode: boolean;
  showAnimations: boolean;
}

export interface LanguageSettings {
  appInterface: string;
  learningLanguage: string;
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

    // Language change
    if (oldSettings.language.appInterface !== newSettings.language.appInterface) {
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

    // Force re-render by dispatching custom event
    window.dispatchEvent(new CustomEvent('settings-changed', {
      detail: this.settings
    }));
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
    const lang = this.settings.language.appInterface;
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
    get: () => this.settings.language.appInterface,
    set: (lang: string) => {
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
