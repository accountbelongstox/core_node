/**
 * useWfNewEndpoints — React binding for the WfNewEndpoints store.
 *
 * Subscribes to the endpoint manager via `useSyncExternalStore` (the project's
 * store pattern — same as core/logstore + core/notify), so components re-render
 * exactly when the endpoint list / health / current selection changes, with no
 * manual event listeners or polling.
 */
import { useSyncExternalStore } from 'react';
import { wfNewEndpoints } from './WfNewEndpoints';
import type { WfNewEndpointSnapshot } from './WfNewApiTypes';

export function useWfNewEndpoints(): WfNewEndpointSnapshot {
  return useSyncExternalStore(
    wfNewEndpoints.subscribe,
    wfNewEndpoints.getSnapshot,
    wfNewEndpoints.getSnapshot,
  );
}
