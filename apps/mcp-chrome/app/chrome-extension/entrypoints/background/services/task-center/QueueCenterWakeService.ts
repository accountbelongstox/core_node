import { logger } from '@/utils/logger';
import { QUEUE_CENTER_PATHS } from '@/utils/api-paths';
import { QUEUE_CENTER_REALTIME_EVENTS } from '@/utils/queue-center-contract';
import { AsyncOperationController, fetchWithTimeout, TimeoutController } from '@/utils/async';

interface ReverbConfig {
  app_key: string;
  host: string;
  port: number;
  scheme: string;
  channel: string;
}

interface PusherFrame {
  event: string;
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
const PUSHER_PROTOCOL = '7';
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
  private socket: WebSocket | null = null;
  private baseUrl: string | null = null;
  private readonly reconnectTimeout = new TimeoutController();
  private handlers = new Set<WakeHandler>();
  private generation = 0;
  private attempts = 0;
  private lastId: number | null = null;
  private readonly replayOperation = new AsyncOperationController<void>();

  subscribe(baseUrl: string, handler: WakeHandler): () => void {
    const normalized = baseUrl.trim().replace(/\/+$/, '');
    this.handlers.add(handler);

    if (this.baseUrl !== normalized) {
      this.baseUrl = normalized;
      this.lastId = null;
      this.closeSocket();
    }
    if (!this.socket) void this.connect();

    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) this.stop();
    };
  }

  private stop(): void {
    this.baseUrl = null;
    this.reconnectTimeout.cancel();
    this.closeSocket();
  }

  private closeSocket(): void {
    const socket = this.socket;
    this.generation += 1;
    this.socket = null;
    if (socket) socket.close();
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
    if (!this.baseUrl || this.handlers.size === 0 || this.socket) return;
    const baseUrl = this.baseUrl;
    const generation = ++this.generation;

    try {
      const response = await fetchWithTimeout(
        `${baseUrl}${QUEUE_CENTER_PATHS.OVERVIEW}`,
        BOOTSTRAP_TIMEOUT_MS,
      );
      const body = await response.json();
      const config = body?.data?.realtime as ReverbConfig | undefined;
      if (!response.ok || !config?.app_key || !config.channel) {
        throw new Error('Laravel Reverb configuration is unavailable');
      }
      if (this.baseUrl !== baseUrl || this.generation !== generation) return;
      await this.replay(baseUrl);
      if (this.baseUrl !== baseUrl || this.generation !== generation) return;
      this.openSocket(baseUrl, config, generation);
    } catch (error) {
      logger.warn(LOG, 'Realtime connection bootstrap failed', error);
      this.scheduleReconnect();
    }
  }

  private openSocket(baseUrl: string, config: ReverbConfig, generation: number): void {
    const endpoint = new URL(baseUrl);
    const configuredHost = String(config.host || '').trim();
    const host = !configuredHost || configuredHost === '0.0.0.0' || configuredHost === '::'
      ? endpoint.hostname
      : configuredHost;
    const secure = config.scheme === 'https' || endpoint.protocol === 'https:';
    const url = new URL(`${secure ? 'wss' : 'ws'}://${host}`);
    url.port = secure ? String(endpoint.port || 443) : String(config.port || 80);
    url.pathname = `/app/${encodeURIComponent(config.app_key)}`;
    url.searchParams.set('protocol', PUSHER_PROTOCOL);
    url.searchParams.set('client', 'mcp-chrome-worker');
    url.searchParams.set('version', '1.0');
    url.searchParams.set('flash', 'false');

    const socket = new WebSocket(url.toString());
    this.socket = socket;
    socket.onmessage = (message) => this.handleMessage(socket, baseUrl, config, message.data);
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this.socket !== socket || this.generation !== generation) return;
      this.socket = null;
      this.scheduleReconnect();
    };
  }

  private handleMessage(
    socket: WebSocket,
    baseUrl: string,
    config: ReverbConfig,
    value: unknown,
  ): void {
    const frame = this.parseFrame(value);
    if (!frame || this.socket !== socket) return;

    if (frame.event === 'pusher:connection_established') {
      socket.send(JSON.stringify({
        event: 'pusher:subscribe',
        data: { channel: config.channel, auth: '' },
      }));
      return;
    }
    if (frame.event === 'pusher:ping') {
      socket.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
      return;
    }
    if (frame.event === 'pusher_internal:subscription_succeeded') {
      this.attempts = 0;
      void this.replay(baseUrl)
        .catch((error) => logger.warn(LOG, 'Realtime replay failed', error))
        .finally(() => this.wake());
      return;
    }
    if (WAKE_EVENTS.has(frame.event)) {
      const payload = this.parseObject(frame.data);
      const id = Number(payload?._id ?? 0);
      if (id > 0) this.lastId = Math.max(this.lastId ?? 0, id);
      this.wake({ event: frame.event, payload });
    }
  }

  private replay(baseUrl: string): Promise<void> {
    return this.replayOperation.run(async () => {
      const cursor = this.lastId ?? 0;
      const response = await fetchWithTimeout(
        `${baseUrl}${QUEUE_CENTER_PATHS.EVENTS}?cursor=${cursor}&limit=200`,
        BOOTSTRAP_TIMEOUT_MS,
      );
      if (!response.ok) throw new Error(`Queue Center replay HTTP ${response.status}`);
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

  private parseFrame(value: unknown): PusherFrame | null {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return parsed && typeof parsed === 'object' && typeof parsed.event === 'string'
        ? parsed as PusherFrame
        : null;
    } catch {
      return null;
    }
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
