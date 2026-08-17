/**
 * Dependency-free Mercure 1.0 SSE transport shared by Laravel clients.
 *
 * Speaks the latest Mercure specification directly (no compatibility mode):
 * one exact `match` query parameter per topic, session auth through the
 * hub-path cookie issued by /api/relay/hub-auth (the spec default
 * `__Secure-mercure_access_token`), native EventSource auto-reconnect with
 * Last-Event-ID resume, and a background re-auth timer that keeps the
 * cookie fresh across reconnects (the hub closes streams at token exp).
 */

export interface LaravelMercureHubConfig {
  hub_url: string;
  topics: string[];
  token_ttl_seconds: number;
}

export interface LaravelMercureAuthorization {
  subscribe_url: string;
  token_ttl_seconds: number;
}

export interface LaravelMercureCallbacks {
  authorize: () => Promise<LaravelMercureAuthorization>;
  onSubscribed: () => void;
  onEvent: (event: string, data: unknown) => void;
  onClose: () => void;
}

/** Refresh the auth cookie once this fraction of the TTL has elapsed. */
const TOKEN_REFRESH_FRACTION = 0.75;

export class LaravelMercureConnection {
  private source: EventSource | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private generation = 0;

  connect(
    _baseURL: string,
    config: LaravelMercureHubConfig,
    callbacks: LaravelMercureCallbacks,
  ): void {
    this.close();
    const generation = ++this.generation;
    void this.open(generation, config, callbacks).catch(() => {
      if (this.generation !== generation) return;
      callbacks.onClose();
    });
  }

  close(): void {
    this.generation += 1;
    this.clearRefreshTimer();
    const source = this.source;
    this.source = null;
    this.connected = false;
    if (source) source.close();
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async open(
    generation: number,
    config: LaravelMercureHubConfig,
    callbacks: LaravelMercureCallbacks,
  ): Promise<void> {
    const authorization = await callbacks.authorize();
    if (this.generation !== generation) return;
    const url = authorization.subscribe_url || this.subscribeUrl(config);
    const source = new EventSource(url, { withCredentials: true });
    this.source = source;
    source.onopen = () => {
      if (this.generation !== generation) return;
      this.connected = true;
      this.scheduleRefresh(generation, authorization.token_ttl_seconds || config.token_ttl_seconds, callbacks);
      callbacks.onSubscribed();
    };
    source.onmessage = (message: MessageEvent<string>) => {
      if (this.generation !== generation) return;
      callbacks.onEvent('message', this.parseData(message.data));
    };
    source.onerror = () => {
      if (this.generation !== generation) return;
      // EventSource retries transient failures itself (Last-Event-ID resume);
      // a CLOSED stream means auth or the hub is gone - hand the lifecycle
      // back to the caller, which re-authenticates and reconnects.
      if (source.readyState === EventSource.CLOSED) {
        this.connected = false;
        callbacks.onClose();
      }
    };
  }

  private scheduleRefresh(
    generation: number,
    ttlSeconds: number,
    callbacks: LaravelMercureCallbacks,
  ): void {
    this.clearRefreshTimer();
    const intervalMs = Math.max(15_000, ttlSeconds * 1000 * TOKEN_REFRESH_FRACTION);
    this.refreshTimer = setInterval(() => {
      if (this.generation !== generation) {
        this.clearRefreshTimer();
        return;
      }
      // Cookie refresh only; a failed refresh surfaces through the stream
      // closing at exp, which takes the normal reconnect path.
      void callbacks.authorize().catch(() => undefined);
    }, intervalMs);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private subscribeUrl(config: LaravelMercureHubConfig): string {
    const url = new URL(config.hub_url);
    for (const topic of config.topics) {
      url.searchParams.append('match', topic);
    }
    return url.toString();
  }

  private parseData(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
