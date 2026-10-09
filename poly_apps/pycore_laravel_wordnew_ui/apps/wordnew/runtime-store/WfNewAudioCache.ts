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
import { orchClipIdentity, orchClipIdentityOfUrl, type OrchClipIdentity } from '../../../shared/orchestration/orchClipIdentity';
import { wfNewEndpoints } from '../api/WfNewEndpoints';
import { READER_AUDIO_DIR, wordNewOrchClipStore } from '../services/orchestration/WordNewOrchClipStore';
import type { WordNewClipFetchOptions, WordNewClipRef } from '../services/orchestration/WordNewClipResolver';

export type { WordNewClipFetchOptions, WordNewClipRef };

export const MAX_AUDIO_CACHE_BYTES = 20 * 1024 ** 3;

const MIN_WEB_AUDIO_CACHE_BYTES = 64 * 1024 ** 2;
const WEB_FALLBACK_CACHE_BYTES = 2 * 1024 ** 3;
const WEB_QUOTA_SHARE = 0.5;
const AUDIO_PRELOAD_CONCURRENCY = 4;

async function resolveCacheBudget(): Promise<number> {
  if (isNativeAppShell()) return MAX_AUDIO_CACHE_BYTES;
  await requestPersistentStorage().catch(() => false);
  const estimate = await getStorageEstimate();
  if (estimate.quotaBytes <= 0) return WEB_FALLBACK_CACHE_BYTES;
  return Math.max(
    MIN_WEB_AUDIO_CACHE_BYTES,
    Math.min(MAX_AUDIO_CACHE_BYTES, Math.floor(estimate.quotaBytes * WEB_QUOTA_SHARE)),
  );
}

function audioMime(url: string): string {
  const match = /\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/.exec(url);
  switch ((match?.[1] ?? '').toLowerCase()) {
    case 'mp3': return 'audio/mpeg';
    case 'm4a':
    case 'aac': return 'audio/mp4';
    case 'wav': return 'audio/wav';
    case 'ogg':
    case 'oga': return 'audio/ogg';
    case 'opus': return 'audio/opus';
    case 'flac': return 'audio/flac';
    default: return 'audio/mpeg';
  }
}

