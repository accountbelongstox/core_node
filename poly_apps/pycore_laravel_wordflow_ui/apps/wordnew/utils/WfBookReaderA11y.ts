/**
 * Edge Read Aloud / HTML-AAM helpers for the book reader.
 * Exposes readable text in semantic blocks with correct `lang` tags so Edge
 * (and other assistive tech) can extract the right language content.
 */
import type { WfNewReaderPlayStep } from '../api/types/bookProgress';

const LANG_BCP47: Record<string, string> = {
  en: 'en-US',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-tw': 'zh-TW',
  ja: 'ja-JP',
  ko: 'ko-KR',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-BR',
  ru: 'ru-RU',
  ar: 'ar-SA',
  hi: 'hi-IN',
  it: 'it-IT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  tr: 'tr-TR',
  vi: 'vi-VN',
  th: 'th-TH',
  id: 'id-ID',
};

export function langCodeToBcp47(code: string): string {
  const lower = (code || '').toLowerCase().trim();
  if (!lower) return 'en-US';
  if (lower.includes('-')) return lower;
  return LANG_BCP47[lower] || `${lower}-${lower.toUpperCase()}`;
}

/** Order visible language lines to match the UI play sequence (multi-order read). */
export function orderLangsForReadAloud(
  visibleLangs: string[],
  sequence: WfNewReaderPlayStep[],
): string[] {
  const seqLangs = sequence.map((s) => s.lang).filter((l) => visibleLangs.includes(l));
  const rest = visibleLangs.filter((l) => !seqLangs.includes(l));
  return [...new Set([...seqLangs, ...rest])];
}

export function isEdgeBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /\bEdg\//i.test(navigator.userAgent);
}

export function isBrowserReadAloudAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
