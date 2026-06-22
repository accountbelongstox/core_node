/* [v4.1-Iris] Wf languages center — supported-languages (backend dictionary
 * surface) for the Wf shell, ported from qy_capacitor/services/LanguagesCenter.ts.
 * NOT the i18n module: UI translation dictionaries live in ../WfLanguageCenter.
 * Data comes from wordflowApi.getSupportedLanguages() (which owns the 24h TTL
 * cache in WordflowStorage); this layer adds response normalization, a
 * built-in offline fallback so the list is never empty, an in-memory snapshot
 * with getByCode/getLanguageName conveniences and a force-refresh. */

import { wordflowApi } from '../api-libs/wordflow/WordflowApi';
import { StorageCenter, StorageKey } from '../api-libs/wordflow/WordflowStorage';

export interface WfSupportedLanguageInfo {
  code: string;
  name: string;
  native_name?: string;
  voice_id?: string;
  has_tts?: boolean;
  flag?: string;
}

/**
 * Built-in offline fallback (mirrors qy's DEFAULT_SUPPORTED_LANGUAGES). The
 * app must stay usable when the backend is unreachable and no 24h cache
 * exists, so the supported-languages list is never empty.
 */
const WF_DEFAULT_SUPPORTED_LANGUAGES: WfSupportedLanguageInfo[] = [
  { code: 'en', name: 'English', native_name: 'English', voice_id: 'en-US-JennyNeural', has_tts: true, flag: '🇺🇸' },
  { code: 'zh', name: 'Chinese', native_name: '中文', voice_id: 'zh-CN-XiaoxiaoNeural', has_tts: true, flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', native_name: '日本語', voice_id: 'ja-JP-NanamiNeural', has_tts: true, flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', native_name: '한국어', voice_id: 'ko-KR-SunHiNeural', has_tts: true, flag: '🇰🇷' },
  { code: 'es', name: 'Spanish', native_name: 'Español', voice_id: 'es-ES-ElviraNeural', has_tts: true, flag: '🇪🇸' },
  { code: 'fr', name: 'French', native_name: 'Français', voice_id: 'fr-FR-DeniseNeural', has_tts: true, flag: '🇫🇷' },
  { code: 'de', name: 'German', native_name: 'Deutsch', voice_id: 'de-DE-KatjaNeural', has_tts: true, flag: '🇩🇪' },
  { code: 'ru', name: 'Russian', native_name: 'Русский', voice_id: 'ru-RU-SvetlanaNeural', has_tts: true, flag: '🇷🇺' },
  { code: 'ar', name: 'Arabic', native_name: 'العربية', voice_id: 'ar-EG-SalmaNeural', has_tts: true, flag: '🇸🇦' },
  { code: 'pt', name: 'Portuguese', native_name: 'Português', voice_id: 'pt-BR-FranciscaNeural', has_tts: true, flag: '🇧🇷' },
];

/** Normalize whatever shape the backend returns into WfSupportedLanguageInfo[]. */
function normalizeLanguages(raw: any): WfSupportedLanguageInfo[] {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.languages) ? raw.languages : [];
  return list
    .map((l: any) => ({
      code: String(l.code || l.language_code || l.lang_code || ''),
      name: String(l.name || l.english_name || l.code || ''),
      native_name: l.native_name || l.nativeName || undefined,
      voice_id: l.voice_id || undefined,
      has_tts: typeof l.has_tts === 'boolean' ? l.has_tts : undefined,
      flag: l.flag || l.icon || undefined,
    }))
    .filter((l: WfSupportedLanguageInfo) => !!l.code);
}

class WfLanguagesCenterClass {
  // Seeded with the built-in fallback so the list is never empty offline.
  private languages: WfSupportedLanguageInfo[] = [...WF_DEFAULT_SUPPORTED_LANGUAGES];
  private loaded = false;
  private loadPromise: Promise<WfSupportedLanguageInfo[]> | null = null;

  /**
   * Load the supported languages (24h TTL cache owned by wordflowApi).
   * Idempotent; concurrent calls share one request. Falls back to the
   * built-in list on failure — never throws, never returns empty.
   */
  load(): Promise<WfSupportedLanguageInfo[]> {
    if (this.loaded) return Promise.resolve(this.getAll());
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const raw = await wordflowApi.getSupportedLanguages();
        const normalized = normalizeLanguages(raw);
        if (normalized.length > 0) {
          this.languages = normalized;
        }
        this.loaded = true;
      } catch (error: any) {
        // Public API failure is non-critical (offline / backend down). Keep
        // the built-in fallback list; retry on the next load() call.
        console.warn('[WfLanguagesCenter] Fetch failed (non-critical, using fallback):', error?.message || error);
      } finally {
        this.loadPromise = null;
      }
      return this.getAll();
    })();

    return this.loadPromise;
  }

  /**
   * Force refresh: drop the 24h cache + the in-memory snapshot and re-fetch.
   */
  async refresh(): Promise<WfSupportedLanguageInfo[]> {
    await StorageCenter.cache.invalidate(StorageKey.SUPPORTED_LANGUAGES_CACHE);
    this.loaded = false;
    this.loadPromise = null;
    return this.load();
  }

  /** Synchronous snapshot (the built-in fallback before load() resolves). */
  getAll(): WfSupportedLanguageInfo[] {
    return [...this.languages];
  }

  /** Language by code from the current snapshot. */
  getByCode(code: string): WfSupportedLanguageInfo | undefined {
    return this.languages.find((lang) => lang.code === code);
  }

  /** Language by code, loading first when needed. */
  async resolveByCode(code: string): Promise<WfSupportedLanguageInfo | undefined> {
    await this.load();
    return this.getByCode(code);
  }

  /** Whether a code is in the current snapshot. */
  isSupported(code: string): boolean {
    return this.languages.some((lang) => lang.code === code);
  }

  /** Display name for a code (native-name preferred on request), code upper-cased as last resort. */
  getLanguageName(code: string, preferNative: boolean = false): string {
    const lang = this.getByCode(code);
    if (!lang) return code.toUpperCase();
    return preferNative && lang.native_name ? lang.native_name : lang.name;
  }
}

export const wfLanguagesCenter = new WfLanguagesCenterClass();
