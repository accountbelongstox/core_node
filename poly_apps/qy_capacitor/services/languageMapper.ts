/**
 * Language code mapper for API calls
 * Maps frontend language codes (ISO 639-1) to backend language names
 */

const LANGUAGE_CODE_MAP: Record<string, string> = {
  'en': 'english',
  'zh': 'chinese',
  'ja': 'japanese',
  'ko': 'korean',
  'es': 'spanish',
  'fr': 'french',
  'de': 'german',
  'ru': 'russian',
  'ar': 'arabic',
  'pt': 'portuguese',
  'vi': 'vietnamese',
  'lo': 'lao',
};

/**
 * Map a single language code to backend format
 * @param langCode ISO 639-1 language code (e.g., 'en', 'zh')
 * @returns Backend language name (e.g., 'english', 'chinese')
 */
export function mapLanguageCode(langCode: string): string {
  return LANGUAGE_CODE_MAP[langCode] || langCode;
}

/**
 * Map multiple language codes to backend format
 * @param langCodes Array of ISO 639-1 language codes
 * @returns Array of backend language names
 */
export function mapLanguageCodes(langCodes: string[]): string[] {
  return langCodes.map(mapLanguageCode);
}

/**
 * Reverse map: backend language name to frontend code
 * @param languageName Backend language name (e.g., 'english')
 * @returns ISO 639-1 language code (e.g., 'en')
 */
export function reverseMapLanguage(languageName: string): string {
  const entry = Object.entries(LANGUAGE_CODE_MAP).find(([_, name]) => name === languageName);
  return entry ? entry[0] : languageName;
}
