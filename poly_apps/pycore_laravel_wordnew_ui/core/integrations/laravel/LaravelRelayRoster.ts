/**
 * LaravelRelayRoster - the always-on relay roster link
 * (DESIGN_20260817_2115 PART_3 §3.3/§3.4).
 *
 * Roster truth is the server registry (`GET /api/relay/machines`), pushed
 * forward by `roster.update` deltas on the public `pycore.machines` topic
 * (SSE through the shared Mercure connection, session hub-auth). The link
 * runs in BOTH transport modes - designation and the roster view stay
 * available even while the pycore backend is direct. A bounded refresh (the
 * offline window) covers SSE gaps/reconnects; deltas never override a
 * registry refresh.
 */
import { laravelApi } from './LaravelAPI';
import type { RelayMachineRecord } from './LaravelTypes';
import { LaravelMercureConnection } from './LaravelMercureConnection';
import { getSharedBaseURL } from './transport/BaseAPI';
import { relayTopic } from '../../contracts/QueueCenterContract';

export interface RelayRosterEntry extends RelayMachineRecord {
  online: boolean;
}

export interface RelayRosterUpdate {
  machine_id: string;
  online: boolean;
  capabilities?: string[];
}

type RosterChangeHandler = (entries: RelayRosterEntry[]) => void;

// Bounded roster refresh: twice per offline window by default (the registry
// remains the authority; SSE is the low-latency path).
const REFRESH_INTERVAL_MS = 20_000;
const HUB_FALLBACK_PATH = '/.well-known/mercure';

class LaravelRelayRoster {
  private entries = new Map<string, RelayRosterEntry>();
  private transport = new LaravelMercureConnection();
  private handlers = new Set<RosterChangeHandler>();
  private started = false;
  private consumers = 0;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private offlineAfterMs = 45_000;

  start(): void {
    this.consumers += 1;
    if (this.started) return;
    this.started = true;
    void this.refresh();
    this.openStream();
    this.scheduleRefresh();
  }

  stop(): void {
    this.consumers = Math.max(0, this.consumers - 1);
    if (this.consumers > 0) return;
    this.started = false;
    this.transport.close();
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  list(): RelayRosterEntry[] {
    return [...this.entries.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  online(): RelayRosterEntry[] {
    return this.list().filter((entry) => entry.online);
  }

  onChange(handler: RosterChangeHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Registry truth pass; deltas continue on top. */
  async refresh(): Promise<void> {
    try {
      const response = await laravelApi.getRelayMachines();
      const offlineAfterSeconds = Math.max(1, response.heartbeat_seconds * 2 + 5);
      this.offlineAfterMs = offlineAfterSeconds * 1000;
      const next = new Map<string, RelayRosterEntry>();
      for (const machine of response.machines) {
        next.set(machine.machine_id, { ...machine, online: this.isOnline(machine) });
      }
      this.entries = next;
      this.emit();
    } catch {
      // Registry unreachable - keep the last known roster; the bounded
      // refresh retries.
    }
  }

  private isOnline(machine: RelayMachineRecord): boolean {
    const seen = Date.parse(machine.last_heartbeat_at || machine.registered_at || '');
    if (!Number.isFinite(seen)) return false;
    return Date.now() - seen <= this.offlineAfterMs;
  }

  private openStream(): void {
    if (typeof EventSource === 'undefined') return;
    const base = getSharedBaseURL();
    // The connection prefers the authorize() answer's subscribe_url; the
    // config hub_url is only its fallback, so it must still be absolute.
    this.transport.connect('', {
      hub_url: base ? new URL(HUB_FALLBACK_PATH, base).toString() : HUB_FALLBACK_PATH,
      topics: [relayTopic('machines')],
      token_ttl_seconds: 600,
    }, {
      authorize: () => laravelApi.relayHubAuth(),
      onSubscribed: () => undefined,
      onEvent: (event, data) => this.applyDelta(event, data),
      onClose: () => {
        if (!this.started) return;
        // Re-open on the next refresh tick (auth cookie is refreshed by the
        // connection itself while open).
        void this.refresh();
      },
    });
  }

  private applyDelta(_event: string, data: unknown): void {
    const update = this.parseUpdate(data);
    if (!update) return;
    const current = this.entries.get(update.machine_id);
    if (!current && !update.online) return;
    this.entries.set(update.machine_id, {
      machine_id: update.machine_id,
      label: current?.label ?? update.machine_id,
      capabilities: update.capabilities ?? current?.capabilities ?? [],
      hostname: current?.hostname,
      platform: current?.platform,
      registered_at: current?.registered_at,
      last_heartbeat_at: current?.last_heartbeat_at,
      online: update.online,
    });
    this.emit();
  }

  private parseUpdate(data: unknown): RelayRosterUpdate | null {
    const value = typeof data === 'string' ? this.parseJson(data) : data;
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<RelayRosterUpdate>;
    if (typeof candidate.machine_id !== 'string' || !candidate.machine_id) return null;
    return {
      machine_id: candidate.machine_id,
      online: !!candidate.online,
      capabilities: Array.isArray(candidate.capabilities) ? candidate.capabilities : undefined,
    };
  }

  private parseJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setInterval(() => {
      if (!this.started) return;
      void this.refresh();
      // Re-open the stream when it closed and the refresh confirmed the
      // server is reachable again.
      if (!this.transport.isConnected()) this.openStream();
    }, REFRESH_INTERVAL_MS);
  }

  private emit(): void {
    const snapshot = this.list();
    this.handlers.forEach((handler) => handler(snapshot));
  }
}

declare global {
  interface Window {
    __RELAY_ROSTER_REFRESH_MS__?: number;
  }
}

export const laravelRelayRoster = new LaravelRelayRoster();
