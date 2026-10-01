import { useCallback, useEffect, useRef, useState } from 'react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { QueueWorkerEvent, QueueWorkerEventPage } from '@/apps/pycore-manager/api';
import { pcFailureMessage } from '../utils/pcErrorCodes';

const PAGE_LIMIT = 20;

const EMPTY_PAGE: QueueWorkerEventPage = { items: [], next_cursor: null, has_more: false, total: 0, revision: 0 };

/** Newest-first worker events, walked with the keyset cursor stack (the first entry is the first page). */
export function useQueueWorkerEventPage(
  lane: 'word' | 'sentence',
  enabled: boolean,
  revision = 0,
) {
  const [data, setData] = useState<QueueWorkerEventPage>(EMPTY_PAGE);
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const cursor = cursors[cursors.length - 1];

  const load = useCallback(async () => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setLoading(true);
    setError(null);
    try {
      const response = await pycoreApi.getQueueCenterEventPage(lane, cursor, PAGE_LIMIT);
      if (sequence !== requestSequence.current) return;
      if (!response.success || !response.data) throw response;
      setData(response.data);
    } catch (reason: unknown) {
      if (sequence !== requestSequence.current) return;
      setError(pcFailureMessage(reason as Parameters<typeof pcFailureMessage>[0]));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [lane, cursor]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load, revision]);

  useEffect(() => { setCursors([null]); }, [lane]);

  const items: QueueWorkerEvent[] = data.items;
  return {
    ...data,
    items,
    loading,
    error,
    pageIndex: cursors.length,
    hasMore: data.has_more && data.next_cursor !== null,
    next: () => { if (data.next_cursor) setCursors((stack) => [...stack, data.next_cursor]); },
    previous: () => setCursors((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack)),
    refresh: load,
  };
}
