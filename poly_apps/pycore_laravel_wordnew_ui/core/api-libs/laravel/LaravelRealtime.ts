/**
 * LaravelRealtime — dependency-free EventSource client for the Queue Center
 * SSE stream (replaces the planned Reverb/Echo websocket, which would have
 * required a new dependency).
 *
 * Endpoint: `{base}/api/queue-center/stream?cursor=<lastId>` where `base` is
 * the shared Laravel base URL (same one every BaseAPI module follows). The
 * route group is a public control plane (same trust level as /api/task/*), so
 * no auth header is needed — EventSource cannot set headers anyway.
 *
 * The server replays the shared translation_events outbox, filtered to the
 * audio-queue priority events. It ends the stream after a bounded lifetime
 * (Octane watchdog / single-worker cap) with a `stream.close` envelope, so
 * the client reconnects with its cursor and resumes with zero gap. Cursor
 * resume uses `?cursor=` from the last seen `_id` (the server sets no SSE
 * `id:` field, so EventSource's built-in reconnect cannot resume by itself —
 * reconnects are handled manually here with jittered backoff).
 *
 * Events (each priority payload carries `_id` = the resume cursor):
 *   word_audio.priority · sentence.priority
 * Envelopes: stream.open / ping / stream.close (cursor only, never dispatched).
 */
import {
  getSharedBaseURL,
  SHARED_BASE_URL_CHANGED_EVENT,
} from './transport/BaseAPI';

/** Queue Center priority event payload (superset of the legacy wire shapes). */
export interface LaravelQueuePriorityEvent {
  queue: string;
  task_id: string;
  dedup_key?: string;
  language?: string | null;
  priority?: number;
  bump?: string;
  /** word_audio only. */
  md5?: string | null;
  word?: string;
  /** sentence_audio only. */
  content_id?: string | null;
  text?: string;
}

export const LARAVEL_REALTIME_EVENTS = {
  wordAudioPriority: 'word_audio.priority',
  sentencePriority: 'sentence.priority',
} as const;

export type LaravelRealtimeEventName =
  (typeof LARAVEL_REALTIME_EVENTS)[keyof typeof LARAVEL_REALTIME_EVENTS];

type Handler = (payload: LaravelQueuePriorityEvent) => void;

const STREAM_ROUTE = '/api/queue-center/stream';
const ENVELOPE_OPEN = 'stream.open';
const ENVELOPE_PING = 'ping';
const ENVELOPE_CLOSE = 'stream.close';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
/** Server-initiated lifetime close: resume almost immediately, with jitter. */
const RESUME_JITTER_MS = 250;

class LaravelRealtime {
  private source: EventSource | null = null;
  private started = false;
  private activeBaseURL: string | null = null;
  private lastId: number | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;
  private attempts = 0;
  /** Event name → handler set. */
  private handlers = new Map<string, Set<Handler>>();
  private handleBaseURLChanged = (): void => {
    const nextBaseURL = getSharedBaseURL();
    if (!this.started || nextBaseURL === this.activeBaseURL) return;
    this.lastId = null;
    this.activeBaseURL = null;
    this.closeSource();
    this.scheduleReconnect(0);
  };

