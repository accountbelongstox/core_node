/**
 * Browser-side cache of generated task files: one Blob + object URL per
 * (task, file name, modified_at), shared by every component that shows the same
 * file. The entry is created on first use, loaded on demand (play / download)
 * and its object URL is revoked when the last user releases it (unmount, or the
 * file entry changed).
 */
import {
  ORCH_FILE_ABORTED_CODE,
  ORCH_FILE_MAX_BUFFER_BYTES,
  pycoreApi,
  type OrchTaskFile,
} from '@/apps/pycore-manager/api';
import { ORCH_L, orchErrorMessage } from './orchShared';

export interface OrchFileState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  loaded: number;
  total: number;
  url: string;
  blob: Blob | null;
  error: string | null;
}

interface CacheEntry {
  state: OrchFileState;
  refs: number;
  abort: AbortController;
  pending: Promise<Blob | null> | null;
  listeners: Set<() => void>;
}

const IDLE_STATE: OrchFileState = { status: 'idle', loaded: 0, total: 0, url: '', blob: null, error: null };
const entries = new Map<string, CacheEntry>();

export const orchFileKey = (taskId: string, file: Pick<OrchTaskFile, 'name' | 'modified_at'>): string => (
  `${taskId}|${file.name}|${file.modified_at}`
);

/** True when the file is too large to buffer in the browser. */
export const orchFileTooLarge = (file: Pick<OrchTaskFile, 'bytes'>): boolean => file.bytes > ORCH_FILE_MAX_BUFFER_BYTES;

const VIDEO_EXTENSION = '.mp4';

export const orchFileIsVideo = (file: Pick<OrchTaskFile, 'kind' | 'name'>): boolean => (
  file.kind === 'video' || file.name.toLowerCase().endsWith(VIDEO_EXTENSION)
);

export const orchFileState = (key: string): OrchFileState => entries.get(key)?.state || IDLE_STATE;

function update(entry: CacheEntry, patch: Partial<OrchFileState>): void {
  entry.state = { ...entry.state, ...patch };
  entry.listeners.forEach((listener) => listener());
}

export function retainOrchFile(key: string, listener: () => void): () => void {
  let entry = entries.get(key);
  if (!entry) {
    entry = { state: IDLE_STATE, refs: 0, abort: new AbortController(), pending: null, listeners: new Set() };
    entries.set(key, entry);
  }
  entry.refs += 1;
  entry.listeners.add(listener);
  const held = entry;
  return () => {
    held.listeners.delete(listener);
    held.refs -= 1;
    if (held.refs > 0) return;
    held.abort.abort();
    if (held.state.url) URL.revokeObjectURL(held.state.url);
    if (entries.get(key) === held) entries.delete(key);
  };
}

/** Loads the file once (concurrent callers share the request); resolves null on failure. */
export function loadOrchFile(key: string, taskId: string, file: OrchTaskFile): Promise<Blob | null> {
  const entry = entries.get(key);
  if (!entry) return Promise.resolve(null);
  if (entry.state.blob) return Promise.resolve(entry.state.blob);
  if (entry.pending) return entry.pending;
  if (orchFileTooLarge(file)) {
    update(entry, { status: 'error', error: ORCH_L.fileTooLarge });
    return Promise.resolve(null);
  }
  update(entry, { status: 'loading', loaded: 0, total: file.bytes, error: null });
  entry.pending = pycoreApi.orchFetchTaskFile(taskId, file.name, {
    signal: entry.abort.signal,
    onProgress: (loaded: number, total: number) => update(entry, { loaded, total }),
  }).then((fetched) => {
    if (entry.abort.signal.aborted) return null;
    update(entry, { status: 'ready', url: URL.createObjectURL(fetched.blob), blob: fetched.blob });
    return fetched.blob;
  }).catch((failure: unknown) => {
    if ((failure as { error?: string } | null)?.error !== ORCH_FILE_ABORTED_CODE) {
      update(entry, { status: 'error', error: orchErrorMessage(failure, ORCH_L.fileLoadFailed) });
    }
    return null;
  }).finally(() => {
    entry.pending = null;
  });
  return entry.pending;
}

/** Saves a loaded file under its own name. */
export function saveOrchFile(key: string, fileName: string): void {
  const url = orchFileState(key).url;
  if (!url) return;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
