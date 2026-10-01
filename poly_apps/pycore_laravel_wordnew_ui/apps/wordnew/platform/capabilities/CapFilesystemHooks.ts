/** React hooks, JSONL helpers, and bounded small-file cache. */
import { useCallback, useEffect, useState } from 'react';
import { Directory } from '@capacitor/filesystem';
import type { CapDirEntry, CapDirectory, UseJsonFileResult } from './CapFilesystemCore';
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
  directory?: CapDirectory,
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
  directory?: CapDirectory,
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
export async function appendJsonl(path: string, obj: unknown, directory?: CapDirectory, fs: CapFilesystemService = capFs): Promise<void> {
  await fs.appendText(path, JSON.stringify(obj) + '\n', directory);
}

/** Read all lines of a `.jsonl` file, parsed (bad lines skipped). */
export async function readJsonl<T = unknown>(path: string, directory?: CapDirectory, fs: CapFilesystemService = capFs): Promise<T[]> {
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
export async function tailJsonl<T = unknown>(path: string, n: number, directory?: CapDirectory, fs: CapFilesystemService = capFs): Promise<T[]> {
  const all = await readJsonl<T>(path, directory, fs);
  return all.slice(Math.max(0, all.length - n));
}

/** Rewrite a `.jsonl` file from an array (e.g. after pruning). */
export async function writeJsonl(path: string, items: unknown[], directory?: CapDirectory, fs: CapFilesystemService = capFs): Promise<void> {
  await fs.writeText(path, items.map((i) => JSON.stringify(i)).join('\n') + (items.length ? '\n' : ''), directory);
}
