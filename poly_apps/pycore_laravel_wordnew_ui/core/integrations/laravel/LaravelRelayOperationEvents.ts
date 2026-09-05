import { RELAY_V2_CONTRACT } from '../../contracts/RelayV2Contract';
import { laravelApi } from './LaravelAPI';
import { LaravelMercureConnection } from './LaravelMercureConnection';

type OperationEventHandler = (operationId: string, state: string) => void;

const RECONNECT_MIN_MS = RELAY_V2_CONTRACT.durations.subscriber_reconnect_min_seconds * 1000;
const RECONNECT_MAX_MS = RELAY_V2_CONTRACT.durations.subscriber_reconnect_max_seconds * 1000;
const TOKEN_REFRESH_MARGIN_MS = 30_000;

/**
 * One Mercure SSE connection for the pairing operation topic.
 *
 * The hub pushes `relay.operation.status` frames the moment an operation
 * reaches a new state; waiters use them to skip the polling sleep. The
 * plain HTTP operation poll remains the reconciliation safety net, so a
 * missed frame only costs one poll interval.
 */
class LaravelRelayOperationEvents {
  private connection = new LaravelMercureConnection();
  private handlers = new Set<OperationEventHandler>();
  private started = false;
  private consumers = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private tokenTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelayMs = RECONNECT_MIN_MS;

  start(): void {
    this.consumers += 1;
    if (this.started) return;
    this.started = true;
    this.reconnectDelayMs = RECONNECT_MIN_MS;
    this.connect();
  }

  stop(): void {
    this.consumers = Math.max(0, this.consumers - 1);
    if (this.consumers > 0 || !this.started) return;
    this.started = false;
    this.clearTimers();
    this.connection.close();
  }

  onOperationEvent(handler: OperationEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.tokenTimer) clearTimeout(this.tokenTimer);
    this.reconnectTimer = null;
    this.tokenTimer = null;
  }

  private connect(): void {
    if (!this.started) return;
    void laravelApi.getRelayV2OwnerHubAuth()
      .then((hub) => {
        if (!this.started || !hub?.url || !(hub.topics || []).length || !hub.subscriber_token) {
          throw new Error('RELAY_HUB_AUTHORIZATION_INCOMPLETE');
        }
        this.connection.connect(
          { hub_url: hub.url, topics: hub.topics },
          {
            authorize: async () => ({
              token: hub.subscriber_token,
              token_ttl_seconds: hub.expires_in_seconds,
            }),
            onSubscribed: () => {
              this.reconnectDelayMs = RECONNECT_MIN_MS;
              this.scheduleTokenRefresh(hub.expires_in_seconds);
            },
            onEvent: (event, data) => this.handleEvent(event, data),
            onClose: () => this.scheduleReconnect(),
          },
        );
      })
      .catch(() => this.scheduleReconnect());
  }

  private scheduleTokenRefresh(expiresInSeconds: number): void {
    if (this.tokenTimer) clearTimeout(this.tokenTimer);
    const delay = Math.max(RECONNECT_MIN_MS, expiresInSeconds * 1000 - TOKEN_REFRESH_MARGIN_MS);
    this.tokenTimer = setTimeout(() => {
      this.tokenTimer = null;
      if (!this.started) return;
      this.connection.close();
      this.connect();
    }, delay);
  }

  private scheduleReconnect(): void {
    if (!this.started || this.reconnectTimer) return;
    this.tokenTimer && clearTimeout(this.tokenTimer);
    this.tokenTimer = null;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelayMs);
    this.reconnectDelayMs = Math.min(RECONNECT_MAX_MS, this.reconnectDelayMs * 2);
  }

  private handleEvent(event: string, data: unknown): void {
    if (event !== String(RELAY_V2_CONTRACT.events.operation_status)) return;
    const frame = data as { operation_id?: unknown; state?: unknown } | null;
    if (!frame || typeof frame.operation_id !== 'string' || frame.operation_id === '') return;
    const state = typeof frame.state === 'string' ? frame.state : '';
    for (const handler of [...this.handlers]) {
      try {
        handler(frame.operation_id, state);
      } catch {
        // Listener errors must never break the shared stream.
      }
    }
  }
}

export const laravelRelayOperationEvents = new LaravelRelayOperationEvents();
