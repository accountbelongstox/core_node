import { RELAY_CONTRACT, type RelayOperation } from '../../contracts/RelayContract';
import { laravelRelayApi as laravelApi } from './LaravelRelayAPI';
import { appendLog } from '../../logstore/logStore';
import { LaravelMercureConnection } from './LaravelMercureConnection';

type OperationEventHandler = (operationId: string, state: string) => void;
type ReadyWaiter = (connected: boolean) => void;
type ConnectionStateHandler = (connected: boolean) => void;

const RECONNECT_MIN_MS = RELAY_CONTRACT.durations.subscriber_reconnect_min_seconds * 1000;
const RECONNECT_MAX_MS = RELAY_CONTRACT.durations.subscriber_reconnect_max_seconds * 1000;
const TOKEN_REFRESH_MARGIN_MS = RELAY_CONTRACT.durations.subscriber_token_refresh_margin_seconds * 1000;

/**
 * One Mercure SSE connection for the pairing operation topic.
 *
 * The hub pushes `relay.operation.status` frames the moment an operation
 * reaches a new state; waiters use them to skip the polling sleep entirely.
 * This stream is the notification plane: operation waiters must establish it
 * first and keep HTTP polling to a bounded reconciliation fallback (the
 * owner rate limiter only tolerates a handful of requests per minute).
 */
class LaravelRelayOperationEvents {
  private connection = new LaravelMercureConnection();
  private handlers = new Set<OperationEventHandler>();
  private operations = new Map<string, RelayOperation>();
  private eventHandlers = new Set<(event: string, data: unknown) => void>();
  private stateHandlers = new Set<ConnectionStateHandler>();
  private readyWaiters = new Set<ReadyWaiter>();
  private started = false;
  private consumers = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private tokenTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelayMs = RECONNECT_MIN_MS;
  private generation = 0;
  private subscribedAt = 0;

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
    this.generation += 1;
    this.operations.clear();
    this.clearTimers();
    this.resolveReady(false);
    this.connection.close();
  }

  onOperationEvent(handler: OperationEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onEvent(handler: (event: string, data: unknown) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  takeOperation(operationId: string): RelayOperation | undefined {
    const operation = this.operations.get(operationId);
    this.operations.delete(operationId);
    return operation;
  }

  onConnectionState(handler: (connected: boolean) => void): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  notifyConnectionState(connected: boolean): void {
    for (const handler of [...this.stateHandlers]) {
      try {
        handler(connected);
      } catch {
        // Listener errors must never break the shared stream.
      }
    }
  }

  isConnected(): boolean {
    return this.connection.isConnected();
  }

  /**
   * Resolves once the Mercure stream is live (or immediately when it already
   * is), so operation waiters can give the long connection absolute priority
   * before falling back to HTTP reconciliation. Resolves `false` when the
   * stream is not live within `timeoutMs`.
   */
  whenConnected(timeoutMs: number): Promise<boolean> {
    if (this.connection.isConnected()) return Promise.resolve(true);
    if (!this.started) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (connected: boolean): void => {
        if (settled) return;
        settled = true;
        this.readyWaiters.delete(finish);
        clearTimeout(timer);
        resolve(connected);
      };
      const timer = setTimeout(() => finish(this.connection.isConnected()), timeoutMs);
      this.readyWaiters.add(finish);
    });
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.tokenTimer) clearTimeout(this.tokenTimer);
    this.reconnectTimer = null;
    this.tokenTimer = null;
  }

  private connect(): void {
    if (!this.started) return;
    const generation = ++this.generation;
    this.subscribedAt = 0;
    void laravelApi.getRelayOwnerHubAuth()
      .then((hub) => {
        if (generation !== this.generation) return;
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
              this.subscribedAt = performance.now();
              this.scheduleTokenRefresh(hub.expires_in_seconds);
              this.resolveReady(true);
              this.notifyConnectionState(true);
            },
            onEvent: (event, data) => this.handleEvent(event, data),
            onClose: (error) => {
              if (error) appendLog('error', 'api', `MERCURE_STREAM_INTERRUPTED: ${String(error)}`);
              if (this.subscribedAt > 0
                && performance.now() - this.subscribedAt >= RELAY_CONTRACT.durations.subscriber_read_timeout_seconds * 1000) {
                this.reconnectDelayMs = RECONNECT_MIN_MS;
              }
              this.notifyConnectionState(false);
              this.scheduleReconnect();
            },
          },
        );
      })
      .catch((error) => {
        if (generation !== this.generation) return;
        appendLog('error', 'api', `RELAY_HUB_AUTHORIZATION_FAILED: ${String(error)}`);
        this.resolveReady(false);
        this.notifyConnectionState(false);
        this.scheduleReconnect();
      });
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
    }, this.reconnectDelayMs + Math.floor(Math.random() * RECONNECT_MIN_MS));
    this.reconnectDelayMs = Math.min(RECONNECT_MAX_MS, this.reconnectDelayMs * 2);
  }

  private resolveReady(connected: boolean): void {
    for (const waiter of [...this.readyWaiters]) waiter(connected);
    this.readyWaiters.clear();
  }

  private handleEvent(event: string, data: unknown): void {
    for (const handler of this.eventHandlers) handler(event, data);
    if (event !== String(RELAY_CONTRACT.events.operation_status)) return;
    const frame = data as { operation_id?: unknown; state?: unknown; operation?: RelayOperation } | null;
    if (!frame || typeof frame.operation_id !== 'string' || frame.operation_id === '') return;
    const state = typeof frame.state === 'string' ? frame.state : '';
    if (frame.operation?.operation_id === frame.operation_id) {
      const previous = this.operations.get(frame.operation_id);
      if (!previous || previous.revision < frame.operation.revision) {
        this.operations.set(frame.operation_id, frame.operation);
      }
      if (this.operations.size > RELAY_CONTRACT.limits.owner_pending_operations) {
        this.operations.delete(this.operations.keys().next().value!);
      }
    }
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
