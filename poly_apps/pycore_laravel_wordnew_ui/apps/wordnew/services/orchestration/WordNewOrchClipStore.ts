/**
 * Permanent device store of orchestration clips (word / sentence audio).
 *
 * Clips are named by their shared identity (pycore resource id, see
 * shared/orchestration/orchClipIdentity) under `orch-clips/` of a storage root:
 *   internal         app data on internal storage (official Filesystem plugin,
 *                    `Directory.Data`): bounded by free space, never purged
 *   app-volume       the app folder of a volume, e.g. an SD card (no permission;
 *                    removed with the app)
 *   public-volume    `WordNew/` on a volume root (all-files access; survives
 *                    reinstalls and is visible to other apps)
 * The web keeps clips in OPFS (persistent-storage grant requested). Nothing is
 * evicted by a budget. The index (Directory.Data) holds each clip's identity,
 * origin, meaning and duration, so compositions resolve and render offline and
 * the cache page lists words and sentences.
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
const PUBLIC_FOLDER = 'WordNew';
const CLIP_MIME = 'audio/mpeg';
const INDEX_SAVE_DELAY_MS = 1_500;

export type OrchClipRootKind = 'internal' | 'app-volume' | 'public-volume' | 'browser';

export interface OrchClipRoot {
  kind: OrchClipRootKind;
  /** Volume id (DeviceStorage) of a volume root; '' for internal / browser. */
  volumeId: string;
  /** Absolute folder that holds `orch-clips/` (native); '' on the web. */
  path: string;
}

export interface OrchClipRootOption extends OrchClipRoot {
  volume: CapStorageVolume | null;
  /** Public folders need all-files access. */
  needsAccess: boolean;
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

const BROWSER_ROOT: OrchClipRoot = { kind: 'browser', volumeId: '', path: '' };

function fileUriPath(uri: string): string {
  return uri.startsWith('file://') ? decodeURI(uri.slice('file://'.length)) : uri;
}

class WordNewOrchClipStore implements OrchDurationMemory {
  private readonly index = new CapJsonStore<OrchClipIndexDocument>(
    INDEX_PATH, { version: 2, entries: {}, durations: {} }, Directory.Data,
  );
  private readonly urls = new Map<string, string>();
  private entries: Record<string, OrchClipIndexEntry> | null = null;
  private durations: Record<string, number> = {};
  private loading: Promise<Record<string, OrchClipIndexEntry>> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> = Promise.resolve();
  private activeRoot: OrchClipRoot | null = null;
  private blobs: CapBlobStore | null = null;

  // -- root ----------------------------------------------------------------- #

  private async internalRoot(): Promise<OrchClipRoot> {
    return { kind: 'internal', volumeId: '', path: fileUriPath(await capFs.getUri('', Directory.Data)).replace(/\/+$/, '') };
  }

  /** The configured root (the internal root until one is chosen). */
  async root(): Promise<OrchClipRoot> {
    if (this.activeRoot) return this.activeRoot;
    if (!isNativeAppShell()) {
      this.activeRoot = BROWSER_ROOT;
      return this.activeRoot;
    }
    const stored = StorageManager.get<OrchClipRoot | null>(StorageKeys.WORDNEW_ORCH_CLIP_ROOT, null);
    this.activeRoot = stored?.path ? stored : await this.internalRoot();
    return this.activeRoot;
  }

  private async store(): Promise<CapBlobStore> {
    if (this.blobs) return this.blobs;
    const root = await this.root();
    this.blobs = root.kind === 'browser'
      ? new CapBlobStore(ORCH_CLIP_DIR, Directory.Data)
      : new CapBlobStore(`${root.path}/${ORCH_CLIP_DIR}`, null);
    return this.blobs;
  }

  /** Every root this device offers: internal, and per volume its app folder and public folder. */
  async rootOptions(): Promise<OrchClipRootOption[]> {
    if (!isNativeAppShell()) return [{ ...BROWSER_ROOT, volume: (await capDeviceStorage.volumes()).volumes[0] ?? null, needsAccess: false }];
    const { volumes } = await capDeviceStorage.volumes();
    const options: OrchClipRootOption[] = [];
    for (const volume of volumes) {
      if (volume.kind === 'internal') {
        options.push({ ...(await this.internalRoot()), volume, needsAccess: false });
        continue;
      }
      options.push({ kind: 'app-volume', volumeId: volume.id, path: volume.appPath, volume, needsAccess: false });
      options.push({ kind: 'public-volume', volumeId: volume.id, path: `${volume.rootPath}/${PUBLIC_FOLDER}`, volume, needsAccess: true });
    }
    return options;
  }

