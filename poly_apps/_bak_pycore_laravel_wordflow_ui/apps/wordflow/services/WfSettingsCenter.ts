/* [v4.1-Iris] Wf settings center — ported from qy_capacitor/services/SettingsCenter.ts,
 * re-shaped for the Wf shell: persistence via WordflowStorage (APP_SETTINGS key),
 * change broadcast via wfEventBus('settings-changed'); theme/language application
 * stays with the shell (ShellContext), not here.
 *
 * Server roaming: when a token exists, load() also pulls GET /user/preferences
 * (app_settings blob + daily_goal) and merges it over the local copy, and every
 * update() pushes the merged settings back via PUT /user/preferences. All sync
 * is best-effort — guests and offline sessions keep working from local storage,
 * and a sync failure never throws out of load()/update(). daily_goal is also
 * sent as its own top-level field because the backend's /user/statistics reads
 * it server-side for today_progress/daily_goal. */

import { StorageCenter } from '../../../core/api-libs/wordflow/WordflowStorage';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { wfEventBus } from './WfEventBus';

export interface WfAppSettings {
  display: {
    theme: 'light' | 'dark' | 'auto';
    fontSize: 'small' | 'medium' | 'large';
    fontFamily: string;
    compactMode: boolean;
    showAnimations: boolean;
  };
  audio: {
    autoPlay: boolean;
    playbackSpeed: number;
    volume: number;
    voice: string;
  };
  walkman: {
    durationDelay: number;
    preDelay: number;
    maxPlays: number;
    maxReview: number;
    wordsPerPage: number;
    showTranslation: boolean;
    fontSize: number;
  };
  learning: {
    dailyGoal: number;
    reviewInterval: number;
    difficultyLevel: 'easy' | 'medium' | 'hard';
    showHints: boolean;
  };
  notifications: {
    enabled: boolean;
    dailyReminder: boolean;
    achievementAlerts: boolean;
    soundEnabled: boolean;
  };
  language: {
    nativeLanguage: string;
    autoDetect: boolean;
  };
  sync: {
    autoSync: boolean;
    wifiOnly: boolean;
  };
}

export const WF_DEFAULT_SETTINGS: WfAppSettings = {
  display: {
    theme: 'auto',
    fontSize: 'medium',
    fontFamily: 'system',
    compactMode: false,
    showAnimations: true,
  },
  audio: {
    autoPlay: true,
    playbackSpeed: 1.0,
    volume: 0.8,
    voice: 'default',
  },
  walkman: {
    durationDelay: 0.5,
    preDelay: 0.5,
    maxPlays: 1,
    maxReview: 1,
    wordsPerPage: 100,
    showTranslation: false,
    fontSize: 16,
  },
  learning: {
    dailyGoal: 20,
    reviewInterval: 4,
    difficultyLevel: 'medium',
    showHints: true,
  },
  notifications: {
    enabled: true,
    dailyReminder: true,
    achievementAlerts: true,
    soundEnabled: true,
  },
  language: {
    nativeLanguage: 'zh',
    autoDetect: false,
  },
  sync: {
    autoSync: true,
    wifiOnly: true,
  },
};

type WfSettingsPatch = Partial<{ [K in keyof WfAppSettings]: Partial<WfAppSettings[K]> }>;
type WfSettingsListener = (s: WfAppSettings) => void;

/** Section-wise deep clone of a settings object. */
function cloneSettings(s: WfAppSettings): WfAppSettings {
  return {
    display: { ...s.display },
    audio: { ...s.audio },
    walkman: { ...s.walkman },
    learning: { ...s.learning },
    notifications: { ...s.notifications },
    language: { ...s.language },
    sync: { ...s.sync },
  };
}

/** Deep-merge a (possibly partial / malformed) stored value over the defaults. */
function mergeWithDefaults(stored: any): WfAppSettings {
  const merged = cloneSettings(WF_DEFAULT_SETTINGS);
  if (stored && typeof stored === 'object') {
    (Object.keys(merged) as Array<keyof WfAppSettings>).forEach((section) => {
      const value = stored[section];
      if (value && typeof value === 'object') {
        merged[section] = { ...merged[section], ...value } as any;
      }
    });
  }
  return merged;
}

