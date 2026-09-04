import { RELAY_V2_CONTRACT, type RelayV2Device } from '../../contracts/RelayV2Contract';
import { laravelApi } from './LaravelAPI';

export interface RelayRosterEntry extends RelayV2Device {
  online: boolean;
}

type RosterChangeHandler = (entries: RelayRosterEntry[]) => void;

const REFRESH_INTERVAL_MS = RELAY_V2_CONTRACT.durations.heartbeat_seconds * 1000;
const OFFLINE_AFTER_MS = (RELAY_V2_CONTRACT.durations.heartbeat_seconds * 2 + 5) * 1000;

/**
 * Device roster synchronized through plain HTTP polling on the relay owner
 * plane; wake events are intentionally not consumed, so the roster stays
 * correct through the mandatory reconciliation cadence alone.
 */
class LaravelRelayRoster {
  private entries = new Map<string, RelayRosterEntry>();
  private handlers = new Set<RosterChangeHandler>();
  private started = false;
  private consumers = 0;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.consumers += 1;
    if (this.started) return;
    this.started = true;
    void this.refresh();
    this.refreshTimer = setInterval(() => void this.refresh(), REFRESH_INTERVAL_MS);
  }

  stop(): void {
    this.consumers = Math.max(0, this.consumers - 1);
    if (this.consumers > 0) return;
    this.started = false;
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

  async refresh(): Promise<void> {
    try {
      const devices = await laravelApi.getRelayV2Devices();
      this.entries = new Map(devices.map((device) => [device.device_id, {
        ...device,
        online: this.isOnline(device),
      }]));
      this.emit();
    } catch {
      return;
    }
  }

  private isOnline(device: RelayV2Device): boolean {
    const lastSeenAt = Date.parse(device.last_seen_at || '');
    return Number.isFinite(lastSeenAt) && Date.now() - lastSeenAt <= OFFLINE_AFTER_MS;
  }

  private emit(): void {
    const snapshot = this.list();
    this.handlers.forEach((handler) => handler(snapshot));
  }
}

export const laravelRelayRoster = new LaravelRelayRoster();
