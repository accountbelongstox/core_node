import { useCallback, useEffect, useState } from 'react';
import { laravelApi, audioLaneRevisionKey, useAudioLaneState } from '@/apps/pycore-manager/api';
import type { WorkNodesResponse } from '@/apps/pycore-manager/api';
import { usePolling } from '../../../core/tasks/usePolling';

const NODES_RECONCILE_MS = 30_000;

/**
 * Laravel's work-lease roster (`work_nodes`). Laravel pushes no roster event, so it is read on mount,
 * whenever this node's lane state moves (a push), and on one slow reconcile.
 */
export function useWorkNodes(enabled = true) {
  const lanes = useAudioLaneState();
  const laneRevision = audioLaneRevisionKey(lanes.payload);
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
    if (enabled) void load();
  }, [enabled, load, laneRevision]);
  usePolling(load, { intervalMs: NODES_RECONCILE_MS, enabled, immediate: false });

  return { data, loading, failed, reload: load };
}
