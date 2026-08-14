/* =============================================================================
 * CapFilesystem — public, cross-platform FILE STORAGE capability library
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library for any app/page in pycore_laravel_wordnew_ui.
 *   *Built primarily for the wordnew mobile APP* (native Capacitor build of
 *   /wordnew): export/import a vocabulary backup, cache audio/clips offline, and
 *   persist larger blobs than localStorage allows. Falls back to an IndexedDB-
 *   backed virtual filesystem on the web.
 *
 * WHAT IT DOES
 *   - Text / JSON / base64 read-write-append, delete, exists, stat.
 *   - Directory ops: mkdir / ensureDir / readdir / rmdir / rename / copy.
 *   - A typed JSON document store (load/save a single object atomically).
 *   - Web export: turn a stored file into a browser download.
 *
 * NATIVE vs WEB (always falls back to web)
 *   - Native: @capacitor/filesystem (real files in Documents/Data/Cache/...).
 *   - Web: an IndexedDB-backed virtual FS (the aliased shim) — durable across
 *     reloads, namespaced by the same Directory enum.
 *
 * QUICK START
 *   import { capFs, Directory, useJsonFile } from '@/apps/wordnew/platform/capabilities/CapFilesystem';
 *   await capFs.writeJson('backup/vocab.json', { words });
 *   const data = await capFs.readJson<MyShape>('backup/vocab.json');
 *   await capFs.downloadFile('backup/vocab.json', 'wordnew-backup.json');
 *   // React: const { value, save } = useJsonFile('settings/profile.json', {});
 * ========================================================================== */

import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { blobToBase64 } from '../utils/blob';
import { stableHash } from '../utils/stableHash';

export { Directory, Encoding };
export { blobToBase64 };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CapFileStat {
  type: 'file' | 'directory';
  size: number;
  ctime: number;
  mtime: number;
  uri: string;
}

export interface CapDirEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  mtime: number;
  uri: string;
}

export interface CapFsOptions {
  /** Default directory for relative paths. Default Directory.Data. */
  directory?: Directory;
  logger?: (msg: string, ...args: unknown[]) => void;
}

function safeIsNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// base64 / text helpers (exported)
// ---------------------------------------------------------------------------

