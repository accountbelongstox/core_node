/**
 * PycoreBlob — fetch pycore binary assets over HTTP controllers as
 * data: URLs, instead of loading them as HTTP element `src` from :59000.
 *
 * Selects the concrete native RPC v2 resource controller for each path.
 * Returns an empty URL while the HTTP controller is unavailable. An in-memory cache keeps a
 * given path's data URL stable across re-renders so a list of thumbnails does not
 * re-fetch on every render.
 */
import { callRpc } from './PycoreHttp';
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

function resourceCall(path: string): Promise<unknown> {
  const speechMatch = path.match(/^\/api\/local\/speech\/history\/file\/([^?]+)/);
  if (speechMatch) {
    return callRpc(PYCORE_RPC_ROUTES.speechHistoryHistoryFile, {
      audio_id: decodeURIComponent(speechMatch[1]),
    });
  }
  const imageMatch = path.match(/^\/api\/local\/ai\/image\/history\/file\/([^?]+)/);
  if (imageMatch) {
    return callRpc(PYCORE_RPC_ROUTES.aiImageImageHistoryFile, {
      image_id: decodeURIComponent(imageMatch[1]),
    });
  }
  if (path.startsWith('/voice-subtitle/audio')) {
    const query = new URL(path, 'http://pycore.local').searchParams;
    return callRpc(PYCORE_RPC_ROUTES.voiceSubtitleGetAudioFile, {
      path: query.get('path') || '',
    });
  }
  return callRpc(PYCORE_RPC_ROUTES.vocabularyResource, { url: path });
}

/**
 * Resolve a pycore media path to a cached `data:` URL fetched over RPC v2.
 * It returns an empty string while RPC is unavailable and never falls back to
 * browser HTTP.
 */
export async function fetchPycoreBlobUrl(url: string): Promise<string> {
  if (!url) return '';
  // Already an inline/blob URL (e.g. base64 image responses) — use as-is.
  if (/^(data:|blob:)/i.test(url)) return url;
  const cached = _cache.get(url);
  if (cached) return cached;
  const existing = _inflight.get(url);
  if (existing) return existing;

  const path = toPycorePath(url);
  const p = (async (): Promise<string> => {
    try {
      const r: any = await resourceCall(path);
      const content = r?.content_base64 || r?.base64;
      if (r && r.success && typeof content === 'string') {
        const dataUrl = `data:${r.mime || 'application/octet-stream'};base64,${content}`;
        _cache.set(url, dataUrl);
        return dataUrl;
      }
    } catch { /* Return an empty URL when the HTTP request fails. */ }
    return '';
  })().finally(() => { _inflight.delete(url); });

  _inflight.set(url, p);
  return p;
}

/** Drop a cached blob (e.g. after a history entry is deleted/regenerated). */
export function clearPycoreBlob(url: string): void {
  _cache.delete(url);
}
