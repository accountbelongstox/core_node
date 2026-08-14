import { Capacitor } from '@capacitor/core';
import {
  CapResourceAssetCache,
  getStorageEstimate,
  requestPersistentStorage,
} from '@/apps/wordnew/platform/capabilities';
import { wfNewEndpoints } from '../api/WfNewEndpoints';

export const MAX_AUDIO_CACHE_BYTES = 20 * 1024 ** 3;

const MIN_WEB_AUDIO_CACHE_BYTES = 64 * 1024 ** 2;
const WEB_FALLBACK_CACHE_BYTES = 2 * 1024 ** 3;
const WEB_QUOTA_SHARE = 0.5;
const AUDIO_PRELOAD_CONCURRENCY = 4;

async function resolveCacheBudget(): Promise<number> {
  if (Capacitor.isNativePlatform()) return MAX_AUDIO_CACHE_BYTES;
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

const audioAssets = new CapResourceAssetCache({
  dir: 'wfnew-audio',
  budget: resolveCacheBudget,
  extractUrls: payloadAudioUrls,
  mimeFor: audioMime,
  concurrency: AUDIO_PRELOAD_CONCURRENCY,
});

export function ensureAudio(url: string): Promise<string | null> {
  return audioAssets.ensure(url);
}

export function resolveAudioSync(url: string | undefined | null): string | undefined {
  return audioAssets.resolveSync(url);
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
