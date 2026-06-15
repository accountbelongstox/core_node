/**
 * Bing media byte cache.
 *
 * Holds the RAW BYTES (as number[], 0–255) captured in-page by the injected
 * BingMediaFetcher class, keyed by the original remote URL. The extension stores
 * the numbers here (never re-requesting the remote URL) and rebuilds a data URL
 * from them on demand for display. Bounded with simple LRU eviction so a long
 * session can't grow it without limit.
 */

interface MediaEntry {
  bytes: number[];
  mime: string;
  ts: number;
}

const MAX_ENTRIES = 200;

class MediaCache {
  private store = new Map<string, MediaEntry>();

  has(url: string): boolean {
    return !!url && this.store.has(url);
  }

  /** Store captured bytes for a URL (LRU: re-insert to mark most-recent). */
  put(url: string, bytes: number[], mime?: string): void {
    if (!url || !Array.isArray(bytes) || bytes.length === 0) return;
    if (this.store.has(url)) this.store.delete(url);
    this.store.set(url, { bytes, mime: mime || 'application/octet-stream', ts: Date.now() });
    while (this.store.size > MAX_ENTRIES) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
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

  /** Rebuild a base64 data URL from cached bytes (for <img>/Audio display). */
  toDataUrl(url: string): string | null {
    const entry = this.get(url);
    if (!entry) return null;
    return MediaCache.bytesToDataUrl(entry.bytes, entry.mime);
  }

  clear(): void {
    this.store.clear();
  }

  /** number[] (0–255) -> "data:<mime>;base64,...." */
  static bytesToDataUrl(bytes: number[], mime: string): string {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.slice(i, i + chunk));
    }
    return `data:${mime || 'application/octet-stream'};base64,${btoa(binary)}`;
  }
}

export const mediaCache = new MediaCache();
export { MediaCache };
