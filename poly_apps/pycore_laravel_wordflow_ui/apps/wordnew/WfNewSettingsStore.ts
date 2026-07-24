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
  /** Stable cache-scope identity for the logged-in user (id ?? username ?? email).
   *  Always present for a logged-in user; '' when logged out. Used to namespace the
   *  local content cache so logout clears the SAME scope login wrote. */
  userId: string;
  authNativeLang: string;
  authTargetLang: string;
  bio: string;
  isLoggedIn: boolean;
  /** The post-login welcome/onboarding wizard has been completed once. */
  onboardingDone: boolean;
  // ---- UI / theme ----
  themeId: string;
  disableBgBreathing: boolean;
  // ---- learning settings ----
  dailyGoal: number;
  speechRate: number;
  voiceAccent: string;
  settingNativeLang: string;
  settingTargetLang: string;
  /** Multi-select learning targets (backend learning_languages). settingTargetLang stays as the primary for legacy reads. */
  settingTargetLangs: string[];
  bilingualRatio: string;
  recitalOrder: string;
  autoSpeech: boolean;
  hapticFeedback: boolean;
  reviewAlgorithm: string;
  contentFields: string[];
  // ---- learning model (word memorization) ----
  /** Memorization mode: 'walkman' (audio loop) or 'cards' (flashcards). Default walkman. */
  memorizeMode: 'walkman' | 'cards';
  /** Times each word audio plays in a pass. */
  wmPlayCount: number;
  /** Times a word is replayed (a later second pass). */
  wmReplayCount: number;
  /** Read the word itself aloud. */
  wmReadWord: boolean;
  /** Read the definition/explanation aloud (default off). */
  wmReadExplanation: boolean;
  /** Playback speed multiplier (default 0.8). */
  wmPlaybackSpeed: number;
  /** Seconds of silence between words (default 0). */
  wmPlayInterval: number;
  /** After a word plays, how many words later it is replayed (default 1 = the
   *  回跳/glimpse jump-back is active). */
  wmReplayGapWords: number;
  /** Replay speed multiplier (default 0.8). */
  wmReplaySpeed: number;
  /** Seconds of silence before a replay (default 0). */
  wmReplayInterval: number;
  /** Practice-pack paged loader window: words fetched per page (clamp 1..100,
   *  default 100). Mirrors the legacy dict-client per_words buffer size. */
  wmPerPage: number;
  /** Chosen SpeechSynthesisVoice.voiceURI for the recite speech fallback;
   *  '' = auto (accent-matched). */
  wmVoiceUri: string;
  /** Larger word font on the practice surface (default off). */
  wmLargeFont: boolean;
  // ---- review settings ----
  /** Max review cards per day. */
  reviewDailyLimit: number;
  /** Review ordering: 'due_first' | 'random' | 'hardest_first'. */
  reviewOrder: string;
  /** Mix newly-learned words into the review queue. */
  reviewIncludeNew: boolean;
  // ---- subtitle playback settings ----
  /** Subtitle player playback speed multiplier (default 1.0). */
  subtitlePlaybackSpeed: number;
  /** Loop the current subtitle line instead of advancing (default false). */
  subtitleLoopLine: boolean;
  /** Show the native/translation line under the subtitle (default true). */
  subtitleShowTranslation: boolean;
  /** Auto-advance to the next segment when one finishes (default true). */
  subtitleAutoNext: boolean;
  /** Language filter for the word-stats sidebar (default 'english'). */
  wordListLanguage: string;
  /** Words per page in the word-stats sidebar (default 30). */
  wordListPageSize: number;
  // ---- book reader settings (persisted GLOBALLY; restored on next open) ----
  /** Reader language mode: bilingual/对照 (several stacked langs per verse) vs
   *  single/单语. Default false (single). */
  readerSimul: boolean;
  /** Preferred reader languages (e.g. ['en','zh']) — intersected with each book's
   *  actually-available languages on open; empty falls back to the book's primary. */
  readerLangs: string[];
  /** Reader text layout: interleaved (one lang per line) vs stacked blocks. */
  readerDisplayMode: 'stacked' | 'interleaved';
  /** Bilingual playback sequence: ordered steps with per-step repeat count. */
  readerPlaySequence: Array<{ lang: string; repeat: number }>;
  /** Per-language playback speed (lang code → multiplier). */
  readerSpeedByLang: Record<string, number>;
  /** Auto-advance to next verse after the full sequence finishes. */
  readerAutoAdvance: boolean;
  /** Repeat the current verse sequence instead of advancing. */
  readerRepeatOne: boolean;
  /** Resume playback automatically when reopening a book at saved position. */
  readerAutoPlayOnOpen: boolean;
  /** When backend audio is missing, use browser speech (Edge Read Aloud / speechSynthesis). */
  readerBrowserTts: boolean;
  /** Per-language preferred sentence audio variant_key (book reader accent picker). */
  readerVariantByLang: Record<string, string>;
  /** Word cards (显示单词卡片): read not-yet-recited Default Vocabulary Group
   *  words found in each sentence aloud around the sentence audio.
   *  ENGLISH ONLY — tokens are matched against English group words. */
  readerWordCards: boolean;
  /** Where the word-card words are read relative to the sentence audio. */
  readerWordCardPosition: 'before' | 'after';
  /** Number of times each new sentence word is played. */
  readerWordRepeats: number;
  readerWordMode: 'new' | 'all';
  /** ISO8601 stamp for last reader-settings cloud sync (merge guard). */
  readerSettingsUpdatedAt: string | null;
  // ---- user data ----
  favorites: Word[];
  streakDays: number;
}

