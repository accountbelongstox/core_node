import { useCallback, useEffect, useState } from 'react';
import { laravelApi } from '@/apps/pycore-manager/api';
import type { WorkNodesResponse } from '@/apps/pycore-manager/api';
import { LARAVEL_REALTIME_EVENTS, laravelRealtime } from '../../../core/integrations/laravel/LaravelRealtime';

/**
 * Laravel's work-lease roster (`work_nodes`). Laravel pushes `work_nodes.changed` (a revision only,
 * at most every 2 s): the roster is refetched when the revision moves and once after a (re)connect.
 */
export function useWorkNodes(enabled = true) {
  const [data, setData] = useState<WorkNodesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await laravelApi.getWorkNodes());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

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
    };
  }, [enabled, load]);

  return { data, loading, failed, reload: load };
}
