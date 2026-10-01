/**
 * Server-side paginated task list of one source tab (pycore
 * `ui/audio_orch/tasks/list`): page / name query / per-source counts, plus the
 * live refresh: a status push reloads the page, a progress push patches the
 * listed row in place.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  pycoreApi,
  pycoreEventBus,
  PYCORE_EVENT_TOPICS,
  type OrchTaskSource,
  type OrchTaskSummary,
} from '@/apps/pycore-manager/api';
import { ORCH_L, orchErrorMessage } from './orchShared';
import { watchReconnect } from '../../../../core/integrations/pycore/PycoreLiveSource';
import { readQueueProgress } from '../../../../core/contracts/QueueProgress';
import { ORCH_TASK_PAGE_SIZE } from './orchSources';

const QUERY_DEBOUNCE_MS = 300;

/** `audio_orchestration.tasks.changed`: a status transition, or a throttled progress delta (template over the task's segments). */
interface OrchTaskChange {
  task_id?: string;
  source?: string;
  status?: string;
  progress?: unknown;
}

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

  useEffect(() => {
    const offTopic = pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.audioOrchestrationTasksChanged, (payload: OrchTaskChange | null) => {
      const progress = readQueueProgress(payload?.progress);
      if (!progress || !payload?.task_id) {
        void load();
        return;
      }
      setListing((held) => {
        const known = held.tasks.some((task) => task.task_id === payload.task_id);
        if (!known) return held;
        return {
          ...held,
          tasks: held.tasks.map((task) => (task.task_id === payload.task_id
            ? { ...task, status: payload.status ?? task.status, segments_done: progress.done, segments_total: progress.total }
            : task)),
        };
      });
    });
    const offReconnect = watchReconnect(() => { void load(); });
    return () => { offTopic(); offReconnect(); };
  }, [load]);

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
