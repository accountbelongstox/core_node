/**
 * useCacheStore — a Chrome-accessible cache "directory" backed by the
 * Origin Private File System (OPFS, `navigator.storage.getDirectory()`).
 *
 * OPFS is a real, sandboxed, Chrome-accessible directory tree that supports
 * subdirectories. We create a root `cache/` directory and one subdirectory per
 * NAMESPACE so language / translation / dictionary cache data can be stored
 * separately:
 *
 *   cache/language/
 *   cache/translation/
 *   cache/dictionary/
 *
 * Every operation is wrapped in try/catch: if OPFS is unavailable or throws,
 * the store reports itself unavailable (so the UI can fall back to a read-only
 * display of the intended structure) instead of crashing the popup.
 */

export const CACHE_ROOT = 'cache';
export const NAMESPACES = ['language', 'translation', 'dictionary'] as const;
export type CacheNamespace = (typeof NAMESPACES)[number];

export interface NamespaceInfo {
  namespace: CacheNamespace;
  fileCount: number;
  totalBytes: number;
}

/** Whether the OPFS API surface exists in this runtime. */
export function isAvailable(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.storage &&
      typeof navigator.storage.getDirectory === 'function'
    );
  } catch {
    return false;
  }
}

/** A human-readable description of where cache data lives. */
export function describeLocation(): string {
  if (isAvailable()) {
    return `OPFS · ${CACHE_ROOT}/{${NAMESPACES.join(',')}}`;
  }
  return `OPFS unavailable — intended: ${CACHE_ROOT}/{${NAMESPACES.join(',')}} (read-only)`;
}

/**
 * Resolve the root `cache/` directory handle, creating it if needed.
 * Throws if OPFS is unavailable — callers should guard with isAvailable()
 * or catch.
 */
async function getRoot(): Promise<FileSystemDirectoryHandle> {
  const opfsRoot = await navigator.storage.getDirectory();
  return opfsRoot.getDirectoryHandle(CACHE_ROOT, { create: true });
}

/** Resolve a single namespace subdirectory, creating it if needed. */
async function getNamespaceDir(ns: CacheNamespace): Promise<FileSystemDirectoryHandle> {
  const root = await getRoot();
  return root.getDirectoryHandle(ns, { create: true });
}

/**
 * Ensure the root and every namespace subdirectory exist.
 * Returns true on success, false if OPFS is unavailable / errored.
 */
export async function ensureNamespaces(): Promise<boolean> {
  if (!isAvailable()) return false;
  try {
    const root = await getRoot();
    for (const ns of NAMESPACES) {
      await root.getDirectoryHandle(ns, { create: true });
    }
    return true;
  } catch (error) {
    console.warn('[useCacheStore] ensureNamespaces failed:', error);
    return false;
  }
}

/** Sanitize a cache key into a safe file name and append a `.json` suffix. */
function keyToFileName(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  return safe.endsWith('.json') ? safe : `${safe}.json`;
}

/**
 * List each namespace with its file count and total byte size.
 * Always returns one entry per namespace (zeroed if it can't be read).
 */
export async function listNamespaces(): Promise<NamespaceInfo[]> {
  const results: NamespaceInfo[] = NAMESPACES.map((namespace) => ({
    namespace,
    fileCount: 0,
    totalBytes: 0,
  }));

  if (!isAvailable()) return results;

  try {
    const root = await getRoot();
    for (let i = 0; i < NAMESPACES.length; i++) {
      const ns = NAMESPACES[i];
      try {
        const dir = await root.getDirectoryHandle(ns, { create: true });
        let fileCount = 0;
        let totalBytes = 0;
        // FileSystemDirectoryHandle is async-iterable over [name, handle].
        for await (const [, handle] of (dir as any).entries() as AsyncIterable<
          [string, FileSystemHandle]
        >) {
          if (handle.kind === 'file') {
            try {
              const file = await (handle as FileSystemFileHandle).getFile();
              fileCount += 1;
              totalBytes += file.size;
            } catch {
              // Skip files that can't be read.
            }
          }
        }
        results[i] = { namespace: ns, fileCount, totalBytes };
      } catch (error) {
        console.warn(`[useCacheStore] listNamespaces(${ns}) failed:`, error);
      }
    }
  } catch (error) {
    console.warn('[useCacheStore] listNamespaces failed:', error);
  }

  return results;
}

/** Read and parse a JSON value from `cache/<ns>/<key>.json`. */
export async function readJson<T = unknown>(
  ns: CacheNamespace,
  key: string,
): Promise<T | null> {
  if (!isAvailable()) return null;
  try {
    const dir = await getNamespaceDir(ns);
    const fileHandle = await dir.getFileHandle(keyToFileName(key), { create: false });
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch (error) {
    // Missing file is an expected miss, not an error worth surfacing.
    return null;
  }
}

/** Serialize and write a JSON value to `cache/<ns>/<key>.json`. */
export async function writeJson(
  ns: CacheNamespace,
  key: string,
  value: unknown,
): Promise<boolean> {
  if (!isAvailable()) return false;
  try {
    const dir = await getNamespaceDir(ns);
    const fileHandle = await dir.getFileHandle(keyToFileName(key), { create: true });
    const writable = await fileHandle.createWritable();
    // Always release the OPFS write lock: close() commits on success, abort()
    // discards partial bytes + releases the lock if write/close threw. Without
    // this, a throw from write() left the stream open, hanging later writes to
    // the same key and leaving a partial file on disk.
    let committed = false;
    try {
      await writable.write(JSON.stringify(value));
      await writable.close();
      committed = true;
    } finally {
      if (!committed) {
        try {
          await writable.abort();
        } catch {
          // Best-effort lock release; nothing else we can do.
        }
      }
    }
    return true;
  } catch (error) {
    console.warn(`[useCacheStore] writeJson(${ns}/${key}) failed:`, error);
    return false;
  }
}

/** Remove a single cache entry `cache/<ns>/<key>.json`. */
export async function remove(ns: CacheNamespace, key: string): Promise<boolean> {
  if (!isAvailable()) return false;
  try {
    const dir = await getNamespaceDir(ns);
    await dir.removeEntry(keyToFileName(key));
    return true;
  } catch (error) {
    console.warn(`[useCacheStore] remove(${ns}/${key}) failed:`, error);
    return false;
  }
}

/** Delete every file inside a namespace (the subdirectory itself is recreated). */
export async function clearNamespace(ns: CacheNamespace): Promise<boolean> {
  if (!isAvailable()) return false;
  try {
    const root = await getRoot();
    // Recursively remove the namespace dir, then recreate it empty.
    await root.removeEntry(ns, { recursive: true });
    await root.getDirectoryHandle(ns, { create: true });
    return true;
  } catch (error) {
    console.warn(`[useCacheStore] clearNamespace(${ns}) failed:`, error);
    return false;
  }
}

/** Clear every namespace. */
export async function clearAll(): Promise<boolean> {
  if (!isAvailable()) return false;
  let ok = true;
  for (const ns of NAMESPACES) {
    const cleared = await clearNamespace(ns);
    ok = ok && cleared;
  }
  return ok;
}

export function useCacheStore() {
  return {
    CACHE_ROOT,
    NAMESPACES,
    isAvailable,
    describeLocation,
    ensureNamespaces,
    listNamespaces,
    readJson,
    writeJson,
    remove,
    clearNamespace,
    clearAll,
  };
}