/** UTF-8 string -> base64. */
export function textToBase64(text: string): string {
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch {
    return btoa(text);
  }
}
/** base64 -> UTF-8 string. */
export function base64ToText(b64: string): string {
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return atob(b64);
  }
}
// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CapFilesystemService {
  private readonly native = safeIsNative();
  private readonly dir: Directory;
  private readonly logger?: (msg: string, ...args: unknown[]) => void;

  constructor(options: CapFsOptions = {}) {
    this.dir = options.directory ?? Directory.Data;
    this.logger = options.logger;
  }

  private log(msg: string, ...args: unknown[]): void {
    this.logger?.(`[CapFilesystem] ${msg}`, ...args);
  }

  isNative(): boolean {
    return this.native;
  }

  private d(directory?: Directory): Directory {
    return directory ?? this.dir;
  }

  // -- text ---------------------------------------------------------------- #

  /** Write a UTF-8 text file (creating parent dirs as needed). */
  async writeText(path: string, text: string, directory?: Directory): Promise<string> {
    await this.ensureDir(parentDir(path), directory);
    const res = await Filesystem.writeFile({
      path,
      data: text,
      directory: this.d(directory),
      encoding: Encoding.UTF8,
      recursive: true,
    });
    return (res as any)?.uri ?? '';
  }

  /** Read a UTF-8 text file. Returns null if it does not exist. */
  async readText(path: string, directory?: Directory): Promise<string | null> {
    try {
      const res = await Filesystem.readFile({ path, directory: this.d(directory), encoding: Encoding.UTF8 });
      const data = (res as any).data;
      return typeof data === 'string' ? data : String(data ?? '');
    } catch {
      return null;
    }
  }

  /** Append UTF-8 text to a file (creates it if missing). */
  async appendText(path: string, text: string, directory?: Directory): Promise<void> {
    await Filesystem.appendFile({ path, data: text, directory: this.d(directory), encoding: Encoding.UTF8 });
  }

  // -- JSON ---------------------------------------------------------------- #

  /** Write a JSON-serializable value (pretty-printed). */
  async writeJson(path: string, value: unknown, directory?: Directory): Promise<string> {
    return this.writeText(path, JSON.stringify(value, null, 2), directory);
  }

  /** Read + parse a JSON file. Returns `fallback` (default null) on miss/parse error. */
  async readJson<T = unknown>(path: string, fallback: T | null = null, directory?: Directory): Promise<T | null> {
    const txt = await this.readText(path, directory);
    if (txt == null) return fallback;
    try {
      return JSON.parse(txt) as T;
    } catch {
      this.log('readJson parse error', path);
      return fallback;
    }
  }

  // -- binary / base64 ----------------------------------------------------- #

  /** Write raw base64 bytes (binary file). */
  async writeBase64(path: string, base64: string, directory?: Directory): Promise<string> {
    await this.ensureDir(parentDir(path), directory);
    const res = await Filesystem.writeFile({ path, data: base64, directory: this.d(directory), recursive: true });
    return (res as any)?.uri ?? '';
  }

  /** Read a binary file as base64. Returns null on miss. */
  async readBase64(path: string, directory?: Directory): Promise<string | null> {
    try {
      const res = await Filesystem.readFile({ path, directory: this.d(directory) });
      return (res as any).data ?? null;
    } catch {
      return null;
    }
  }

  /** Write a Blob (converted to base64). */
  async writeBlob(path: string, blob: Blob, directory?: Directory): Promise<string> {
    return this.writeBase64(path, await blobToBase64(blob), directory);
  }

  // -- existence / metadata ------------------------------------------------ #

  /** Whether a file/dir exists. */
  async exists(path: string, directory?: Directory): Promise<boolean> {
    try {
      await Filesystem.stat({ path, directory: this.d(directory) });
      return true;
    } catch {
      return false;
    }
  }

  /** Stat a path, or null if missing. */
  async stat(path: string, directory?: Directory): Promise<CapFileStat | null> {
    try {
      const r: any = await Filesystem.stat({ path, directory: this.d(directory) });
      return { type: r.type, size: r.size, ctime: r.ctime, mtime: r.mtime, uri: r.uri };
    } catch {
      return null;
    }
  }

  /** A native/blob URI for a path (for <audio>/<img> on native). */
  async getUri(path: string, directory?: Directory): Promise<string> {
    try {
      const r: any = await Filesystem.getUri({ path, directory: this.d(directory) });
      return r?.uri ?? '';
    } catch {
      return '';
    }
  }

  // -- directories --------------------------------------------------------- #

  /** Create a directory (recursive). No-op if it already exists. */
  async mkdir(path: string, directory?: Directory): Promise<void> {
    if (!path || path === '.' || path === '/') return;
    try {
      await Filesystem.mkdir({ path, directory: this.d(directory), recursive: true } as any);
    } catch {
      /* already exists or implicit on web */
    }
  }

  /** Ensure a directory exists (alias of mkdir, ignores empty paths). */
  async ensureDir(path: string, directory?: Directory): Promise<void> {
    if (path) await this.mkdir(path, directory);
  }

  /** List a directory's entries. */
  async readdir(path: string, directory?: Directory): Promise<CapDirEntry[]> {
    try {
      const r: any = await Filesystem.readdir({ path, directory: this.d(directory) });
      const files = r?.files ?? [];
      // Native returns string[] on some versions, objects on others.
      return files.map((f: any) =>
        typeof f === 'string'
          ? { name: f, type: 'file', size: 0, mtime: 0, uri: '' }
          : { name: f.name, type: f.type, size: f.size ?? 0, mtime: f.mtime ?? 0, uri: f.uri ?? '' },
      );
    } catch {
      return [];
    }
  }

  /** Remove a directory (recursive). */
  async rmdir(path: string, directory?: Directory): Promise<void> {
    try {
      await Filesystem.rmdir({ path, directory: this.d(directory), recursive: true } as any);
    } catch (e) {
      this.log('rmdir failed', path, e);
    }
  }

  // -- delete / move / copy ------------------------------------------------ #

  async delete(path: string, directory?: Directory): Promise<void> {
    try {
      await Filesystem.deleteFile({ path, directory: this.d(directory) });
    } catch (e) {
      this.log('delete failed', path, e);
    }
  }

  async rename(from: string, to: string, directory?: Directory): Promise<void> {
    await Filesystem.rename({ from, to, directory: this.d(directory) } as any);
  }

  async copy(from: string, to: string, directory?: Directory): Promise<string> {
    const r: any = await Filesystem.copy({ from, to, directory: this.d(directory) } as any);
    return r?.uri ?? '';
  }

  // -- web export ---------------------------------------------------------- #

  /**
   * Trigger a browser download of a stored TEXT file (web only; on native this
   * resolves the file URI which the caller can share instead).
   */
  async downloadFile(path: string, downloadName?: string, directory?: Directory): Promise<void> {
    const text = await this.readText(path, directory);
    if (text == null) {
      this.log('downloadFile: not found', path);
      return;
    }
    this.downloadText(downloadName || basename(path), text);
  }

  /** Trigger a browser download of arbitrary text (web only). */
  downloadText(filename: string, text: string, mime = 'application/json'): void {
    try {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* no DOM */
    }
  }
}

// path helpers
function parentDir(path: string): string {
  const norm = path.replace(/^\/+/, '').replace(/\/+$/, '');
  const idx = norm.lastIndexOf('/');
  return idx >= 0 ? norm.slice(0, idx) : '';
}
function basename(path: string): string {
  const norm = path.replace(/\/+$/, '');
  const idx = norm.lastIndexOf('/');
  return idx >= 0 ? norm.slice(idx + 1) : norm;
}

// ---------------------------------------------------------------------------
// Typed JSON document store
// ---------------------------------------------------------------------------

