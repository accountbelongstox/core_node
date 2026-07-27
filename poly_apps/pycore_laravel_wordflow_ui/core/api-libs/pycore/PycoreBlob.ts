/**
 * PycoreBlob — fetch pycore binary assets (images/audio) over the WS bus as
 * data: URLs, instead of loading them as HTTP element `src` from :59000.
 *
 * Uses the native `pycore.router.resource` RPC route and receives base64 data.
 * Returns an empty URL while the WS bus is unavailable. An in-memory cache keeps a
 * given path's data URL stable across re-renders so a list of thumbnails does not
 * re-fetch on every render.
 */
import { callRpc, isWsConnected } from './PycoreWs';
import { PYCORE_RPC_ROUTES } from './PycoreRpcRoutes';

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
  if (!isWsConnected()) return '';
  const existing = _inflight.get(url);
  if (existing) return existing;

  const path = toPycorePath(url);
  const p = (async (): Promise<string> => {
    try {
      const r: any = await callRpc(
        PYCORE_RPC_ROUTES.routerResource,
        { route: path },
      );
      if (r && r.success && typeof r.base64 === 'string') {
        const dataUrl = `data:${r.mime || 'application/octet-stream'};base64,${r.base64}`;
        _cache.set(url, dataUrl);
        return dataUrl;
      }
    } catch { /* the WS request remains durable on the server */ }
    return '';
  })().finally(() => { _inflight.delete(url); });

  _inflight.set(url, p);
  return p;
}

/** Drop a cached blob (e.g. after a history entry is deleted/regenerated). */
export function clearPycoreBlob(url: string): void {
  _cache.delete(url);
}
