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

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { blobToBase64 } from '../utils/blob';

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

export function safeIsNative(): boolean {
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

