import {
  RELAY_CONTRACT,
  type RelayGrant, type RelayGrantDevice, type RelayPairing,
} from '../../contracts/RelayContract';
import { Backoff } from '../../tasks/Backoff';
import { appendLog } from '../../logstore/logStore';
import { isRelayAuthorizationFailure, laravelRelayApi } from './LaravelRelayAPI';
import { LaravelMercureConnection } from './LaravelMercureConnection';
import { subscribeAuthSession } from '../../auth/AuthSession';

type RelayEventHandler = (event: string, data: unknown) => void;
type ConnectionStateHandler = (connected: boolean) => void;

interface StreamEntry {
  conn: LaravelMercureConnection;
  key: string;
  topics: Set<string>;
  ttlMs: number;
  subscribedAt: number;
}

const DURATIONS = RELAY_CONTRACT.durations;
const GRANT_REFRESH_MARGIN_MS = DURATIONS.grant_refresh_margin_seconds * 1000;
const RECONNECT_MIN_MS = DURATIONS.subscriber_reconnect_min_seconds * 1000;
const RECONNECT_MAX_MS = DURATIONS.subscriber_reconnect_max_seconds * 1000;
const STREAM_STABLE_MS = 30_000;
const STREAM_CONNECT_WAIT_MS = 3_000;
const STREAM_IDLE_STOP_MS = 600_000;
const ROTATE_MIN_MS = 5_000;
const REGRANT_MIN_INTERVAL_MS = 5_000;
const DEVICE_RECHECK_MS = 10_000;
const GRANT_BLOCK_MIN_MS = 30_000;
const GRANT_BLOCK_MAX_MS = 300_000;
const AUTHENTICATION_REQUIRED = 'authentication_required';

export class RelayGrantUnavailableError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`RELAY_GRANT_UNAVAILABLE_${reason.toUpperCase()}`);
    this.name = 'RelayGrantUnavailableError';
    this.reason = reason;
  }
}

function topicsOf(grant: RelayGrant): string[] {
  const listed = (grant.topics || []).filter((topic) => typeof topic === 'string' && topic !== '');
  return [...new Set(listed)].sort();
}

/**
 * The single hub connection of the relay: one owner grant covers the owner
 * events topic and every device response topic, so roster, pairing, device
 * events and response frames all arrive on one stream and are dispatched by
 * event type.
 */
class LaravelRelayStream {
  private grantState: RelayGrant | null = null;
  private grantExpiresAt = 0;
  private grantFetchedAt = 0;
  private grantFlight: Promise<RelayGrant> | null = null;
  private blockedUntil = 0;
  private authorizationBlocked = false;
  private authGeneration = 0;
  private readonly grantBackoff = new Backoff(GRANT_BLOCK_MIN_MS, GRANT_BLOCK_MAX_MS);
  private readonly reconnectBackoff = new Backoff(RECONNECT_MIN_MS, RECONNECT_MAX_MS);
  private active: StreamEntry | null = null;
  private candidate: StreamEntry | null = null;
  private consumers = 0;
  private lastUseAt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private rotateTimer: ReturnType<typeof setTimeout> | null = null;
  private waiters = new Set<() => void>();
  private eventHandlers = new Set<RelayEventHandler>();
  private stateHandlers = new Set<ConnectionStateHandler>();

  /** A grant 401/403 pauses the stream until the shared auth session changes. */
  constructor() {
    subscribeAuthSession(() => {
      this.authGeneration += 1;
      this.close();
      this.grantState = null;
      this.grantExpiresAt = 0;
      this.grantFetchedAt = 0;
      this.grantFlight = null;
      this.blockedUntil = 0;
      this.authorizationBlocked = false;
      this.grantBackoff.reset();
      this.reconnectBackoff.reset();
      if (this.wanted()) this.ensureOpen();
    });
  }

  /** Hold the stream open while a consumer (roster, event tunnel) needs it. */
  start(): void {
    this.consumers += 1;
    this.ensureOpen();
  }

  stop(): void {
    this.consumers = Math.max(0, this.consumers - 1);
    if (!this.wanted()) this.close();
  }

  /** Keep the stream open for a call in flight; it closes after an idle period. */
  touch(): void {
    this.lastUseAt = Date.now();
    this.ensureOpen();
  }

  isConnected(): boolean {
    return this.active !== null;
  }

  grant(): RelayGrant | null {
    return this.grantState;
  }