/**
 * A tiny typed store backed by a single JSON file. Reads lazily, writes the
 * whole object on save. Good for app data that's too big for localStorage
 * (e.g. an exported vocabulary set, offline review cache).
 *
 *   const store = new CapJsonStore<MySettings>('settings/app.json', DEFAULTS);
 *   const s = await store.load();
 *   await store.update((d) => ({ ...d, theme: 'iris' }));
 */
export class CapJsonStore<T extends object> {
  private cache: T | null = null;
  constructor(
    private readonly path: string,
    private readonly defaults: T,
    private readonly directory?: Directory,
    private readonly fs: CapFilesystemService = capFs,
  ) {}

  /** Load (cached after first read). */
  async load(force = false): Promise<T> {
    if (this.cache && !force) return this.cache;
    const data = await this.fs.readJson<T>(this.path, this.defaults, this.directory);
    this.cache = { ...this.defaults, ...(data as object) } as T;
    return this.cache;
  }

  /** Overwrite the whole document. */
  async save(value: T): Promise<void> {
    this.cache = value;
    await this.fs.writeJson(this.path, value, this.directory);
  }

  /** Functional update (load -> mutate -> save). */
  async update(mutator: (current: T) => T): Promise<T> {
    const current = await this.load();
    const next = mutator(current);
    await this.save(next);
    return next;
  }

  /** Delete the backing file + clear cache. */
  async clear(): Promise<void> {
    this.cache = null;
    await this.fs.delete(this.path, this.directory);
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience
// ---------------------------------------------------------------------------

export const capFs = new CapFilesystemService();

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseJsonFileResult<T> {
  value: T;
  loading: boolean;
  save: (value: T) => Promise<void>;
  update: (mutator: (current: T) => T) => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * React hook over a single JSON file. Loads on mount, exposes save/update.
 *
 *   const { value, update } = useJsonFile('settings/profile.json', { name: '' });
 */
// ===========================================================================
// EXTENDED CAPABILITIES — tree ops, upload import, remote cache, object URLs
// ===========================================================================
//
// Beyond single files: walk a directory tree, compute total size, copy trees,
// import an uploaded File, cache a remote URL to disk (offline audio/images),
// and turn a stored binary into an object URL for <audio>/<img> on the web.

/** Recursively list every FILE under a directory (relative paths). */
export async function walkFiles(root: string, directory?: Directory, fs: CapFilesystemService = capFs): Promise<string[]> {
  const out: string[] = [];
  const recurse = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, directory);
    for (const e of entries) {
      const full = dir ? `${dir}/${e.name}` : e.name;
      if (e.type === 'directory') await recurse(full);
      else out.push(full);
    }
  };
  await recurse(root.replace(/\/+$/, ''));
  return out;
}

/** Total byte size of all files under a directory. */
export async function directorySize(root: string, directory?: Directory, fs: CapFilesystemService = capFs): Promise<number> {
  const files = await walkFiles(root, directory, fs);
  let total = 0;
  for (const f of files) {
    const st = await fs.stat(f, directory);
    total += st?.size ?? 0;
  }
  return total;
}

/** Recursively copy a directory tree (text + binary preserved as base64). */
export async function copyTree(
  from: string,
  to: string,
  directory?: Directory,
  fs: CapFilesystemService = capFs,
): Promise<number> {
  const files = await walkFiles(from, directory, fs);
  let copied = 0;
  for (const rel of files) {
    const suffix = rel.slice(from.replace(/\/+$/, '').length).replace(/^\/+/, '');
    const data = await fs.readBase64(rel, directory);
    if (data != null) {
      await fs.writeBase64(`${to.replace(/\/+$/, '')}/${suffix}`, data, directory);
      copied++;
    }
  }
  return copied;
}

/** Import a browser-uploaded File into the filesystem (binary-safe). */
export async function importFile(file: File, path: string, directory?: Directory, fs: CapFilesystemService = capFs): Promise<string> {
  const base64 = await blobToBase64(file);
  return fs.writeBase64(path, base64, directory);
}

export interface CapCacheOptions {
  directory?: Directory;
  /** Skip the download if the file already exists. Default true. */
  skipIfExists?: boolean;
}

/**
 * Download a remote URL and store it at `path` (e.g. cache an audio clip for
 * offline playback). Returns the stored file's URI. No-op re-download when the
 * file already exists unless `skipIfExists` is false.
 */
export async function cacheRemote(
  url: string,
  path: string,
  options: CapCacheOptions = {},
  fs: CapFilesystemService = capFs,
): Promise<string> {
  const directory = options.directory;
  if (options.skipIfExists !== false && (await fs.exists(path, directory))) {
    return fs.getUri(path, directory);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`cacheRemote failed: ${res.status}`);
  const blob = await res.blob();
  return fs.writeBlob(path, blob, directory);
}

/**
 * Read a stored binary file and return an object URL for direct playback /
 * display on the web (and a native URI on device). Remember to revoke the URL.
 */
export async function toObjectUrl(path: string, mime = 'application/octet-stream', directory?: Directory, fs: CapFilesystemService = capFs): Promise<string | null> {
  if (fs.isNative()) {
    const uri = await fs.getUri(path, directory);
    return uri || null;
  }
  const base64 = await fs.readBase64(path, directory);
  if (base64 == null) return null;
  try {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return null;
  }
}

/** Bundle several text/JSON files into one backup object for export. */
export async function bundleForExport(
  paths: string[],
  directory?: Directory,
  fs: CapFilesystemService = capFs,
): Promise<Record<string, unknown>> {
  const bundle: Record<string, unknown> = { __exportedAt: new Date().toISOString(), files: {} as Record<string, string> };
  for (const p of paths) {
    const txt = await fs.readText(p, directory);
    if (txt != null) (bundle.files as Record<string, string>)[p] = txt;
  }
  return bundle;
}

// ---------------------------------------------------------------------------
// Extended React hooks
// ---------------------------------------------------------------------------

// ===========================================================================
// LARGE-FILE / BIG-CACHE SUBSYSTEM (10-100 GB) — read this before using!
// ===========================================================================
//
// WHY A SEPARATE PATH: the standard read/write helpers above go through the
// Capacitor Filesystem base64 API (and, on web, the IndexedDB shim). base64
// INFLATES data ~33% and forces the WHOLE file through JS memory — fine for
// settings/JSON/small clips, but it will OOM on big media and cannot reach the
// 10-100 GB range. For large blob caches use the API below instead.
//
//   ┌──────────────── LARGE-FILE AVAILABILITY MATRIX ────────────────┐
//   │ mechanism        │ native (Filesystem) │ web                    │
//   │ large blob store │ ✅ device disk      │ ✅ OPFS (preferred)    │
//   │   "             "│                     │ ⚠️ IndexedDB fallback   │
//   │ streamed write   │ ⚠️ via downloadFile │ ✅ OPFS createWritable │
//   │ download-to-disk │ ✅ Filesystem.downloadFile (no JS memory)    │
//   │                 "│                     │ ✅ fetch→OPFS stream    │
//   │ servable src     │ ✅ convertFileSrc   │ ✅ object URL          │
//   │ practical cap    │ ~free disk (GBs)    │ browser quota (ask for │
//   │                 "│                     │ a persistent grant)    │
//   └─────────────────────────────────────────────────────────────────┘
//
// IMPORTANT (web): IndexedDB/OPFS storage can be EVICTED by the browser under
// pressure unless you hold a persistent grant — call requestPersistentStorage()
// for caches you must keep. Always check getStorageEstimate() before large writes.

export interface CapStorageEstimate {
  usageBytes: number;
  quotaBytes: number;
  /** 0..1 fraction of quota used (0 when quota unknown). */
  percentUsed: number;
  /** Whether the origin has a persistent-storage grant (eviction-resistant). */
  persisted: boolean;
}

/** Query the browser storage quota + usage (web). Native reports best-effort. */
export async function getStorageEstimate(): Promise<CapStorageEstimate> {
  try {
    const sm = (navigator as any)?.storage;
    if (sm?.estimate) {
      const est = await sm.estimate();
      const usage = est.usage ?? 0;
      const quota = est.quota ?? 0;
      const persisted = sm.persisted ? await sm.persisted() : false;
      return { usageBytes: usage, quotaBytes: quota, percentUsed: quota ? usage / quota : 0, persisted };
    }
  } catch {
    /* unsupported */
  }
  return { usageBytes: 0, quotaBytes: 0, percentUsed: 0, persisted: true };
}

/** Ask the browser for a persistent-storage grant (reduces eviction). Web only. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const sm = (navigator as any)?.storage;
    if (sm?.persisted && (await sm.persisted())) return true;
    if (sm?.persist) return !!(await sm.persist());
  } catch {
    /* unsupported */
  }
  return false;
}