  /** Subscribe to one realtime event. Returns an unsubscribe fn. */
  subscribe(event: LaravelRealtimeEventName, handler: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  /** Open the singleton stream (idempotent). Handlers survive reconnects. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.attempts = 0;
    if (typeof window !== 'undefined') {
      window.addEventListener(SHARED_BASE_URL_CHANGED_EVENT, this.handleBaseURLChanged);
    }
    this.openSource();
  }

  /** Close the stream and cancel any pending reconnect. Handlers are kept. */
  stop(): void {
    this.started = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener(SHARED_BASE_URL_CHANGED_EVENT, this.handleBaseURLChanged);
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeSource();
  }

  isConnected(): boolean {
    return !!this.source && this.source.readyState === EventSource.OPEN;
  }

  private resolveUrl(): string | null {
    const base = getSharedBaseURL();
    if (!base) return null;
    const cursor = this.lastId !== null && this.lastId > 0 ? `?cursor=${this.lastId}` : '';
    return `${base}${STREAM_ROUTE}${cursor}`;
  }

  private parseData(ev: MessageEvent): Record<string, unknown> | null {
    if (typeof ev.data !== 'string') return null;
    try {
      const parsed = JSON.parse(ev.data);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }

  /** Advance the resume cursor from a frame's `_id` or envelope `cursor`. */
  private trackCursor(obj: Record<string, unknown> | null): void {
    if (!obj) return;
    const raw = typeof obj._id === 'number' ? obj._id
      : typeof obj.cursor === 'number' ? obj.cursor
        : null;
    if (raw === null) return;
    if (this.lastId === null || raw > this.lastId) this.lastId = raw;
  }

  private emit(event: string, payload: LaravelQueuePriorityEvent): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (error) {
        console.warn('[laravel-realtime] handler failed', error);
      }
    }
  }

  private scheduleReconnect(delayMs: number): void {
    if (!this.started || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSource();
    }, delayMs);
  }

  private closeSource(): void {
    if (!this.source) return;
    this.manualClose = true;
    try {
      this.source.close();
    } catch { /* ignore */ }
    this.source = null;
  }

  private openSource(): void {
    if (!this.started) return;
    if (this.source
      && (this.source.readyState === EventSource.OPEN
        || this.source.readyState === EventSource.CONNECTING)) return;
    if (typeof EventSource === 'undefined') {
      console.warn('[laravel-realtime] EventSource unavailable — realtime disabled');
      return;
    }
    const url = this.resolveUrl();
    if (!url) {
      // No endpoint resolved yet — retry on the error backoff schedule.
      this.scheduleReconnect(RECONNECT_BASE_MS);
      return;
    }
    this.activeBaseURL = getSharedBaseURL();
    this.manualClose = false;
    const es = new EventSource(url);
    this.source = es;

    es.onopen = () => {
      this.attempts = 0;
    };

    // Envelope frames — cursor only, never dispatched.
    es.addEventListener(ENVELOPE_OPEN, (ev) => {
      this.trackCursor(this.parseData(ev as MessageEvent));
    });
    es.addEventListener(ENVELOPE_PING, (ev) => {
      this.trackCursor(this.parseData(ev as MessageEvent));
    });
    es.addEventListener(ENVELOPE_CLOSE, (ev) => {
      this.trackCursor(this.parseData(ev as MessageEvent));
      // Bounded server lifetime reached — resume with the cursor, zero gap.
      this.closeSource();
      this.scheduleReconnect(Math.floor(Math.random() * RESUME_JITTER_MS));
    });

    // Named priority events (the backend emits each as event:<name>).
    const named: LaravelRealtimeEventName[] = [
      LARAVEL_REALTIME_EVENTS.wordAudioPriority,
      LARAVEL_REALTIME_EVENTS.sentencePriority,
    ];
    for (const name of named) {
      es.addEventListener(name, (ev) => {
        const data = this.parseData(ev as MessageEvent);
        if (!data) return;
        this.trackCursor(data);
        const payload = { ...data };
        delete payload._id;
        this.emit(name, payload as unknown as LaravelQueuePriorityEvent);
      });
    }

    es.onerror = () => {
      if (this.source !== es || this.manualClose) return;
      this.closeSource();
      this.manualClose = false;
      // Manual jittered backoff: EventSource auto-reconnect would retry the
      // original URL (stale cursor) and cannot resume from `_id`.
      this.attempts += 1;
      const backoff = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** (this.attempts - 1));
      const jitter = Math.floor(Math.random() * RECONNECT_BASE_MS);
      this.scheduleReconnect(backoff + jitter);
    };
  }
}

export const laravelRealtime = new LaravelRealtime();