  onEvent(handler: RelayEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onConnectionState(handler: ConnectionStateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  whenConnected(timeoutMs: number): Promise<boolean> {
    if (this.active) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      const finish = (): void => {
        clearTimeout(timer);
        this.waiters.delete(finish);
        resolve(this.active !== null);
      };
      const timer = setTimeout(finish, timeoutMs);
      this.waiters.add(finish);
    });
  }

  async resolveDevice(pairing: RelayPairing): Promise<RelayGrantDevice> {
    const find = (grant: RelayGrant): RelayGrantDevice | undefined => grant.devices.find(
      (device) => device.device_id === pairing.device_id && device.pairing_id === pairing.pairing_id,
    );
    let device = find(await this.ensureGrant(false));
    const stale = device !== undefined && !device.online
      && performance.now() - this.grantFetchedAt > DEVICE_RECHECK_MS;
    if (!device || stale) device = find(await this.ensureGrant(true));
    if (!device) throw new RelayGrantUnavailableError('device_not_granted');
    return device;
  }

  async requireTopic(topic: string): Promise<void> {
    const covered = (): boolean => this.active?.topics.has(topic) === true;
    if (covered()) return;
    await new Promise<void>((resolve, reject) => {
      const settle = (): void => {
        clearTimeout(timer);
        this.waiters.delete(settle);
        if (covered()) resolve();
        else reject(new RelayGrantUnavailableError('stream_unavailable'));
      };
      const timer = setTimeout(settle, STREAM_CONNECT_WAIT_MS);
      this.waiters.add(settle);
      if (!this.active && !this.candidate && !this.reconnectTimer && this.grantState) {
        this.openCandidate(this.grantState);
      }
    });
  }

  markDeviceOffline(deviceId: string): void {
    const device = this.grantState?.devices.find((entry) => entry.device_id === deviceId);
    if (device) device.online = false;
  }

  noteGrantFailure(): void {
    this.blockedUntil = performance.now() + this.grantBackoff.next();
  }

  async ensureGrant(force: boolean): Promise<RelayGrant> {
    if (this.authorizationBlocked) throw new RelayGrantUnavailableError(AUTHENTICATION_REQUIRED);
    const now = performance.now();
    const current = this.grantState;
    if (current && !force && now < this.grantExpiresAt - GRANT_REFRESH_MARGIN_MS) return current;
    if (current && force && now - this.grantFetchedAt < REGRANT_MIN_INTERVAL_MS) return current;
    if (this.grantFlight) return this.grantFlight;
    if (now < this.blockedUntil) {
      if (current && now < this.grantExpiresAt) return current;
      throw new RelayGrantUnavailableError('grant_backoff');
    }
    try {
      return await this.fetchGrant();
    } catch (error) {
      if (current && performance.now() < this.grantExpiresAt) return current;
      throw error;
    }
  }

  private wanted(): boolean {
    return this.consumers > 0 || Date.now() - this.lastUseAt <= STREAM_IDLE_STOP_MS;
  }

  private ensureOpen(): void {
    if (this.authorizationBlocked) return;
    if (this.active || this.candidate || this.reconnectTimer) return;
    const grant = this.grantState;
    if (grant && performance.now() < this.grantExpiresAt - GRANT_REFRESH_MARGIN_MS) {
      this.openCandidate(grant);
      return;
    }
    this.fetchGrant()
      .then((fresh) => {
        if (this.wanted() && !this.active && !this.candidate) this.openCandidate(fresh);
      })
      .catch(() => this.scheduleReconnect());
  }

  private fetchGrant(): Promise<RelayGrant> {
    if (this.grantFlight) return this.grantFlight;
    const generation = this.authGeneration;
    const flight = laravelRelayApi.getRelayGrant()
      .then((raw) => {
        if (generation !== this.authGeneration) throw new DOMException('Aborted', 'AbortError');
        return this.applyGrant(raw);
      })
      .catch((error) => {
        if (generation !== this.authGeneration) throw new RelayGrantUnavailableError('grant_unavailable');
        appendLog('warn', 'api', `RELAY_GRANT_FAILED: ${String(error)}`);
        if (isRelayAuthorizationFailure(error)) {
          this.authorizationBlocked = true;
          this.grantState = null;
          this.grantExpiresAt = 0;
          throw new RelayGrantUnavailableError(AUTHENTICATION_REQUIRED);
        }
        this.noteGrantFailure();
        throw new RelayGrantUnavailableError('grant_unavailable');
      })
      .finally(() => {
        if (this.grantFlight === flight) this.grantFlight = null;
      });
    this.grantFlight = flight;
    return flight;
  }

