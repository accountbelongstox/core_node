import { RELAY_CONTRACT, type RelayDevice } from '../../contracts/RelayContract';
import { laravelRelayApi as laravelApi } from './LaravelRelayAPI';
import { SHARED_BASE_URL_CHANGED_EVENT } from './transport/BaseAPI';
import { laravelRelayOperationEvents } from './LaravelRelayOperationEvents';
import { subscribeAuthSession } from '../../auth/AuthSession';

export interface RelayRosterEntry extends RelayDevice {
  online: boolean;
}

type RosterChangeHandler = (entries: RelayRosterEntry[]) => void;

const REFRESH_INTERVAL_MS = RELAY_CONTRACT.durations.roster_reconciliation_seconds * 1000;
const OFFLINE_AFTER_MS = RELAY_CONTRACT.durations.presence_timeout_seconds * 1000;

class LaravelRelayRoster {
  private entries = new Map<string, RelayRosterEntry>();
  private handlers = new Set<RosterChangeHandler>();
  private started = false;
  private consumers = 0;
  private refreshFlight: Promise<void> | null = null;
  private unsubscribe: (() => void)[] = [];
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;
  private refreshedAt = 0;
  private refreshError: unknown = null;

  constructor() {
    const reset = (): void => {
      this.generation += 1;
      this.refreshFlight = null;
      this.entries.clear();
      this.refreshedAt = 0;
      this.refreshError = null;
      this.emit();
    };
    subscribeAuthSession(reset);
    if (typeof window !== 'undefined') window.addEventListener(SHARED_BASE_URL_CHANGED_EVENT, reset);
  }

  start(): void {
    this.consumers += 1;
    if (this.started) return;
    this.started = true;
    this.unsubscribe = [
      laravelRelayOperationEvents.onConnectionState((connected) => {
        if (connected) {
          this.refreshedAt = 0;
          void this.refresh();
        }
      }),
      laravelRelayOperationEvents.onEvent((event, data) => {
        if (event !== RELAY_CONTRACT.events.device_presence) return;
        const frame = data as { device?: RelayDevice; online?: boolean };
        if (!frame?.device?.device_id) return;
        this.entries.set(frame.device.device_id, { ...frame.device, online: frame.online === true });
        this.refreshedAt = 0;
        this.emit();
      }),
    ];
    laravelRelayOperationEvents.start();
    void this.refresh();
    this.refreshTimer = setInterval(() => {
      if (!laravelRelayOperationEvents.isConnected()) void this.refresh();
    }, REFRESH_INTERVAL_MS);
  }

  stop(): void {
    this.consumers = Math.max(0, this.consumers - 1);
    if (this.consumers > 0) return;
    this.started = false;
    this.unsubscribe.forEach((unsubscribe) => unsubscribe());
    this.unsubscribe = [];
    laravelRelayOperationEvents.stop();
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  list(): RelayRosterEntry[] {
    return [...this.entries.values()]
      .map((device) => ({ ...device, online: this.isOnline(device) }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  online(): RelayRosterEntry[] {
    return this.list().filter((entry) => entry.online);
  }

  onChange(handler: RosterChangeHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  refresh(): Promise<void> {
    if (Date.now() - this.refreshedAt < REFRESH_INTERVAL_MS) return Promise.resolve();
    if (!this.refreshFlight) {
      const flight = this.fetchRoster(this.generation).finally(() => {
        if (this.refreshFlight === flight) this.refreshFlight = null;
      });
      this.refreshFlight = flight;
    }
    return this.refreshFlight;
  }

  async requireDevices(): Promise<RelayRosterEntry[]> {
    await this.refresh();
    if (this.refreshError) throw this.refreshError;
    return this.list();
  }

  private async fetchRoster(generation: number): Promise<void> {
    try {
      const devices = await laravelApi.getRelayDevices();
      if (generation !== this.generation) return;
      this.refreshedAt = Date.now();
      this.refreshError = null;
      this.entries = new Map(devices.map((device) => [device.device_id, {
        ...device,
        online: this.isOnline(device),
      }]));
      this.emit();
    } catch (error) {
      if (generation !== this.generation) return;
      this.refreshError = error;
      this.refreshedAt = Date.now() - REFRESH_INTERVAL_MS
        + RELAY_CONTRACT.durations.subscriber_reconnect_max_seconds * 1000;
    }
  }

  private isOnline(device: RelayDevice): boolean {
    const lastSeenAt = Date.parse(device.last_seen_at || '');
    return device.online !== false && Number.isFinite(lastSeenAt) && Date.now() - lastSeenAt <= OFFLINE_AFTER_MS;
  }

  private emit(): void {
    const snapshot = this.list();
    this.handlers.forEach((handler) => handler(snapshot));
  }
}

export const laravelRelayRoster = new LaravelRelayRoster();
