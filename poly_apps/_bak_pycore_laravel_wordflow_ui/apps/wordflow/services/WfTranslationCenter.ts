/* [v4.1-Iris] Wf translation center — word lookup/translation for the Wf shell
 * (qy_capacitor's VocabularyTranslationCenter idea reduced to the shell's
 * lookup surface). Wraps wordflowApi's public GET /lookup dictionary endpoint
 * (and getWordDetail) and adds a ~30-min localStorage cache keyed by
 * word+language, persisted as one dictionary map under
 * StorageKey.DICTIONARY_CACHE (wf_dictionary_cache). Hits only are cached —
 * a miss/offline result must stay re-queryable. Errors propagate so pages keep
 * their own try/catch empty states. */

import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { StorageCenter, StorageKey } from '../../../core/api-libs/wordflow/WordflowStorage';
import type { Word } from '../../../core/api-libs/wordflow/wordflowTypes';

/** Per-entry cache lifetime (~30 minutes). */
const ENTRY_TTL_MS = 30 * 60 * 1000;

interface WfTranslationCacheEntry {
  value: any;
  at: number;
}

type WfTranslationCacheMap = Record<string, WfTranslationCacheEntry>;

/**
 * Normalize the /lookup response into the page-facing Word list. Live-verified
 * unwrapped shape: { success, word, language, data: { content, us_phonetic,
 * uk_phonetic, phonetic, translations, image_files, has_translation, audio? } }
 * — a miss is HTTP 404 (thrown). Array / { words } / flat-word shapes from
 * other backends are tolerated.
 */
function normalizeLookupResponse(response: any, searchQuery: string): Word[] {
  const detail = response?.data && typeof response.data === 'object' ? response.data : null;
  const translations = detail?.translations;
  const firstTranslation =
    typeof translations === 'string'
      ? translations
      : translations && typeof translations === 'object'
        ? String(Object.values(translations).find((v) => typeof v === 'string' && v) ?? '')
        : '';
  return Array.isArray(response)
    ? response
    : Array.isArray(response?.words)
      ? response.words
      : detail
        ? [{
            id: String(response.word || searchQuery),
            text: String(response.word || detail.content || searchQuery),
            phonetic: detail.phonetic || detail.us_phonetic || detail.uk_phonetic || '',
            translation: firstTranslation,
            definition: firstTranslation || undefined,
            example: '',
            masteryLevel: 0,
            tags: [],
            audioUrl: detail.audio?.url,
          } as Word]
        : response && (response.id || response.text)
          ? [response]
          : [];
}

class WfTranslationCenterClass {
  private async loadMap(): Promise<WfTranslationCacheMap> {
    try {
      const stored = await StorageCenter.get<WfTranslationCacheMap>(StorageKey.DICTIONARY_CACHE, {});
      return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    } catch (error: any) {
      // Corrupt entry must not throw: degrade to an empty dictionary.
      console.warn('[WfTranslationCenter] Cache load failed (handled, empty):', error?.message || error);
      return {};
    }
  }

  private async saveMap(map: WfTranslationCacheMap): Promise<void> {
    await StorageCenter.set(StorageKey.DICTIONARY_CACHE, map);
  }

  /** Drop expired entries in place; returns whether anything was removed. */
  private prune(map: WfTranslationCacheMap): boolean {
    const now = Date.now();
    let removed = false;
    for (const key of Object.keys(map)) {
      const entry = map[key];
      if (!entry || typeof entry.at !== 'number' || now - entry.at > ENTRY_TTL_MS) {
        delete map[key];
        removed = true;
      }
    }
    return removed;
  }

  private async readEntry<T>(key: string): Promise<T | null> {
    const map = await this.loadMap();
    const entry = map[key];
    if (!entry || typeof entry.at !== 'number') return null;
    if (Date.now() - entry.at > ENTRY_TTL_MS) {
      // Stale — drop it (and any other expired entries) lazily.
      this.prune(map);
      await this.saveMap(map);
      return null;
    }
    return entry.value as T;
  }

  private async writeEntry(key: string, value: any): Promise<void> {
    const map = await this.loadMap();
    this.prune(map);
    map[key] = { value, at: Date.now() };
    await this.saveMap(map);
  }

  /** Unique cache key for a word + language combination. */
  private getWordKey(word: string, language: string): string {
    return `lookup:${language}:${word.toLowerCase()}`;
  }

  /**
   * Dictionary lookup via the public GET /lookup?word=&language= surface,
   * normalized to a Word list. Hits are cached for ~30 minutes per
   * word+language; errors (incl. the 404 miss) propagate to the caller.
   */
  async lookup(word: string, language: string): Promise<Word[]> {
    const key = this.getWordKey(word, language);
    const cached = await this.readEntry<Word[]>(key);
    if (cached && Array.isArray(cached)) return cached;

    const response = await wordflowApi.request<any>(
      `/lookup?word=${encodeURIComponent(word)}&language=${encodeURIComponent(language)}`
    );
    const list = normalizeLookupResponse(response, word);
    if (list.length > 0) {
      await this.writeEntry(key, list);
    }
    return list;
  }

  /**
   * Single word detail (wordflowApi.getWordDetail) with the same ~30-min
   * cache, keyed by word id. Errors propagate.
   */
  async getWordDetail(wordId: string): Promise<Word | null> {
    const key = `detail:${wordId}`;
    const cached = await this.readEntry<Word>(key);
    if (cached) return cached;

    const word = await wordflowApi.getWordDetail(wordId);
    if (word) {
      await this.writeEntry(key, word);
    }
    return word || null;
  }

  /** Drop the whole lookup/detail cache. */
  async clearCache(): Promise<void> {
    await StorageCenter.cache.invalidate(StorageKey.DICTIONARY_CACHE);
  }
}

export const wfTranslationCenter = new WfTranslationCenterClass();