class WfSettingsCenterClass {
  private settings: WfAppSettings = cloneSettings(WF_DEFAULT_SETTINGS);
  private loaded = false;
  private loadPromise: Promise<WfAppSettings> | null = null;
  private listeners: Set<WfSettingsListener> = new Set();

  /**
   * Load settings from storage, deep-merged over the defaults. Idempotent;
   * concurrent calls share one storage read.
   */
  load(): Promise<WfAppSettings> {
    if (this.loaded) return Promise.resolve(this.getSnapshot());
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const stored = await StorageCenter.settings.get();
        this.settings = mergeWithDefaults(stored);
      } catch (error: any) {
        // Corrupt entry must not throw out of load(): keep the defaults.
        console.warn('[WfSettingsCenter] Load failed (handled, using defaults):', error?.message || error);
        this.settings = cloneSettings(WF_DEFAULT_SETTINGS);
      }

      // Server roaming: merge the account's stored app_settings over the local
      // copy (server wins — it is the cross-device source). Best-effort.
      try {
        const token = await StorageCenter.auth.getToken();
        if (token) {
          const prefs = await wordflowApi.request<any>('/user/preferences');
          if (prefs?.app_settings && typeof prefs.app_settings === 'object') {
            this.settings = mergeWithDefaults({ ...this.settings, ...prefs.app_settings });
            await this.save();
          } else if (typeof prefs?.daily_goal === 'number' && prefs.daily_goal > 0) {
            // Account has a goal but no settings blob yet (set via another
            // client): honor at least the goal.
            this.settings.learning.dailyGoal = prefs.daily_goal;
            await this.save();
          }
        }
      } catch (error: any) {
        console.warn('[WfSettingsCenter] Server preferences pull skipped:', error?.message || error);
      }

      this.loaded = true;
      this.loadPromise = null;
      return this.getSnapshot();
    })();

    return this.loadPromise;
  }

  /**
   * Synchronous snapshot of the current settings (defaults before load()).
   */
  getSnapshot(): WfAppSettings {
    return cloneSettings(this.settings);
  }

  /**
   * Deep-merge a partial patch (per section), persist, notify subscribers and
   * emit 'settings-changed' on the wfEventBus.
   */
  async update(patch: WfSettingsPatch): Promise<WfAppSettings> {
    await this.load();

    (Object.keys(patch) as Array<keyof WfAppSettings>).forEach((section) => {
      const value = patch[section];
      if (value && typeof value === 'object' && section in this.settings) {
        this.settings[section] = { ...this.settings[section], ...value } as any;
      }
    });

    await this.save();
    this.notify();
    this.pushToServer();
    return this.getSnapshot();
  }

  /**
   * Best-effort fire-and-forget push of the current settings to the account
   * (PUT /user/preferences). daily_goal rides along as a top-level field so
   * the backend's /user/statistics can report against the user's real target.
   */
  private pushToServer(): void {
    void (async () => {
      try {
        const token = await StorageCenter.auth.getToken();
        if (!token) return;
        await wordflowApi.request('/user/preferences', {
          method: 'PUT',
          body: JSON.stringify({
            daily_goal: this.settings.learning.dailyGoal,
            app_settings: this.settings,
          }),
        });
      } catch (error: any) {
        console.warn('[WfSettingsCenter] Server preferences push skipped:', error?.message || error);
      }
    })();
  }

  /**
   * Subscribe to settings changes. Returns an unsubscribe function.
   */
  subscribe(cb: (s: WfAppSettings) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /**
   * Reset to defaults, persist and broadcast.
   */
  async reset(): Promise<WfAppSettings> {
    this.settings = cloneSettings(WF_DEFAULT_SETTINGS);
    this.loaded = true;
    await this.save();
    this.notify();
    this.pushToServer();
    return this.getSnapshot();
  }

  private async save(): Promise<void> {
    await StorageCenter.settings.set(this.settings);
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (error) {
        console.error('[WfSettingsCenter] Error in subscriber:', error);
      }
    });
    wfEventBus.emit('settings-changed', snapshot);
  }
}

export const wfSettingsCenter = new WfSettingsCenterClass();
