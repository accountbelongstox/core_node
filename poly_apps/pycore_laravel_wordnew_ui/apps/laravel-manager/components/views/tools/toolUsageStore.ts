/** Favorites and run history for the Tools page (one store, canonical ids, size-capped). */
import { useSyncExternalStore } from 'react';
import { createRuntimeStore } from '@/core/persistence/RuntimeStore';
import { LaravelManagerStorageKeys } from '@/apps/laravel-manager/persistence/LaravelManagerStorageKeys';
import { canonicalToolId } from './toolCatalog';

const HISTORY_LIMIT = 50;
const ENTRY_BYTES_LIMIT = 16 * 1024;

export interface ToolUsageEntry {
  toolId: string;
  variant: string;
  timestamp: number;
  input: unknown;
  output: unknown;
}

interface ToolUsageState {
  favorites: string[];
  history: ToolUsageEntry[];
}

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode: usage stays in memory */
  }
};

const capPayload = (value: unknown): unknown => {
  try {
    return JSON.stringify(value ?? null).length > ENTRY_BYTES_LIMIT ? null : value;
  } catch {
    return null;
  }
};

const restoreState = (): ToolUsageState => {
  const favorites = readJson<string[]>(LaravelManagerStorageKeys.TOOL_FAVORITES, []);
  const history = readJson<Array<Partial<ToolUsageEntry>>>(LaravelManagerStorageKeys.TOOL_HISTORY, []);
  const seen = new Set<string>();
  return {
    favorites: Array.from(new Set(favorites.filter((id) => typeof id === 'string').map(canonicalToolId))),
    history: history
      .filter((entry): entry is Partial<ToolUsageEntry> & { toolId: string } => typeof entry?.toolId === 'string')
      .map((entry) => ({
        toolId: canonicalToolId(entry.toolId),
        variant: entry.variant ?? entry.toolId,
        timestamp: entry.timestamp ?? 0,
        input: entry.input ?? null,
        output: entry.output ?? null,
      }))
      .filter((entry) => (seen.has(entry.toolId) ? false : (seen.add(entry.toolId), true))),
  };
};

const store = createRuntimeStore<ToolUsageState>({
  defaults: () => ({ favorites: [], history: [] }),
  restore: restoreState,
  persist: (state) => {
    writeJson(LaravelManagerStorageKeys.TOOL_FAVORITES, state.favorites);
    writeJson(LaravelManagerStorageKeys.TOOL_HISTORY, state.history);
  },
  persistDebounceMs: 300,
});

export const toolUsageStore = {
  getState: store.getState,
  subscribe: store.subscribe,
  toggleFavorite(toolId: string): void {
    const id = canonicalToolId(toolId);
    const { favorites } = store.getState();
    store.patch({ favorites: favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id] });
  },
  record(toolId: string, variant: string, input: unknown, output: unknown): void {
    const id = canonicalToolId(toolId);
    const entry: ToolUsageEntry = { toolId: id, variant, timestamp: Date.now(), input: capPayload(input), output: capPayload(output) };
    store.patch({ history: [entry, ...store.getState().history.filter((h) => h.toolId !== id)].slice(0, HISTORY_LIMIT) });
  },
  lastRun(toolId: string): ToolUsageEntry | undefined {
    const id = canonicalToolId(toolId);
    return store.getState().history.find((h) => h.toolId === id);
  },
};

export const useToolUsage = (): ToolUsageState => useSyncExternalStore(store.subscribe, store.getState, store.getState);
