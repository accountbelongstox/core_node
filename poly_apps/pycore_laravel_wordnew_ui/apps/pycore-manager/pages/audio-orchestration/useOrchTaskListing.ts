/**
 * Server-side paginated task list of one source tab (pycore
 * `ui/audio_orch/tasks/list`): page / name query / per-source counts, plus the
 * live refresh: task-changed pushes (debounced) and polling while any listed
 * task is running.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  pycoreApi,
  pycoreEventBus,
  PYCORE_EVENT_TOPICS,
  type OrchTaskSource,
  type OrchTaskSummary,
} from '@/apps/pycore-manager/api';
import { ORCH_L, ORCH_POLL_MS, orchErrorMessage } from './orchShared';
import { usePolling } from '../../../../core/tasks/usePolling';
import { ORCH_TASK_PAGE_SIZE } from './orchSources';

const PUSH_REFETCH_DEBOUNCE_MS = 500;
const QUERY_DEBOUNCE_MS = 300;

interface ListView {
  source: OrchTaskSource;
  page: number;
  query: string;
}

interface Listing {
  tasks: OrchTaskSummary[];
  counts: Record<string, number>;
  total: number;
  sources: OrchTaskSource[];
}

const EMPTY_LISTING: Listing = { tasks: [], counts: {}, total: 0, sources: [] };

const sameView = (a: ListView, b: ListView): boolean => a.source === b.source && a.page === b.page && a.query === b.query;

export function useOrchTaskListing(initialSource: OrchTaskSource) {
  const [source, setSource] = useState<OrchTaskSource>(initialSource);
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [listing, setListing] = useState<Listing>(EMPTY_LISTING);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const viewRef = useRef<ListView>({ source, page, query });
  const loadingRef = useRef(false);
  const reloadQueuedRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  viewRef.current = { source, page, query };

  const load = useCallback(async () => {
    if (loadingRef.current) {
      reloadQueuedRef.current = true;
      return;
    }
    loadingRef.current = true;
    try {
      do {
        reloadQueuedRef.current = false;
        const view = viewRef.current;
        try {
          const response = await pycoreApi.orchTasksList({
            source: view.source, page: view.page, page_size: ORCH_TASK_PAGE_SIZE, query: view.query,
          });
          if (!response.success) throw new Error(ORCH_L.loadFailed);
          if (!sameView(view, viewRef.current)) {
            reloadQueuedRef.current = true;
            continue;
          }
          const total = Number(response.total) || 0;
          const lastPage = Math.max(1, Math.ceil(total / ORCH_TASK_PAGE_SIZE));
          setListing({
            tasks: Array.isArray(response.tasks) ? response.tasks : [],
            counts: response.counts || {},
            total,
            sources: Array.isArray(response.sources) ? response.sources : [],
          });
          setRevision((value) => value + 1);
          setError(null);
          if (view.page > lastPage) setPage(lastPage);
        } catch (e) {
          setError(orchErrorMessage(e, ORCH_L.loadFailed));
        }
      } while (reloadQueuedRef.current);
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [source, page, query, load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = queryInput.trim();
      if (next === viewRef.current.query) return;
      setQuery(next);
      setPage(1);
    }, QUERY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const selectSource = useCallback((next: OrchTaskSource) => {
    if (next === viewRef.current.source) return;
    setSource(next);
    setPage(1);
    setQueryInput('');
    setQuery('');
  }, []);

  useEffect(() => pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.audioOrchestrationTasksChanged, () => {
    if (pushTimerRef.current) return;
    pushTimerRef.current = setTimeout(() => {
      pushTimerRef.current = null;
      void load();
    }, PUSH_REFETCH_DEBOUNCE_MS);
  }), [load]);

  const running = listing.tasks.some((task) => task.running || task.status === 'generating' || task.progress?.sync_pending);
  usePolling(() => load(), { intervalMs: ORCH_POLL_MS, enabled: running, immediate: false });

  useEffect(() => () => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
  }, []);

  return {
    source,
    selectSource,
    page,
    setPage,
    queryInput,
    setQueryInput,
    pageSize: ORCH_TASK_PAGE_SIZE,
    tasks: listing.tasks,
    counts: listing.counts,
    total: listing.total,
    sources: listing.sources,
    revision,
    error,
    setError,
    reload: load,
  };
}
