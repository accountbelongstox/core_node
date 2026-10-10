/**
 * ShareInbox - global holding area for files other apps share to this app. Items stay here (metadata persisted on the
 * device, native copies kept) until a UI delivers or discards them; only then are the native copies cleared.
 */
import { useSyncExternalStore } from 'react';
import { registerLocalDataGroup } from '../../core/persistence/LocalDataRegistry';
import { deviceKvGet, deviceKvSet } from '../persistence/DeviceKvCache';
import { capShareReceiver, shareReceiverSupported, type ShareTarget, type SharedBatch, type SharedItem } from './CapShareReceiver';

export const SHARE_INBOX_KV_KEY = 'share.inbox.v1';

export interface ShareInboxEntry {
  item: SharedItem;
  batchId: string;
  /** Sharing-shortcut id the share was sent through, when the native side reported one. */
  targetId?: string;
  /** True once the picker was shown for this entry. */
  prompted: boolean;
}

export interface ShareInboxState {
  entries: readonly ShareInboxEntry[];
  pickerOpen: boolean;
}

let state: ShareInboxState = { entries: [], pickerOpen: false };
let started = false;
let stopListening: (() => void) | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getState(): ShareInboxState {
  return state;
}

function persist(): void {
  void deviceKvSet(SHARE_INBOX_KV_KEY, state.entries.length ? { entries: state.entries } : null);
}

function commit(next: Partial<ShareInboxState>, save = true): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
  if (save && next.entries) persist();
}

function entriesOfBatches(batches: SharedBatch[], known: ReadonlyMap<string, ShareInboxEntry>): ShareInboxEntry[] {
  return batches.flatMap((batch) => batch.items.map((item): ShareInboxEntry => {
    const previous = known.get(item.id);
    const targetId = batch.targetId ?? previous?.targetId;
    return { item, batchId: batch.batchId, ...(targetId ? { targetId } : {}), prompted: previous?.prompted ?? false };
  }));
}

function addBatches(batches: SharedBatch[]): void {
  const known = new Map(state.entries.map((entry) => [entry.item.id, entry]));
  const fresh = entriesOfBatches(batches, known).filter((entry) => !known.has(entry.item.id));
  if (!fresh.length) return;
  commit({ entries: [...state.entries, ...fresh], pickerOpen: true });
}

/** Takes the queue the native side holds and follows later shares; idempotent, a no-op outside the Android app. */
export function startShareInbox(): void {
  if (started || !shareReceiverSupported()) return;
  started = true;
  stopListening = capShareReceiver.onShare((batch) => addBatches([batch]));
  void (async () => {
    const stored = await deviceKvGet<{ entries?: ShareInboxEntry[] }>(SHARE_INBOX_KV_KEY);
    const pending = await capShareReceiver.pending();
    const known = new Map((stored?.entries ?? []).map((entry) => [entry.item.id, entry]));
    const reconciled = entriesOfBatches(pending, known);
    const liveIds = new Set(state.entries.map((entry) => entry.item.id));
    const merged = [...state.entries, ...reconciled.filter((entry) => !liveIds.has(entry.item.id))];
    if (merged.length === state.entries.length && !stored?.entries?.length) return;
    commit({ entries: merged, pickerOpen: state.pickerOpen || merged.some((entry) => !entry.prompted) });
  })();
}

export function stopShareInbox(): void {
  stopListening?.();
  stopListening = null;
  started = false;
}

export function useShareInbox(): ShareInboxState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function openShareInboxPicker(): void {
  commit({ pickerOpen: true }, false);
}

export function closeShareInboxPicker(): void {
  commit({ pickerOpen: false }, false);
}

/** The picker was shown: its entries no longer reopen it on their own. */
export function markShareInboxPrompted(): void {
  if (state.entries.every((entry) => entry.prompted)) return;
  commit({ entries: state.entries.map((entry) => (entry.prompted ? entry : { ...entry, prompted: true })) });
}

/** Delivered or discarded: leaves the inbox and drops the native copies. */
export async function removeFromShareInbox(ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  const gone = new Set(ids);
  commit({ entries: state.entries.filter((entry) => !gone.has(entry.item.id)) });
  await capShareReceiver.clear([...gone]);
}

export async function clearShareInbox(): Promise<void> {
  commit({ entries: [], pickerOpen: false });
  await capShareReceiver.clear();
  await deviceKvSet(SHARE_INBOX_KV_KEY, null);
}

/** Publishes sharing shortcuts (Direct Share targets); a no-op off Android. */
export function publishShareTargets(targets: ShareTarget[]): Promise<void> {
  return capShareReceiver.publishShareTargets(targets);
}

export function reportShareTargetUsed(id: string): Promise<void> {
  return capShareReceiver.reportShareTargetUsed(id);
}

registerLocalDataGroup({
  id: 'shared.share_inbox',
  appId: 'shared',
  labelKey: 'common.local_data.groups.shared_share_inbox',
  descriptionKey: 'common.local_data.groups.shared_share_inbox_desc',
  clearable: true,
  sources: [{ kind: 'deviceKv', keys: [SHARE_INBOX_KV_KEY] }],
  clear: clearShareInbox,
});
