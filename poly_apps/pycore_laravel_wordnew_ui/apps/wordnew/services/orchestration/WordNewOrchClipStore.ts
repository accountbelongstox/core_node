/**
 * Permanent device store of orchestration clips (word / sentence audio).
 *
 * Native: `Directory.Data` through the official @capacitor/filesystem plugin -
 * app data on internal storage, bounded only by free space, never purged by
 * the OS and never evicted by a budget. Web: OPFS with a persistent-storage
 * grant request. An index document keeps origin and word meaning per key so a
 * composition resolves and renders offline.
 */
import {
  CapBlobStore,
  CapJsonStore,
  Directory,
  requestPersistentStorage,
} from '../../platform/capabilities';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import type { OrchClipOrigin } from './orchComposeTypes';

const CLIP_DIR = 'wfnew-orch-clips';
const INDEX_PATH = 'wfnew-orch/clip_index.json';
const CLIP_MIME = 'audio/mpeg';
const INDEX_SAVE_DELAY_MS = 1_500;

export interface OrchClipIndexEntry {
  origin: Exclude<OrchClipOrigin, 'device'>;
  bytes: number;
  meaning: string;
  storedAt: number;
}

interface OrchClipIndexDocument {
  version: 1;
  entries: Record<string, OrchClipIndexEntry>;
  /** Probed clip durations (ms), also for web clips played from their URL. */
  durations: Record<string, number>;
}

class WordNewOrchClipStore {
  private readonly blobs = new CapBlobStore(CLIP_DIR, Directory.Data);
  private readonly index = new CapJsonStore<OrchClipIndexDocument>(INDEX_PATH, { version: 1, entries: {}, durations: {} }, Directory.Data);
  private readonly urls = new Map<string, string>();
  private entries: Record<string, OrchClipIndexEntry> | null = null;
  private durations: Record<string, number> = {};
  private loading: Promise<Record<string, OrchClipIndexEntry>> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> = Promise.resolve();

  private load(): Promise<Record<string, OrchClipIndexEntry>> {
    if (this.entries) return Promise.resolve(this.entries);
    this.loading ??= (async () => {
      if (!isNativeAppShell()) await requestPersistentStorage().catch(() => false);
      const document = await this.index.load();
      this.entries = { ...document.entries };
      this.durations = { ...(document.durations ?? {}) };
      return this.entries;
    })();
    return this.loading;
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      const entries = this.entries ?? {};
      const durations = this.durations;
      this.saving = this.saving
        .catch(() => undefined)
        .then(() => this.index.save({ version: 1, entries, durations }));
    }, INDEX_SAVE_DELAY_MS);
  }

  async entry(key: string): Promise<OrchClipIndexEntry | null> {
    return (await this.load())[key] ?? null;
  }

  /** Playable URL of a stored clip, or null when the device does not hold it. */
  async url(key: string): Promise<string | null> {
    const cached = this.urls.get(key);
    if (cached) return cached;
    const entries = await this.load();
    if (!entries[key] || !(await this.blobs.has(key))) return null;
    const url = await this.blobs.getServableUrl(key, CLIP_MIME);
    if (url) this.urls.set(key, url);
    return url;
  }

  async putBlob(key: string, blob: Blob, origin: OrchClipIndexEntry['origin'], meaning: string): Promise<string | null> {
    await this.blobs.putBlob(key, blob);
    return this.remember(key, origin, blob.size, meaning);
  }

  /** Native: streamed to disk by the Filesystem plugin (no JS memory). */
  async putFromUrl(key: string, remoteUrl: string, meaning: string): Promise<string | null> {
    await this.blobs.putFromUrl(key, remoteUrl, { force: true });
    return this.remember(key, 'laravel', await this.blobs.size(key), meaning);
  }

  async durationMs(key: string): Promise<number> {
    await this.load();
    return this.durations[key] ?? 0;
  }

  async setDuration(key: string, durationMs: number): Promise<void> {
    await this.load();
    if (!(durationMs > 0) || this.durations[key] === durationMs) return;
    this.durations[key] = Math.round(durationMs);
    this.scheduleSave();
  }

  /** A meaning learned later (e.g. from Laravel) is kept with the clip. */
  async setMeaning(key: string, meaning: string): Promise<void> {
    const entries = await this.load();
    if (!meaning || !entries[key] || entries[key].meaning === meaning) return;
    entries[key] = { ...entries[key], meaning };
    this.scheduleSave();
  }

  private async remember(
    key: string,
    origin: OrchClipIndexEntry['origin'],
    bytes: number,
    meaning: string,
  ): Promise<string | null> {
    const entries = await this.load();
    entries[key] = { origin, bytes, meaning, storedAt: Date.now() };
    this.scheduleSave();
    this.urls.delete(key);
    return this.url(key);
  }

  async stats(): Promise<{ clips: number; bytes: number }> {
    const values = Object.values(await this.load());
    return { clips: values.length, bytes: values.reduce((total, entry) => total + entry.bytes, 0) };
  }
}

export const wordNewOrchClipStore = new WordNewOrchClipStore();
