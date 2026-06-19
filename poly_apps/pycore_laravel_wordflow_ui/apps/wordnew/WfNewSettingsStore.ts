/**
 * WfNewSettingsStore — all /wordnew app settings + profile in ONE persisted,
 * reactive store. A sibling of WfNewEndpointStore: both subclass the shared
 * `PersistedStore` (core/persistence), so settings live under one localStorage
 * key (no scattered raw `localStorage.getItem/setItem` across components) and
 * components stay in sync via `subscribe` instead of the old hand-rolled
 * `window 'storage'` event + 1s polling.
 *
 * Replaces the previously scattered raw keys: wf_new_theme_id, wf_new_nickname,
 * wf_new_avatar, wf_auth_*, wf_setting_*, wf_new_daily_goal, wf_new_speech_rate,
 * wf_new_favorites, wf_streak_days. `migrateLegacyKeys()` folds any existing
 * values in once, then deletes the old raw keys.
 */
import { PersistedStore, StorageManager, StorageKeys } from '../../core/persistence';
import type { Word } from './api';

export interface WfNewSettings {
  // ---- profile / auth ----
  nickname: string;
  avatar: string;
  email: string;
  authNativeLang: string;
  authTargetLang: string;
  bio: string;
  isLoggedIn: boolean;
  // ---- UI / theme ----
  themeId: string;
  disableBgBreathing: boolean;
  // ---- learning settings ----
  dailyGoal: number;
  speechRate: number;
  voiceAccent: string;
  settingNativeLang: string;
  settingTargetLang: string;
  bilingualRatio: string;
  recitalOrder: string;
  autoSpeech: boolean;
  hapticFeedback: boolean;
  reviewAlgorithm: string;
  contentFields: string[];
  // ---- user data ----
  favorites: Word[];
  streakDays: number;
}

const makeDefaults = (): WfNewSettings => ({
  nickname: 'WordFlow Commander',
  avatar: '🦊',
  email: 'commander@wordflow.universe',
  authNativeLang: 'zh',
  authTargetLang: 'en',
  bio: 'Expanding my cognitive neural horizon in WordFlow.',
  isLoggedIn: false,
  themeId: 'cosmic',
  disableBgBreathing: false,
  dailyGoal: 20,
  speechRate: 1.0,
  voiceAccent: 'en-US',
  settingNativeLang: 'zh',
  settingTargetLang: 'en',
  bilingualRatio: '1en_1zh',
  recitalOrder: 'target_first',
  autoSpeech: true,
  hapticFeedback: false,
  reviewAlgorithm: 'ebbinghaus',
  contentFields: ['tech', 'literature'],
  favorites: [],
  streakDays: 8,
});

class WfNewSettingsStore extends PersistedStore<WfNewSettings> {
  constructor() {
    super(StorageKeys.WORDNEW_SETTINGS, makeDefaults);
    this.migrateLegacyKeys();
  }

  /** Typed single-field setter (persists + notifies via the base). */
  setField<K extends keyof WfNewSettings>(key: K, value: WfNewSettings[K]): void {
    this.patch({ [key]: value } as Partial<WfNewSettings>);
  }

  /** Add/remove a word in favorites; returns true if it is now favorited. */
  toggleFavorite(word: Word): boolean {
    const favorites = this.get('favorites');
    const exists = favorites.some((f) => f.id === word.id);
    this.patch({ favorites: exists ? favorites.filter((f) => f.id !== word.id) : [...favorites, word] });
    return !exists;
  }

  /** Reset the profile + local learning data to defaults (Settings → Clear cache). */
  clearProfileCache(): void {
    const d = makeDefaults();
    this.patch({
      nickname: d.nickname,
      avatar: d.avatar,
      speechRate: d.speechRate,
      dailyGoal: d.dailyGoal,
      favorites: d.favorites,
    });
  }

  // ---- one-time migration from the legacy scattered raw localStorage keys ----

  private migrateLegacyKeys(): void {
    if (StorageManager.has(StorageKeys.WORDNEW_SETTINGS)) return;
    if (typeof window === 'undefined' || !window.localStorage) return;
    const ls = window.localStorage;
    const get = (k: string) => ls.getItem(k);

    const patch: Partial<WfNewSettings> = {};
    // strings
    const str: Array<[string, keyof WfNewSettings]> = [
      ['wf_new_nickname', 'nickname'],
      ['wf_new_avatar', 'avatar'],
      ['wf_auth_email', 'email'],
      ['wf_auth_native_lang', 'authNativeLang'],
      ['wf_auth_target_lang', 'authTargetLang'],
      ['wf_auth_bio', 'bio'],
      ['wf_new_theme_id', 'themeId'],
      ['wf_setting_accent', 'voiceAccent'],
      ['wf_setting_native_lang', 'settingNativeLang'],
      ['wf_setting_target_lang', 'settingTargetLang'],
      ['wf_setting_bilingual_ratio', 'bilingualRatio'],
      ['wf_setting_recital_order', 'recitalOrder'],
      ['wf_setting_algorithm', 'reviewAlgorithm'],
    ];
    for (const [key, field] of str) {
      const v = get(key);
      if (v !== null) (patch as Record<string, unknown>)[field] = v;
    }
    // booleans (exact legacy truthiness)
    if (get('wf_auth_is_logged_in') !== null) patch.isLoggedIn = get('wf_auth_is_logged_in') === 'true';
    if (get('wf_setting_disable_bg_breathing') !== null) patch.disableBgBreathing = get('wf_setting_disable_bg_breathing') === 'true';
    if (get('wf_setting_autospeech') !== null) patch.autoSpeech = get('wf_setting_autospeech') !== 'false';
    if (get('wf_setting_haptic') !== null) patch.hapticFeedback = get('wf_setting_haptic') === 'true';
    // numbers
    if (get('wf_new_daily_goal') !== null) patch.dailyGoal = parseInt(get('wf_new_daily_goal') as string, 10) || 20;
    if (get('wf_new_speech_rate') !== null) patch.speechRate = parseFloat(get('wf_new_speech_rate') as string) || 1.0;
    if (get('wf_streak_days') !== null) patch.streakDays = parseInt(get('wf_streak_days') as string, 10) || 8;
    // JSON arrays
    try { const f = get('wf_setting_fields'); if (f) patch.contentFields = JSON.parse(f); } catch { /* keep default */ }
    try { const fav = get('wf_new_favorites'); if (fav) patch.favorites = JSON.parse(fav); } catch { /* keep default */ }

    if (Object.keys(patch).length > 0) this.patch(patch);

    for (const k of [
      'wf_new_nickname', 'wf_new_avatar', 'wf_auth_email', 'wf_auth_native_lang',
      'wf_auth_target_lang', 'wf_auth_bio', 'wf_auth_is_logged_in', 'wf_new_theme_id',
      'wf_setting_accent', 'wf_setting_disable_bg_breathing', 'wf_setting_native_lang',
      'wf_setting_target_lang', 'wf_setting_bilingual_ratio', 'wf_setting_recital_order',
      'wf_setting_autospeech', 'wf_setting_haptic', 'wf_setting_algorithm', 'wf_setting_fields',
      'wf_new_daily_goal', 'wf_new_speech_rate', 'wf_new_favorites', 'wf_streak_days',
    ]) {
      ls.removeItem(k);
    }
  }
}

/** Global singleton — the one persisted settings store for /wordnew. */
export const wfNewSettings = new WfNewSettingsStore();
