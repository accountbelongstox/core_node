import { useCallback, useEffect, useRef, useState } from 'react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { QueueWorkerEvent, QueueWorkerEventPage } from '@/apps/pycore-manager/api';

const DEFAULT_PAGE_SIZE = 20;

const EMPTY_PAGE: QueueWorkerEventPage = {
  items: [],
  page: 1,
  page_size: DEFAULT_PAGE_SIZE,
  pages: 1,
  total: 0,
  revision: 0,
};

export function useQueueWorkerEventPage(
  lane: 'word' | 'sentence',
  enabled: boolean,
  revision = 0,
) {
  const [data, setData] = useState<QueueWorkerEventPage>(EMPTY_PAGE);
  const [requestedPage, setRequestedPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const loadPage = useCallback(async (requestedPage: number) => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setLoading(true);
    setError(null);
    try {
      const response = await pycoreApi.getQueueCenterEventPage(
        lane,
        Math.max(1, requestedPage),
        DEFAULT_PAGE_SIZE,
      );
      if (sequence !== requestSequence.current) return;
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Worker event page is unavailable');
      }
      setData(response.data);
    } catch (reason: unknown) {
      if (sequence !== requestSequence.current) return;
      setError(reason instanceof Error ? reason.message : 'Worker event page is unavailable');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [lane]);

  useEffect(() => {
    if (!enabled) return;
    void loadPage(requestedPage);
  }, [enabled, loadPage, requestedPage, revision]);

  const items: QueueWorkerEvent[] = data.items;
  return {
    ...data,
    items,
    loading,
    error,
    setPage: (page: number) => setRequestedPage(Math.max(1, page)),
    refresh: () => loadPage(data.page),
  };
}
