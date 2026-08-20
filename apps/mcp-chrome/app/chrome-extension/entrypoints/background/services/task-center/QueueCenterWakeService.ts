import { logger } from '@/utils/logger';
import { QUEUE_CENTER_PATHS } from '@/utils/api-paths';
import { QUEUE_CENTER_REALTIME_EVENTS } from '@/utils/queue-center-contract';
import { AsyncOperationController, fetchWithTimeout, TimeoutController } from '@/utils/async';

interface MercureConfig {
  transport: 'mercure';
  subscribe_url: string;
  token: string;
  topics: string[];
}

interface MercureEnvelope {
  event?: unknown;
  data?: unknown;
}

export interface QueueCenterWakeSignal {
  event: string;
  payload: Record<string, unknown> | null;
}

type WakeHandler = (signal?: QueueCenterWakeSignal) => void;

const LOG = 'QueueCenterWake';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
const BOOTSTRAP_TIMEOUT_MS = 10000;
const WAKE_EVENTS = new Set<string>([
  QUEUE_CENTER_REALTIME_EVENTS.queue_changed,
  QUEUE_CENTER_REALTIME_EVENTS.word_audio_head,
  QUEUE_CENTER_REALTIME_EVENTS.sentence_audio_head,
  QUEUE_CENTER_REALTIME_EVENTS.task_priority,
  QUEUE_CENTER_REALTIME_EVENTS.word_image_priority,
  QUEUE_CENTER_REALTIME_EVENTS.cover_priority,
  QUEUE_CENTER_REALTIME_EVENTS.poster_priority,
]);

class QueueCenterWakeService {
  private streamController: AbortController | null = null;
  private baseUrl: string | null = null;
  private readonly reconnectTimeout = new TimeoutController();
  private handlers = new Set<WakeHandler>();
  private generation = 0;
  private attempts = 0;
  private lastId: number | null = null;
  private lastEventId: string | null = null;
  private connecting = false;
  private readonly replayOperation = new AsyncOperationController<void>();

