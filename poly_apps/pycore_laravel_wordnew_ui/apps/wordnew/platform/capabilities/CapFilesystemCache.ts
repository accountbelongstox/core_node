/** Filesystem tree, remote, and large-cache capabilities. */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { stableHash } from '../utils/stableHash';
import { fetchAssetUrl, nativeBundleAvailable, nativeDownloadToFile } from '../../../../core/network/ProtocolFetch';
import { consumeBodyWithStallGuard, readBytesWithStallGuard } from '../../../../core/network/StallGuardedRead';
import {
  CapFilesystemService,
  type CapDirectory,
  blobToBase64,
  capFs,
  safeIsNative,
} from './CapFilesystemCore';
// ===========================================================================
// EXTENDED CAPABILITIES — tree ops, upload import, remote cache, object URLs
// ===========================================================================
//
// Beyond single files: walk a directory tree, compute total size, copy trees,
// import an uploaded File, cache a remote URL to disk (offline audio/images),
// and turn a stored binary into an object URL for <audio>/<img> on the web.

/** Recursively list every FILE under a directory (relative paths). */
export async function walkFiles(root: string, directory?: CapDirectory, fs: CapFilesystemService = capFs): Promise<string[]> {
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
export async function directorySize(root: string, directory?: CapDirectory, fs: CapFilesystemService = capFs): Promise<number> {
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
  directory?: CapDirectory,
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
export async function importFile(file: File, path: string, directory?: CapDirectory, fs: CapFilesystemService = capFs): Promise<string> {
  const base64 = await blobToBase64(file);
  return fs.writeBase64(path, base64, directory);
}

export interface CapCacheOptions {
  directory?: CapDirectory;
  /** Skip the download if the file already exists. Default true. */
  skipIfExists?: boolean;
  /** Aborts the download; one with no byte for the transfer idle window fails with TimeoutError. */
  signal?: AbortSignal;
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
  const res = await fetchAssetUrl(url, { signal: options.signal });
  if (!res.ok) throw new Error(`cacheRemote failed: ${res.status}`);
  const blob = new Blob([await readBytesWithStallGuard(res, { signal: options.signal })]);
  return fs.writeBlob(path, blob, directory);
}

/**
 * Read a stored binary file and return an object URL for direct playback /
 * display on the web (and a native URI on device). Remember to revoke the URL.
 */
export async function toObjectUrl(path: string, mime = 'application/octet-stream', directory?: CapDirectory, fs: CapFilesystemService = capFs): Promise<string | null> {
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
  directory?: CapDirectory,
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

/** The absolute path of a `file://` URI (the native stack writes by path). */
function fileUriToPath(uri: string | null | undefined): string {
  return decodeURIComponent(String(uri || '').replace(/^file:\/\//, ''));
}

export interface CapBlobPutOptions {
  /** Progress callback 0..1 (best-effort; requires a known length). */
  onProgress?: (fraction: number) => void;
  /** Aborts a download (AbortError); a download with no byte for the transfer idle window fails with TimeoutError. */
  signal?: AbortSignal;
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
/** App-cache folder that stages native downloads bound for an absolute folder. */
const STAGING_DIR = 'blob-staging';
/** Filesystem plugin message of a path that does not exist (Android / iOS / web). */
const MISSING_PATH_RE = /does not exist|not found|no such file/i;

export class CapBlobStore {
  private readonly dir: string;
  private readonly directory: CapDirectory;
  private nativeNames: Promise<Set<string>> | null = null;
  private folderUri: Promise<string> | null = null;

  /** `directory` null: `dir` is an absolute path (e.g. a folder on an SD-card volume). */
  constructor(dir = 'blobs', directory: CapDirectory = Directory.Cache) {
    this.dir = dir.replace(/\/+$/, '');
    this.directory = directory;
  }

  private nativePath(key: string): string {
    return `${this.dir}/${sanitizeKey(key)}`;
  }

  /**
   * The folder's file URI, asked once: a file URI is the folder URI plus the
   * (URL-safe) sanitized key, so serving thousands of files costs no bridge
   * call each. A failed lookup is not cached.
   */
  private nativeFolderUri(): Promise<string> {
    this.folderUri ??= capFs.getUri(this.dir, this.directory).then((uri) => {
      if (!uri) this.folderUri = null;
      return uri.replace(/\/+$/, '');
    });
    return this.folderUri;
  }

  /**
   * One directory listing shared by all native existence checks; misses never
   * reach a throwing plugin call. A missing folder is an empty index; a listing
   * that fails (permission, unmounted volume) rejects and is not cached, so a
   * later call retries instead of treating every file as absent.
   */
  private nativeIndex(): Promise<Set<string>> {
    if (!this.nativeNames) {
      this.nativeNames = (async () => {
        const listing: any = await Filesystem.readdir({ path: this.dir, directory: this.directory ?? undefined })
          .catch((error: unknown) => {
            if (MISSING_PATH_RE.test(String((error as Error)?.message ?? error))) return { files: [] };
            throw error;
          });
        const files: any[] = listing?.files ?? [];
        return new Set(files
          .filter((entry) => typeof entry === 'string' || entry.type === 'file')
          .map((entry) => (typeof entry === 'string' ? entry : entry.name)));
      })().catch((error) => {
        this.nativeNames = null;
        throw error;
      });
    }
    return this.nativeNames;
  }

  private async trackNative(name: string, present: boolean): Promise<void> {
    const names = await this.nativeIndex();
    if (present) names.add(name);
    else names.delete(name);
  }

  /**
   * Native: the folder's absolute file-system path (created if missing), for
   * native writers that put files into it directly; null on the web.
   */
  async nativeFolderPath(): Promise<string | null> {
    if (!safeIsNative()) return null;
    await capFs.ensureDir(this.dir, this.directory);
    const uri = await this.nativeFolderUri();
    return uri ? decodeURIComponent(uri.replace(/^file:\/\//, '')) : null;
  }

  /** Native: a file a native writer put into the folder (keeps the existence index current). */
  async noteNativeWrite(key: string): Promise<void> {
    if (safeIsNative()) await this.trackNative(sanitizeKey(key), true);
  }

  /** The file name a key is stored under. */
  fileName(key: string): string {
    return sanitizeKey(key);
  }

  /** Which of `keys` exist - native: one listing for all of them; web: per key. */
  async presentKeys(keys: readonly string[]): Promise<Set<string>> {
    if (safeIsNative()) {
      const names = await this.nativeIndex();
      return new Set(keys.filter((key) => names.has(sanitizeKey(key))));
    }
    const present = await Promise.all(keys.map(async (key) => ((await this.has(key)) ? key : null)));
    return new Set(present.filter((key): key is string => key !== null));
  }

  /** Servable URLs of many keys - native: the folder URI is asked once, no bridge call per key. */
  async servableUrls(keys: readonly string[], mime = 'application/octet-stream'): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    if (safeIsNative()) {
      const folder = await this.nativeFolderUri();
      const convert = (Capacitor as any).convertFileSrc;
      if (folder) {
        keys.forEach((key) => {
          const uri = `${folder}/${sanitizeKey(key)}`;
          urls.set(key, typeof convert === 'function' ? convert(uri) : uri);
        });
        return urls;
      }
    }
    for (const key of keys) {
      const url = await this.getServableUrl(key, mime);
      if (url) urls.set(key, url);
    }
    return urls;
  }

  /** Whether a key exists. */
  async has(key: string): Promise<boolean> {
    if (safeIsNative()) return (await this.nativeIndex()).has(sanitizeKey(key));
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
    if (safeIsNative()) await this.trackNative(sanitizeKey(key), true);
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
    if (safeIsNative() && nativeBundleAvailable()) return this.downloadWithNativeStack(safeKey, url, options);
    if (safeIsNative() && this.directory === null) {
      // The legacy downloadFile needs a Directory (an omitted one means
      // Downloads) and ignores `recursive`: stream into the app cache, then
      // move the bytes into the absolute folder.
      const staging = new CapBlobStore(STAGING_DIR, Directory.Cache);
      await staging.putFromUrl(temporaryKey, url, { ...options, force: true });
      const blob = await staging.getBlob(temporaryKey);
      await staging.delete(temporaryKey);
      if (!blob) throw new Error('putFromUrl failed: staged download unreadable.');
      await this.putBlob(safeKey, blob);
      return (await this.getServableUrl(safeKey)) || '';
    }
    if (safeIsNative()) {
      const finalPath = this.nativePath(safeKey);
      const temporaryPath = this.nativePath(temporaryKey);
      const download = (Filesystem as any).downloadFile;
      await capFs.ensureDir(this.dir, this.directory);
      const dropTemporary = async (): Promise<void> => {
        if (!(await this.nativeIndex()).has(temporaryKey)) return;
        await capFs.delete(temporaryPath, this.directory);
        await this.trackNative(temporaryKey, false);
      };
      await dropTemporary();
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
          const response = await fetchAssetUrl(url, { signal: options.signal });
          if (!response.ok) throw new Error(`putFromUrl failed: ${response.status}`);
          await capFs.writeBlob(temporaryPath, new Blob([await readBytesWithStallGuard(response, { signal: options.signal })]), this.directory);
        }
        await this.trackNative(temporaryKey, true);
        if ((await this.nativeIndex()).has(safeKey)) await capFs.delete(finalPath, this.directory);
        await capFs.rename(temporaryPath, finalPath, this.directory);
        await this.trackNative(temporaryKey, false);
        await this.trackNative(safeKey, true);
      } catch (error) {
        await dropTemporary();
        throw error;
      }
      options.onProgress?.(1);
      return (await capFs.getUri(finalPath, this.directory)) || '';
    }

    if (opfsSupported()) {
      const response = await fetchAssetUrl(url, { signal: options.signal });
      if (!response.ok || !response.body) throw new Error(`putFromUrl failed: ${response.status}`);
      const dir = await opfsDir(this.dir, true);
      if (!dir) throw new Error('putFromUrl failed: OPFS directory unavailable.');
      try {
        await dir.removeEntry(temporaryKey).catch(() => undefined);
        const temporaryHandle = await dir.getFileHandle(temporaryKey, { create: true });
        const writable = await temporaryHandle.createWritable();
        try {
          await consumeBodyWithStallGuard(response, (chunk) => writable.write(chunk), { signal: options.signal, onProgress: options.onProgress });
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

    const response = await fetchAssetUrl(url, { signal: options.signal });
    if (!response.ok) throw new Error(`putFromUrl failed: ${response.status}`);
    await this.putBlob(safeKey, new Blob([await readBytesWithStallGuard(response, { signal: options.signal })]), options);
    return (await this.getServableUrl(safeKey)) || '';
  }

  /**
   * Native app: the Cronet stack streams the body straight into the final file (temp file + rename, nothing
   * crosses the WebView bridge) under an idle watchdog and an abort signal; the partial file is removed on failure.
   */
  private async downloadWithNativeStack(safeKey: string, url: string, options: CapBlobPutOptions): Promise<string> {
    const finalPath = this.nativePath(safeKey);
    await capFs.ensureDir(this.dir, this.directory);
    const target = this.directory === null ? finalPath : fileUriToPath(await capFs.getUri(finalPath, this.directory));
    const result = await nativeDownloadToFile({ url, path: target, signal: options.signal, onProgress: options.onProgress });
    if (result.status !== 200) throw new Error(`putFromUrl failed: ${result.status}`);
    await this.trackNative(safeKey, true);
    options.onProgress?.(1);
    return (await capFs.getUri(finalPath, this.directory)) || '';
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
      const folder = await this.nativeFolderUri();
      const uri = folder ? `${folder}/${sanitizeKey(key)}` : await capFs.getUri(this.nativePath(key), this.directory);
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
    const name = sanitizeKey(key);
    if (!(await this.nativeIndex()).has(name)) return;
    await capFs.delete(this.nativePath(key), this.directory);
    await this.trackNative(name, false);
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

  /** Stored entry metadata used by quota-aware caches (web: one directory pass, file metadata read concurrently). */
  async entries(): Promise<CapBlobEntry[]> {
    if (!safeIsNative() && opfsSupported()) {
      const dir = await opfsDir(this.dir, false);
      if (!dir) return [];
      const reads: Promise<CapBlobEntry | null>[] = [];
      try {
        for await (const [name, handle] of (dir as any).entries()) {
          if (handle?.kind !== 'file') continue;
          reads.push((handle.getFile() as Promise<File>)
            .then((file) => ({ key: name as string, size: file.size, mtime: Number(file.lastModified) || 0 }))
            .catch(() => null));
        }
      } catch {
        /* iteration unsupported */
      }
      return (await Promise.all(reads)).filter((entry): entry is CapBlobEntry => entry !== null);
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
    this.nativeNames = null;
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
  /**
   * Size ledger, oldest first (Map order): read from one listing on first use,
   * then kept by put / remove / clear - a put never lists or opens the store.
   */
  private ledger: Map<string, number> | null = null;
  private ledgerLoading: Promise<Map<string, number>> | null = null;
  private ledgerBytes = 0;

  constructor(options: { dir?: string; maxBytes?: number; directory?: CapDirectory } = {}) {
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
        await this.record(key, await this.store.size(key));
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
    await this.record(key, blob.size);
    await this.enforceBudget();
  }

  has(key: string): Promise<boolean> {
    return this.store.has(key);
  }
  async remove(key: string): Promise<void> {
    await this.store.delete(key);
    await this.record(key, null);
  }
  async totalSize(): Promise<number> {
    await this.loadLedger();
    return this.ledgerBytes;
  }
  /** Files and bytes from the ledger (no listing after the first). */
  async stats(): Promise<{ files: number; bytes: number }> {
    const ledger = await this.loadLedger();
    return { files: ledger.size, bytes: this.ledgerBytes };
  }
  clear(): Promise<void> {
    this.generation += 1;
    this.ledger = new Map();
    this.ledgerLoading = null;
    this.ledgerBytes = 0;
    return this.store.clear();
  }

  private loadLedger(): Promise<Map<string, number>> {
    if (this.ledger) return Promise.resolve(this.ledger);
    this.ledgerLoading ??= this.store.entries().then((entries) => {
      const ledger = new Map<string, number>();
      entries.slice().sort((left, right) => left.mtime - right.mtime).forEach((entry) => ledger.set(entry.key, entry.size));
      if (!this.ledger) {
        this.ledger = ledger;
        this.ledgerBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
      }
      return this.ledger;
    });
    return this.ledgerLoading;
  }

  /** Ledger update: a written entry moves to the newest end; null drops it. */
  private async record(key: string, size: number | null): Promise<void> {
    const ledger = await this.loadLedger();
    this.ledgerBytes -= ledger.get(key) ?? 0;
    ledger.delete(key);
    if (size === null) return;
    ledger.set(key, size);
    this.ledgerBytes += size;
  }

  /** Evict the oldest ledger entries until under the byte budget. */
  enforceBudget(): Promise<void> {
    const operation = this.evictionChain.catch(() => undefined).then(async () => {
      const ledger = await this.loadLedger();
      if (this.ledgerBytes <= this.maxBytes) return;
      const victims: string[] = [];
      let total = this.ledgerBytes;
      for (const [key, size] of ledger) {
        if (total <= this.maxBytes) break;
        victims.push(key);
        total -= size;
      }
      for (const key of victims) await this.remove(key);
    });
    this.evictionChain = operation;
    return operation;
  }
}

