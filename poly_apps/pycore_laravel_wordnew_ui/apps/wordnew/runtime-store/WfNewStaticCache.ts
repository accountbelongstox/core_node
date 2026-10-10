/**
 * The one device library of wordnew's static files: every remote static file a page shows or plays (word / phrase /
 * sentence audio, voice / accent variants, article audio, images, covers, avatars) is looked up here first and kept
 * for good (WORDNEW_GUIDE R14: never evicted, never fetched twice; only the cache page's clear removes files).
 *
 *   clip files     a file whose clip identity is known (kind, language, text noted by a caller, or proven by a
 *                  Laravel sentence / phrase file URL) belongs to the orchestration clip store: native looks it up
 *                  there (and moves a copy this library held into it), fetches a missing one through the schedule's
 *                  transfer stages (WordNewClipResolver) and only then from the URL. The web keeps it here under
 *                  its resource id.
 *   other files    kept here (`wfnew-static`, app data / OPFS) by the URL's path key: another host or query is the
 *                  same file. Files of the old reader audio folders move over instead of being fetched again.
 *
 * Audio callers use runtime-store/WfNewAudioCache (the clip API on top of this library); images use
 * hooks/useWfNewStaticUrl and components/WfNewCachedImage.
 */
import {
  CapResourceAssetCache,
  Directory,
  getStorageEstimate,
  pathAssetKey,
  requestPersistentStorage,
  urlAssetKey,
  type CapResourceExternalStore,
} from '@/apps/wordnew/platform/capabilities';
import { isNativeAppShell } from '../../../core/network/NativeShell';
import { orchClipIdentityOfUrl, type OrchClipIdentity } from '../../../shared/orchestration/orchClipIdentity';
import { wfNewEndpoints } from '../api/WfNewEndpoints';
import {
  LEGACY_STATIC_FOLDERS,
  STATIC_FILE_DIR,
  clipStaticKeys,
  wordNewOrchClipStore,
} from '../services/orchestration/WordNewOrchClipStore';

export type WfNewStaticKind = 'audio' | 'image';

export const MAX_STATIC_CACHE_BYTES = 20 * 1024 ** 3;

const MIN_WEB_STATIC_CACHE_BYTES = 64 * 1024 ** 2;
const WEB_FALLBACK_CACHE_BYTES = 2 * 1024 ** 3;
const WEB_QUOTA_SHARE = 0.5;
const STATIC_PRELOAD_CONCURRENCY = 4;
const IDENTITY_LIMIT = 50_000;
const KIND_HINT_LIMIT = 50_000;
const STATIC_RETRY_MS = 10 * 60 * 1000;
const REMOTE_URL_RE = /^https?:\/\//i;

const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/opus',
  flac: 'audio/flac',
};

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
};

async function resolveCacheBudget(): Promise<number> {
  if (isNativeAppShell()) return MAX_STATIC_CACHE_BYTES;
  await requestPersistentStorage().catch(() => false);
  const estimate = await getStorageEstimate();
  if (estimate.quotaBytes <= 0) return WEB_FALLBACK_CACHE_BYTES;
  return Math.max(
    MIN_WEB_STATIC_CACHE_BYTES,
    Math.min(MAX_STATIC_CACHE_BYTES, Math.floor(estimate.quotaBytes * WEB_QUOTA_SHARE)),
  );
}

/** Bounded insertion-ordered map: the oldest entry goes when the limit is reached. */
function boundedSet<K, V>(map: Map<K, V>, key: K, value: V, limit: number): void {
  if (!map.has(key) && map.size >= limit) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}

/** What a caller said a URL is (audio / image), by the URL's path key: extension-less URLs get the right type. */
const kindHints = new Map<string, WfNewStaticKind>();

/** Clip identity a caller proved for a URL (it knows the clip's kind, language and text), by the URL's path key. */
const notedIdentities = new Map<string, OrchClipIdentity>();

function extensionOf(url: string): string {
  return (/\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/.exec(url)?.[1] ?? '').toLowerCase();
}

function staticMime(url: string): string | undefined {
  const extension = extensionOf(url);
  if (AUDIO_MIME[extension]) return AUDIO_MIME[extension];
  if (IMAGE_MIME[extension]) return IMAGE_MIME[extension];
  // An extension-less image is sniffed by the browser; an extension-less audio file is served as MP3 (every clip is).
  return kindHints.get(pathAssetKey(url)) === 'image' ? undefined : AUDIO_MIME.mp3;
}

/** The clip identity of a URL: the one a caller noted, else the one a Laravel sentence / phrase file URL proves. */
export function staticClipIdentity(url: string): OrchClipIdentity | null {
  const proven = orchClipIdentityOfUrl(url);
  const noted = notedIdentities.get(pathAssetKey(url));
  if (noted && (!proven || proven.resourceId === noted.resourceId)) return noted;
  return proven;
}

/** A caller that knows which clip a URL's file is says so: from then on the file is that clip everywhere. */
export function noteStaticClip(url: string, identity: OrchClipIdentity): void {
  boundedSet(notedIdentities, pathAssetKey(url), identity, IDENTITY_LIMIT);
}

/**
 * Stable keys of one file, in order: a clip file's key is its resource id (the name the clip store uses); any other
 * URL is keyed by its path. The whole-URL key of the first generation stays last so an old file is renamed to the
 * stable key on first use instead of being downloaded again.
 */
