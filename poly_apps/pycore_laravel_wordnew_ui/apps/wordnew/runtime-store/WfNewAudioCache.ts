/**
 * The clip API of the device static library (runtime-store/WfNewStaticCache) for every audio caller outside a
 * composition run. A caller that knows what it plays (kind, language, text) names the clip; one order everywhere:
 * the device store first (a held clip is never requested again, R14), then the schedule's transfer stages
 * (WordNewClipResolver), then the file its payload named. Other audio (voice / accent variants, article audio) is
 * a static file by URL.
 */
import {
  orchClipIdentityOfUrl,
  orchClipRefIdentity,
  orchClipRefUsable,
  type OrchClipRef,
} from '../../../shared/orchestration/orchClipIdentity';
import { wordNewOrchClipStore } from '../services/orchestration/WordNewOrchClipStore';
import type { WordNewClipFetchOptions } from '../services/orchestration/WordNewClipResolver';
import {
  ensureStatic,
  noteStaticClip,
  preloadStatic,
  resolveStaticSync,
} from './WfNewStaticCache';

export type { WordNewClipFetchOptions };
export type WordNewClipRef = OrchClipRef;

const AUDIO_PRELOAD_CONCURRENCY = 4;
const REMOTE_URL_RE = /^https?:\/\//i;

/**
 * The clip loader is reached on first use: it reaches the schedule (WORDNEW_ORCH_SCHEDULE), which reaches the API
 * layer, which reaches this cache. Callers and this cache only meet it at call time.
 */
const loadClipResolver = async () => (await import('../services/orchestration/WordNewClipResolver')).wordNewClipResolver;

/** Playable URLs of clips resolved by identity (store URLs, page object URLs). */
const clipPlayableUrls = new Map<string, string>();

wordNewOrchClipStore.onRootChanged(() => clipPlayableUrls.clear());
wordNewOrchClipStore.onRemoved(() => clipPlayableUrls.clear());

export const wordClip = (text: string, language = 'en'): WordNewClipRef => ({ kind: 'word', language, text });

export const sentenceClip = (text: string, language = 'en'): WordNewClipRef => ({ kind: 'sentence', language, text });

const remoteOf = (url: string | null | undefined): string | null => (url && REMOTE_URL_RE.test(url) ? url : null);

/**
 * A caller that knows what a URL is (kind, language, text) says so: from then on the static library keeps that file
 * as the orchestration clip of that identity - one name (the resource id), one store, shared with every composition.
 * Only the default file of a clip is noted: accent / voice variants are other audio and stay on their path keys.
 */
export function noteAudioClip(ref: WordNewClipRef, url: string | null | undefined): void {
  const remote = remoteOf(url);
  if (remote && orchClipRefUsable(ref)) noteStaticClip(remote, orchClipRefIdentity(ref));
}

/** The URL is the default file of this clip (a Laravel sentence / phrase file proves it); a voice / accent variant file is other audio. */
export function clipOwnsUrl(ref: WordNewClipRef, url: string | null | undefined): boolean {
  if (!url || !orchClipRefUsable(ref)) return false;
  const proven = orchClipIdentityOfUrl(url);
  return !!proven && proven.resourceId === orchClipRefIdentity(ref).resourceId;
}

/** A static audio file by URL (variants, article audio; a clip URL is still resolved as its clip). */
export function ensureAudio(url: string): Promise<string | null> {
  return ensureStatic(url, 'audio');
}

export function resolveAudioSync(url: string | undefined | null): string | undefined {
  return resolveStaticSync(url, 'audio');
}

function withTimeout<T>(work: Promise<T | null>, timeoutMs: number | undefined): Promise<T | null> {
  if (!timeoutMs) return work;
  return Promise.race([work, new Promise<null>((resolve) => { setTimeout(() => resolve(null), timeoutMs); })]);
}

/**
 * The clip-first entry for every caller that knows what it plays (kind, language, text; `url` = the file its payload
 * named, if any): the device store (a held clip is never requested again, R14), then the schedule's transfer stages
 * (pycore direct, Laravel, relay; WordNewClipResolver), then - for a clip the payload named - the file at its URL.
 * Resolves to a playable URL, or null when nothing has the clip within `timeoutMs` (the caller then asks the queue
 * to generate it and falls back to its next tier, e.g. browser speech). The fetch goes on after a timeout.
 */