  subscribe(baseUrl: string, handler: WakeHandler): () => void {
    const normalized = baseUrl.trim().replace(/\/+$/, '');
    this.handlers.add(handler);

    if (this.baseUrl !== normalized) {
      this.baseUrl = normalized;
      this.lastId = null;
      this.lastEventId = null;
      this.closeStream();
    }
    if (!this.streamController && !this.connecting) void this.connect();

    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) this.stop();
    };
  }

  private stop(): void {
    this.baseUrl = null;
    this.reconnectTimeout.cancel();
    this.closeStream();
  }

  private closeStream(): void {
    const controller = this.streamController;
    this.generation += 1;
    this.streamController = null;
    this.connecting = false;
    controller?.abort();
  }

  private scheduleReconnect(): void {
    if (!this.baseUrl || this.handlers.size === 0 || this.reconnectTimeout.isScheduled) return;
    this.attempts += 1;
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** (this.attempts - 1));
    const jitter = Math.floor(Math.random() * RECONNECT_BASE_MS);
    this.reconnectTimeout.schedule(() => {
      void this.connect();
    }, delay + jitter);
  }

  private async connect(): Promise<void> {
    if (!this.baseUrl || this.handlers.size === 0 || this.streamController || this.connecting) return;
    const baseUrl = this.baseUrl;
    const generation = ++this.generation;
    const controller = new AbortController();
    this.connecting = true;

    try {
      const response = await fetchWithTimeout(
        `${baseUrl}${QUEUE_CENTER_PATHS.OVERVIEW}`,
        BOOTSTRAP_TIMEOUT_MS,
      );
      const body = await response.json();
      const config = body?.data?.realtime as MercureConfig | undefined;
      if (!response.ok || config?.transport !== 'mercure' || !config.subscribe_url || !config.token) {
        throw new Error('MERCURE_CONFIGURATION_UNAVAILABLE');
      }
      if (this.baseUrl !== baseUrl || this.generation !== generation) return;

      this.streamController = controller;
      const streamResponse = await fetch(config.subscribe_url, {
        headers: this.streamHeaders(config.token),
        signal: controller.signal,
      });
      if (!streamResponse.ok || !streamResponse.body) {
        throw new Error(`MERCURE_SUBSCRIPTION_HTTP_${streamResponse.status}`);
      }
      if (this.baseUrl !== baseUrl || this.generation !== generation) return;

      await this.replay(baseUrl);
      if (this.baseUrl !== baseUrl || this.generation !== generation) return;
      this.attempts = 0;
      this.wake();
      await this.consumeStream(streamResponse.body, generation);
    } catch (error) {
      if (!controller.signal.aborted && this.generation === generation) {
        logger.warn(LOG, 'MERCURE_CONNECTION_FAILED', error);
      }
    } finally {
      if (this.generation === generation) {
        this.streamController = null;
        this.connecting = false;
        this.scheduleReconnect();
      }
    }
  }

  private streamHeaders(token: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    };
    if (this.lastEventId) headers['Last-Event-ID'] = this.lastEventId;
    return headers;
  }

  private async consumeStream(stream: ReadableStream<Uint8Array>, generation: number): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let dataLines: string[] = [];
    let eventType = 'message';
    let eventId: string | null = null;

    const dispatch = (): void => {
      if (dataLines.length > 0) {
        this.handleEvent(eventType, dataLines.join('\n'), eventId);
      }
      dataLines = [];
      eventType = 'message';
      eventId = null;
    };

    const consumeLine = (rawLine: string): void => {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
      if (line === '') {
        dispatch();
        return;
      }
      if (line.startsWith(':')) return;
      const separator = line.indexOf(':');
      const field = separator < 0 ? line : line.slice(0, separator);
      let lineValue = separator < 0 ? '' : line.slice(separator + 1);
      if (lineValue.startsWith(' ')) lineValue = lineValue.slice(1);
      if (field === 'data') dataLines.push(lineValue);
      else if (field === 'event') eventType = lineValue || 'message';
      else if (field === 'id' && !lineValue.includes('\u0000')) eventId = lineValue;
    };

    while (this.generation === generation) {
      const result = await reader.read();
      buffer += decoder.decode(result.value, { stream: !result.done });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        consumeLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
      if (result.done) {
        if (buffer !== '') consumeLine(buffer);
        dispatch();
        return;
      }
    }
  }

  private handleEvent(eventType: string, value: string, eventId: string | null): void {
    const envelope = this.parseObject(value) as MercureEnvelope | null;
    const event = typeof envelope?.event === 'string' ? envelope.event : eventType;
    const payload = this.parseObject(envelope?.data ?? value);
    const id = Number(payload?._id ?? 0);
    if (eventId !== null) this.lastEventId = eventId;
    if (id > 0 && id <= (this.lastId ?? 0)) return;
    if (!WAKE_EVENTS.has(event)) return;
    if (id > 0) this.lastId = Math.max(this.lastId ?? 0, id);
    this.wake({ event, payload });
  }

  private replay(baseUrl: string): Promise<void> {
    return this.replayOperation.run(async () => {
      const cursor = this.lastId ?? 0;
      const response = await fetchWithTimeout(
        `${baseUrl}${QUEUE_CENTER_PATHS.EVENTS}?cursor=${cursor}&limit=200`,
        BOOTSTRAP_TIMEOUT_MS,
      );
      if (!response.ok) throw new Error(`QUEUE_CENTER_REPLAY_HTTP_${response.status}`);
      const body = await response.json();
      const replay = body?.data ?? body;
      const events = Array.isArray(replay?.events) ? replay.events : [];
      const nextCursor = Number(replay?.cursor ?? cursor);
      if (nextCursor > 0) this.lastId = Math.max(this.lastId ?? 0, nextCursor);
      for (const item of events) {
        const event = String(item?.event || '');
        if (!WAKE_EVENTS.has(event)) continue;
        this.wake({ event, payload: this.parseObject(item?.data) });
      }
    });
  }

  private wake(signal?: QueueCenterWakeSignal): void {
    for (const handler of this.handlers) handler(signal);
  }

  private parseObject(value: unknown): Record<string, unknown> | null {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return parsed && typeof parsed === 'object'
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
}

export const queueCenterWakeService = new QueueCenterWakeService();
