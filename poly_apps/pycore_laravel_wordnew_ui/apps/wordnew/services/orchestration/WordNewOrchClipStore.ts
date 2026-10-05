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
 * The web schedule writes no clips here (WORDNEW_GUIDE 1.1: Laravel URLs and
 * page-lifetime object URLs); on the web only the index (durations) is kept.
 * Nothing is evicted by a budget. The index holds each clip's identity, origin,
 * meaning and duration, so compositions resolve and render offline and the
 * cache page lists words and sentences.
 *
 * Clip writes run in parallel (one per key; a second write of a key joins the
 * first); removals and relocation run alone (`exclusive`) after the writes in
 * flight, so a move never misses a clip that a running composition writes.
 */
import { ChangeSignal } from '../../../../core/events/ChangeSignal';
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
  Directory,
  capDeviceStorage,
  capFs,
  requestPersistentStorage,
  type CapStorageVolume,
} from '../../platform/capabilities';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';

const INDEX_PATH = 'wfnew-orch/clip_index_v2.json';
/** Changes since the index snapshot, one JSON record per line (appended, never rewritten). */
const JOURNAL_PATH = 'wfnew-orch/clip_index_v2.log';
/** Index copy kept next to the clips of a public root (survives a reinstall). */
const ROOT_INDEX_NAME = 'index.json';
const ROOT_JOURNAL_NAME = 'index.log';
/** Journal records after which the snapshot is rewritten and the journal dropped. */
const JOURNAL_COMPACT_RECORDS = 5_000;
const PUBLIC_FOLDER = 'WordNew';
/** Folder of the reader's audio cache (runtime-store/WfNewAudioCache) in app data; its sentence clips live in this store. */
export const READER_AUDIO_DIR = 'wfnew-audio';
const CLIP_MIME = 'audio/mpeg';
const INDEX_SAVE_DELAY_MS = 1_500;
const CHANGE_NOTIFY_MS = 400;

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
  /** Content version the server reported for the stored copy (absent until known); see wordNewClipUpdater. */
  version?: number;
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
  phrases: number;
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

/** One index change: an entry (null = removed) or a duration. */
type OrchClipJournalRecord = { e: string; v: OrchClipIndexEntry | null } | { d: string; v: number };