  /**
   * Move every clip to another root, then use it. Copies file by file (volumes
   * differ), deletes the old copy only after the new one exists.
   */
  async relocate(target: OrchClipRoot, onProgress?: (done: number, total: number) => void): Promise<void> {
    const current = await this.root();
    if (current.kind === 'browser' || target.path === current.path) return;
    const entries = await this.load();
    const keys = Object.keys(entries);
    const from = `${current.path}/${ORCH_CLIP_DIR}`;
    const to = `${target.path}/${ORCH_CLIP_DIR}`;
    await capFs.ensureDir(to, null);
    let done = 0;
    for (const key of keys) {
      const name = `${key}${ORCH_CLIP_EXTENSION}`;
      if (await capFs.exists(`${from}/${name}`, null)) {
        await capFs.copy(`${from}/${name}`, `${to}/${name}`, null);
        await capFs.delete(`${from}/${name}`, null);
      }
      done += 1;
      onProgress?.(done, keys.length);
    }
    StorageManager.set(StorageKeys.WORDNEW_ORCH_CLIP_ROOT, { kind: target.kind, volumeId: target.volumeId, path: target.path });
    this.activeRoot = { kind: target.kind, volumeId: target.volumeId, path: target.path };
    this.blobs = null;
    this.urls.clear();
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

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      const entries = this.entries ?? {};
      const durations = this.durations;
      this.saving = this.saving
        .catch(() => undefined)
        .then(() => this.index.save({ version: 2, entries, durations }));
    }, INDEX_SAVE_DELAY_MS);
  }

  async entry(key: string): Promise<OrchClipIndexEntry | null> {
    return (await this.load())[key] ?? null;
  }

  // -- clips ---------------------------------------------------------------- #

  /** Playable URL of a stored clip, or null when the device does not hold it. */
  async url(key: string): Promise<string | null> {
    const cached = this.urls.get(key);
    if (cached) return cached;
    const entries = await this.load();
    const blobs = await this.store();
    if (!entries[key] || !(await blobs.has(`${key}${ORCH_CLIP_EXTENSION}`))) return null;
    const url = await blobs.getServableUrl(`${key}${ORCH_CLIP_EXTENSION}`, CLIP_MIME);
    if (url) this.urls.set(key, url);
    return url;
  }

  async putBlob(identity: OrchClipIdentity, blob: Blob, origin: OrchClipIndexEntry['origin'], meaning: string): Promise<string | null> {
    await (await this.store()).putBlob(`${identity.resourceId}${ORCH_CLIP_EXTENSION}`, blob);
    return this.remember(identity, origin, blob.size, meaning);
  }

  /** Native: streamed to disk by the Filesystem plugin (no JS memory). */
  async putFromUrl(identity: OrchClipIdentity, remoteUrl: string, meaning: string): Promise<string | null> {
    const blobs = await this.store();
    const name = `${identity.resourceId}${ORCH_CLIP_EXTENSION}`;
    await blobs.putFromUrl(name, remoteUrl, { force: true });
    return this.remember(identity, 'laravel', await blobs.size(name), meaning);
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
  ): Promise<string | null> {
    const entries = await this.load();
    entries[identity.resourceId] = { ...identity, origin, bytes, meaning, storedAt: Date.now() };
    this.scheduleSave();
    this.urls.delete(identity.resourceId);
    return this.url(identity.resourceId);
  }

  async remove(keys: string[]): Promise<void> {
    const entries = await this.load();
    const blobs = await this.store();
    for (const key of keys) {
      await blobs.delete(`${key}${ORCH_CLIP_EXTENSION}`);
      delete entries[key];
      delete this.durations[key];
      const url = this.urls.get(key);
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      this.urls.delete(key);
    }
    this.scheduleSave();
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
    const root = await this.root();
    return { ...shared, device: { path: root.path ? `${root.path}/${shared.store.path}` : shared.store.path } };
  }
}

export const wordNewOrchClipStore = new WordNewOrchClipStore();
