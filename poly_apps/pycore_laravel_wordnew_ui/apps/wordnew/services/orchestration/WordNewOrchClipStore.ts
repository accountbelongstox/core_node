/**
 * Permanent device store of orchestration clips (word / sentence audio).
 *
 * Clips are named by their shared identity (pycore resource id, see
 * shared/orchestration/orchClipIdentity) under `orch-clips/` of a storage root:
 *   internal         app data on internal storage (official Filesystem plugin,
 *                    `Directory.Data`): bounded by free space, never purged
 *   app-volume       the app folder of a volume, e.g. an SD card (the
 *                    Filesystem storage permission on Android 12 and older;
 *                    removed with the app)
 *   public-volume    `WordNew/` on a volume root (all-files access; kept after
 *                    a reinstall - its index is mirrored next to the clips and
 *                    adopted again by `adoptPublicRoots`)
 * The web keeps clips in OPFS (persistent-storage grant requested). Nothing is
 * evicted by a budget. The index holds each clip's identity, origin, meaning
 * and duration, so compositions resolve and render offline and the cache page
 * lists words and sentences.
 *
 * Writes, removals and relocation run one at a time (`exclusive`), so a move
 * never misses a clip that a running composition writes.
 */
import { StorageManager } from '../../../../core/persistence';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import {
  ORCH_CLIP_DIR,
  ORCH_CLIP_EXTENSION,
  orchClipLocations,
  type OrchClipIdentity,
  type OrchClipLocations,
} from '../../../../shared/orchestration/orchClipIdentity';
import type { OrchDurationMemory } from '../../../../shared/orchestration/orchComposer';
import type { OrchClipOrigin } from '../../../../shared/orchestration/orchTypes';
import {
  CapBlobStore,
  CapJsonStore,
  Directory,
  capDeviceStorage,
  capFs,
  requestPersistentStorage,
  type CapStorageVolume,
} from '../../platform/capabilities';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';

const INDEX_PATH = 'wfnew-orch/clip_index_v2.json';
/** Index copy kept next to the clips of a public root (survives a reinstall). */
const ROOT_INDEX_NAME = 'index.json';
const PUBLIC_FOLDER = 'WordNew';
const CLIP_MIME = 'audio/mpeg';
const INDEX_SAVE_DELAY_MS = 1_500;

export type OrchClipRootKind = 'internal' | 'app-volume' | 'public-volume' | 'browser';
/** What a root needs before use: nothing, the Filesystem storage permission, or all-files access. */
export type OrchClipRootAccess = 'none' | 'storage' | 'all-files';

export interface OrchClipRoot {
  kind: OrchClipRootKind;
  /** Volume id (DeviceStorage) of a volume root; '' for internal / browser. */
  volumeId: string;
  /** Absolute folder that holds `orch-clips/` (volume roots); '' for internal / browser. */
  path: string;
}

export interface OrchClipRootOption extends OrchClipRoot {
  volume: CapStorageVolume | null;
  access: OrchClipRootAccess;
}

export interface OrchClipIndexEntry extends OrchClipIdentity {
  origin: Exclude<OrchClipOrigin, 'device'>;
  bytes: number;
  meaning: string;
  storedAt: number;
}

export interface OrchClipQuery {
  kind?: OrchClipIdentity['kind'] | null;
  text?: string;
  offset?: number;
  limit?: number;
}

export interface OrchClipPage {
  items: OrchClipIndexEntry[];
  total: number;
}

export interface OrchClipStats {
  clips: number;
  words: number;
  sentences: number;
  bytes: number;
}

export interface OrchClipDeviceLocations extends OrchClipLocations {
  /** Absolute file on this device (native) or the OPFS path (web). */
  device: { path: string };
}

interface OrchClipIndexDocument {
  version: 2;
  entries: Record<string, OrchClipIndexEntry>;
  /** Probed clip durations (ms), also for web clips played from their URL. */
  durations: Record<string, number>;
}

const INTERNAL_ROOT: OrchClipRoot = { kind: 'internal', volumeId: '', path: '' };
const BROWSER_ROOT: OrchClipRoot = { kind: 'browser', volumeId: '', path: '' };
const EMPTY_INDEX: OrchClipIndexDocument = { version: 2, entries: {}, durations: {} };