function payloadAudioUrls(payload: unknown): string[] {
  const urls = new Set<string>();
  const visit = (value: unknown, parentKey = '', audioContext = false): void => {
    if (typeof value === 'string') {
      const isAudioKey = /^(audio|audio_url|audioUrl|mp3_url)$/i.test(parentKey);
      if (audioContext || isAudioKey) {
        const absolute = /^https?:\/\//i.test(value)
          ? value
          : value.startsWith('/') ? wfNewEndpoints.buildUrl(value) : '';
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
      const nextAudioContext = audioContext || /^(audio|audio_files|audioFiles|audio_variants)$/i.test(key);
      visit(child, key, nextAudioContext);
    }
  };
  visit(payload);
  return [...urls];
}

const SENTENCE_CLIP_EXTENSION = '.mp3';
const CLIP_IDENTITY_LIMIT = 50_000;

/** Identity a caller proved for a URL (it knows the clip's kind, language and text), by the URL's path key. */
const notedIdentities = new Map<string, OrchClipIdentity>();

/**
 * The clip resolver is loaded on first use: it reaches the schedule (WORDNEW_ORCH_SCHEDULE), which reaches the API
 * layer, which reaches this cache. Callers and this cache only meet it at call time.
 */
const loadClipResolver = async () => (await import('../services/orchestration/WordNewClipResolver')).wordNewClipResolver;

/** Playable URLs of clips resolved by identity (store URLs, page object URLs). */
const clipPlayableUrls = new Map<string, string>();

export const wordClip = (text: string, language = 'en'): WordNewClipRef => ({ kind: 'word', language, text });

export const sentenceClip = (text: string, language = 'en'): WordNewClipRef => ({ kind: 'sentence', language, text });

const clipUsable = (ref: WordNewClipRef | null | undefined): ref is WordNewClipRef =>
  !!ref && ref.text.trim() !== '' && ref.language.trim() !== '';

const identityOfRef = (ref: WordNewClipRef): OrchClipIdentity => orchClipIdentity(ref.kind, ref.language, ref.text.trim());

/**
 * A caller that knows what a URL is (kind, language, text) says so: from then on this cache keeps that file as the
 * orchestration clip of that identity - one name (the resource id), one store, shared with every composition. Only
 * the default file of a clip is noted: accent / voice variants are other audio than the clip and stay on their path keys.
 */
export function noteAudioClip(ref: WordNewClipRef, url: string | null | undefined): void {
  if (!url || !/^https?:\/\//i.test(url) || !clipUsable(ref)) return;
  if (notedIdentities.size >= CLIP_IDENTITY_LIMIT) {
    const oldest = notedIdentities.keys().next().value;
    if (oldest !== undefined) notedIdentities.delete(oldest);
  }
  notedIdentities.set(pathAssetKey(url), identityOfRef(ref));
}

/** The URL is the default file of this clip (a Laravel sentence / phrase file proves it); a voice / accent variant file is other audio. */
export function clipOwnsUrl(ref: WordNewClipRef, url: string | null | undefined): boolean {
  if (!url || !clipUsable(ref)) return false;
  const proven = orchClipIdentityOfUrl(url);
  return !!proven && proven.resourceId === identityOfRef(ref).resourceId;
}

/** The clip identity of an audio URL: the one a caller noted, else the one a Laravel sentence / phrase file URL proves. */
function identityOfAudioUrl(url: string): OrchClipIdentity | null {
  const proven = orchClipIdentityOfUrl(url);
  const noted = notedIdentities.get(pathAssetKey(url));
  if (noted && (!proven || proven.resourceId === noted.resourceId)) return noted;
  return proven;
}

/**
 * Stable keys of one audio file, in order: a clip file's key is its resource id (the name the orchestration clip
 * store uses); any other URL is keyed by its path (a changed host or query is the same file). The whole-URL key of
 * the first generation stays last so existing files are renamed to the stable key on first use instead of being
 * downloaded again. Word file URLs carry a voice hash, not the word: a word is a clip only when a caller noted it.
 */
function audioKeys(url: string): string[] {
  const identity = identityOfAudioUrl(url);
  const keys = [pathAssetKey(url), urlAssetKey(url)];
  return identity ? [`${identity.resourceId}${SENTENCE_CLIP_EXTENSION}`, ...keys] : keys;
}

/**
 * Native: a clip the orchestration clip store holds (or takes over from this cache's old files) is served from there;
 * a missing one is fetched through the clip resolver (the schedule's transfer stages: pycore direct, Laravel, relay),
 * and from the URL itself when no stage has it.
 */
function clipStoreFor(url: string): CapResourceExternalStore | null {
  const identity = isNativeAppShell() ? identityOfAudioUrl(url) : null;
  if (!identity) return null;
  return {
    held: async () => {
      const hit = (await wordNewOrchClipStore.lookup([identity])).get(identity.resourceId);
      return hit?.url ?? wordNewOrchClipStore.adoptReaderFile(identity, [pathAssetKey(url), urlAssetKey(url)]);
    },
    fetch: async () => {
      const fetched = identity.text ? await (await loadClipResolver()).fetch(identity, url) : null;
      return fetched ?? wordNewOrchClipStore.putFromUrl(identity, url, '');
    },
  };
}

const audioAssets = new CapResourceAssetCache({
  dir: READER_AUDIO_DIR,
  directory: Directory.Data,
  legacyDirectory: Directory.Cache,
  keysFor: audioKeys,
  externalFor: clipStoreFor,
  budget: resolveCacheBudget,
  extractUrls: payloadAudioUrls,
  mimeFor: audioMime,
  concurrency: AUDIO_PRELOAD_CONCURRENCY,
});

wordNewOrchClipStore.onRootChanged(() => { clipPlayableUrls.clear(); audioAssets.forgetResolved(); });
wordNewOrchClipStore.onRemoved(() => { clipPlayableUrls.clear(); audioAssets.forgetResolved(); });

export function ensureAudio(url: string): Promise<string | null> {
  return audioAssets.ensure(url);
}

export function resolveAudioSync(url: string | undefined | null): string | undefined {
  return audioAssets.resolveSync(url);
}

/**
 * The clip-first entry for every caller that knows what it plays (kind, language, text; `url` = the file its payload
 * named, if any). One order everywhere: the device store (a held clip is never requested again, R14), then the
 * schedule's transfer stages (pycore direct, Laravel, relay; WordNewClipResolver), then - for a clip the payload
 * named - the file at its URL. Resolves to a playable URL, or null when nothing has the clip (the caller then asks
 * the queue to generate it and falls back to its next tier, e.g. browser speech).
 */
export async function ensureClipAudio(
  ref: WordNewClipRef,
  url?: string | null,
  options: WordNewClipFetchOptions = {},
): Promise<string | null> {
  const remote = url && /^https?:\/\//i.test(url) ? url : null;
  if (!clipUsable(ref)) return remote ? audioAssets.ensure(remote) : null;
  noteAudioClip(ref, remote);
  const id = identityOfRef(ref).resourceId;
  const memo = clipPlayableUrls.get(id);
  if (memo) return memo;
  const work = remote
    ? audioAssets.ensure(remote)
    : (async () => (await loadClipResolver()).fetch(ref, null, options))();
  const local = await (options.timeoutMs
    ? Promise.race([work, new Promise<null>((resolve) => { setTimeout(() => resolve(null), options.timeoutMs); })])
    : work);
  if (local) clipPlayableUrls.set(id, local);
  return local;
}

/**
 * The playable URL to hand to an audio element right now: the clip's local copy when known; otherwise the payload
 * URL (the clip is fetched in the background for the next play); undefined when there is neither.
 */
export function playableClip(ref: WordNewClipRef, url?: string | null): string | undefined {
  const remote = url && /^https?:\/\//i.test(url) ? url : null;
  if (!clipUsable(ref)) return remote ? resolveAudioSync(remote) : undefined;
  noteAudioClip(ref, remote);
  const memo = clipPlayableUrls.get(identityOfRef(ref).resourceId);
  if (memo) return memo;
  if (remote) return resolveAudioSync(remote);
  void ensureClipAudio(ref).catch(() => null);
  return undefined;
}

/**
 * `playableClip`, and for a clip no file was named for, the clip by identity (device store, then the schedule's
 * transfers) within `waitMs`: what an interactive play (a speaker button) hands to an audio element, or null when
 * the caller should fall to its next tier (browser speech) and ask the queue to generate the clip.
 */
export async function awaitPlayableClip(ref: WordNewClipRef, url: string | null | undefined, waitMs: number): Promise<string | null> {
  return playableClip(ref, url) ?? await ensureClipAudio(ref, null, { timeoutMs: waitMs });
}

/** The playable URLs of the clips the device already holds, by index into `refs` (no network). */
export async function heldClipAudio(refs: readonly WordNewClipRef[]): Promise<Map<number, string>> {
  const found = new Map<number, string>();
  const unknown: Array<{ index: number; ref: WordNewClipRef }> = [];
  refs.forEach((ref, index) => {
    const memo = clipUsable(ref) ? clipPlayableUrls.get(identityOfRef(ref).resourceId) : undefined;
    if (memo) found.set(index, memo);
    else if (clipUsable(ref)) unknown.push({ index, ref });
  });
  if (unknown.length === 0) return found;
  const held = await (await loadClipResolver()).heldMany(unknown.map(({ ref }) => ref));
  held.forEach((url, position) => {
    const { index, ref } = unknown[position];
    clipPlayableUrls.set(identityOfRef(ref).resourceId, url);
    found.set(index, url);
  });
  return found;
}

export interface WordNewClipAudioItem {
  ref: WordNewClipRef;
  /** The file the payload named for this clip (absent: the clip is looked up by identity only). */
  url?: string | null;
}

/** Warm the cache for clips (payload URLs go through the URL cache with their identity noted; no blind lookups). */
export function preloadClipAudio(items: Iterable<WordNewClipAudioItem>): void {
  const urls: string[] = [];
  for (const { ref, url } of items) {
    if (!url) continue;
    noteAudioClip(ref, url);
    urls.push(url);
  }
  audioAssets.preload(urls);
}

/** `ensureClipAudio` for many clips with bounded concurrency; `onSettled` gets each item's index and whether it is now local. */
export async function preloadClipAudioTracked(
  items: readonly WordNewClipAudioItem[],
  onSettled: (index: number, ready: boolean) => void,
): Promise<void> {
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        onSettled(index, !!(await ensureClipAudio(items[index].ref, items[index].url)));
      } catch {
        onSettled(index, false);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(AUDIO_PRELOAD_CONCURRENCY, items.length) }, () => worker()));
}

