/**
 * PycoreBlob — fetch pycore binary assets (images/audio) over the WS bus as
 * data: URLs, instead of loading them as HTTP element `src` from :59000.
 *
 * Uses the backend `local_http.blob` RPC (in-process ASGI dispatch → base64).
 * Falls back to the direct HTTP URL only when the WS bus is not connected (an
 * element can still load it directly in that case). An in-memory cache keeps a
 * given path's data URL stable across re-renders so a list of thumbnails does not
 * re-fetch on every render.
 */
import { callRpc, isWsConnected } from './PycoreWs';
import { rewritePycoreEndpoint } from './pycoreTarget';

const WS_BLOB_TIMEOUT_MS = 20_000;
const _cache = new Map<string, string>();
const _inflight = new Map<string, Promise<string>>();

/** Normalise a builder URL (relative or absolute :59000) to a pycore path+query. */
function toPycorePath(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    try { const u = new URL(url); return `${u.pathname}${u.search}`; } catch { return url; }
  }
  return url.startsWith('/') ? url : `/${url}`;
}

/**
 * Resolve a pycore media path to a usable `src`: a `data:` URL fetched over WS
 * when connected (cached), else the direct HTTP URL. Never rejects.
 */
export async function fetchPycoreBlobUrl(url: string): Promise<string> {
  if (!url) return '';
  // Already an inline/blob URL (e.g. base64 image responses) — use as-is.
  if (/^(data:|blob:)/i.test(url)) return url;
  const cached = _cache.get(url);
  if (cached) return cached;
  if (!isWsConnected()) return rewritePycoreEndpoint(url);
  const existing = _inflight.get(url);
  if (existing) return existing;

  const path = toPycorePath(url);
  const p = (async (): Promise<string> => {
    try {
      const r: any = await callRpc(
        'local_http.blob',
        { path, timeout_s: WS_BLOB_TIMEOUT_MS / 1000 },
        WS_BLOB_TIMEOUT_MS + 2000,
      );
      if (r && r.success && typeof r.base64 === 'string') {
        const dataUrl = `data:${r.mime || 'application/octet-stream'};base64,${r.base64}`;
        _cache.set(url, dataUrl);
        return dataUrl;
      }
    } catch { /* fall through to HTTP */ }
    // WS blob failed — let the element load the direct URL instead.
    return rewritePycoreEndpoint(url);
  })().finally(() => { _inflight.delete(url); });

  _inflight.set(url, p);
  return p;
}

/** Drop a cached blob (e.g. after a history entry is deleted/regenerated). */
export function clearPycoreBlob(url: string): void {
  _cache.delete(url);
}
