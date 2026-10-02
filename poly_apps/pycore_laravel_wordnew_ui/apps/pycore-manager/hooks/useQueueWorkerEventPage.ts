import { useCallback } from 'react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { QueueWorkerEvent, QueueWorkerEventPage } from '@/apps/pycore-manager/api';
import { useKeysetPages } from '../../../core/integrations/pycore/useKeysetPages';
import { pcFailureMessage } from '../utils/pcErrorCodes';

const PAGE_LIMIT = 20;

/** Newest-first worker events of one lane. */
export function useQueueWorkerEventPage(lane: 'word' | 'sentence', enabled: boolean, revision = 0) {
  const fetchPage = useCallback(async (cursor: string | null): Promise<QueueWorkerEventPage> => {
    const response = await pycoreApi.getQueueCenterEventPage(lane, cursor, PAGE_LIMIT);
    if (!response.success) throw response;
    return response;
  }, [lane]);
  const pages = useKeysetPages<QueueWorkerEvent, QueueWorkerEventPage>(fetchPage, enabled, revision);
  return {
    items: pages.items,
    total: pages.page?.total ?? 0,
    loading: pages.loading,
    error: pages.error ? pcFailureMessage(pages.error as Parameters<typeof pcFailureMessage>[0]) : null,
    pageIndex: pages.pageIndex,
    hasMore: pages.hasMore,
    next: pages.next,
    previous: pages.previous,
    refresh: pages.reload,
  };
}