  private applyGrant(raw: RelayGrant): RelayGrant {
    if (!raw || typeof raw.hub_url !== 'string' || typeof raw.subscriber_token !== 'string'
      || !Array.isArray(raw.devices) || !(Number(raw.expires_in_seconds) > 0)) {
      throw new Error('RELAY_GRANT_INVALID');
    }
    this.grantState = raw;
    this.grantFetchedAt = performance.now();
    this.grantExpiresAt = this.grantFetchedAt + Number(raw.expires_in_seconds) * 1000;
    this.blockedUntil = 0;
    this.grantBackoff.reset();
    if (this.wanted()) this.reconcile(raw);
    return raw;
  }

  private reconcile(grant: RelayGrant): void {
    const key = topicsOf(grant).join('\n');
    if (this.active?.key === key || this.candidate?.key === key) return;
    this.openCandidate(grant);
  }

  private openCandidate(grant: RelayGrant): void {
    const topics = topicsOf(grant);
    if (topics.length === 0) return;
    this.candidate?.conn.close();
    const entry: StreamEntry = {
      conn: new LaravelMercureConnection(),
      key: topics.join('\n'),
      topics: new Set(topics),
      ttlMs: Number(grant.expires_in_seconds) * 1000,
      subscribedAt: 0,
    };
    this.candidate = entry;
    entry.conn.connect(
      { hub_url: grant.hub_url, topics },
      {
        authorize: async () => ({
          token: grant.subscriber_token,
          token_ttl_seconds: Number(grant.expires_in_seconds),
        }),
        onSubscribed: () => this.promote(entry),
        onEvent: (event, data) => {
          if (this.active !== entry) return;
          this.eventHandlers.forEach((handler) => handler(event, data));
        },
        onClose: (error) => this.closed(entry, error),
      },
    );
  }

  private promote(entry: StreamEntry): void {
    if (this.candidate !== entry && this.active !== entry) {
      entry.conn.close();
      return;
    }
    const previous = this.active;
    entry.subscribedAt = performance.now();
    this.active = entry;
    if (this.candidate === entry) this.candidate = null;
    if (previous && previous !== entry) previous.conn.close();
    this.scheduleRotation(entry.ttlMs);
    this.waiters.forEach((waiter) => waiter());
    if (!previous) this.notifyState(true);
  }

  private closed(entry: StreamEntry, error?: unknown): void {
    if (error) appendLog('error', 'api', `RELAY_STREAM_INTERRUPTED: ${String(error)}`);
    if (isRelayAuthorizationFailure(error)) this.grantExpiresAt = 0;
    if (this.active === entry) {
      this.active = null;
      if (this.rotateTimer) clearTimeout(this.rotateTimer);
      this.rotateTimer = null;
      if (performance.now() - entry.subscribedAt >= STREAM_STABLE_MS) this.reconnectBackoff.reset();
      this.notifyState(false);
    } else if (this.candidate === entry) {
      this.candidate = null;
    } else {
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.authorizationBlocked || !this.wanted() || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.wanted() || this.candidate || this.active) return;
      this.ensureGrant(false)
        .then((grant) => {
          if (this.wanted() && !this.candidate && !this.active) this.openCandidate(grant);
        })
        .catch(() => this.scheduleReconnect());
    }, this.reconnectBackoff.next());
  }

  private scheduleRotation(ttlMs: number): void {
    if (this.rotateTimer) clearTimeout(this.rotateTimer);
    const delay = Math.max(ROTATE_MIN_MS, ttlMs - GRANT_REFRESH_MARGIN_MS);
    this.rotateTimer = setTimeout(() => {
      this.rotateTimer = null;
      if (!this.wanted()) {
        this.close();
        return;
      }
      this.fetchGrant()
        .then((grant) => {
          if (this.wanted() && !this.candidate) this.openCandidate(grant);
        })
        .catch(() => this.scheduleReconnect());
    }, delay);
  }

  private close(): void {
    if (this.rotateTimer) clearTimeout(this.rotateTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.rotateTimer = null;
    this.reconnectTimer = null;
    this.candidate?.conn.close();
    const wasActive = this.active !== null;
    this.active?.conn.close();
    this.candidate = null;
    this.active = null;
    if (wasActive) this.notifyState(false);
  }

  private notifyState(connected: boolean): void {
    this.stateHandlers.forEach((handler) => {
      try {
        handler(connected);
      } catch {
        // Listener errors must never break the shared stream.
      }
    });
  }
}

export const laravelRelayStream = new LaravelRelayStream();
