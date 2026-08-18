/* [v4.1-Iris] Wf event bus — ported from qy_capacitor/services/EventBus.ts,
 * trimmed to the wordnew-end event set; same on()/emit() unsubscribe contract. */

import { TypedEventEmitter } from '../../../core/events/TypedEventEmitter';

export type WordNewEventName =
  | 'settings-changed'
  /** Active API endpoint re-pointed (manual pick or re-detect). Payload: { endpoint: WfNewEndpoint }. */
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
   *  { today: WordNewRecitationToday, date?: string, pending?: boolean } — pending
   *  is true when the flush was persisted offline and awaits sync. */
  | 'recitation-updated';

type WordNewEventCallback = (payload?: any) => void;
type WordNewEventMap = { [EventName in WordNewEventName]: any };

const emitter = new TypedEventEmitter<WordNewEventMap>('WordNewEventBus');

class WordNewEventBusClass {
  /**
   * Listen to an event. Returns an unsubscribe function.
   */
  on(event: WordNewEventName, callback: WordNewEventCallback): () => void {
    return emitter.on(event, callback);
  }

  /**
   * Emit an event to all subscribers. Listener errors are isolated.
   */
  emit(event: WordNewEventName, payload?: any): void {
    emitter.emit(event, payload);
  }
}

export const wordNewEventBus = new WordNewEventBusClass();
