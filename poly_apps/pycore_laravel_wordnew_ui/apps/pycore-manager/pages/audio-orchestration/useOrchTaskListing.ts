/**
 * Task list of one source tab (pycore `ui/audio_orch/tasks/list`, keyset pages,
 * newest created first) with the name query and per-source counts, plus the
 * recently active strip. A status push reloads the page; a progress push patches
 * the listed rows in place, so rows never move while a task generates.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  pycoreApi,
  pycoreEventBus,
  PYCORE_EVENT_TOPICS,
  type OrchTaskSource,
  type OrchTaskSummary,
  type OrchTasksListResponse,
} from '@/apps/pycore-manager/api';
import { ORCH_L, orchErrorMessage } from './orchShared';
import { watchEventGap } from '../../../../core/integrations/pycore/PycoreLiveSource';
import { useKeysetPages } from '../../../../core/integrations/pycore/useKeysetPages';
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

function patchRow(task: OrchTaskSummary, change: OrchTaskChange, done: number, total: number): OrchTaskSummary {
  return task.task_id === change.task_id
    ? { ...task, status: change.status ?? task.status, segments_done: done, segments_total: total }
    : task;
}

export function useOrchTaskListing(initialSource: OrchTaskSource) {
  const [source, setSource] = useState<OrchTaskSource>(initialSource);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<OrchTaskSummary[]>([]);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (cursor: string | null): Promise<OrchTasksListResponse> => {
    const response = await pycoreApi.orchTasksList({ source, cursor, limit: ORCH_TASK_PAGE_SIZE, query });
    if (!response.success) throw new Error(ORCH_L.loadFailed);
    return response;
  }, [source, query]);
  const pages = useKeysetPages<OrchTaskSummary, OrchTasksListResponse>(fetchPage);
  const { page, reload, patchItems } = pages;

  const loadActive = useCallback(async () => {
    try {
      const response = await pycoreApi.orchTasksActive();
      if (response.success) setActive(Array.isArray(response.items) ? response.items : []);
    } catch { /* keep the held strip */ }
  }, []);

  const load = useCallback(async () => {
    await Promise.all([reload(), loadActive()]);
  }, [reload, loadActive]);

  useEffect(() => { void loadActive(); }, [loadActive]);

  useEffect(() => {
    if (page) setRevision((value) => value + 1);
  }, [page]);

  useEffect(() => {
    setError(pages.error ? orchErrorMessage(pages.error, ORCH_L.loadFailed) : null);
  }, [pages.error]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(queryInput.trim()), QUERY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const selectSource = useCallback((next: OrchTaskSource) => {
    setSource(next);
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
      const patch = (rows: OrchTaskSummary[]) => rows.map((task) => patchRow(task, payload, progress.done, progress.total));
      patchItems(patch);
      setActive(patch);
    });
    const offGap = watchEventGap(() => { void load(); });
    return () => { offTopic(); offGap(); };
  }, [load, patchItems]);

  return {
    source,
    selectSource,
    pageIndex: pages.pageIndex,
    hasMore: pages.hasMore,
    next: pages.next,
    previous: pages.previous,
    loading: pages.loading,
    queryInput,
    setQueryInput,
    tasks: pages.items,
    active,
    counts: page?.counts ?? {},
    total: Number(page?.total) || 0,
    sources: Array.isArray(page?.sources) ? page.sources : [],
    revision,
    error,
    setError,
    reload: load,
  };
}
