/**
 * One gitsync state shared by every consumer: refetched only on the gitsync.changed topic
 * (or a slow poll while the event link is down), with known_revision so an unchanged state
 * costs a revision-only reply; concurrent refreshes share one request.
 */
import { useEffect } from 'react';
import type { GitSyncState, PycoreGitSyncApi } from '@/apps/pycore-manager/api';
import { createPcExternalStore, type PcExternalStore } from '../api/PcExternalStore';
import { PYCORE_EVENT_TOPICS } from '../../../core/integrations/pycore/PycoreEventTopics';
import { usePycoreTopicRefresh } from '../../../core/integrations/pycore/usePycoreTopicRefresh';
import { useSelectedPycoreNode } from './useSelectedPycoreNode';

const FALLBACK_POLL_MS = 15_000;
const TOPICS = [PYCORE_EVENT_TOPICS.gitsyncChanged];

export interface GitSyncNode {
  key: string;
  api: PycoreGitSyncApi;
}

interface GitSyncNodeSlot {
  store: PcExternalStore<GitSyncState | null>;
  flight: Promise<void> | null;
}

const slots = new Map<string, GitSyncNodeSlot>();

function slotOf(key: string): GitSyncNodeSlot {
  let slot = slots.get(key);
  if (!slot) {
    slot = { store: createPcExternalStore<GitSyncState | null>(null), flight: null };
    slots.set(key, slot);
  }
  return slot;
}

/** The gitsync node picked in the terminal node tabs (null URL = this machine). */
export function useSelectedGitSyncNode(): GitSyncNode {
  const node = useSelectedPycoreNode();
  return { key: node.key, api: node.client.gitSync };
}

/** Keeps a full state reply; a revision-only (unchanged) reply leaves the stored state as is. */
export function applyGitSyncState(nodeKey: string, next: GitSyncState | null | undefined): void {
  if (next?.success && !next.unchanged) slotOf(nodeKey).store.set(next);
}

function refreshGitSyncState(node: GitSyncNode): Promise<void> {
  const slot = slotOf(node.key);
  if (slot.flight) return slot.flight;
  slot.flight = node.api.getGitSyncState(slot.store.get()?.revision)
    .then((next) => applyGitSyncState(node.key, next))
    // An older pycore without the route keeps the indicator hidden.
    .catch(() => undefined)
    .finally(() => { slot.flight = null; });
  return slot.flight;
}

export function useGitSyncState(node: GitSyncNode): GitSyncState | null {
  const { key, api } = node;
  useEffect(() => { void refreshGitSyncState({ key, api }); }, [key, api]);
  usePycoreTopicRefresh(TOPICS, () => refreshGitSyncState({ key, api }), { fallbackMs: FALLBACK_POLL_MS });
  return slotOf(key).store.use();
}