export async function ensureClipAudio(
  ref: WordNewClipRef,
  url?: string | null,
  options: WordNewClipFetchOptions = {},
): Promise<string | null> {
  const remote = remoteOf(url);
  if (!orchClipRefUsable(ref)) return remote ? withTimeout(ensureAudio(remote), options.timeoutMs) : null;
  noteAudioClip(ref, remote);
  const id = orchClipRefIdentity(ref).resourceId;
  const memo = clipPlayableUrls.get(id);
  if (memo) return memo;
  const work = (async () => {
    const local = remote ? await ensureAudio(remote) : await (await loadClipResolver()).fetch(ref, null, { force: options.force });
    if (local) clipPlayableUrls.set(id, local);
    return local;
  })();
  return withTimeout(work, options.timeoutMs);
}

/**
 * The playable URL to hand to an audio element right now (synchronous callers only): the clip's local copy when this
 * session resolved it; otherwise the payload URL while the clip is resolved in the background for the next play;
 * undefined when there is neither. Interactive plays use `awaitPlayableClip` (device store first).
 */
export function playableClip(ref: WordNewClipRef, url?: string | null): string | undefined {
  const remote = remoteOf(url);
  if (!orchClipRefUsable(ref)) return remote ? resolveAudioSync(remote) : undefined;
  const memo = clipPlayableUrls.get(orchClipRefIdentity(ref).resourceId);
  if (memo) return memo;
  void ensureClipAudio(ref, remote).catch(() => null);
  return remote ?? undefined;
}

/**
 * What an interactive play (a speaker button, a list player) hands to an audio element: the clip from the device
 * store or the schedule's transfers within `waitMs`; when that does not answer in time, the file the payload named
 * (the clip keeps resolving for the next play); null when the caller should fall to its next tier (browser speech)
 * and ask the queue to generate the clip.
 */
export async function awaitPlayableClip(ref: WordNewClipRef, url: string | null | undefined, waitMs: number): Promise<string | null> {
  const remote = remoteOf(url);
  if (!orchClipRefUsable(ref)) return remote ? (await withTimeout(ensureAudio(remote), waitMs)) ?? remote : null;
  return (await ensureClipAudio(ref, remote, { timeoutMs: waitMs })) ?? remote;
}

/** The playable URLs of the clips the device already holds, by index into `refs` (no network). */
export async function heldClipAudio(refs: readonly WordNewClipRef[]): Promise<Map<number, string>> {
  const found = new Map<number, string>();
  const unknown: Array<{ index: number; ref: WordNewClipRef }> = [];
  refs.forEach((ref, index) => {
    if (!orchClipRefUsable(ref)) return;
    const memo = clipPlayableUrls.get(orchClipRefIdentity(ref).resourceId);
    if (memo) found.set(index, memo);
    else unknown.push({ index, ref });
  });
  if (unknown.length === 0) return found;
  const held = await (await loadClipResolver()).heldMany(unknown.map(({ ref }) => ref));
  held.forEach((url, position) => {
    const { index, ref } = unknown[position];
    clipPlayableUrls.set(orchClipRefIdentity(ref).resourceId, url);
    found.set(index, url);
  });
  return found;
}

export interface WordNewClipAudioItem {
  ref: WordNewClipRef;
  /** The file the payload named for this clip (absent: the clip is looked up by identity only). */
  url?: string | null;
}

/** Warm the library for clips (payload URLs with their identity noted; no blind lookups). */
export function preloadClipAudio(items: Iterable<WordNewClipAudioItem>): void {
  const urls: string[] = [];
  for (const { ref, url } of items) {
    const remote = remoteOf(url);
    if (!remote) continue;
    noteAudioClip(ref, remote);
    urls.push(remote);
  }
  preloadStatic(urls, 'audio');
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
    const primary = remoteOf(word?.audioUrl);
    if (primary) urls.add(primary);
    for (const file of word?.audioFiles ?? []) {
      const variant = remoteOf(file?.url);
      if (variant) urls.add(variant);
    }
  }
  return [...urls];
}

/** Warm the library for the words of a page: each word's default file as its clip, its voice files by URL. */
export function preloadWordAudio(words: Array<{
  text: string;
  audioUrl?: string | null;
  audioFiles?: Array<{ url?: string }>;
}>, language = 'en'): void {
  preloadClipAudio(words.map((word) => ({ ref: wordClip(word.text, language), url: word.audioUrl })));
  preloadAudio(collectAudioUrls(words.map(({ audioFiles }) => ({ audioFiles }))));
}

export function preloadAudio(urls: string[]): void {
  preloadStatic(urls, 'audio');
}