/** Whether storage is currently persistent (eviction-resistant). */
export async function isPersistentStorage(): Promise<boolean> {
  try {
    const sm = (navigator as any)?.storage;
    if (sm?.persisted) return !!(await sm.persisted());
  } catch {
    /* unsupported */
  }
  return false;
}

// -- OPFS helpers (web) ------------------------------------------------------

function opfsSupported(): boolean {
  try {
    return !!(navigator as any)?.storage?.getDirectory;
  } catch {
    return false;
  }
}

async function opfsDir(path: string, create: boolean): Promise<any | null> {
  try {
    let dir: any = await (navigator as any).storage.getDirectory();
    const parts = path.split('/').filter(Boolean);
    for (const p of parts) dir = await dir.getDirectoryHandle(p, { create });
    return dir;
  } catch {
    return null;
  }
}

function sanitizeKey(key: string): string {
  if (/^[a-zA-Z0-9._-]+$/.test(key) && key.length <= 180) return key;
  const match = /\.([a-zA-Z0-9]{2,5})$/.exec(key);
  const extension = match ? `.${match[1].toLowerCase()}` : '.bin';
  return `k${stableHash(key)}${extension}`;
}

export interface CapBlobPutOptions {
  /** Progress callback 0..1 (best-effort; requires a known length). */
  onProgress?: (fraction: number) => void;
}

export interface CapBlobEntry {
  key: string;
  size: number;
  mtime: number;
}

