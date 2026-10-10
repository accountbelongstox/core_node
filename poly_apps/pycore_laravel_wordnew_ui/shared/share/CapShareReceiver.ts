/* =============================================================================
 * CapShareReceiver - files other apps share to this app (Android share sheet)
 * =============================================================================
 * Native (Android, app plugin `ShareReceiver`): ACTION_SEND / ACTION_SEND_MULTIPLE intents (images, audio, video,
 * documents, text) are copied into the app-private cache and queued until the web layer takes them; a
 * `shareReceived` event fires for shares that arrive while the app runs. Each item points at its cached copy,
 * read through the WebView file bridge. Web / desktop: unsupported (empty queue, no events).
 * ========================================================================== */
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { isNativeAppShell } from '../../core/network/NativeShell';
import { isDesktopAppShell } from '../../core/network/DesktopShell';

export interface SharedItem {
  /** Stable id of the queued item (used to clear it). */
  id: string;
  /** Display file name (from the sharing app; a generated one for shared text). */
  name: string;
  mimeType: string;
  size: number;
  /** Absolute path of the cached copy inside the app-private cache. */
  path: string;
  /** Plain text of an EXTRA_TEXT share without a file (also cached as a .txt file). */
  text?: string;
  /** Epoch milliseconds the share arrived. */
  receivedAt: number;
}

export interface SharedBatch {
  /** Id of the share intent; one share of several files is one batch. */
  batchId: string;
  items: SharedItem[];
}

interface ShareReceiverPlugin {
  /** Every queued batch not yet cleared (shares that started the app included). */
  getPending(): Promise<{ batches: SharedBatch[] }>;
  /** Drops queued items and deletes their cached copies; `ids` omitted clears everything. */
  clear(options: { ids?: string[] }): Promise<{ removed: number }>;
  addListener(event: 'shareReceived', handler: (batch: SharedBatch) => void): Promise<PluginListenerHandle>;
}

const nativeShare = registerPlugin<ShareReceiverPlugin>('ShareReceiver');

/** The Android app shell: the only place the share target exists. */
export function shareReceiverSupported(): boolean {
  return isNativeAppShell() && !isDesktopAppShell();
}

/** Reads a shared item's cached copy as a File (for the composer attachments). */
export async function sharedItemFile(item: SharedItem): Promise<File> {
  const response = await fetch(Capacitor.convertFileSrc(item.path));
  const blob = await response.blob();
  return new File([blob], item.name, { type: item.mimeType || blob.type, lastModified: item.receivedAt });
}

export const capShareReceiver = {
  async pending(): Promise<SharedBatch[]> {
    if (!shareReceiverSupported()) return [];
    return (await nativeShare.getPending().catch(() => ({ batches: [] }))).batches;
  },
  async clear(ids?: string[]): Promise<void> {
    if (!shareReceiverSupported()) return;
    await nativeShare.clear(ids ? { ids } : {}).catch(() => undefined);
  },
  /** Subscribes to shares that arrive while the app runs; returns the unsubscribe function. */
  onShare(handler: (batch: SharedBatch) => void): () => void {
    if (!shareReceiverSupported()) return () => undefined;
    const handle = nativeShare.addListener('shareReceived', handler);
    return () => { void handle.then((listener) => listener.remove()); };
  },
};
