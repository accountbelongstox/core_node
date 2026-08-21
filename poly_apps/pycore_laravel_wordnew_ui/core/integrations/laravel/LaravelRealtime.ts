/** Shared Queue Center Mercure client with persistent cursor replay. */
import {
  QUEUE_CENTER_REALTIME_EVENTS,
} from '../../contracts/QueueCenterContract';
import {
  getSharedBaseURL,
  SHARED_BASE_URL_CHANGED_EVENT,
} from './transport/BaseAPI';
import { laravelApi } from './LaravelAPI';
import { LaravelMercureConnection } from './LaravelMercureConnection';

export interface LaravelQueueHeadItem {
  task_id: string;
  queue_position: number;
  dedup_key?: string;
  language?: string | null;
  md5?: string | null;
  word?: string;
}

export interface LaravelQueueHeadEvent {
  queue: string;
  count: number;
  items: LaravelQueueHeadItem[];
  head_task_id: string;
  queue_position: number;
}

export interface LaravelWorkerPresenceEvent {
  worker_id: string | null;
  online: boolean | null;
  changed_at?: string | null;
}

export interface LaravelQueueChangedEvent {
  revision: number;
  resource: string;
  language?: string | null;
  resource_id?: string | number | null;
  changed_at?: string | null;
}

export interface LaravelArticlePublishedEvent {
  article_id: string;
  source_key?: string | null;
  title?: string | null;
  language?: string | null;
  article_type?: string | null;
  source?: string | null;
  audio_url?: string | null;
  document_id?: string | number | null;
}

export interface LaravelArticleAudioReadyEvent {
  article_id: string;
  audio_url?: string | null;
  tts_engine?: string | null;
  tts_model?: string | null;
  tts_chunked?: boolean;
  audio_rebuilt_at?: string | null;
}

export const LARAVEL_REALTIME_EVENTS = {
  queueChanged: QUEUE_CENTER_REALTIME_EVENTS.queue_changed,
  wordAudioHead: QUEUE_CENTER_REALTIME_EVENTS.word_audio_head,
  sentenceAudioHead: QUEUE_CENTER_REALTIME_EVENTS.sentence_audio_head,
  workerPresence: QUEUE_CENTER_REALTIME_EVENTS.worker_presence,
  articlePublished: 'article.published',
  articleAudioReady: 'article.audio.ready',
} as const;

export type LaravelRealtimeEventName =
  (typeof LARAVEL_REALTIME_EVENTS)[keyof typeof LARAVEL_REALTIME_EVENTS];

export type LaravelRealtimeEventPayloadMap = {
  [LARAVEL_REALTIME_EVENTS.queueChanged]: LaravelQueueChangedEvent;
  [LARAVEL_REALTIME_EVENTS.wordAudioHead]: LaravelQueueHeadEvent;
  [LARAVEL_REALTIME_EVENTS.sentenceAudioHead]: LaravelQueueHeadEvent;
  [LARAVEL_REALTIME_EVENTS.workerPresence]: LaravelWorkerPresenceEvent;
  [LARAVEL_REALTIME_EVENTS.articlePublished]: LaravelArticlePublishedEvent;
  [LARAVEL_REALTIME_EVENTS.articleAudioReady]: LaravelArticleAudioReadyEvent;
};

type LaravelRealtimePayload = LaravelRealtimeEventPayloadMap[LaravelRealtimeEventName];
type Handler = (payload: LaravelRealtimePayload) => void;

interface RealtimeFrame {
  event: LaravelRealtimeEventName;
  payload: Record<string, unknown>;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
class LaravelRealtime {
  private transport = new LaravelMercureConnection();
  private started = false;
  private connected = false;
  private activeBaseURL: string | null = null;
  private lastId: number | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private consumers = 0;
  private generation = 0;
  private replaying = false;
  private fallbackReplayActive = false;
  private pendingFrames: RealtimeFrame[] = [];
  private handlers = new Map<string, Set<Handler>>();

  private handleBaseURLChanged = (): void => {
    const nextBaseURL = getSharedBaseURL();
    if (!this.started || nextBaseURL === this.activeBaseURL) return;
    this.lastId = null;
    this.activeBaseURL = null;
    this.closeSocket();
    this.scheduleReconnect(0);
  };

  subscribe<EventName extends LaravelRealtimeEventName>(
    event: EventName,
    handler: (payload: LaravelRealtimeEventPayloadMap[EventName]) => void,
  ): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    const commonHandler = handler as unknown as Handler;
    set.add(commonHandler);
    return () => set.delete(commonHandler);
  }

  start(): void {
    this.consumers += 1;
    if (this.started) return;
    this.started = true;
    this.attempts = 0;
    if (typeof window !== 'undefined') {
      window.addEventListener(SHARED_BASE_URL_CHANGED_EVENT, this.handleBaseURLChanged);
    }
    void this.openSocket();
  }