/**
 * A LARGE blob store backed by OPFS on web (real files, streamable, no base64
 * inflation) and the device filesystem on native. This is the right primitive
 * for the 10-100 GB media/audio cache.
 *
 *   const store = new CapBlobStore('media');
 *   await store.putFromUrl('clip-42.mp3', remoteUrl, { onProgress: p => ... });
 *   const src = await store.getServableUrl('clip-42.mp3');   // <audio src=...>
 */
export class CapBlobStore {
  private readonly dir: string;
  private readonly directory: Directory;

  constructor(dir = 'blobs', directory: Directory = Directory.Cache) {
    this.dir = dir.replace(/\/+$/, '');
    this.directory = directory;
  }

  private nativePath(key: string): string {
    return `${this.dir}/${sanitizeKey(key)}`;
  }

  /** Whether a key exists. */
  async has(key: string): Promise<boolean> {
    if (safeIsNative()) return capFs.exists(this.nativePath(key), this.directory);
    if (opfsSupported()) {
      const dir = await opfsDir(this.dir, false);
      if (!dir) return false;
      try {
        await dir.getFileHandle(sanitizeKey(key));
        return true;
      } catch {
        return false;
      }
    }
    return capFs.exists(this.nativePath(key), this.directory);
  }

  /** Store a Blob. Web: OPFS streamed write. Native: base64 write (memory-bound — prefer putFromUrl for huge files). */
  async putBlob(key: string, blob: Blob, options: CapBlobPutOptions = {}): Promise<void> {
    if (!safeIsNative() && opfsSupported()) {
      const dir = await opfsDir(this.dir, true);
      if (dir) {
        const fh = await dir.getFileHandle(sanitizeKey(key), { create: true });
        const writable = await fh.createWritable();
        try {
          await this.streamBlobToWritable(blob, writable, options.onProgress);
        } finally {
          await writable.close();
        }
        return;
      }
    }
    // Native (or no-OPFS web): go through the Filesystem base64 path.
    await capFs.writeBlob(this.nativePath(key), blob, this.directory);
    options.onProgress?.(1);
  }

