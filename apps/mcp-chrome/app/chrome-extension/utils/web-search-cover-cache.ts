/**
 * OPFS disk cache for idempotent cover image searches (up to COVER_SEARCH_MAX files).
 *
 * Layout (Chrome OPFS — same origin-private tree as cache/duoreader):
 *   cache/web_search/covers/{cacheKey}/manifest.json
 *   cache/web_search/covers/{cacheKey}/00.jpg
 *   cache/web_search/covers/{cacheKey}/01.webp
 *   ...
 *
 * Cache key = sha1("cover_search|{engine}|images|{normalizedQuery}").
 * A hit skips live browser search and returns stored remote URLs + local blob URLs.
 */

import { COVER_SEARCH_MAX, normalizeCoverUrls } from '@/utils/cover-playback';
import { sha1Hex } from '@/utils/duoreader-importer-core';
import { bookCoverQuery, type WebSearchEngine } from '@/utils/web-search-core';
import { STORAGE_KEYS } from '@/utils/storage-keys';
import { isOpfsAvailable, writeOpfsFile } from '@/utils/opfs';

export const WEB_SEARCH_COVER_CACHE_ROOT = 'cache/web_search/covers';
export const COVER_CACHE_MANIFEST_FILE = 'manifest.json';
export const COVER_CACHE_SCHEMA_VERSION = 1;
/** chrome.storage.local mirror — survives extension reload; OPFS bytes may be rebuilt from this. */
export const COVER_CACHE_STORAGE_KEY = STORAGE_KEYS.WEB_SEARCH_COVER_MANIFESTS;

export interface CoverCacheImageRecord {
  slot: number;
  file: string;
  remoteUrl: string;
  mime: string;
  bytes: number;
}

export interface CoverSearchCacheManifest {
  schemaVersion: number;
  cacheKey: string;
  query: string;
  engine: WebSearchEngine;
  mode: 'images';
  cachedAt: string;
  imageCount: number;
  images: CoverCacheImageRecord[];
}

export interface CoverSearchCacheHit {
  hit: true;
  manifest: CoverSearchCacheManifest;
  /** Remote URLs in slot order — safe for Laravel metadata. */
  remoteUrls: string[];
  /** blob: URLs for popup preview (revoke when done). */
  localBlobUrls: string[];
}

export interface CoverSearchCacheMiss {
  hit: false;
  cacheKey: string;
}

export type CoverSearchCacheLookup = CoverSearchCacheHit | CoverSearchCacheMiss;

export function describeWebSearchCoverCacheLocation(): string {
  if (isOpfsAvailable()) {
    return `OPFS · ${WEB_SEARCH_COVER_CACHE_ROOT}/{cacheKey}/ + chrome.storage.local · ${COVER_CACHE_STORAGE_KEY}`;
  }
  return `OPFS unavailable — mirror: chrome.storage.local · ${COVER_CACHE_STORAGE_KEY}`;
}

export async function buildCoverSearchCacheKey(
  query: string,
  engine: WebSearchEngine,
): Promise<string> {
  const normalized = String(query || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const digest = await sha1Hex(`cover_search|${engine}|images|${normalized}`);
  return digest.slice(0, 40);
}

async function getCoversRoot(): Promise<FileSystemDirectoryHandle> {
  const opfs = await navigator.storage.getDirectory();
  const cache = await opfs.getDirectoryHandle('cache', { create: true });
  const webSearch = await cache.getDirectoryHandle('web_search', { create: true });
  return webSearch.getDirectoryHandle('covers', { create: true });
}

async function getCacheDir(cacheKey: string, create = false): Promise<FileSystemDirectoryHandle> {
  const root = await getCoversRoot();
  return root.getDirectoryHandle(cacheKey, { create });
}

function slotFileName(slot: number, mime: string): string {
  const ext = extForMime(mime);
  return `${String(slot).padStart(2, '0')}.${ext}`;
}

function extForMime(mime: string): string {
  const m = String(mime || '').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  return 'jpg';
}

async function readFileBytes(handle: FileSystemFileHandle): Promise<Uint8Array> {
  const file = await handle.getFile();
  return new Uint8Array(await file.arrayBuffer());
}

async function readStorageManifest(cacheKey: string): Promise<CoverSearchCacheManifest | null> {
  try {
    const stored = await chrome.storage.local.get(COVER_CACHE_STORAGE_KEY);
    const map = stored[COVER_CACHE_STORAGE_KEY] as Record<string, CoverSearchCacheManifest> | undefined;
    const manifest = map?.[cacheKey];
    if (!manifest || manifest.schemaVersion !== COVER_CACHE_SCHEMA_VERSION) return null;
    return manifest;
  } catch {
    return null;
  }
}

async function writeStorageManifest(manifest: CoverSearchCacheManifest): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(COVER_CACHE_STORAGE_KEY);
    const map = (stored[COVER_CACHE_STORAGE_KEY] as Record<string, CoverSearchCacheManifest> | undefined) || {};
    map[manifest.cacheKey] = manifest;
    await chrome.storage.local.set({ [COVER_CACHE_STORAGE_KEY]: map });
  } catch {
    // ignore storage mirror failures
  }
}