export function collectAudioUrls(words: Array<{
  audioUrl?: string | null;
  audioFiles?: Array<{ url?: string }>;
}>): string[] {
  const urls = new Set<string>();
  for (const word of words || []) {
    if (word?.audioUrl && /^https?:\/\//i.test(word.audioUrl)) urls.add(word.audioUrl);
    for (const file of word?.audioFiles ?? []) {
      if (file?.url && /^https?:\/\//i.test(file.url)) urls.add(file.url);
    }
  }
  return [...urls];
}

/** Warm the cache for the words of a page: each word's default file as its clip, its voice files by URL. */
export function preloadWordAudio(words: Array<{
  text: string;
  audioUrl?: string | null;
  audioFiles?: Array<{ url?: string }>;
}>, language = 'en'): void {
  preloadClipAudio(words.map((word) => ({ ref: wordClip(word.text, language), url: word.audioUrl })));
  preloadAudio(collectAudioUrls(words.map(({ audioFiles }) => ({ audioFiles }))));
}

export function preloadAudio(urls: string[]): void {
  audioAssets.preload(urls);
}

export async function preloadAudioTracked(
  urls: Iterable<string>,
  onSettled: (url: string, ready: boolean) => void,
): Promise<void> {
  const queue = [...new Set(urls)].filter((url) => /^https?:\/\//i.test(url));
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < queue.length) {
      const url = queue[cursor];
      cursor += 1;
      try {
        const localUrl = await audioAssets.ensure(url);
        onSettled(url, !!localUrl);
      } catch {
        onSettled(url, false);
      }
    }
  };
  const workers = Array.from(
    { length: Math.min(AUDIO_PRELOAD_CONCURRENCY, queue.length) },
    () => worker(),
  );
  await Promise.all(workers);
}

/**
 * Route-scoped gate for wordnew's background audio fetching. WfNewApp pauses
 * the cache on unmount (route left) and resumes on mount — the queue/resolved
 * state is preserved, only NEW fetches wait. Guarantees wordnew network
 * activity never continues under another end's route.
 */
export function setAudioCachePaused(paused: boolean): void {
  audioAssets.setPaused(paused);
}

export function preloadAudioFromPayload(payload: unknown): void {
  audioAssets.preloadPayload(payload);
}

export async function audioCacheStats(): Promise<{ files: number; bytes: number; budgetBytes: number }> {
  return audioAssets.stats();
}

export function clearAudioCache(): Promise<void> {
  return audioAssets.clear();
}