  private async streamBlobToWritable(blob: Blob, writable: any, onProgress?: (f: number) => void): Promise<void> {
    const total = blob.size || 0;
    const reader = (blob.stream && blob.stream().getReader) ? blob.stream().getReader() : null;
    if (!reader) {
      await writable.write(blob);
      onProgress?.(1);
      return;
    }
    let written = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writable.write(value);
      written += value.length ?? value.byteLength ?? 0;
      if (total) onProgress?.(Math.min(1, written / total));
    }
    onProgress?.(1);
  }

  /**
   * Download a remote URL straight to storage. Native uses Filesystem.downloadFile
   * (streams to disk, NO JS memory). Web streams fetch -> OPFS. The right way to
   * cache big media. Skips re-download if present (unless `force`).
   */
  async putFromUrl(key: string, url: string, options: CapBlobPutOptions & { force?: boolean } = {}): Promise<string> {
    if (!options.force && (await this.has(key))) return this.getServableUrl(key).then((u) => u || '');

    const safeKey = sanitizeKey(key);
    const temporaryKey = `${safeKey}.download`;
    if (safeIsNative()) {
      const finalPath = this.nativePath(safeKey);
      const temporaryPath = this.nativePath(temporaryKey);
      const download = (Filesystem as any).downloadFile;
      await capFs.delete(temporaryPath, this.directory);
      try {
        if (typeof download === 'function') {
          await download.call(Filesystem, {
            url,
            path: temporaryPath,
            directory: this.directory,
            recursive: true,
            progress: !!options.onProgress,
          });
        } else {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`putFromUrl failed: ${response.status}`);
          await capFs.writeBlob(temporaryPath, await response.blob(), this.directory);
        }
        await capFs.delete(finalPath, this.directory);
        await capFs.rename(temporaryPath, finalPath, this.directory);
      } catch (error) {
        await capFs.delete(temporaryPath, this.directory);
        throw error;
      }
      options.onProgress?.(1);
      return (await capFs.getUri(finalPath, this.directory)) || '';
    }

    if (opfsSupported()) {
      const response = await fetch(url);
      if (!response.ok || !response.body) throw new Error(`putFromUrl failed: ${response.status}`);
      const total = Number(response.headers.get('content-length') || 0);
      const dir = await opfsDir(this.dir, true);
      if (!dir) throw new Error('putFromUrl failed: OPFS directory unavailable.');
      try {
        await dir.removeEntry(temporaryKey).catch(() => undefined);
        const temporaryHandle = await dir.getFileHandle(temporaryKey, { create: true });
        const writable = await temporaryHandle.createWritable();
        const reader = response.body.getReader();
        let written = 0;
        try {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writable.write(value);
            written += value.byteLength;
            if (total) options.onProgress?.(Math.min(1, written / total));
          }
        } finally {
          await writable.close();
        }
        await this.commitOpfsDownload(dir, temporaryHandle, safeKey);
      } catch (error) {
        await dir.removeEntry(temporaryKey).catch(() => undefined);
        throw error;
      }
      options.onProgress?.(1);
      return (await this.getServableUrl(safeKey)) || '';
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`putFromUrl failed: ${response.status}`);
    await this.putBlob(safeKey, await response.blob(), options);
    return (await this.getServableUrl(safeKey)) || '';
  }

  private async commitOpfsDownload(dir: any, temporaryHandle: any, finalKey: string): Promise<void> {
    const move = temporaryHandle.move;
    if (typeof move === 'function') {
      await dir.removeEntry(finalKey).catch(() => undefined);
      await move.call(temporaryHandle, finalKey);
      return;
    }
    const temporaryFile = await temporaryHandle.getFile();
    await dir.removeEntry(finalKey).catch(() => undefined);
    const finalHandle = await dir.getFileHandle(finalKey, { create: true });
    const writable = await finalHandle.createWritable();
    try {
      await this.streamBlobToWritable(temporaryFile, writable);
    } catch (error) {
      await dir.removeEntry(finalKey).catch(() => undefined);
      throw error;
    } finally {
      await writable.close();
    }
    await dir.removeEntry(temporaryHandle.name).catch(() => undefined);
  }

  /** Read a stored blob back (web: OPFS File; native: base64->Blob, memory-bound). */
  async getBlob(key: string): Promise<Blob | null> {
    if (!safeIsNative() && opfsSupported()) {
      const dir = await opfsDir(this.dir, false);
      if (!dir) return null;
      try {
        const fh = await dir.getFileHandle(sanitizeKey(key));
        return await fh.getFile();
      } catch {
        return null;
      }
    }
    const b64 = await capFs.readBase64(this.nativePath(key), this.directory);
    if (b64 == null) return null;
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes]);
    } catch {
      return null;
    }
  }

  /** A URL usable in <audio>/<img>/<video> for the stored file. */
  async getServableUrl(key: string, mime = 'application/octet-stream'): Promise<string | null> {
    if (safeIsNative()) {
      const uri = await capFs.getUri(this.nativePath(key), this.directory);
      if (!uri) return null;
      const convert = (Capacitor as any).convertFileSrc;
      return typeof convert === 'function' ? convert(uri) : uri;
    }
    const blob = await this.getBlob(key);
    if (!blob) return null;
    try {
      return URL.createObjectURL(mime ? new Blob([blob], { type: mime }) : blob);
    } catch {
      return null;
    }
  }

  /** Byte size of a stored entry (0 if absent). */
  async size(key: string): Promise<number> {
    if (!safeIsNative() && opfsSupported()) {
      const blob = await this.getBlob(key);
      return blob?.size ?? 0;
    }
    const st = await capFs.stat(this.nativePath(key), this.directory);
    return st?.size ?? 0;
  }

  /** Delete a stored entry. */
  async delete(key: string): Promise<void> {
    if (!safeIsNative() && opfsSupported()) {
      const dir = await opfsDir(this.dir, false);
      try {
        await dir?.removeEntry(sanitizeKey(key));
      } catch {
        /* missing */
      }
      return;
    }
    await capFs.delete(this.nativePath(key), this.directory);
  }

  /** List stored keys. */
  async keys(): Promise<string[]> {
    if (!safeIsNative() && opfsSupported()) {
      const dir = await opfsDir(this.dir, false);
      if (!dir) return [];
      const out: string[] = [];
      try {
        for await (const [name] of (dir as any).entries()) out.push(name);
      } catch {
        /* iteration unsupported */
      }
      return out;
    }
    return (await capFs.readdir(this.dir, this.directory)).map((e) => e.name);
  }

  /** Stored entry metadata used by quota-aware caches. */
  async entries(): Promise<CapBlobEntry[]> {
    if (!safeIsNative() && opfsSupported()) {
      const keys = await this.keys();
      const entries: CapBlobEntry[] = [];
      for (const key of keys) {
        const blob = await this.getBlob(key);
        entries.push({
          key,
          size: blob?.size ?? 0,
          mtime: blob && 'lastModified' in blob ? Number(blob.lastModified) || 0 : 0,
        });
      }
      return entries;
    }
    return (await capFs.readdir(this.dir, this.directory))
      .filter((entry) => entry.type === 'file')
      .map((entry) => ({ key: entry.name, size: entry.size, mtime: entry.mtime }));
  }

  /** Total bytes used by the store. */
  async totalSize(): Promise<number> {
    return (await this.entries()).reduce((total, entry) => total + entry.size, 0);
  }

  /** Remove all entries. */
  async clear(): Promise<void> {
    if (!safeIsNative() && opfsSupported()) {
      const root = await (navigator as any).storage.getDirectory().catch(() => null);
      try {
        await root?.removeEntry(this.dir, { recursive: true });
      } catch {
        /* missing */
      }
      return;
    }
    await capFs.rmdir(this.dir, this.directory);
  }
}