function staticKeys(url: string): string[] {
  const identity = staticClipIdentity(url);
  return identity ? clipStaticKeys(identity, url) : [pathAssetKey(url), urlAssetKey(url)];
}

/**
 * The clip loader is reached on first use: it reaches the schedule (WORDNEW_ORCH_SCHEDULE), which reaches the API
 * layer, which reaches this library. Callers and this library only meet it at call time.
 */
const loadClipResolver = async () => (await import('../services/orchestration/WordNewClipResolver')).wordNewClipResolver;

/**
 * Native: a clip file belongs to the orchestration clip store - held there (or moved there from this library's
 * folders), else fetched through the schedule's transfer stages, else from the URL itself.
 */
function clipStoreFor(url: string): CapResourceExternalStore | null {
  const identity = isNativeAppShell() ? staticClipIdentity(url) : null;
  if (!identity) return null;
  return {
    held: async () => {
      const hit = (await wordNewOrchClipStore.lookup([{ ...identity, laravelUrl: url }])).get(identity.resourceId);
      return hit?.url ?? null;
    },
    fetch: async () => {
      const fetched = identity.text ? await (await loadClipResolver()).fetch(identity, url) : null;
      return fetched ?? wordNewOrchClipStore.putFromUrl(identity, url, '');
    },
  };
}

function absoluteStaticUrl(value: string): string {
  if (REMOTE_URL_RE.test(value)) return value;
  return value.startsWith('/') ? wfNewEndpoints.buildUrl(value) : '';
}

/** Audio file URLs a server payload names (audio keys and the members of audio collections). */
function payloadAudioUrls(payload: unknown): string[] {
  const urls = new Set<string>();
  const visit = (value: unknown, parentKey = '', audioContext = false): void => {
    if (typeof value === 'string') {
      if (audioContext || /^(audio|audio_url|audioUrl|mp3_url)$/i.test(parentKey)) {
        const absolute = absoluteStaticUrl(value);
        if (absolute) urls.add(absolute);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, parentKey, audioContext);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      visit(child, key, audioContext || /^(audio|audio_files|audioFiles|audio_variants)$/i.test(key));
    }
  };
  visit(payload);
  return [...urls];
}

const staticAssets = new CapResourceAssetCache({
  dir: STATIC_FILE_DIR,
  directory: Directory.Data,
  legacy: LEGACY_STATIC_FOLDERS,
  keysFor: staticKeys,
  externalFor: clipStoreFor,
  budget: resolveCacheBudget,
  extractUrls: payloadAudioUrls,
  mimeFor: staticMime,
  concurrency: STATIC_PRELOAD_CONCURRENCY,
});

wordNewOrchClipStore.onRootChanged(() => staticAssets.forgetResolved());
wordNewOrchClipStore.onRemoved(() => staticAssets.forgetResolved());

function hintKind(url: string, kind: WfNewStaticKind | undefined): void {
  if (kind) boundedSet(kindHints, pathAssetKey(url), kind, KIND_HINT_LIMIT);
}

/** When a file could not be had (no CORS, gone, offline): it is not asked again within the retry window. */
const failedAt = new Map<string, number>();

/** The local copy of a remote static file (held, or fetched now and kept); null when it cannot be had. */
export async function ensureStatic(url: string, kind?: WfNewStaticKind): Promise<string | null> {
  if (!url || !REMOTE_URL_RE.test(url)) return null;
  hintKind(url, kind);
  const failed = failedAt.get(url);
  if (failed && Date.now() - failed < STATIC_RETRY_MS) return null;
  const local = await staticAssets.ensure(url);
  if (local) failedAt.delete(url);
  else boundedSet(failedAt, url, Date.now(), KIND_HINT_LIMIT);
  return local;
}

/** The local copy when this session already resolved it; otherwise the URL itself (and the file is fetched for next time). */
export function resolveStaticSync(url: string | null | undefined, kind?: WfNewStaticKind): string | undefined {
  if (url && REMOTE_URL_RE.test(url)) hintKind(url, kind);
  return staticAssets.resolveSync(url);
}

/** The local copy this session already resolved (no lookup, no fetch), or undefined. */
export function peekStatic(url: string | null | undefined): string | undefined {
  return url ? staticAssets.peek(url) : undefined;
}

export function preloadStatic(urls: Iterable<string>, kind?: WfNewStaticKind): void {
  const remote = [...urls].filter((url) => !!url && REMOTE_URL_RE.test(url));
  remote.forEach((url) => hintKind(url, kind));
  staticAssets.preload(remote);
}

/** Every audio file a server payload names, kept ahead of use. */
export function preloadStaticFromPayload(payload: unknown): void {
  staticAssets.preloadPayload(payload);
}

/**
 * Route-scoped gate for wordnew's background fetching: WfNewApp pauses the library when its route is left and
 * resumes it on mount (state is kept; only new fetches wait), so wordnew never fetches under another end's route.
 */
export function setStaticCachePaused(paused: boolean): void {
  staticAssets.setPaused(paused);
}

export function staticCacheStats(): Promise<{ files: number; bytes: number; budgetBytes: number }> {
  return staticAssets.stats();
}

/** The cache page's clear: every file of this library (clips in the clip store are cleared with that store). */
export function clearStaticCache(): Promise<void> {
  return staticAssets.clear();
}
