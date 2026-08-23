import { RELAY_V2_CONTRACT, type RelayV2Device } from '../../contracts/RelayV2Contract';
import { LaravelMercureConnection } from './LaravelMercureConnection';
import { laravelApi } from './LaravelAPI';

export interface RelayRosterEntry extends RelayV2Device {
  online: boolean;
}

type RosterChangeHandler = (entries: RelayRosterEntry[]) => void;

const REFRESH_INTERVAL_MS = RELAY_V2_CONTRACT.durations.heartbeat_seconds * 1000;
const OFFLINE_AFTER_MS = (RELAY_V2_CONTRACT.durations.heartbeat_seconds * 2 + 5) * 1000;

class LaravelRelayRoster {
  private entries = new Map<string, RelayRosterEntry>();
  private transport = new LaravelMercureConnection();
  private handlers = new Set<RosterChangeHandler>();
  private started = false;
  private consumers = 0;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.consumers += 1;
    if (this.started) return;
    this.started = true;
    void this.refresh().then(() => this.openStream());
    this.refreshTimer = setInterval(() => void this.refresh(), REFRESH_INTERVAL_MS);
  }

  stop(): void {
    this.consumers = Math.max(0, this.consumers - 1);
    if (this.consumers > 0) return;
    this.started = false;
    this.transport.close();
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

  private openStream(): void {
    if (!this.started) return;
    this.transport.connect({
      hub_url: RELAY_V2_CONTRACT.public_urls.mercure_hub,
      topics: [],
    }, {
      authorize: async () => {
        const hub = await laravelApi.relayV2HubAuth();
        return {
          subscribe_url: this.subscribeUrl(hub.url, hub.topics),
          token: hub.subscriber_token,
          token_ttl_seconds: hub.expires_in_seconds,
        };
      },
      onSubscribed: () => undefined,
      onEvent: () => void this.refresh(),
      onClose: () => {
        if (!this.started) return;
        setTimeout(() => this.openStream(), REFRESH_INTERVAL_MS);
      },
    });
  }

  private subscribeUrl(hubUrl: string, topics: string[]): string {
    const url = new URL(hubUrl);
    topics.forEach((topic) => url.searchParams.append('topic', topic));
    return url.toString();
  }

  private emit(): void {
    const snapshot = this.list();
    this.handlers.forEach((handler) => handler(snapshot));
  }
}

export const laravelRelayRoster = new LaravelRelayRoster();
