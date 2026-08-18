/**
 * Shared learning-language catalog for every UI end.
 *
 * Frontend fallback aligned with the shared backend supported-language contract.
 * Every application receives the same language codes and display fields.
 *
 * NOTE: the live backend returns its FULL Edge-TTS catalog (~85 languages); this
 * is a curated subset of the most-studied languages, enough to build/iterate the
 * register UI offline. Every entry below matches a real backend entry — when you
 * add one, copy code/name/native_name/voice_id/icon from
 * the backend catalog so offline and live behavior do not drift.
 */

export interface SupportedLearningLanguage {
  code: string;
  name: string;
  native_name: string;
  voice_id?: string;
  icon?: string;
  has_tts?: boolean;
}

/** Curated, backend-aligned learning-language list (mirror of /system/supported-languages rows). */
export const SUPPORTED_LEARNING_LANGUAGES: SupportedLearningLanguage[] = [
  { code: 'en', name: 'English', native_name: 'English', voice_id: 'en-US-JennyNeural', icon: 'flag-us', has_tts: true },
  { code: 'zh', name: 'Chinese', native_name: '中文', voice_id: 'zh-CN-XiaoxiaoNeural', icon: 'flag-cn', has_tts: true },
  { code: 'ja', name: 'Japanese', native_name: '日本語', voice_id: 'ja-JP-NanamiNeural', icon: 'flag-jp', has_tts: true },
  { code: 'ko', name: 'Korean', native_name: '한국어', voice_id: 'ko-KR-SunHiNeural', icon: 'flag-kr', has_tts: true },
  { code: 'fr', name: 'French', native_name: 'Français', voice_id: 'fr-FR-DeniseNeural', icon: 'flag-fr', has_tts: true },
  { code: 'de', name: 'German', native_name: 'Deutsch', voice_id: 'de-DE-KatjaNeural', icon: 'flag-de', has_tts: true },
  { code: 'es', name: 'Spanish', native_name: 'Español', voice_id: 'es-ES-ElviraNeural', icon: 'flag-es', has_tts: true },
  { code: 'it', name: 'Italian', native_name: 'Italiano', voice_id: 'it-IT-ElsaNeural', icon: 'flag-it', has_tts: true },
  { code: 'pt', name: 'Portuguese', native_name: 'Português', voice_id: 'pt-BR-FranciscaNeural', icon: 'flag-pt', has_tts: true },
  { code: 'ru', name: 'Russian', native_name: 'Русский', voice_id: 'ru-RU-SvetlanaNeural', icon: 'flag-ru', has_tts: true },
  { code: 'ar', name: 'Arabic', native_name: 'العربية', voice_id: 'ar-EG-SalmaNeural', icon: 'flag-sa', has_tts: true },
  { code: 'hi', name: 'Hindi', native_name: 'हिन्दी', voice_id: 'hi-IN-SwaraNeural', icon: 'flag-in', has_tts: true },
  { code: 'vi', name: 'Vietnamese', native_name: 'Tiếng Việt', voice_id: 'vi-VN-HoaiMyNeural', icon: 'flag-vn', has_tts: true },
  { code: 'th', name: 'Thai', native_name: 'ไทย', voice_id: 'th-TH-PremwadeeNeural', icon: 'flag-th', has_tts: true },
  { code: 'id', name: 'Indonesian', native_name: 'Bahasa Indonesia', voice_id: 'id-ID-GadisNeural', icon: 'flag-id', has_tts: true },
  { code: 'ms', name: 'Malay', native_name: 'Bahasa Melayu', voice_id: 'ms-MY-YasminNeural', icon: 'flag-my', has_tts: true },
  { code: 'nl', name: 'Dutch', native_name: 'Nederlands', voice_id: 'nl-NL-ColetteNeural', icon: 'flag-nl', has_tts: true },
  { code: 'pl', name: 'Polish', native_name: 'Polski', voice_id: 'pl-PL-ZofiaNeural', icon: 'flag-pl', has_tts: true },
  { code: 'tr', name: 'Turkish', native_name: 'Türkçe', voice_id: 'tr-TR-EmelNeural', icon: 'flag-tr', has_tts: true },
  { code: 'sv', name: 'Swedish', native_name: 'Svenska', voice_id: 'sv-SE-HilleviNeural', icon: 'flag-se', has_tts: true },
  { code: 'uk', name: 'Ukrainian', native_name: 'Українська', voice_id: 'uk-UA-PolinaNeural', icon: 'flag-ua', has_tts: true },
  { code: 'fa', name: 'Persian', native_name: 'فارسی', voice_id: 'fa-IR-DilaraNeural', icon: 'flag-ir', has_tts: true },
  { code: 'el', name: 'Greek', native_name: 'Ελληνικά', voice_id: 'el-GR-AthinaNeural', icon: 'flag-gr', has_tts: true },
  { code: 'he', name: 'Hebrew', native_name: 'עברית', voice_id: 'he-IL-HilaNeural', icon: 'flag-il', has_tts: true },
  { code: 'cs', name: 'Czech', native_name: 'Čeština', voice_id: 'cs-CZ-VlastaNeural', icon: 'flag-cz', has_tts: true },
  { code: 'da', name: 'Danish', native_name: 'Dansk', voice_id: 'da-DK-ChristelNeural', icon: 'flag-dk', has_tts: true },
  { code: 'fi', name: 'Finnish', native_name: 'Suomi', voice_id: 'fi-FI-NooraNeural', icon: 'flag-fi', has_tts: true },
  { code: 'lo', name: 'Lao', native_name: 'ລາວ', voice_id: 'lo-LA-KeomanyNeural', icon: 'flag-la', has_tts: true },
];

/** Fast lookup set of valid codes (used to validate a learning-language selection). */
export const SUPPORTED_LEARNING_LANGUAGE_CODES: ReadonlySet<string> = new Set(
  SUPPORTED_LEARNING_LANGUAGES.map((l) => l.code)
);

/** Keep only codes the catalog recognizes (order preserved, dupes dropped). */
export function filterSupportedLanguageCodes(codes: unknown): string[] {
  if (!Array.isArray(codes)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of codes) {
    if (typeof c === 'string' && SUPPORTED_LEARNING_LANGUAGE_CODES.has(c) && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}
