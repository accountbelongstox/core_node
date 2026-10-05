/**
 * One gitsync state shared by every consumer: refetched only on the gitsync.changed topic
 * (or a slow poll while the event link is down), with known_revision so an unchanged state
 * costs a revision-only reply; concurrent refreshes share one request.
 */
import { useEffect } from 'react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { GitSyncState } from '@/apps/pycore-manager/api';
import { createPcExternalStore } from '../api/PcExternalStore';
import { PYCORE_EVENT_TOPICS } from '../../../core/integrations/pycore/PycoreEventTopics';
import { usePycoreTopicRefresh } from '../../../core/integrations/pycore/usePycoreTopicRefresh';

const FALLBACK_POLL_MS = 15_000;
const TOPICS = [PYCORE_EVENT_TOPICS.gitsyncChanged];

const gitSyncStore = createPcExternalStore<GitSyncState | null>(null);
let flight: Promise<void> | null = null;

/** Keeps a full state reply; a revision-only (unchanged) reply leaves the stored state as is. */
export function applyGitSyncState(next: GitSyncState | null | undefined): void {
  if (next?.success && !next.unchanged) gitSyncStore.set(next);
}

function refreshGitSyncState(): Promise<void> {
  if (flight) return flight;
  flight = pycoreApi.getGitSyncState(gitSyncStore.get()?.revision)
    .then(applyGitSyncState)
    // An older pycore without the route keeps the indicator hidden.
    .catch(() => undefined)
    .finally(() => { flight = null; });
  return flight;
}

export function useGitSyncState(): GitSyncState | null {
  useEffect(() => { void refreshGitSyncState(); }, []);
  usePycoreTopicRefresh(TOPICS, refreshGitSyncState, { fallbackMs: FALLBACK_POLL_MS });
  return gitSyncStore.use();
}
