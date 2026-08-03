import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import {
  CapResourceAssetCache,
  getStorageEstimate,
  requestPersistentStorage,
} from '@/shared/capabilities';
import { wfNewEndpoints } from '../api/WfNewEndpoints';

export const MAX_AUDIO_CACHE_BYTES = 20 * 1024 ** 3;
export const MIN_NATIVE_AUDIO_CACHE_BYTES = MAX_AUDIO_CACHE_BYTES;

const MAX_NATIVE_AUDIO_CACHE_BYTES = 100 * 1024 ** 3;
const WEB_FALLBACK_CACHE_BYTES = 2 * 1024 ** 3;

async function resolveCacheBudget(): Promise<number> {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await Device.getInfo() as Awaited<ReturnType<typeof Device.getInfo>> & {
        diskFree?: number;
        diskTotal?: number;
      };
      const free = Number(info.diskFree ?? 0);
      const total = Number(info.diskTotal ?? 0);
      const capacityTarget = Math.max(free * 0.8, total * 0.25);
      return Math.max(MIN_NATIVE_AUDIO_CACHE_BYTES, Math.min(MAX_NATIVE_AUDIO_CACHE_BYTES, capacityTarget));
    } catch {
      return MIN_NATIVE_AUDIO_CACHE_BYTES;
    }
  }
  await requestPersistentStorage().catch(() => false);
  const estimate = await getStorageEstimate();
  return estimate.quotaBytes > 0
    ? Math.max(64 * 1024 ** 2, Math.floor(estimate.quotaBytes * 0.98))
    : WEB_FALLBACK_CACHE_BYTES;
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
  concurrency: 4,
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