const makeDefaults = (): WfNewSettings => ({
  nickname: 'WordFlow Commander',
  avatar: '🦊',
  email: 'commander@wordflow.universe',
  userId: '',
  authNativeLang: 'zh',
  authTargetLang: 'en',
  bio: 'Expanding my cognitive neural horizon in WordFlow.',
  isLoggedIn: false,
  onboardingDone: false,
  themeId: 'cosmic',
  disableBgBreathing: false,
  dailyGoal: 20,
  speechRate: 1.0,
  voiceAccent: 'en-US',
  settingNativeLang: 'zh',
  settingTargetLang: 'en',
  settingTargetLangs: ['en'],
  bilingualRatio: '1en_1zh',
  recitalOrder: 'target_first',
  autoSpeech: true,
  hapticFeedback: false,
  reviewAlgorithm: 'ebbinghaus',
  contentFields: ['tech', 'literature'],
  // learning model (word memorization)
  memorizeMode: 'walkman',
  wmPlayCount: 1,
  wmReplayCount: 1,
  wmReadWord: true,
  wmReadExplanation: false,
  wmPlaybackSpeed: 0.8,
  wmPlayInterval: 0,
  wmReplayGapWords: 1,
  wmReplaySpeed: 0.8,
  wmReplayInterval: 0,
  wmPerPage: 100,
  wmVoiceUri: '',
  wmLargeFont: false,
  // review settings
  reviewDailyLimit: 50,
  reviewOrder: 'due_first',
  reviewIncludeNew: false,
  // subtitle playback settings
  subtitlePlaybackSpeed: 1.0,
  subtitleLoopLine: false,
  subtitleShowTranslation: true,
  subtitleAutoNext: true,
  wordListLanguage: 'english',
  wordListPageSize: 30,
  // book reader settings
  readerSimul: false,
  readerLangs: ['en', 'zh'],
  readerDisplayMode: 'interleaved',
  readerPlaySequence: [
    { lang: 'en', repeat: 1 },
    { lang: 'zh', repeat: 1 },
    { lang: 'en', repeat: 3 },
  ],
  readerSpeedByLang: { en: 1, zh: 1 },
  readerAutoAdvance: true,
  readerRepeatOne: false,
  readerAutoPlayOnOpen: false,
  readerBrowserTts: true,
  readerVariantByLang: {},
  readerWordCards: false,
  readerWordCardPosition: 'before',
  readerWordRepeats: 1,
  readerWordMode: 'new',
  readerSettingsUpdatedAt: null,
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
