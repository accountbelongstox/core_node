/**
 * WfNewCacheRegistry — the SINGLE place that knows every wordnew DATA cache, so
 * the Cache Manager (and "Clear cache") can list + wipe them ONE ITEM AT A TIME,
 * several at once, or all. It clears CACHED DATA only — it deliberately does NOT
 * touch the user's login token or settings (clearing those would log them out).
 *
 * Items today:
 *   books / subtitles / libraries / wordGroups / words — the CapDatabase Content
 *     Library cache (per kind, across ALL endpoint/user scopes).
 *   audio — the device media cache (WfNewAudioCache: every preloaded word
 *     audio clip; up to 20 GB on the Capacitor APP build).
 *   serverResources — exact local-first API response resources.
 * NOT cleared (by design): auth token, the PersistedStore settings stores, and
 * in-memory maps (reset on reload). Add any NEW persistent data cache as an item
 * HERE so the manager covers it.
 *
 * NEVER throws — each step is independently guarded; results report what was
 * cleared and what errored.
 */
import {
  clearContentByPrefix, CONTENT_PREFIX, contentCacheStats,
  type WfNewContentCacheStats,
} from './WfNewContentCache';
import { audioCacheStats, clearAudioCache } from './WfNewAudioCache';
import { clearServerMirror, serverResourceStats } from './WfNewServerMirror';

export type WfNewCacheItemId =
  | 'books' | 'subtitles' | 'libraries' | 'wordGroups' | 'words' | 'serverResources' | 'audio';

/** Display order of the cache items (also "all" = this list). */
export const WFNEW_CACHE_ITEM_IDS: WfNewCacheItemId[] = [
  'books', 'subtitles', 'libraries', 'wordGroups', 'words', 'serverResources', 'audio',
];

export interface WfNewCacheItem {
  id: WfNewCacheItemId;
  /** Cached unit count, or null when not countable (the TTL key/value cache). */
  count: number | null;
}

export interface WfNewCacheOverview {
  backend: string | null;          // 'sqlite' | 'indexeddb' | null
  wordGroupsWithWords: number;     // how many groups have cached words
  items: WfNewCacheItem[];
}

export interface WfNewCacheClearResult {
  cleared: string[];
  errors: string[];
}

// One clear function per item. Content kinds wipe their collections ACROSS ALL
// scopes (by prefix).
const ITEM_CLEAR: Record<WfNewCacheItemId, () => Promise<string[]>> = {
  books: () => clearContentByPrefix(CONTENT_PREFIX.book),
  subtitles: () => clearContentByPrefix(CONTENT_PREFIX.subtitle),
  libraries: () => clearContentByPrefix(CONTENT_PREFIX.library),
  wordGroups: () => clearContentByPrefix(CONTENT_PREFIX.word),
  words: () => clearContentByPrefix(CONTENT_PREFIX.words),
  serverResources: async () => {
    const cleared = await clearServerMirror();
    if (!cleared) throw new Error('Server resources clear failed.');
    return ['server-responses'];
  },
  audio: async () => {
    await clearAudioCache();
    return ['wfnew-audio'];
  },
};

/** Per-item stats for the Cache Manager (counts + storage backend). NEVER throws. */
export async function listWfNewCacheItems(): Promise<WfNewCacheOverview> {
  const s = await contentCacheStats();
  const audio = await audioCacheStats();
  const resources = await serverResourceStats();
  return {
    backend: s.backend,
    wordGroupsWithWords: s.wordGroups,
    items: [
      { id: 'books', count: s.groups.book },
      { id: 'subtitles', count: s.groups.subtitle },
      { id: 'libraries', count: s.groups.library },
      { id: 'wordGroups', count: s.groups.word },
      { id: 'words', count: s.totalWords },
      { id: 'serverResources', count: resources.records },
      { id: 'audio', count: audio.files },
    ],
  };
}

/** Clear the given cache items (one, several, or — via clearAllWfNewCaches — all). */
export async function clearWfNewCacheItems(ids: WfNewCacheItemId[]): Promise<WfNewCacheClearResult> {
  const cleared: string[] = [];
  const errors: string[] = [];
  for (const id of ids) {
    try {
      const c = await ITEM_CLEAR[id]();
      cleared.push(...c.map((n) => `${id}:${n}`));
    } catch {
      errors.push(id);
    }
  }
  return { cleared, errors };
}

/** Clear EVERY cache item (the "clear all" path). */
export async function clearAllWfNewCaches(): Promise<WfNewCacheClearResult> {
  return clearWfNewCacheItems(WFNEW_CACHE_ITEM_IDS);
}

// --- legacy aggregate stats (still consumed by older callers) -------------- //
export interface WfNewCacheStats {
  content: WfNewContentCacheStats;
}

export async function wfNewCacheStats(): Promise<WfNewCacheStats> {
  return { content: await contentCacheStats() };
}
