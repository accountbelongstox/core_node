/**
 * WfNewApiDefaults — the FRONTEND BUILT-IN FALLBACKS for the /wordnew app.
 *
 * When a live backend list can't be fetched (offline, mock mode, or the endpoint
 * doesn't exist yet — e.g. there is NO preset-avatar gallery on the backend, only
 * upload + Laravolt auto-generation), the API layer falls back to these so the
 * UI is never empty. Both WfNewApiHttp (on failure) and WfNewApiMock use them.
 *
 * The language list mirrors the backend `/system/supported-languages` shape and
 * uses 2-char codes (AppQyV1LearningController::setUserLanguages requires
 * `size:2`), so a built-in choice is always backend-savable.
 */

import type { WfNewLanguage } from './WfNewApiTypes';

/**
 * Built-in preset avatars (emoji). The wordnew UI renders avatars as text, so the
 * presets are emoji; uploaded image avatars are rendered as <img> separately.
 */
export const WFNEW_BUILTIN_PRESET_AVATARS: string[] = [
  '🦁', '🦊', '🐈', '🐼', '🐰', '🐯', '🦉', '🛸',
  '🚀', '👾', '🪐', '🧠', '👑', '⚡', '🐲', '🦄',
  '🐙', '🦜', '🐧', '🦋',
];

/** Built-in learning-language catalog (2-char codes, backend-aligned). */
export const WFNEW_BUILTIN_LANGUAGES: WfNewLanguage[] = [
  { code: 'en', name: 'English', native_name: 'English' },
  { code: 'zh', name: 'Chinese', native_name: '中文' },
  { code: 'ja', name: 'Japanese', native_name: '日本語' },
  { code: 'ko', name: 'Korean', native_name: '한국어' },
  { code: 'fr', name: 'French', native_name: 'Français' },
  { code: 'de', name: 'German', native_name: 'Deutsch' },
  { code: 'es', name: 'Spanish', native_name: 'Español' },
  { code: 'it', name: 'Italian', native_name: 'Italiano' },
  { code: 'pt', name: 'Portuguese', native_name: 'Português' },
  { code: 'ru', name: 'Russian', native_name: 'Русский' },
  { code: 'ar', name: 'Arabic', native_name: 'العربية' },
  { code: 'hi', name: 'Hindi', native_name: 'हिन्दी' },
  { code: 'vi', name: 'Vietnamese', native_name: 'Tiếng Việt' },
  { code: 'th', name: 'Thai', native_name: 'ไทย' },
  { code: 'id', name: 'Indonesian', native_name: 'Bahasa Indonesia' },
  { code: 'nl', name: 'Dutch', native_name: 'Nederlands' },
  { code: 'pl', name: 'Polish', native_name: 'Polski' },
  { code: 'tr', name: 'Turkish', native_name: 'Türkçe' },
  { code: 'uk', name: 'Ukrainian', native_name: 'Українська' },
  { code: 'el', name: 'Greek', native_name: 'Ελληνικά' },
];

/** True only for a 2-char language code present in the built-in catalog. */
export const WFNEW_BUILTIN_LANGUAGE_CODES: ReadonlySet<string> = new Set(
  WFNEW_BUILTIN_LANGUAGES.map((l) => l.code)
);
