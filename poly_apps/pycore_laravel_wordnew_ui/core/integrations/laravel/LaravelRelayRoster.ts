import { RELAY_CONTRACT, type RelayDevice } from '../../contracts/RelayContract';
import { laravelApi } from './LaravelAPI';
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

  constructor() {
    subscribeAuthSession(() => {
      this.generation += 1;
      this.refreshFlight = null;
      this.entries.clear();
      this.emit();
    });
  }

  start(): void {
    this.consumers += 1;
    if (this.started) return;
    this.started = true;
    this.unsubscribe = [
      laravelRelayOperationEvents.onConnectionState((connected) => {
        if (connected) void this.refresh();
      }),
      laravelRelayOperationEvents.onEvent((event, data) => {
        if (event !== RELAY_CONTRACT.events.device_presence) return;
        const frame = data as { device?: RelayDevice; online?: boolean };
        if (!frame?.device?.device_id) return;
        this.entries.set(frame.device.device_id, { ...frame.device, online: frame.online === true });
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
    return [...this.entries.values()].sort((left, right) => left.label.localeCompare(right.label));
  }

  online(): RelayRosterEntry[] {
    return this.list().filter((entry) => entry.online);
  }

  onChange(handler: RosterChangeHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  refresh(): Promise<void> {
    if (!this.refreshFlight) {
      const flight = this.fetchRoster(this.generation).finally(() => {
        if (this.refreshFlight === flight) this.refreshFlight = null;
      });
      this.refreshFlight = flight;
    }
    return this.refreshFlight;
  }

  private async fetchRoster(generation: number): Promise<void> {
    try {
      const devices = await laravelApi.getRelayDevices();
      if (generation !== this.generation) return;
      this.entries = new Map(devices.map((device) => [device.device_id, {
        ...device,
        online: this.isOnline(device),
      }]));
      this.emit();
    } catch {
      return;
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
