import { RELAY_CONTRACT, type RelayDevice } from '../../contracts/RelayContract';
import { laravelRelayApi as laravelApi } from './LaravelRelayAPI';
import { laravelRelayOperationEvents } from './LaravelRelayOperationEvents';

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
  private recommendedDeviceId: string | null = null;
  private selectionReason = '';
  private presenceChanges = new Map<string, RelayRosterEntry>();
  private serverEpochMs: number | null = null;
  private serverObservedAt = 0;
  private groupId: string | null = null;
  private unavailableCode: string | null = null;
  private unavailableMessage: string | null = null;

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
        const frame = data as {
          device?: RelayDevice;
          online?: boolean;
          server_time_unix?: number;
          recommended_device_id?: string | null;
          selection_reason?: string;
        };
        if (!frame?.device?.device_id) return;
        this.observeServerTime(frame.server_time_unix);
        const entry = { ...frame.device, online: frame.online === true };
        this.entries.set(entry.device_id, entry);
        if (this.refreshFlight) this.presenceChanges.set(entry.device_id, entry);
        if (frame.recommended_device_id === null || typeof frame.recommended_device_id === 'string') {
          this.recommendedDeviceId = frame.recommended_device_id;
        }
        this.selectionReason = typeof frame.selection_reason === 'string'
          ? frame.selection_reason
          : this.selectionReason;
        this.refreshedAt = 0;
        this.emit();
      }),
    ];
    laravelRelayOperationEvents.start();
    void this.refresh();
    this.refreshTimer = setInterval(() => {
      void this.refresh();
    }, REFRESH_INTERVAL_MS);
  }

  stop(): void {
    this.consumers = Math.max(0, this.consumers - 1);
    if (this.consumers > 0) return;
    this.started = false;
    this.refreshedAt = 0;
    this.refreshError = null;
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

  preferredDeviceId(): string | null {
    if (this.recommendedDeviceId && this.entries.has(this.recommendedDeviceId)) {
      return this.recommendedDeviceId;
    }
    const ordered = this.list().sort((left, right) => {
      const leftSeen = Date.parse(left.last_seen_at || '') || 0;
      const rightSeen = Date.parse(right.last_seen_at || '') || 0;
      return rightSeen - leftSeen || left.device_id.localeCompare(right.device_id);
    });
    return ordered.find((entry) => entry.online)?.device_id
      ?? ordered[0]?.device_id
      ?? null;
  }

  recommendationReason(): string {
    return this.selectionReason;
  }

  onChange(handler: RosterChangeHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  refresh(force = false): Promise<void> {
    if (force) {
        this.refreshedAt = 0;
    }
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
    const generation = this.generation;
    await this.refresh();
    if (generation !== this.generation) throw new DOMException('Aborted', 'AbortError');
    if (this.refreshError) throw this.refreshError;
    return this.list();
  }

  unavailableError(): Error {
    return Object.assign(new Error(this.unavailableMessage || this.unavailableCode || 'RELAY_GROUP_EMPTY'), {
      code: this.unavailableCode || 'RELAY_GROUP_EMPTY',
      status: 503,
      group_id: this.groupId,
    });
  }

  private async fetchRoster(generation: number): Promise<void> {
    this.presenceChanges.clear();
    try {
      const roster = await laravelApi.getRelayDevices();
      if (generation !== this.generation) return;
      this.observeServerTime(roster.server_time_unix);
      this.refreshedAt = Date.now();
      this.refreshError = null;
      if (this.presenceChanges.size === 0) {
        this.recommendedDeviceId = roster.recommended_device_id;
        this.selectionReason = roster.selection_reason;
      }
      this.groupId = roster.group_id;
      this.unavailableCode = roster.unavailable_code;
      this.unavailableMessage = roster.unavailable_message;
      this.entries = new Map(roster.devices.map((device) => [device.device_id, {
        ...device,
        online: this.isOnline(device),
      }]));
      this.presenceChanges.forEach((entry, deviceId) => this.entries.set(deviceId, entry));
      this.presenceChanges.clear();
      this.emit();
    } catch (error) {
      if (generation !== this.generation) return;
      this.refreshError = error;
      this.refreshedAt = Date.now() - REFRESH_INTERVAL_MS
        + RELAY_CONTRACT.durations.subscriber_reconnect_max_seconds * 1000;
    }
  }

  private observeServerTime(epoch: unknown): void {
    if (typeof epoch !== 'number' || !Number.isFinite(epoch) || epoch <= 0) return;
    this.serverEpochMs = epoch * 1000;
    this.serverObservedAt = performance.now();
  }

  private isOnline(device: RelayDevice): boolean {
    const lastSeenAt = Date.parse(device.last_seen_at || '');
    const serverNow = this.serverEpochMs === null ? null
      : this.serverEpochMs + performance.now() - this.serverObservedAt;
    if (serverNow === null) return device.online === true;
    return device.online !== false && Number.isFinite(lastSeenAt) && serverNow - lastSeenAt <= OFFLINE_AFTER_MS;
  }

  private emit(): void {
    const snapshot = this.list();
    this.handlers.forEach((handler) => handler(snapshot));
  }
}

export const laravelRelayRoster = new LaravelRelayRoster();