/** The snapshot with its journal applied (lines that do not parse - a cut-off last write - are skipped). */
function replayJournal(document: OrchClipIndexDocument, journal: string | null): OrchClipIndexDocument {
  const entries = { ...(document.entries ?? {}) };
  const durations = { ...(document.durations ?? {}) };
  (journal ?? '').split('\n').forEach((line) => {
    if (!line) return;
    let record: OrchClipJournalRecord;
    try { record = JSON.parse(line) as OrchClipJournalRecord; } catch { return; }
    if ('e' in record) {
      if (record.v) entries[record.e] = record.v;
      else { delete entries[record.e]; delete durations[record.e]; }
    } else if ('d' in record) {
      durations[record.d] = record.v;
    }
  });
  return { version: 2, entries, durations };
}

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
  /** Journal records not yet appended, and records on disk since the last snapshot. */
  private pending: OrchClipJournalRecord[] = [];
  private journaled = 0;
  private readonly urls = new Map<string, string>();
  private readonly rootChanged = new ChangeSignal();
  private readonly clipsChanged = new ChangeSignal();
  private readonly clipsRemoved = new ChangeSignal();
  private changeTimer: ReturnType<typeof setTimeout> | null = null;
  private entries: Record<string, OrchClipIndexEntry> | null = null;
  private durations: Record<string, number> = {};
  private loading: Promise<Record<string, OrchClipIndexEntry>> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> = Promise.resolve();
  private activeRoot: OrchClipRoot | null = null;
  private blobs: CapBlobStore | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  /** The reader cache folders (app data, and the old app cache folder its files moved from). */
  private readonly readerStores = [new CapBlobStore(READER_AUDIO_DIR, Directory.Data), new CapBlobStore(READER_AUDIO_DIR, Directory.Cache)];
  /** Clip writes in flight, by key (one write per clip at a time). */
  private readonly writes = new Map<string, Promise<string | null>>();

  /**
   * Run a store-wide change (root move, adoption, delete) alone: it waits for
   * the clip writes in flight, and writes started meanwhile wait for it.
   */
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.catch(() => undefined)
      .then(() => Promise.allSettled([...this.writes.values()]))
      .then(work);
    this.queue = run;
    return run;
  }

  /**
   * One clip write, in parallel with other clips' writes. A write of the same
   * clip already running is joined (a resumed run and the run it replaced never
   * download one clip twice).
   */
  private write(key: string, work: () => Promise<void>): Promise<string | null> {
    const running = this.writes.get(key);
    if (running) return running;
    const task = this.queue.catch(() => undefined)
      .then(work)
      .then(() => this.url(key))
      .finally(() => { this.writes.delete(key); });
    this.writes.set(key, task);
    return task;
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

  /** Called (debounced) after clips were added, removed or moved: usage widgets refresh. */
  onChange(listener: () => void): () => void {
    return this.clipsChanged.subscribe(listener);
  }

  private notifyChange(): void {
    if (this.changeTimer) return;
    this.changeTimer = setTimeout(() => {
      this.changeTimer = null;
      this.clipsChanged.emit();
    }, CHANGE_NOTIFY_MS);
  }

  /** Called after clips were removed (playable URLs handed out for them are invalid). */
  onRemoved(listener: () => void): () => void {
    return this.clipsRemoved.subscribe(listener);
  }

  /** Called after the root changed (playable URLs of the old root are invalid). */
  onRootChanged(listener: () => void): () => void {
    return this.rootChanged.subscribe(listener);
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
      const created: string[] = [];
      let done = 0;
      try {
        for (const key of keys) {
          if (await destination.has(clipName(key))) {
            copied.push(key);
          } else {
            const blob = await source.getBlob(clipName(key));
            if (blob) {
              await destination.putBlob(clipName(key), blob);
              copied.push(key);
              created.push(key);
            }
          }
          done += 1;
          onProgress?.(done, keys.length * 2);
        }
      } catch (error) {
        for (const key of created) await destination.delete(clipName(key));
        throw error;
      }
      const next: OrchClipRoot = { kind: target.kind, volumeId: target.volumeId, path: target.path };
      if (next.kind === 'internal') StorageManager.remove(StorageKeys.WORDNEW_ORCH_CLIP_ROOT);
      else StorageManager.set(StorageKeys.WORDNEW_ORCH_CLIP_ROOT, next);
      this.activeRoot = next;
      this.blobs = destination;
      this.revokeUrls();
      await this.saveNow();
      this.rootChanged.emit();
      this.notifyChange();
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
        const folder = `${option.path}/${ORCH_CLIP_DIR}`;
        const snapshot = await capFs.readJson<OrchClipIndexDocument>(`${folder}/${ROOT_INDEX_NAME}`, null, null);
        if (!snapshot?.entries) continue;
        const mirror = replayJournal(snapshot, await capFs.readText(`${folder}/${ROOT_JOURNAL_NAME}`, null));
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
          this.rootChanged.emit();
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
      const snapshot = await capFs.readJson<OrchClipIndexDocument>(INDEX_PATH, EMPTY_INDEX, Directory.Data) ?? EMPTY_INDEX;
      const journal = await capFs.readText(JOURNAL_PATH, Directory.Data);
      const document = replayJournal(snapshot, journal);
      this.journaled = journal ? journal.split('\n').length - 1 : 0;
      this.entries = document.entries;
      this.durations = document.durations;
      return this.entries;
    })();
    return this.loading;
  }

  private document(): OrchClipIndexDocument {
    return { version: 2, entries: this.entries ?? {}, durations: this.durations };
  }

  /** Full snapshot (compact JSON) and an empty journal - on store-wide changes and journal compaction. */
  private async writeSnapshot(text: string): Promise<void> {
    this.pending = [];
    this.journaled = 0;
    await capFs.writeText(INDEX_PATH, text, Directory.Data);
    await capFs.delete(JOURNAL_PATH, Directory.Data).catch(() => undefined);
    const root = await this.root();
    if (root.kind === 'public-volume') {
      const folder = `${root.path}/${ORCH_CLIP_DIR}`;
      await capFs.writeText(`${folder}/${ROOT_INDEX_NAME}`, text, null).catch(() => '');
      await capFs.delete(`${folder}/${ROOT_JOURNAL_NAME}`, null).catch(() => undefined);
    }
  }

  /** Pending changes appended to the journal (a clip costs one line, not a rewrite of the index). */
  private async appendJournal(): Promise<void> {
    if (this.pending.length === 0) return;
    if (this.journaled + this.pending.length > JOURNAL_COMPACT_RECORDS) {
      await this.writeSnapshot(JSON.stringify(this.document()));
      return;
    }
    const text = this.pending.map((record) => `${JSON.stringify(record)}\n`).join('');
    this.journaled += this.pending.length;
    this.pending = [];
    await capFs.appendText(JOURNAL_PATH, text, Directory.Data);
    const root = await this.root();
    if (root.kind === 'public-volume') {
      await capFs.appendText(`${root.path}/${ORCH_CLIP_DIR}/${ROOT_JOURNAL_NAME}`, text, null).catch(() => undefined);
    }
  }

  /** Record one change; the journal is appended at most every INDEX_SAVE_DELAY_MS. */
  private note(record: OrchClipJournalRecord): void {
    this.pending.push(record);
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saving = this.saving.catch(() => undefined).then(() => this.appendJournal());
    }, INDEX_SAVE_DELAY_MS);
  }

  private async saveNow(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const text = JSON.stringify(this.document());
    this.saving = this.saving.catch(() => undefined).then(() => this.writeSnapshot(text));
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

  /**
   * Which of `clips` the device holds, with their playable URLs and index
   * entries - one index read, one folder listing and one folder URI for all of
   * them (a whole book answers in one pass, without a call per clip). A clip
   * file the index lost (cut-off write, unreadable snapshot) is held all the
   * same: it joins the index again instead of being fetched again.
   */
  async lookup(clips: readonly OrchClipIdentity[]): Promise<Map<string, { url: string; entry: OrchClipIndexEntry }>> {
    const entries = await this.load();
    const blobs = await this.store();
    const present = await blobs.presentKeys(clips.map(({ resourceId }) => clipName(resourceId)));
    const files = clips.filter(({ resourceId }) => present.has(clipName(resourceId)));
    const orphans = files.filter(({ resourceId }) => !entries[resourceId]);
    if (orphans.length > 0) {
      const sizes = new Map((await blobs.entries()).map((file) => [file.key, file.size]));
      orphans.forEach((identity) => this.index(identity, 'pycore', sizes.get(blobs.fileName(clipName(identity.resourceId))) ?? 0, ''));
    }
    files.forEach((identity) => {
      if (identity.text && entries[identity.resourceId] && !entries[identity.resourceId].text) this.setText(identity.resourceId, identity.text);
    });
    const held = files.map(({ resourceId }) => resourceId);
    const unknown = held.filter((key) => !this.urls.has(key));
    const fresh = await blobs.servableUrls(unknown.map(clipName), CLIP_MIME);
    unknown.forEach((key) => {
      const url = fresh.get(clipName(key));
      if (url) this.urls.set(key, url);
    });
    const found = new Map<string, { url: string; entry: OrchClipIndexEntry }>();
    held.forEach((key) => {
      const url = this.urls.get(key);
      if (url) found.set(key, { url, entry: entries[key] });
    });
    return found;
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

  putBlob(identity: OrchClipIdentity, blob: Blob, origin: OrchClipIndexEntry['origin'], meaning: string, version?: number | null): Promise<string | null> {
    return this.write(identity.resourceId, async () => {
      if (await this.holds(identity)) return;
      await (await this.store()).putBlob(clipName(identity.resourceId), blob);
      await this.remember(identity, origin, blob.size, meaning, version);
    });
  }

  /**
   * Native: where clip bundles are written directly (absolute folder) and the
   * file name of each clip key; null on the web.
   */
  async nativeTarget(): Promise<{ folder: string; fileName: (key: string) => string } | null> {
    if (!isNativeAppShell()) return null;
    const blobs = await this.store();
    const folder = await blobs.nativeFolderPath();
    return folder ? { folder, fileName: (key) => blobs.fileName(clipName(key)) } : null;
  }

  /** Native: a clip the native stack wrote into the store folder joins the store. */
  adoptWritten(identity: OrchClipIdentity, origin: OrchClipIndexEntry['origin'], bytes: number, meaning: string, version?: number | null): Promise<string | null> {
    return this.write(identity.resourceId, async () => {
      await (await this.store()).noteNativeWrite(clipName(identity.resourceId));
      if (!(await this.entry(identity.resourceId))) await this.remember(identity, origin, bytes, meaning, version);
    });
  }

  /**
   * Native: a sentence clip the reader cache (wfnew-audio, app data or the old app cache folder) holds under
   * one of `keys` moves into this store (copied when the move is impossible, e.g. an SD-card root): the clip is
   * kept once and never fetched again. Its playable URL, or null when the reader cache holds none of the keys.
   */
  adoptReaderFile(identity: OrchClipIdentity, keys: readonly string[]): Promise<string | null> {
    return this.write(identity.resourceId, async () => {
      if (!isNativeAppShell() || await this.holds(identity)) return;
      const blobs = await this.store();
      const name = clipName(identity.resourceId);
      for (const source of this.readerStores) {
        for (const key of keys) {
          if (!(await source.has(key).catch(() => false))) continue;
          if (!(await blobs.adoptFrom(source, key, name))) {
            const blob = await source.getBlob(key);
            if (!blob || blob.size === 0) continue;
            await blobs.putBlob(name, blob);
            await source.delete(key);
          }
          await this.remember(identity, 'laravel', await blobs.size(name), '');
          return;
        }
      }
    });
  }

  /** Native: downloaded by the Filesystem plugin (streamed, no JS memory for app-private roots). */
  putFromUrl(
    identity: OrchClipIdentity,
    remoteUrl: string,
    meaning: string,
    onProgress?: (fraction: number) => void,
    version?: number | null,
  ): Promise<string | null> {
    return this.write(identity.resourceId, async () => {
      if (await this.holds(identity)) return;
      const blobs = await this.store();
      const name = clipName(identity.resourceId);
      await blobs.putFromUrl(name, remoteUrl, { onProgress });
      await this.remember(identity, 'laravel', await blobs.size(name), meaning, version);
    });
  }

  /**
   * Content update (WORDNEW_GUIDE R14's only automatic exception): the server declared a new version of this
   * held clip. The new file is downloaded beside the old one and replaces it only when complete; a failed
   * download leaves the held copy untouched. True when the clip was replaced.
   */
  async replaceFromUrl(entry: OrchClipIndexEntry, remoteUrl: string, version: number): Promise<boolean> {
    const key = entry.resourceId;
    const replaced = await this.write(key, async () => {
      const blobs = await this.store();
      const name = clipName(key);
      await blobs.putFromUrl(name, remoteUrl, { force: true });
      const entries = await this.load();
      entries[key] = { ...(entries[key] ?? entry), bytes: await blobs.size(name), version, storedAt: Date.now() };
      this.note({ e: key, v: entries[key] });
      this.durations[key] = 0;
      this.note({ d: key, v: 0 });
      this.urls.delete(key);
      this.notifyChange();
    }).catch(() => null);
    return replaced !== null;
  }

  /**
   * A slice of the indexed clips that can be checked against the server (they have the text to ask with):
   * up to `count` from position `offset`, and the position the next slice starts at (0 after the last).
   */
  async checkSlice(offset: number, count: number): Promise<{ entries: OrchClipIndexEntry[]; next: number }> {
    const entries = await this.load();
    const keys = Object.keys(entries);
    const slice: OrchClipIndexEntry[] = [];
    let position = offset >= keys.length ? 0 : offset;
    while (position < keys.length && slice.length < count) {
      const entry = entries[keys[position]];
      if (entry?.text) slice.push(entry);
      position += 1;
    }
    return { entries: slice, next: position >= keys.length ? 0 : position };
  }

  /** The first server version seen for a clip stored without one: it becomes the version later reports are compared with. */
  async noteVersion(key: string, version: number): Promise<void> {
    const entries = await this.load();
    if (!entries[key] || entries[key].version === version) return;
    entries[key] = { ...entries[key], version };
    this.note({ e: key, v: entries[key] });
  }

  private setText(key: string, text: string): void {
    const entries = this.entries ?? {};
    if (!entries[key]) return;
    entries[key] = { ...entries[key], text };
    this.note({ e: key, v: entries[key] });
  }

  /** A meaning learned later (e.g. from Laravel) is kept with the clip. */
  async setMeaning(key: string, meaning: string): Promise<void> {
    const entries = await this.load();
    if (!meaning || !entries[key] || entries[key].meaning === meaning) return;
    entries[key] = { ...entries[key], meaning };
    this.note({ e: key, v: entries[key] });
  }

  /** Put a clip into the loaded index (the caller has loaded it). */
  private index(identity: OrchClipIdentity, origin: OrchClipIndexEntry['origin'], bytes: number, meaning: string, version?: number | null): void {
    const { kind, language, text, contentId, resourceId } = identity;
    const entries = this.entries ?? {};
    entries[resourceId] = { kind, language, text, contentId, resourceId, origin, bytes, meaning, storedAt: Date.now(), ...(version ? { version } : {}) };
    this.note({ e: resourceId, v: entries[resourceId] });
    this.urls.delete(resourceId);
    this.notifyChange();
  }

  private async remember(
    identity: OrchClipIdentity,
    origin: OrchClipIndexEntry['origin'],
    bytes: number,
    meaning: string,
    version?: number | null,
  ): Promise<void> {
    await this.load();
    this.index(identity, origin, bytes, meaning, version);
  }

  /** The device holds this clip (its file exists, indexed or not): it is never written or fetched again. */
  private async holds(identity: OrchClipIdentity): Promise<boolean> {
    const blobs = await this.store();
    const name = clipName(identity.resourceId);
    if (!(await blobs.has(name).catch(() => false))) return false;
    const entry = await this.entry(identity.resourceId);
    if (!entry) await this.remember(identity, 'pycore', await blobs.size(name), '');
    else if (!entry.text && identity.text) this.setText(identity.resourceId, identity.text);
    return true;
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
      this.notifyChange();
      this.clipsRemoved.emit();
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
    this.note({ d: key, v: this.durations[key] });
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
      phrases: values.filter((entry) => entry.kind === 'phrase').length,
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
