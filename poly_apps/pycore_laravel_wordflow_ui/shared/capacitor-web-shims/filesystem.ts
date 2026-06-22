/**
 * Web shim for @capacitor/filesystem.
 *
 * Backs a useful subset of the Capacitor Filesystem plugin with an
 * IndexedDB-backed virtual filesystem (path -> { data, mtime }). This gives the
 * web shell durable read/write/append/delete/readdir/stat so export, import and
 * offline caching work without the native plugin. Aliased on the web build.
 *
 * NOTE: primarily provided for the wordnew mobile APP (native Capacitor build);
 * this browser fallback keeps the web shell working. `directory` is folded into
 * the key namespace; `getUri` returns an opaque vfs:// uri.
 */

export enum Directory {
  Documents = 'DOCUMENTS',
  Data = 'DATA',
  Library = 'LIBRARY',
  Cache = 'CACHE',
  External = 'EXTERNAL',
  ExternalStorage = 'EXTERNAL_STORAGE',
}

export enum Encoding {
  UTF8 = 'utf8',
  ASCII = 'ascii',
  UTF16 = 'utf16',
}

export interface FileWriteOptions {
  path: string;
  data: string;
  directory?: Directory;
  encoding?: Encoding;
  recursive?: boolean;
}
export interface FileReadOptions {
  path: string;
  directory?: Directory;
  encoding?: Encoding;
}
export interface FileDeleteOptions {
  path: string;
  directory?: Directory;
}
export interface ReaddirOptions {
  path: string;
  directory?: Directory;
}
export interface StatOptions {
  path: string;
  directory?: Directory;
}

const DB_NAME = 'cap_web_fs';
const STORE = 'files';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

function key(path: string, directory?: Directory): string {
  return `${directory || 'DATA'}:/${path.replace(/^\/+/, '')}`;
}

interface Entry {
  data: string; // base64 (binary) or text
  encoding: 'base64' | 'utf8';
  mtime: number;
  ctime: number;
  size: number;
}

async function get(k: string): Promise<Entry | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(k);
    req.onsuccess = () => resolve(req.result as Entry | undefined);
    req.onerror = () => reject(req.error);
  });
}
async function put(k: string, entry: Entry): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry, k);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function del(k: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(k);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function allKeys(): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String));
    req.onerror = () => reject(req.error);
  });
}

export const Filesystem = {
  async writeFile(options: FileWriteOptions): Promise<{ uri: string }> {
    const k = key(options.path, options.directory);
    const isBase64 = !options.encoding; // plugin: no encoding => base64 binary
    const now = Date.now();
    const prior = await get(k);
    await put(k, {
      data: options.data,
      encoding: isBase64 ? 'base64' : 'utf8',
      mtime: now,
      ctime: prior?.ctime ?? now,
      size: options.data.length,
    });
    return { uri: `vfs://${k}` };
  },
  async readFile(options: FileReadOptions): Promise<{ data: string }> {
    const entry = await get(key(options.path, options.directory));
    if (!entry) throw new Error(`File does not exist: ${options.path}`);
    return { data: entry.data };
  },
  async appendFile(options: FileWriteOptions): Promise<void> {
    const k = key(options.path, options.directory);
    const entry = await get(k);
    const data = (entry?.data ?? '') + options.data;
    const now = Date.now();
    await put(k, {
      data,
      encoding: options.encoding ? 'utf8' : 'base64',
      mtime: now,
      ctime: entry?.ctime ?? now,
      size: data.length,
    });
  },
  async deleteFile(options: FileDeleteOptions): Promise<void> {
    await del(key(options.path, options.directory));
  },
  async mkdir(_options?: { path: string; directory?: Directory; recursive?: boolean }): Promise<void> {
    /* directories are implicit in the flat key store; no-op */
  },
  async rmdir(options: ReaddirOptions): Promise<void> {
    const prefix = key(options.path, options.directory).replace(/\/+$/, '') + '/';
    const keys = await allKeys();
    await Promise.all(keys.filter((k) => k.startsWith(prefix)).map((k) => del(k)));
  },
  async readdir(options: ReaddirOptions): Promise<{ files: Array<{ name: string; type: string; size: number; mtime: number; uri: string }> }> {
    const base = key(options.path, options.directory).replace(/\/+$/, '') + '/';
    const keys = await allKeys();
    const names = new Set<string>();
    const files: Array<{ name: string; type: string; size: number; mtime: number; uri: string }> = [];
    for (const k of keys) {
      if (!k.startsWith(base)) continue;
      const rest = k.slice(base.length);
      const seg = rest.split('/')[0];
      if (names.has(seg)) continue;
      names.add(seg);
      const isFile = rest.indexOf('/') === -1;
      const entry = isFile ? await get(k) : undefined;
      files.push({
        name: seg,
        type: isFile ? 'file' : 'directory',
        size: entry?.size ?? 0,
        mtime: entry?.mtime ?? 0,
        uri: `vfs://${base}${seg}`,
      });
    }
    return { files };
  },
  async stat(options: StatOptions): Promise<{ type: string; size: number; ctime: number; mtime: number; uri: string }> {
    const k = key(options.path, options.directory);
    const entry = await get(k);
    if (!entry) throw new Error(`File does not exist: ${options.path}`);
    return { type: 'file', size: entry.size, ctime: entry.ctime, mtime: entry.mtime, uri: `vfs://${k}` };
  },
  async rename(options: { from: string; to: string; directory?: Directory; toDirectory?: Directory }): Promise<void> {
    const fromK = key(options.from, options.directory);
    const toK = key(options.to, options.toDirectory ?? options.directory);
    const entry = await get(fromK);
    if (!entry) throw new Error(`File does not exist: ${options.from}`);
    await put(toK, entry);
    await del(fromK);
  },
  async copy(options: { from: string; to: string; directory?: Directory; toDirectory?: Directory }): Promise<{ uri: string }> {
    const fromK = key(options.from, options.directory);
    const toK = key(options.to, options.toDirectory ?? options.directory);
    const entry = await get(fromK);
    if (!entry) throw new Error(`File does not exist: ${options.from}`);
    await put(toK, { ...entry, mtime: Date.now() });
    return { uri: `vfs://${toK}` };
  },
  async getUri(options: { path: string; directory?: Directory }): Promise<{ uri: string }> {
    return { uri: `vfs://${key(options.path, options.directory)}` };
  },
  async requestPermissions(): Promise<{ publicStorage: string }> {
    return { publicStorage: 'granted' };
  },
  async checkPermissions(): Promise<{ publicStorage: string }> {
    return { publicStorage: 'granted' };
  },
};

export default { Filesystem, Directory, Encoding };