/**
 * A quota-aware LARGE cache for the 10-100 GB media use case. Wraps CapBlobStore
 * with a byte budget + LRU-ish eviction (oldest files first), and a getOrFetch
 * that downloads-on-miss straight to disk/OPFS.
 *
 *   const cache = new CapLargeCache({ dir: 'audio', maxBytes: 20 * 1024 ** 3 }); // 20 GB
 *   const url = await cache.getOrFetchUrl('w-42', () => `${cdn}/w-42.mp3`);
 */
export class CapLargeCache {
  private readonly store: CapBlobStore;
  private readonly maxBytes: number;
  private readonly inFlight = new Map<string, Promise<string | null>>();
  private evictionChain: Promise<void> = Promise.resolve();
  private generation = 0;

  constructor(options: { dir?: string; maxBytes?: number; directory?: Directory } = {}) {
    this.store = new CapBlobStore(options.dir ?? 'large-cache', options.directory ?? Directory.Cache);
    this.maxBytes = Math.max(0, Math.floor(options.maxBytes ?? 2 * 1024 * 1024 * 1024));
  }

  /** The underlying blob store (for direct ops). */
  get blobs(): CapBlobStore {
    return this.store;
  }

  /** Get a servable URL, downloading via `urlFor` on a miss, then enforce budget. */
  async getOrFetchUrl(key: string, urlFor: () => string | Promise<string>, mime?: string): Promise<string | null> {
    if (await this.store.has(key)) return this.store.getServableUrl(key, mime);
    if (this.maxBytes === 0) return null;
    const pending = this.inFlight.get(key);
    if (pending) return pending;
    const generation = this.generation;
    const operation = (async (): Promise<string | null> => {
      try {
        await this.store.putFromUrl(key, await urlFor());
        if (generation !== this.generation) {
          await this.store.delete(key);
          return null;
        }
        await this.enforceBudget();
        if (!(await this.store.has(key))) return null;
        return this.store.getServableUrl(key, mime);
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, operation);
    return operation;
  }

  /** Store a blob and enforce the budget. */
  async put(key: string, blob: Blob, options?: CapBlobPutOptions): Promise<void> {
    if (this.maxBytes === 0) return;
    const generation = this.generation;
    await this.store.putBlob(key, blob, options);
    if (generation !== this.generation) {
      await this.store.delete(key);
      return;
    }
    await this.enforceBudget();
  }

  has(key: string): Promise<boolean> {
    return this.store.has(key);
  }
  remove(key: string): Promise<void> {
    return this.store.delete(key);
  }
  totalSize(): Promise<number> {
    return this.store.totalSize();
  }
  clear(): Promise<void> {
    this.generation += 1;
    return this.store.clear();
  }

  /** Evict oldest entries (by mtime) until under the byte budget. */
  enforceBudget(): Promise<void> {
    const operation = this.evictionChain.catch(() => undefined).then(async () => {
      const entries = await this.store.entries();
      let total = entries.reduce((sum, entry) => sum + entry.size, 0);
      if (total <= this.maxBytes) return;
      const oldestFirst = entries.slice().sort((left, right) => left.mtime - right.mtime);
      for (const entry of oldestFirst) {
        if (total <= this.maxBytes) break;
        await this.store.delete(entry.key);
        total -= entry.size;
      }
    });
    this.evictionChain = operation;
    return operation;
  }
}

// ---------------------------------------------------------------------------
// Extended React hooks
// ---------------------------------------------------------------------------

/** Live storage quota/usage estimate + a persistent-grant requester. */
export function useStorageEstimate(): {
  estimate: CapStorageEstimate | null;
  refresh: () => Promise<void>;
  requestPersistent: () => Promise<boolean>;
} {
  const [estimate, setEstimate] = useState<CapStorageEstimate | null>(null);
  const refresh = useCallback(async () => {
    setEstimate(await getStorageEstimate());
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return {
    estimate,
    refresh,
    requestPersistent: async () => {
      const ok = await requestPersistentStorage();
      await refresh();
      return ok;
    },
  };
}

/** Live directory listing with refresh. */
export function useDirectory(
  path: string,
  directory?: Directory,
): { entries: CapDirEntry[]; loading: boolean; refresh: () => Promise<void> } {
  const [entries, setEntries] = useState<CapDirEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await capFs.readdir(path, directory));
    } finally {
      setLoading(false);
    }
  }, [path, directory]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, refresh };
}

export function useJsonFile<T extends object>(
  path: string,
  defaults: T,
  directory?: Directory,
): UseJsonFileResult<T> {
  const [value, setValue] = useState<T>(defaults);
  const [loading, setLoading] = useState(true);
  const [store] = useState(() => new CapJsonStore<T>(path, defaults, directory));

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setValue(await store.load(true));
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (next: T) => {
      await store.save(next);
      setValue(next);
    },
    [store],
  );

  const update = useCallback(
    async (mutator: (current: T) => T) => {
      const next = await store.update(mutator);
      setValue(next);
    },
    [store],
  );

  return { value, loading, save, update, reload };
}

// ===========================================================================
// EXTENDED CAPABILITIES — JSONL append logs + a size-capped file cache
// ===========================================================================
//
// Two patterns wordnew uses a lot: an append-only event/review log (cheap to
// append, easy to tail) and a bounded on-disk cache for audio/image blobs that
// evicts the oldest entries once it exceeds a byte budget.