async function rebuildOpfsFromManifest(manifest: CoverSearchCacheManifest): Promise<boolean> {
  if (!isOpfsAvailable() || !manifest.images?.length) return false;
  try {
    const dir = await getCacheDir(manifest.cacheKey, true);
    let saved = 0;
    for (const rec of manifest.images.slice(0, COVER_SEARCH_MAX)) {
      const fetched = await fetchImageBytes(rec.remoteUrl);
      if (!fetched) continue;
      const handle = await dir.getFileHandle(rec.file, { create: true });
      await writeOpfsFile(handle, fetched.bytes);
      saved += 1;
    }
    if (!saved) return false;
    const manifestHandle = await dir.getFileHandle(COVER_CACHE_MANIFEST_FILE, { create: true });
    await writeOpfsFile(manifestHandle, JSON.stringify(manifest, null, 2));
    return true;
  } catch {
    return false;
  }
}

function isValidManifest(
  manifest: CoverSearchCacheManifest | null | undefined,
  query: string,
  engine: WebSearchEngine,
): manifest is CoverSearchCacheManifest {
  return !!(
    manifest
    && manifest.schemaVersion === COVER_CACHE_SCHEMA_VERSION
    && manifest.engine === engine
    && manifest.query.trim().toLowerCase() === query.trim().toLowerCase()
    && Array.isArray(manifest.images)
    && manifest.images.length > 0
  );
}

/** Load manifest + verify image files exist (no blob URLs). Falls back to chrome.storage.local mirror. */
export async function peekCoverSearchCache(
  query: string,
  engine: WebSearchEngine,
): Promise<CoverSearchCacheLookup> {
  const cacheKey = await buildCoverSearchCacheKey(query, engine);

  if (isOpfsAvailable()) {
    try {
      const dir = await getCacheDir(cacheKey, false);
      const manifestHandle = await dir.getFileHandle(COVER_CACHE_MANIFEST_FILE);
      const manifestText = new TextDecoder().decode(await readFileBytes(manifestHandle));
      const manifest = JSON.parse(manifestText) as CoverSearchCacheManifest;

      if (isValidManifest(manifest, query, engine)) {
        const remoteUrls: string[] = [];
        for (const rec of manifest.images.slice(0, COVER_SEARCH_MAX)) {
          const imgHandle = await dir.getFileHandle(rec.file);
          const file = await imgHandle.getFile();
          if (!file.size) {
            break;
          }
          remoteUrls.push(rec.remoteUrl);
        }
        if (remoteUrls.length) {
          return { hit: true, manifest, remoteUrls, localBlobUrls: [] };
        }
      }
    } catch {
      // fall through to storage mirror
    }
  }

  const stored = await readStorageManifest(cacheKey);
  if (isValidManifest(stored, query, engine)) {
    if (isOpfsAvailable()) {
      await rebuildOpfsFromManifest(stored);
    }
    const remoteUrls = stored.images.map((rec) => rec.remoteUrl).slice(0, COVER_SEARCH_MAX);
    return { hit: true, manifest: stored, remoteUrls, localBlobUrls: [] };
  }

  return { hit: false, cacheKey };
}