const clipName = (key: string): string => `${key}${ORCH_CLIP_EXTENSION}`;

function fileUriPath(uri: string): string {
  return uri.startsWith('file://') ? decodeURI(uri.slice('file://'.length)) : uri;
}

function sameRoot(left: OrchClipRoot, right: OrchClipRoot): boolean {
  return left.kind === right.kind && left.path === right.path;
}

function blobStoreFor(root: OrchClipRoot): CapBlobStore {
  return root.path
    ? new CapBlobStore(`${root.path}/${ORCH_CLIP_DIR}`, null)
    : new CapBlobStore(ORCH_CLIP_DIR, Directory.Data);
}

class WordNewOrchClipStore implements OrchDurationMemory {
  private readonly index = new CapJsonStore<OrchClipIndexDocument>(INDEX_PATH, EMPTY_INDEX, Directory.Data);
  private readonly urls = new Map<string, string>();
  private readonly rootListeners = new Set<() => void>();
  private entries: Record<string, OrchClipIndexEntry> | null = null;
  private durations: Record<string, number> = {};
  private loading: Promise<Record<string, OrchClipIndexEntry>> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> = Promise.resolve();
  private activeRoot: OrchClipRoot | null = null;
  private blobs: CapBlobStore | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  /** Run store mutations one at a time. */
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.catch(() => undefined).then(work);
    this.queue = run;
    return run;
  }

  // -- root ----------------------------------------------------------------- #

  /** The configured root (internal until one is chosen; OPFS on the web). */
  async root(): Promise<OrchClipRoot> {
    if (this.activeRoot) return this.activeRoot;
    if (!isNativeAppShell()) {
      this.activeRoot = BROWSER_ROOT;
      return this.activeRoot;
    }
    const stored = StorageManager.get<OrchClipRoot | null>(StorageKeys.WORDNEW_ORCH_CLIP_ROOT, null);
    this.activeRoot = stored?.path && stored.kind !== 'internal' ? stored : INTERNAL_ROOT;
    return this.activeRoot;
  }

  /** Absolute folder of a root, for display and FileProvider hand-off. */
  async rootPath(root: OrchClipRoot): Promise<string> {
    if (root.path) return root.path;
    if (root.kind === 'browser') return '';
    return fileUriPath(await capFs.getUri('', Directory.Data)).replace(/\/+$/, '');
  }

  private async store(): Promise<CapBlobStore> {
    if (this.blobs) return this.blobs;
    const root = await this.root();
    if (root.path) await capDeviceStorage.ensureFilesystemAccess();
    this.blobs = blobStoreFor(root);
    return this.blobs;
  }

  /** Called after the root changed (playable URLs of the old root are invalid). */
  onRootChanged(listener: () => void): () => void {
    this.rootListeners.add(listener);
    return () => { this.rootListeners.delete(listener); };
  }

  /** Every root this device offers: internal, and per volume its app folder and public folder. */
  async rootOptions(): Promise<OrchClipRootOption[]> {
    const { volumes } = await capDeviceStorage.volumes();
    if (!isNativeAppShell()) return [{ ...BROWSER_ROOT, volume: volumes[0] ?? null, access: 'none' }];
    return volumes.flatMap((volume): OrchClipRootOption[] => (volume.kind === 'internal'
      ? [{ ...INTERNAL_ROOT, volume, access: 'none' }]
      : [
        { kind: 'app-volume', volumeId: volume.id, path: volume.appPath, volume, access: 'storage' },
        { kind: 'public-volume', volumeId: volume.id, path: `${volume.rootPath}/${PUBLIC_FOLDER}`, volume, access: 'all-files' },
      ]));
  }

  /**
   * Move every clip to another root: copy all, switch, then delete the old
   * copies. A failed copy removes the partial copies and keeps the old root.
   */
  relocate(target: OrchClipRoot, onProgress?: (done: number, total: number) => void): Promise<void> {
    return this.exclusive(async () => {
      const current = await this.root();
      if (current.kind === 'browser' || sameRoot(current, target)) return;
      if (target.path && !(await capDeviceStorage.ensureFilesystemAccess())) throw new Error('ORCH_CLIP_ROOT_ACCESS_DENIED');
      const source = await this.store();
      const destination = blobStoreFor(target);
      const keys = Object.keys(await this.load());
      const copied: string[] = [];
      let done = 0;
      try {
        for (const key of keys) {
          const blob = await source.getBlob(clipName(key));
          if (blob) {
            await destination.putBlob(clipName(key), blob);
            copied.push(key);
          }
          done += 1;
          onProgress?.(done, keys.length * 2);
        }
      } catch (error) {
        for (const key of copied) await destination.delete(clipName(key));
        throw error;
      }
      const next: OrchClipRoot = { kind: target.kind, volumeId: target.volumeId, path: target.path };
      if (next.kind === 'internal') StorageManager.remove(StorageKeys.WORDNEW_ORCH_CLIP_ROOT);
      else StorageManager.set(StorageKeys.WORDNEW_ORCH_CLIP_ROOT, next);
      this.activeRoot = next;
      this.blobs = destination;
      this.revokeUrls();
      await this.saveNow();
      this.rootListeners.forEach((listener) => listener());
      for (const key of copied) {
        await source.delete(clipName(key));
        done += 1;
        onProgress?.(done, keys.length * 2);
      }
    });
  }

  /**
   * After a reinstall: find public roots that hold a mirrored index and take
   * them over (index merged, root selected). Needs all-files access.
   */
  adoptPublicRoots(): Promise<number> {
    return this.exclusive(async () => {
      if (!isNativeAppShell()) return 0;
      const entries = await this.load();
      let adopted = 0;
      for (const option of await this.rootOptions()) {
        if (option.kind !== 'public-volume') continue;
        const mirror = await capFs.readJson<OrchClipIndexDocument>(`${option.path}/${ORCH_CLIP_DIR}/${ROOT_INDEX_NAME}`, null, null);
        if (!mirror?.entries) continue;
        Object.entries(mirror.entries).forEach(([key, entry]) => {
          if (!entries[key]) {
            entries[key] = entry;
            adopted += 1;
          }
        });
        Object.assign(this.durations, mirror.durations ?? {});
        if ((await this.root()).kind === 'internal' && Object.keys(entries).length === adopted) {
          const next: OrchClipRoot = { kind: 'public-volume', volumeId: option.volumeId, path: option.path };
          StorageManager.set(StorageKeys.WORDNEW_ORCH_CLIP_ROOT, next);
          this.activeRoot = next;
          this.blobs = null;
          this.revokeUrls();
          this.rootListeners.forEach((listener) => listener());
        }
      }
      if (adopted > 0) await this.saveNow();
      return adopted;
    });
  }

  // -- index ---------------------------------------------------------------- #

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

  private document(): OrchClipIndexDocument {
    return { version: 2, entries: this.entries ?? {}, durations: this.durations };
  }

  private async writeIndex(document: OrchClipIndexDocument): Promise<void> {
    await this.index.save(document);
    const root = await this.root();
    if (root.kind === 'public-volume') {
      await capFs.writeJson(`${root.path}/${ORCH_CLIP_DIR}/${ROOT_INDEX_NAME}`, document, null).catch(() => '');
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      const document = this.document();
      this.saving = this.saving.catch(() => undefined).then(() => this.writeIndex(document));
    }, INDEX_SAVE_DELAY_MS);
  }

  private async saveNow(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const document = this.document();
    this.saving = this.saving.catch(() => undefined).then(() => this.writeIndex(document));
    await this.saving;
  }

  async entry(key: string): Promise<OrchClipIndexEntry | null> {
    return (await this.load())[key] ?? null;
  }

  // -- clips ---------------------------------------------------------------- #

  private revokeUrls(): void {
    this.urls.forEach((url) => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); });
    this.urls.clear();
  }

  /** Playable URL of a stored clip, or null when the device does not hold it. */
  async url(key: string): Promise<string | null> {
    const cached = this.urls.get(key);
    if (cached) return cached;
    const entries = await this.load();
    const blobs = await this.store();
    if (!entries[key] || !(await blobs.has(clipName(key)).catch(() => false))) return null;
    const url = await blobs.getServableUrl(clipName(key), CLIP_MIME);
    if (url) this.urls.set(key, url);
    return url;
  }

  putBlob(identity: OrchClipIdentity, blob: Blob, origin: OrchClipIndexEntry['origin'], meaning: string): Promise<string | null> {
    return this.exclusive(async () => {
      await (await this.store()).putBlob(clipName(identity.resourceId), blob);
      await this.remember(identity, origin, blob.size, meaning);
    }).then(() => this.url(identity.resourceId));
  }

  /** Native: downloaded by the Filesystem plugin (streamed, no JS memory for app-private roots). */
  putFromUrl(identity: OrchClipIdentity, remoteUrl: string, meaning: string): Promise<string | null> {
    return this.exclusive(async () => {
      const blobs = await this.store();
      const name = clipName(identity.resourceId);
      await blobs.putFromUrl(name, remoteUrl, { force: true });
      await this.remember(identity, 'laravel', await blobs.size(name), meaning);
    }).then(() => this.url(identity.resourceId));
  }

  /** A meaning learned later (e.g. from Laravel) is kept with the clip. */
  async setMeaning(key: string, meaning: string): Promise<void> {
    const entries = await this.load();
    if (!meaning || !entries[key] || entries[key].meaning === meaning) return;
    entries[key] = { ...entries[key], meaning };
    this.scheduleSave();
  }

  private async remember(
    identity: OrchClipIdentity,
    origin: OrchClipIndexEntry['origin'],
    bytes: number,
    meaning: string,
  ): Promise<void> {
    const entries = await this.load();
    const { kind, language, text, contentId, resourceId } = identity;
    entries[resourceId] = { kind, language, text, contentId, resourceId, origin, bytes, meaning, storedAt: Date.now() };
    this.scheduleSave();
    this.urls.delete(resourceId);
  }

  remove(keys: string[]): Promise<void> {
    return this.exclusive(async () => {
      const entries = await this.load();
      const blobs = await this.store();
      for (const key of keys) {
        await blobs.delete(clipName(key));
        delete entries[key];
        delete this.durations[key];
        const url = this.urls.get(key);
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
        this.urls.delete(key);
      }
      await this.saveNow();
    });
  }

  async clear(): Promise<void> {
    await this.remove(Object.keys(await this.load()));
  }

  // -- durations (OrchDurationMemory) ---------------------------------------- #

  async get(key: string): Promise<number> {
    await this.load();
    return this.durations[key] ?? 0;
  }

  async set(key: string, durationMs: number): Promise<void> {
    await this.load();
    if (!(durationMs > 0) || this.durations[key] === durationMs) return;
    this.durations[key] = Math.round(durationMs);
    this.scheduleSave();
  }

  // -- listing / paths ------------------------------------------------------ #

  async query({ kind = null, text = '', offset = 0, limit = 50 }: OrchClipQuery = {}): Promise<OrchClipPage> {
    const needle = text.trim().toLowerCase();
    const matches = Object.values(await this.load())
      .filter((entry) => (!kind || entry.kind === kind)
        && (!needle || entry.text.toLowerCase().includes(needle) || entry.meaning.toLowerCase().includes(needle)))
      .sort((left, right) => right.storedAt - left.storedAt);
    return { items: matches.slice(offset, offset + limit), total: matches.length };
  }

  async stats(): Promise<OrchClipStats> {
    const values = Object.values(await this.load());
    return {
      clips: values.length,
      words: values.filter((entry) => entry.kind === 'word').length,
      sentences: values.filter((entry) => entry.kind === 'sentence').length,
      bytes: values.reduce((total, entry) => total + entry.bytes, 0),
    };
  }

  /** The clip's paths on pycore, Laravel and this device. */
  async locations(identity: OrchClipIdentity): Promise<OrchClipDeviceLocations> {
    const shared = orchClipLocations(identity);
    const base = await this.rootPath(await this.root());
    return { ...shared, device: { path: base ? `${base}/${shared.store.path}` : shared.store.path } };
  }
}

export const wordNewOrchClipStore = new WordNewOrchClipStore();
