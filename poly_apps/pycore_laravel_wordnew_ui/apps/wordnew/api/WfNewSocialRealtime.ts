/** WordNew social realtime client: private Mercure topic plus cursor recovery. */
import {
  LaravelMercureConnection,
  type LaravelMercureAuthorization,
} from '../../../core/integrations/laravel/LaravelMercureConnection';
import { wfNewEndpoints } from './WfNewEndpoints';
import { WfNewApiPaths } from './WfNewApiPaths';
import {
  authedGetJSON,
  loadToken,
} from './WfNewApiTransport';

export type WfNewSocialEvent =
  | 'message.new' | 'friend.request' | 'friend.accept'
  | 'friend.online' | 'friend.offline' | 'notification.new' | 'presence.update'
  | 'post.created' | 'post.liked' | 'post.comment'
  | 'live.started' | 'live.chat.new';

interface SocialRealtimeConnection {
  hub_url: string;
  topics: string[];
  token_ttl_seconds: number;
  subscribe_url: string;
  auth_mode: string;
  protocol: string;
  cookie: string;
  events: string[];
}

interface SocialRealtimeEvent {
  id: number;
  event: string;
  data: Record<string, unknown>;
}

interface SocialRealtimeReplay {
  cursor: number;
  events: SocialRealtimeEvent[];
  has_more: boolean;
}

interface SocialFrame {
  event: string;
  payload: Record<string, unknown>;
}

type Handler = (payload: any) => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

class WfNewSocialRealtime {
  private transport = new LaravelMercureConnection();
  private started = false;
  private connected = false;
  private generation = 0;
  private attempts = 0;
  private lastId: number | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private replaying = false;
  private fallbackReplayActive = false;
  private pendingFrames: SocialFrame[] = [];
  private allowedEvents = new Set<string>();
  private handlers = new Map<string, Set<Handler>>();

  subscribe(event: WfNewSocialEvent | '*', handler: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.attempts = 0;
    void this.openSocket();
  }

  stop(): void {
    this.started = false;
    this.generation += 1;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeSocket();
    this.lastId = null;
    this.allowedEvents.clear();
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

  private emit(event: string, payload: Record<string, unknown>): void {
    const named = this.handlers.get(event);
    if (named) {
      for (const handler of named) {
        try { handler(payload); } catch { /* Ignore subscriber failures. */ }
      }
    }
    const wildcard = this.handlers.get('*');
    if (wildcard) {
      for (const handler of wildcard) {
        try { handler({ event, payload }); } catch { /* Ignore subscriber failures. */ }
      }
    }
  }

  private dispatchFrame(frame: SocialFrame): void {
    const rawId = frame.payload._id;
    const id = typeof rawId === 'number' ? rawId : Number(rawId || 0);
    if (id > 0 && this.lastId !== null && id <= this.lastId) return;
    if (id > 0) this.lastId = id;
    const payload = { ...frame.payload };
    delete payload._id;
    this.emit(frame.event, payload);
  }

  private handleEvent(_transportEvent: string, value: unknown): void {
    // Hub updates arrive as {event, data} envelopes; the envelope event is
    // the canonical name the roster gate checks.
    const envelope = this.parseObject(value);
    if (!envelope || typeof envelope.event !== 'string') return;
    if (!this.allowedEvents.has(envelope.event)) return;
    const payload = this.parseObject(envelope.data) ?? envelope;
    if (!payload) return;
    const frame = { event: envelope.event, payload };
    if (this.replaying) this.pendingFrames.push(frame);
    else this.dispatchFrame(frame);
  }

  private async replay(): Promise<void> {
    let hasMore = true;
    while (hasMore) {
      const replay = await authedGetJSON<SocialRealtimeReplay>(
        WfNewApiPaths.socialRealtimeEvents(this.lastId ?? 0),
        { cursor: this.lastId ?? 0, events: [], has_more: false },
      );
      for (const item of replay.events) {
        if (!this.allowedEvents.has(item.event)) continue;
        this.dispatchFrame({ event: item.event, payload: item.data });
      }
      if (this.lastId === null || replay.cursor > this.lastId) this.lastId = replay.cursor;
      hasMore = replay.has_more;
    }
  }

  /**
   * The authenticated connection endpoint is the single authorize step: it
   * returns the hub contract and refreshes the hub-path cookie for the
   * private social topic; the stream itself reuses it on reconnects.
   */
  private async authorize(): Promise<LaravelMercureAuthorization> {
    const config = await authedGetJSON<SocialRealtimeConnection>(
      WfNewApiPaths.socialRealtimeConnection,
      null as unknown as SocialRealtimeConnection,
    );
    if (!config?.subscribe_url) throw new Error('SOCIAL_REALTIME_UNAVAILABLE');
    this.allowedEvents = new Set(config.events || []);
    return {
      subscribe_url: config.subscribe_url,
      token_ttl_seconds: config.token_ttl_seconds,
    };
  }

  private async subscribed(generation: number): Promise<void> {
    this.attempts = 0;
    this.replaying = true;
    await this.replay();
    if (!this.started || this.generation !== generation) return;
    this.replaying = false;
    this.connected = true;
    const pending = this.pendingFrames;
    this.pendingFrames = [];
    pending.forEach((frame) => this.dispatchFrame(frame));
  }

  private closeSocket(): void {
    this.transport.close();
    this.connected = false;
    this.replaying = false;
    this.pendingFrames = [];
  }

  private scheduleReconnect(delayMs: number): void {
    if (!this.started || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket();
    }, delayMs);
  }

