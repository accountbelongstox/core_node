/* [v4.1-Iris] Wf event bus — ported from qy_capacitor/services/EventBus.ts,
 * trimmed to the wordflow-end event set; same on()/emit() unsubscribe contract. */

export type WfEventName =
  | 'settings-changed'
  /** Active API endpoint re-pointed (manual pick or re-detect). Payload: { endpoint: ApiEndpoint }. */
  | 'api-endpoint-changed'
  | 'learning-stats-updated'
  | 'quiz-completed'
  | 'word-groups-updated'
  | 'reading-progress-updated'
  /** Vocabulary library selected/deselected (or library caches refreshed). Payload: { collectionId, selected } | undefined. */
  | 'library-selection-changed'
  /** A group's content sources changed (media source / library added or removed). Payload: { gid, sourceType?, sourceKey?, action } | undefined. */
  | 'group-sources-changed'
  /** Daily-recitation progress changed (a log flush landed — or was queued
   *  offline and counted optimistically). Payload:
   *  { today: WfRecitationToday, date?: string, pending?: boolean } — pending
   *  is true when the flush was persisted offline and awaits sync. */
  | 'recitation-updated';

type WfEventCallback = (payload?: any) => void;

class WfEventBusClass {
  private listeners: Map<WfEventName, Set<WfEventCallback>> = new Map();

  /**
   * Listen to an event. Returns an unsubscribe function.
   */
  on(e: WfEventName, cb: (payload?: any) => void): () => void {
    if (!this.listeners.has(e)) {
      this.listeners.set(e, new Set());
    }
    const callbacks = this.listeners.get(e)!;
    callbacks.add(cb);

    return () => {
      callbacks.delete(cb);
      if (callbacks.size === 0) {
        this.listeners.delete(e);
      }
    };
  }

  /**
   * Emit an event to all subscribers. Listener errors are isolated.
   */
  emit(e: WfEventName, payload?: any): void {
    const callbacks = this.listeners.get(e);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch (error) {
          console.error(`[WfEventBus] Error in listener for "${e}":`, error);
        }
      });
    }
  }
}

export const wfEventBus = new WfEventBusClass();
