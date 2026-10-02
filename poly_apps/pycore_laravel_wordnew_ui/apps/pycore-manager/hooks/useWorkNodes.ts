import { useCallback, useEffect, useRef, useState } from 'react';
import { laravelApi } from '@/apps/pycore-manager/api';
import type { WorkNodesResponse } from '@/apps/pycore-manager/api';
import { LARAVEL_REALTIME_EVENTS, laravelRealtime } from '../../../core/integrations/laravel/LaravelRealtime';
import { serverSchemaGate } from '../../../core/integrations/laravel/ServerSchemaGate';
import { RECONNECT_BACKOFF_MS } from '../../../core/config/NetworkTiming';
import { Backoff } from '../../../core/tasks/Backoff';
import { PC_REQUEST_FAILED_CODE } from '../utils/pcErrorCodes';

const MS_PER_SECOND = 1000;

/**
 * Laravel's work-lease roster (`work_nodes`). Laravel pushes `work_nodes.changed` (a revision only,
 * at most every 2 s): the roster is refetched when the revision moves and once after a (re)connect.
 * A failed read retries with backoff (every `retry_after_seconds` while the server schema is pending),
 * because no push arrives for a roster that could not be read.
 */
export function useWorkNodes(enabled = true) {
  const [data, setData] = useState<WorkNodesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const retryTimer = useRef<number | undefined>(undefined);
  const retryBackoff = useRef(new Backoff(RECONNECT_BACKOFF_MS.min, RECONNECT_BACKOFF_MS.max, { jitter: 'half' }));
  const loadRef = useRef<() => Promise<void>>(async () => undefined);

  const load = useCallback(async () => {
    window.clearTimeout(retryTimer.current);
    setLoading(true);
    try {
      setData(await laravelApi.getWorkNodes());
      setErrorCode(null);
      retryBackoff.current.reset();
    } catch (error: unknown) {
      const code = (error as { code?: unknown } | null)?.code;
      setErrorCode(typeof code === 'string' && code ? code : PC_REQUEST_FAILED_CODE);
      const schema = serverSchemaGate.getSnapshot();
      const delayMs = schema.schema === 'pending' ? schema.retryAfterSeconds * MS_PER_SECOND : retryBackoff.current.next();
      retryTimer.current = window.setTimeout(() => { void loadRef.current(); }, delayMs);
    } finally {
      setLoading(false);
    }
  }, []);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) return undefined;
    let revision = -1;
    const offChanged = laravelRealtime.subscribe(LARAVEL_REALTIME_EVENTS.workNodesChanged, (event) => {
      if (event.revision <= revision) return;
      revision = event.revision;
      void load();
    });
    const offConnected = laravelRealtime.onConnected(() => { void load(); });
    laravelRealtime.start();
    void load();
    return () => {
      offChanged();
      offConnected();
      laravelRealtime.stop();
      window.clearTimeout(retryTimer.current);
    };
  }, [enabled, load]);

  return { data, loading, failed: errorCode !== null, errorCode, reload: load };
}
