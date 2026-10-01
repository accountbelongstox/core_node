/**
 * AiHubCatalogStore — the ONE UI copy of the manifest-driven AI hub catalog
 * (`ui/ai_hub/catalog`): categories, boot verdicts, runtime state, capabilities
 * and test schemas. An `ai_hub.boot.changed` topic patches the boot verdict of
 * the named entry in place (or re-reads the catalog when the payload does not
 * name one); mounting keeps the subscription alive.
 */
import { useEffect, useMemo } from 'react';
import { pycoreApi } from '../../../core/integrations/pycore/PycoreApi';
import { aiHubData, aiHubEntryKey, aiHubFailureCode } from '../../../core/integrations/pycore/PycoreApiAiHub';
import { createPycoreLiveSource } from '../../../core/integrations/pycore/PycoreLiveSource';
import { PYCORE_EVENT_TOPICS } from '../../../core/integrations/pycore/PycoreEventTopics';
import { PYCORE_HTTP_DEFAULTS } from '../../../core/integrations/pycore/PycoreNetwork';
import type {
  AiHubBootRecord,
  AiHubCatalogData,
  AiHubCategory,
  AiHubEntry,
} from '../../../core/integrations/pycore/PycoreAiHubTypes';
import { PC_REQUEST_FAILED_CODE } from '../utils/pcErrorCodes';
import { createPcExternalStore } from './PcExternalStore';

const REFRESH_DEBOUNCE_MS = 400;

export interface AiHubCatalogState {
  categories: AiHubCategory[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  receivedAt: number;
}

const store = createPcExternalStore<AiHubCatalogState>({
  categories: [], loaded: false, loading: false, error: null, receivedAt: 0,
});

let fetchInFlight: Promise<void> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function getAiHubCatalogState(): AiHubCatalogState {
  return store.get();
}

function applyCatalog(data: AiHubCatalogData): void {
  store.set({
    categories: Array.isArray(data.categories) ? data.categories : [],
    loaded: true, loading: false, error: null, receivedAt: Date.now(),
  });
}

export function refreshAiHubCatalog(): Promise<void> {
  if (fetchInFlight) return fetchInFlight;
  if (!store.get().loaded) store.set((state) => ({ ...state, loading: true }));
  fetchInFlight = pycoreApi.getAiHubCatalog()
    .then((answer) => {
      const data = aiHubData<AiHubCatalogData>(answer);
      if (data) applyCatalog(data);
      else store.set((state) => ({ ...state, loading: false, error: aiHubFailureCode(answer) || PC_REQUEST_FAILED_CODE }));
    })
    .catch(() => {
      store.set((state) => ({ ...state, loading: false, error: PC_REQUEST_FAILED_CODE }));
    })
    .finally(() => { fetchInFlight = null; });
  return fetchInFlight;
}

function scheduleRefresh(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { debounceTimer = null; void refreshAiHubCatalog(); }, REFRESH_DEBOUNCE_MS);
}

function sameEntry(entry: AiHubEntry, record: AiHubBootRecord): boolean {
  if (record.key) return aiHubEntryKey(entry) === record.key;
  return !!record.id && entry.id === record.id && (!record.category || entry.category === record.category);
}

function onBootChanged(payload: unknown): void {
  const record = payload as AiHubBootRecord | null;
  if (!record || !record.state || !(record.key || record.id)) {
    scheduleRefresh();
    return;
  }
  store.set((state) => ({
    ...state,
    categories: state.categories.map((category) => ({
      ...category,
      entries: category.entries.map((entry) => (sameEntry(entry, record)
        ? { ...entry, boot: { ...entry.boot, ...record } }
        : entry)),
    })),
  }));
  scheduleRefresh();
}

const liveSource = createPycoreLiveSource({
  topics: { [PYCORE_EVENT_TOPICS.aiHubBootChanged]: onBootChanged },
  refresh: refreshAiHubCatalog,
  fallbackMs: PYCORE_HTTP_DEFAULTS.fallbackPollMs,
  onRelease: () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = null;
  },
});

/** Re-verify one masked entry (or every blocked entry), then re-read the catalog. */
export async function retryAiHubBoot(entry?: AiHubEntry): Promise<void> {
  try {
    await pycoreApi.retryAiHubBoot(entry);
  } finally {
    await refreshAiHubCatalog();
  }
}

/** Entry by key ("tts:azure") or, when scoped by category or unambiguous, by bare id or alias. */
export function findAiHubEntry(
  categories: AiHubCategory[],
  name: string,
  category?: string,
): AiHubEntry | null {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  for (const group of categories) {
    if (category && group.id !== category) continue;
    const hit = group.entries.find((entry) => aiHubEntryKey(entry).toLowerCase() === wanted
      || entry.id.toLowerCase() === wanted
      || (entry.aliases ?? []).some((alias) => alias.toLowerCase() === wanted));
    if (hit) return hit;
  }
  return null;
}

export interface AiHubCatalogHook extends AiHubCatalogState {
  entries: AiHubEntry[];
  find: (name: string, category?: string) => AiHubEntry | null;
  refresh: () => Promise<void>;
}

/** Shared AI hub catalog; mounting keeps the boot-topic subscription alive. */
export function useAiHubCatalog(): AiHubCatalogHook {
  useEffect(() => {
    liveSource.retain();
    return liveSource.release;
  }, []);
  const state = store.use();
  return useMemo(() => ({
    ...state,
    entries: state.categories.flatMap((category) => category.entries),
    find: (name: string, category?: string) => findAiHubEntry(state.categories, name, category),
    refresh: refreshAiHubCatalog,
  }), [state]);
}