/** Append one JSON object as a line to a `.jsonl` file. */
export async function appendJsonl(path: string, obj: unknown, directory?: Directory, fs: CapFilesystemService = capFs): Promise<void> {
  await fs.appendText(path, JSON.stringify(obj) + '\n', directory);
}

/** Read all lines of a `.jsonl` file, parsed (bad lines skipped). */
export async function readJsonl<T = unknown>(path: string, directory?: Directory, fs: CapFilesystemService = capFs): Promise<T[]> {
  const txt = await fs.readText(path, directory);
  if (!txt) return [];
  const out: T[] = [];
  for (const line of txt.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as T);
    } catch {
      /* skip malformed line */
    }
  }
  return out;
}

/** Read just the last `n` parsed lines of a `.jsonl` file. */
export async function tailJsonl<T = unknown>(path: string, n: number, directory?: Directory, fs: CapFilesystemService = capFs): Promise<T[]> {
  const all = await readJsonl<T>(path, directory, fs);
  return all.slice(Math.max(0, all.length - n));
}

/** Rewrite a `.jsonl` file from an array (e.g. after pruning). */
export async function writeJsonl(path: string, items: unknown[], directory?: Directory, fs: CapFilesystemService = capFs): Promise<void> {
  await fs.writeText(path, items.map((i) => JSON.stringify(i)).join('\n') + (items.length ? '\n' : ''), directory);
}

export interface CapFileCacheOptions {
  /** Sub-directory under the chosen Directory to namespace the cache. */
  dir?: string;
  /** Max total bytes before LRU-ish eviction kicks in. Default 50 MB. */
  maxBytes?: number;
  directory?: Directory;
}

/**
 * A bounded on-disk blob cache. Keys are mapped to files under `dir`; once the
 * total size exceeds `maxBytes`, the oldest files (by mtime) are evicted. Ideal
 * for caching TTS audio / cover images for offline use.
 *
 *   const cache = new CapFileCache({ dir: 'audio-cache', maxBytes: 30 * 1024 * 1024 });
 *   const url = await cache.getOrFetch('word-42', () => ttsClipBlob());
 */
export class CapFileCache {
  private readonly dir: string;
  private readonly maxBytes: number;
  private readonly directory?: Directory;
  private readonly fs: CapFilesystemService;

  constructor(options: CapFileCacheOptions = {}, fs: CapFilesystemService = capFs) {
    this.dir = (options.dir ?? 'cache').replace(/\/+$/, '');
    this.maxBytes = options.maxBytes ?? 50 * 1024 * 1024;
    this.directory = options.directory ?? Directory.Cache;
    this.fs = fs;
  }

  private pathFor(key: string): string {
    const safe = key.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${this.dir}/${safe}`;
  }

  /** Whether a cached entry exists. */
  has(key: string): Promise<boolean> {
    return this.fs.exists(this.pathFor(key), this.directory);
  }

  /** Store a blob under a key (then enforce the size budget). */
  async put(key: string, blob: Blob): Promise<string> {
    const uri = await this.fs.writeBlob(this.pathFor(key), blob, this.directory);
    await this.enforceBudget();
    return uri;
  }

  /** Store raw base64 under a key. */
  async putBase64(key: string, base64: string): Promise<string> {
    const uri = await this.fs.writeBase64(this.pathFor(key), base64, this.directory);
    await this.enforceBudget();
    return uri;
  }

  /** Get a playable/displayable URL for a cached entry, or null if absent. */
  getUrl(key: string, mime = 'application/octet-stream'): Promise<string | null> {
    return toObjectUrl(this.pathFor(key), mime, this.directory, this.fs);
  }

  /** Get the cached URL, or fetch+store via `produce` on a miss. */
  async getOrFetch(key: string, produce: () => Promise<Blob>, mime = 'application/octet-stream'): Promise<string | null> {
    if (!(await this.has(key))) {
      try {
        await this.put(key, await produce());
      } catch {
        return null;
      }
    }
    return this.getUrl(key, mime);
  }

  /** Remove a single entry. */
  async remove(key: string): Promise<void> {
    await this.fs.delete(this.pathFor(key), this.directory);
  }

  /** Clear the whole cache directory. */
  async clear(): Promise<void> {
    await this.fs.rmdir(this.dir, this.directory);
  }

  /** Current total size of the cache (bytes). */
  size(): Promise<number> {
    return directorySize(this.dir, this.directory, this.fs);
  }

  /** Evict oldest entries until under the byte budget. */
  private async enforceBudget(): Promise<void> {
    const entries = await this.fs.readdir(this.dir, this.directory);
    let total = entries.reduce((a, e) => a + (e.size || 0), 0);
    if (total <= this.maxBytes) return;
    const byAge = entries.slice().sort((a, b) => (a.mtime || 0) - (b.mtime || 0));
    for (const e of byAge) {
      if (total <= this.maxBytes) break;
      await this.fs.delete(`${this.dir}/${e.name}`, this.directory);
      total -= e.size || 0;
    }
  }
}

export default capFs;
