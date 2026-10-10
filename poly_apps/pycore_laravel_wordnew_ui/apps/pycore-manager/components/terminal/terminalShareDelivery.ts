/**
 * Hand-over of shared files from the share picker to a terminal's composer: the picker sets a request, the
 * terminal view of that node adds the files to the terminal's attachments (not sent) and reports back, which
 * releases the files from the share inbox. Also the sharing-shortcut ids and the recently used targets.
 */
import { createPcExternalStore } from '@/apps/pycore-manager/api';
import { StorageManager } from '@/core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '@/apps/pycore-manager/persistence/PycoreManagerStorageKeys';
import { removeFromShareInbox, reportShareTargetUsed } from '@/shared/share/ShareInbox';

const TARGET_ID_PREFIX = 'pc-terminal';
const TARGET_ID_SEPARATOR = '|';
export const MAX_RECENT_SHARE_TARGETS = 4;

export interface ShareTargetRef {
  /** Backend URL of the node tab; null is this machine. */
  nodeUrl: string | null;
  terminalNumber: number;
}

export interface ShareDeliveryRequest extends ShareTargetRef {
  files: File[];
  /** Share inbox ids released once the files reached the composer. */
  entryIds: string[];
}

/** Set by the picker; the matching node view consumes it and calls `completeShareDelivery`. */
export const shareDeliveryRequest = createPcExternalStore<ShareDeliveryRequest | null>(null);

export function shareTargetId(target: ShareTargetRef): string {
  return [TARGET_ID_PREFIX, target.terminalNumber, target.nodeUrl ?? ''].join(TARGET_ID_SEPARATOR);
}

export function parseShareTargetId(id: string | undefined): ShareTargetRef | null {
  if (!id) return null;
  const [prefix, number, ...rest] = id.split(TARGET_ID_SEPARATOR);
  const terminalNumber = Number(number);
  if (prefix !== TARGET_ID_PREFIX || !Number.isInteger(terminalNumber)) return null;
  return { nodeUrl: rest.join(TARGET_ID_SEPARATOR) || null, terminalNumber };
}

export function sameShareTarget(left: ShareTargetRef, right: ShareTargetRef): boolean {
  return left.nodeUrl === right.nodeUrl && left.terminalNumber === right.terminalNumber;
}

export function readRecentShareTargets(): ShareTargetRef[] {
  const stored = StorageManager.get<ShareTargetRef[]>(StorageKeys.PYCORE_SHARE_RECENT_TARGETS, []);
  return Array.isArray(stored)
    ? stored.filter((target) => Number.isInteger(target?.terminalNumber)).slice(0, MAX_RECENT_SHARE_TARGETS)
    : [];
}

/** The terminal last opened, drafted in, operated or shared to goes first; the share picker preselects it. */
export function recordRecentShareTarget(target: ShareTargetRef): void {
  const recent = readRecentShareTargets();
  if (recent[0] && sameShareTarget(recent[0], target)) return;
  const next = [{ nodeUrl: target.nodeUrl, terminalNumber: target.terminalNumber }, ...recent.filter((entry) => !sameShareTarget(entry, target))];
  StorageManager.set(StorageKeys.PYCORE_SHARE_RECENT_TARGETS, next.slice(0, MAX_RECENT_SHARE_TARGETS));
}

/** Called by the node view that took the request: `delivered` releases the files from the inbox, otherwise they stay. */
export function completeShareDelivery(request: ShareDeliveryRequest, delivered: boolean): void {
  if (shareDeliveryRequest.get() === request) shareDeliveryRequest.set(null);
  if (!delivered) return;
  recordRecentShareTarget(request);
  void reportShareTargetUsed(shareTargetId(request));
  void removeFromShareInbox(request.entryIds);
}