  stop(): void {
    this.consumers = Math.max(0, this.consumers - 1);
    if (this.consumers > 0) return;
    this.started = false;
    this.generation += 1;
    if (typeof window !== 'undefined') {
      window.removeEventListener(SHARED_BASE_URL_CHANGED_EVENT, this.handleBaseURLChanged);
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeSocket();
  }

  isConnected(): boolean {
    return this.connected && this.transport.isConnected();
  }

  private parseObject(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object') return value as Record<string, unknown>;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }

  private isRealtimeEvent(value: string): value is LaravelRealtimeEventName {
    return Object.values(LARAVEL_REALTIME_EVENTS).includes(value as LaravelRealtimeEventName);
  }

  private emit(event: LaravelRealtimeEventName, payload: LaravelRealtimePayload): void {
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

  private dispatchFrame(frame: RealtimeFrame): void {
    const rawId = frame.payload._id;
    const id = typeof rawId === 'number' ? rawId : Number(rawId || 0);
    if (id > 0 && this.lastId !== null && id <= this.lastId) return;
    if (id > 0) this.lastId = id;
    const payload = { ...frame.payload };
    delete payload._id;
    this.emit(frame.event, payload as unknown as LaravelRealtimePayload);
  }

  private async replay(): Promise<void> {
    let hasMore = true;
    while (hasMore) {
      const replay = await laravelApi.getQueueCenterEvents(this.lastId ?? 0);
      for (const item of replay.events) {
        if (!this.isRealtimeEvent(item.event)) continue;
        this.dispatchFrame({ event: item.event, payload: item.data });
      }
      if (this.lastId === null || replay.cursor > this.lastId) this.lastId = replay.cursor;
      hasMore = replay.has_more;
    }
  }

  private async subscribed(generation: number): Promise<void> {
    this.connected = true;
    this.attempts = 0;
    this.replaying = true;
    await this.replay();
    if (!this.started || this.generation !== generation) return;
    this.replaying = false;
    const pending = this.pendingFrames;
    this.pendingFrames = [];
    pending.forEach((frame) => this.dispatchFrame(frame));
  }

  private handleMessage(event: string, value: unknown): void {
    if (!this.isRealtimeEvent(event)) return;
    const envelope = this.parseObject(value);
    if (!envelope) return;
    // Hub updates carry {event, data} envelopes; the SSE event type is the
    // canonical name - accept both shapes from one source of truth.
    const payload = this.parseObject(envelope.data) ?? envelope;
    if (!payload) return;
    const eventName = (typeof envelope.event === 'string' && this.isRealtimeEvent(envelope.event))
      ? envelope.event
      : event;
    const queueFrame = { event: eventName, payload };
    if (this.replaying) {
      this.pendingFrames.push(queueFrame);
    } else {
      this.dispatchFrame(queueFrame);
    }
  }

  private scheduleReconnect(delayMs: number): void {
    if (!this.started || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket();
    }, delayMs);
  }

  private closeSocket(): void {
    this.transport.close();
    this.connected = false;
    this.replaying = false;
    this.pendingFrames = [];
  }

  private reconnectAfterFailure(): void {
    if (!this.started) return;
    this.replayFallback();
    this.attempts += 1;
    const backoff = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** (this.attempts - 1));
    const jitter = Math.floor(Math.random() * RECONNECT_BASE_MS);
    this.scheduleReconnect(backoff + jitter);
  }

  private replayFallback(): void {
    if (this.fallbackReplayActive) return;
    this.fallbackReplayActive = true;
    void this.replay()
      .catch((error) => {
        console.warn('[laravel-realtime] fallback replay failed', error);
      })
      .finally(() => {
        this.fallbackReplayActive = false;
      });
  }

  private async openSocket(): Promise<void> {
    if (!this.started || this.transport.isConnected()) return;
    const generation = ++this.generation;
    try {
      const overview = await laravelApi.getQueueCenterOverview();
      if (!this.started || generation !== this.generation) return;
      const baseURL = getSharedBaseURL();
      const realtime = overview.realtime;
      if (!baseURL || !realtime.hub_url || !(realtime.topics || []).length) {
        throw new Error('LARAVEL_REALTIME_CONFIGURATION_UNAVAILABLE');
      }
      this.activeBaseURL = baseURL;
      await this.replay();
      if (!this.started || generation !== this.generation) return;
      this.transport.connect(baseURL, realtime, {
        authorize: () => laravelApi.relayHubAuth(),
        onSubscribed: () => {
          void this.subscribed(generation).catch((error) => {
            console.warn('[laravel-realtime] cursor replay failed', error);
            this.closeSocket();
            this.reconnectAfterFailure();
          });
        },
        onEvent: (event, data) => this.handleMessage(event, data),
        onClose: () => {
          this.connected = false;
          this.replaying = false;
          this.pendingFrames = [];
          this.reconnectAfterFailure();
        },
      });
    } catch (error) {
      console.warn('[laravel-realtime] connect failed', error);
      this.reconnectAfterFailure();
    }
  }
}

export const laravelRealtime = new LaravelRealtime();