  private reconnectAfterFailure(): void {
    if (!this.started || !loadToken()) return;
    this.replayFallback();
    this.attempts += 1;
    const backoff = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** (this.attempts - 1));
    const jitter = Math.floor(Math.random() * RECONNECT_BASE_MS);
    this.scheduleReconnect(backoff + jitter);
  }

  private replayFallback(): void {
    if (this.fallbackReplayActive || this.allowedEvents.size === 0) return;
    this.fallbackReplayActive = true;
    void this.replay()
      .catch((error) => console.warn('[wfnew-social-realtime] fallback replay failed', error))
      .finally(() => { this.fallbackReplayActive = false; });
  }

  private async openSocket(): Promise<void> {
    if (!this.started || !loadToken()) return;
    if (typeof EventSource === 'undefined') {
      console.warn('[wfnew-social-realtime] EventSource unavailable');
      return;
    }
    const generation = ++this.generation;
    try {
      await wfNewEndpoints.whenReady();
      const config = await authedGetJSON<SocialRealtimeConnection>(
        WfNewApiPaths.socialRealtimeConnection,
        null as unknown as SocialRealtimeConnection,
      );
      if (!this.started || generation !== this.generation) return;
      if (!config?.hub_url || !(config.topics || []).length) {
        throw new Error('SOCIAL_REALTIME_CONFIGURATION_UNAVAILABLE');
      }
      this.allowedEvents = new Set(config.events || []);
      await this.replay();
      if (!this.started || generation !== this.generation) return;
      this.transport.connect(wfNewEndpoints.getCurrentBaseUrl(), config, {
        authorize: () => this.authorize(),
        onSubscribed: () => {
          void this.subscribed(generation).catch((error) => {
            console.warn('[wfnew-social-realtime] cursor replay failed', error);
            this.closeSocket();
            this.reconnectAfterFailure();
          });
        },
        onEvent: (event, data) => this.handleEvent(event, data),
        onClose: () => {
          this.connected = false;
          this.replaying = false;
          this.pendingFrames = [];
          this.reconnectAfterFailure();
        },
      });
    } catch (error) {
      console.warn('[wfnew-social-realtime] connect failed', error);
      this.reconnectAfterFailure();
    }
  }
}

const socialRealtime = new WfNewSocialRealtime();

export function subscribeSocial(event: WfNewSocialEvent | '*', handler: Handler): () => void {
  return socialRealtime.subscribe(event, handler);
}

export function startSocialRealtime(): void {
  socialRealtime.start();
}

export function stopSocialRealtime(): void {
  socialRealtime.stop();
}

export function isSocialRealtimeConnected(): boolean {
  return socialRealtime.isConnected();
}