/** Load a valid cache entry when manifest + all image files exist. */
export async function loadCoverSearchCache(
  query: string,
  engine: WebSearchEngine,
): Promise<CoverSearchCacheLookup> {
  const cacheKey = await buildCoverSearchCacheKey(query, engine);
  if (!isOpfsAvailable()) {
    return { hit: false, cacheKey };
  }

  try {
    const dir = await getCacheDir(cacheKey, false);
    const manifestHandle = await dir.getFileHandle(COVER_CACHE_MANIFEST_FILE);
    const manifestText = new TextDecoder().decode(await readFileBytes(manifestHandle));
    const manifest = JSON.parse(manifestText) as CoverSearchCacheManifest;

    if (
      !manifest
      || manifest.schemaVersion !== COVER_CACHE_SCHEMA_VERSION
      || manifest.engine !== engine
      || manifest.query.trim().toLowerCase() !== query.trim().toLowerCase()
      || !Array.isArray(manifest.images)
      || manifest.images.length === 0
    ) {
      return { hit: false, cacheKey };
    }

    const remoteUrls: string[] = [];
    const localBlobUrls: string[] = [];

    for (const rec of manifest.images.slice(0, COVER_SEARCH_MAX)) {
      const imgHandle = await dir.getFileHandle(rec.file);
      const bytes = await readFileBytes(imgHandle);
      if (!bytes.length) {
        return { hit: false, cacheKey };
      }
      const blob = new Blob([new Uint8Array(bytes).buffer], { type: rec.mime || 'image/jpeg' });
      remoteUrls.push(rec.remoteUrl);
      localBlobUrls.push(URL.createObjectURL(blob));
    }

    if (!remoteUrls.length) {
      return { hit: false, cacheKey };
    }

    return {
      hit: true,
      manifest,
      remoteUrls,
      localBlobUrls,
    };
  } catch {
    return { hit: false, cacheKey };
  }
}

async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const mime = res.headers.get('content-type') || 'image/jpeg';
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) return null;
    return { bytes: new Uint8Array(buf), mime: mime.split(';')[0].trim() || 'image/jpeg' };
  } catch {
    return null;
  }
}

/**
 * Persist up to COVER_SEARCH_MAX remote image URLs under the idempotent cache key.
 * Returns remote URLs that were successfully cached (may be fewer than input).
 */
export async function saveCoverSearchCache(
  query: string,
  engine: WebSearchEngine,
  remoteUrls: string[],
): Promise<{ cacheKey: string; savedUrls: string[]; skipped: boolean }> {
  const cacheKey = await buildCoverSearchCacheKey(query, engine);
  const unique = Array.from(new Set(remoteUrls.map((u) => String(u || '').trim()).filter(Boolean)))
    .slice(0, COVER_SEARCH_MAX);

  if (!unique.length || !isOpfsAvailable()) {
    return { cacheKey, savedUrls: unique, skipped: true };
  }

  const dir = await getCacheDir(cacheKey, true);
  const images: CoverCacheImageRecord[] = [];
  const savedUrls: string[] = [];

  for (let slot = 0; slot < unique.length; slot += 1) {
    const remoteUrl = unique[slot];
    const fetched = await fetchImageBytes(remoteUrl);
    if (!fetched) continue;
    const file = slotFileName(slot, fetched.mime);
    const handle = await dir.getFileHandle(file, { create: true });
    await writeOpfsFile(handle, fetched.bytes);
    images.push({
      slot,
      file,
      remoteUrl,
      mime: fetched.mime,
      bytes: fetched.bytes.length,
    });
    savedUrls.push(remoteUrl);
  }

  if (!images.length) {
    return { cacheKey, savedUrls: [], skipped: true };
  }

  const manifest: CoverSearchCacheManifest = {
    schemaVersion: COVER_CACHE_SCHEMA_VERSION,
    cacheKey,
    query: query.trim(),
    engine,
    mode: 'images',
    cachedAt: new Date().toISOString(),
    imageCount: images.length,
    images,
  };

  const manifestHandle = await dir.getFileHandle(COVER_CACHE_MANIFEST_FILE, { create: true });
  await writeOpfsFile(manifestHandle, JSON.stringify(manifest, null, 2));
  await writeStorageManifest(manifest);

  return { cacheKey, savedUrls, skipped: false };
}

export function revokeCoverSearchBlobUrls(urls: string[]): void {
  for (const url of urls) {
    if (url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Resolve popup display URLs: OPFS cached blobs (up to 5, carousel-ready) when available,
 * otherwise shelf/search remote URLs with referrer-friendly ordering.
 */
export async function resolveCoverUrlsForDisplay(
  title: string,
  author: string,
  shelfCoverUrl: string,
  remoteCoverUrls: string[] = [],
): Promise<string[]> {
  const query = bookCoverQuery(title, author);
  const engines: WebSearchEngine[] = ['google', 'bing'];
  for (const engine of engines) {
    const cached = await loadCoverSearchCache(query, engine);
    if (cached.hit && cached.localBlobUrls.length) {
      return cached.localBlobUrls.slice(0, COVER_SEARCH_MAX);
    }
  }
  return normalizeCoverUrls(shelfCoverUrl, remoteCoverUrls);
}
