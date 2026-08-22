/** React hooks, JSONL helpers, and bounded small-file cache. */
import { useCallback, useEffect, useState } from 'react';
import { Directory } from '@capacitor/filesystem';
import type { CapDirEntry, UseJsonFileResult } from './CapFilesystemCore';
import { CapFilesystemService, CapJsonStore, capFs } from './CapFilesystemCore';
import {
  directorySize,
  getStorageEstimate,
  requestPersistentStorage,
  toObjectUrl,
} from './CapFilesystemCache';
import type { CapStorageEstimate } from './CapFilesystemCache';
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


