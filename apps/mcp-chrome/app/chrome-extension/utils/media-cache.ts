/**
 * Bing media byte cache (persistent, local).
 *
 * Holds the binary captured IN the dictionary page by the injected
 * BingMediaFetcher class (the remote *.bing.net / cn.bing.com/dict mp3 URLs
 * cannot be requested directly from the extension — wrong referrer/CORS). The
 * extension stores that binary HERE, keyed by the original remote URL, and
 * rebuilds a data URL from it for display — it never re-requests the remote URL.
 *
 * Persistence: entries are written to chrome.storage.local (key prefix
 * "media:") so they survive an MV3 service-worker restart and popup reopen — a
 * word looked up before is served from local storage without re-downloading.
 * Binary is stored as base64 (compact + JSON-safe + a data URL is just a string
 * concat away). Bounded with LRU eviction (memory + storage) so it can't grow
 * without limit.
 */

const STORAGE_PREFIX = 'media:';
const MAX_ENTRIES = 300;

interface MediaEntry {
  b64: string; // base64 of the raw bytes
  mime: string;
  len: number; // original byte length (for debug/inspection)
  ts: number;
}

class MediaCache {
  private store = new Map<string, MediaEntry>();
  private loaded = false;

  /** Load persisted entries into memory once (idempotent). */
  async init(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const all = await chrome.storage.local.get(null);
      const entries: Array<[string, MediaEntry]> = [];
      for (const key of Object.keys(all)) {
        if (key.startsWith(STORAGE_PREFIX)) {
          const v = all[key];
          if (v && typeof v.b64 === 'string') {
            entries.push([key.slice(STORAGE_PREFIX.length), v as MediaEntry]);
          }
        }
      }
      // Keep the most-recent up to the cap (drop oldest overflow) and insert
      // oldest-first so Map iteration order matches the LRU invariant
      // maintained by get()/put() (first key = least-recently-used victim).
      entries.sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
      entries.slice(-MAX_ENTRIES).forEach(([url, e]) => this.store.set(url, e));
    } catch (error) {
      console.debug('[media-cache] init failed:', error);
    }
  }

  has(url: string): boolean {
    return !!url && this.store.has(url);
  }

  /** Store captured bytes for a URL (memory + persistent storage). */
  put(url: string, bytes: number[], mime?: string): void {
    if (!url || !Array.isArray(bytes) || bytes.length === 0) return;
    const entry: MediaEntry = {
      b64: MediaCache.bytesToBase64(bytes),
      mime: mime || 'application/octet-stream',
      len: bytes.length,
      ts: Date.now(),
    };
    if (this.store.has(url)) this.store.delete(url);
    this.store.set(url, entry);
    chrome.storage.local
      .set({ [STORAGE_PREFIX + url]: entry })
      .catch((e) => console.debug('[media-cache] persist failed:', e));
    this.evict();
  }

  get(url: string): MediaEntry | undefined {
    if (!url) return undefined;
    const entry = this.store.get(url);
    if (entry) {
      // Refresh LRU recency.
      this.store.delete(url);
      this.store.set(url, entry);
    }
    return entry;
  }

  /** Byte length of a cached entry (0 if absent) — for debug display. */
  size(url: string): number {
    return this.store.get(url)?.len || 0;
  }

  /** Rebuild a base64 data URL from cached bytes (for <img>/Audio display). */
  toDataUrl(url: string): string | null {
    const entry = this.get(url);
    if (!entry) return null;
    return `data:${entry.mime};base64,${entry.b64}`;
  }

  /** Drop every cached entry (memory + storage). */
  async clear(): Promise<void> {
    const keys = Array.from(this.store.keys()).map((u) => STORAGE_PREFIX + u);
    this.store.clear();
    if (keys.length) await chrome.storage.local.remove(keys).catch(() => undefined);
  }

  /** Evict oldest entries beyond the cap, from memory AND storage. */
  private evict(): void {
    while (this.store.size > MAX_ENTRIES) {
      const oldest = this.store.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.store.delete(oldest);
      chrome.storage.local.remove(STORAGE_PREFIX + oldest).catch(() => undefined);
    }
  }

  /** number[] (0–255) -> base64 string. */
  static bytesToBase64(bytes: number[]): string {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.slice(i, i + chunk));
    }
    return btoa(binary);
  }
}

export const mediaCache = new MediaCache();
export { MediaCache };
