/**
 * What the pycore wordnew talks to can generate at all (R4): its declared lane capability
 * (`ui/queue_center/lane_capability` - the lanes, languages and engines of its work-lease claims),
 * cached per channel and machine, read synchronously by the clip schedule and the app-led assignment.
 *
 *   direct  the selected pycore, asked on its own address (the LAN route is only another address)
 *   relay   the paired pycore, asked through the Laravel relay
 *
 * A capability is refreshed when the selected pycore changes, when a channel comes up, and at the start
 * of a run when it is older than `CAPABILITY_TTL_MS`. A pycore that does not answer (older build) has an
 * unknown capability, and an unknown capability can generate everything (the behavior before the
 * capability existed). Capability is never an availability source (R7).
 */
import { ChangeSignal } from '../../../../core/events/ChangeSignal';
import type { AudioLaneKey } from '../../../../core/contracts/QueueCenterTypes';
import {
  laravelRelayDeviceId,
  parsePycoreLaneCapability,
  pycoreApi,
  subscribeLaravelRelayDevice,
  pycoreLaneCapabilityRoute,
  pycoreLaneCovers,
  relayPycoreFetch,
  type OrchResourceKind,
  type PycoreLaneCapability,
} from '../../../../core/integrations/pycore';
import { wordNewPycoreLink } from '../../integrations/WordNewPycoreLink';
import { wordNewChannels } from '../compute/WordNewCompute';
import { laneOfKind } from './WordNewBookPlanAssigner';

export type LaneCapabilityChannel = 'direct' | 'relay';

const CAPABILITY_TTL_MS = 60_000;
/** A failed read is tried again after this long (at the next run start or channel change). */
const FAILED_RETRY_MS = 30_000;
/** A run waits at most this long for a capability read before it continues with what is cached. */
const ENSURE_WAIT_MS = 4_000;
const UNKNOWN_SIGNATURE = '-';

interface CapabilityEntry {
  /** The machine the capability belongs to (selected pycore URL / paired relay device). */
  machine: string;
  capability: PycoreLaneCapability | null;
  readAt: number;
  failedAt: number;
}

const EMPTY_ENTRY: CapabilityEntry = { machine: '', capability: null, readAt: 0, failedAt: 0 };

function signatureOf(capability: PycoreLaneCapability | null): string {
  if (!capability) return UNKNOWN_SIGNATURE;
  return Object.keys(capability.lanes).sort()
    .map((lane) => `${lane}=${[...capability.lanes[lane].languages].sort().join(',')}`)
    .join(';');
}

class WordNewLaneCapabilityService {
  private readonly changes = new ChangeSignal();
  private readonly entries: Record<LaneCapabilityChannel, CapabilityEntry> = { direct: EMPTY_ENTRY, relay: EMPTY_ENTRY };
  private readonly reads: Partial<Record<LaneCapabilityChannel, Promise<void>>> = {};
  private channels = { direct: wordNewChannels.direct(), relay: wordNewChannels.relay() };
  private selected = wordNewPycoreLink.getSnapshot().selectedUrl;

  readonly subscribe = this.changes.subscribe;

  constructor() {
    wordNewChannels.subscribe(() => {
      const next = { direct: wordNewChannels.direct(), relay: wordNewChannels.relay() };
      const rose = (next.direct && !this.channels.direct) || (next.relay && !this.channels.relay);
      this.channels = next;
      if (rose) void this.ensure(0);
    });
    wordNewPycoreLink.subscribe(() => {
      const { selectedUrl } = wordNewPycoreLink.getSnapshot();
      if (selectedUrl === this.selected) return;
      this.selected = selectedUrl;
      // The old machine's capability is void at once; the new one is read now.
      this.changes.emit();
      void this.ensure(0);
    });
    // Another paired pycore behind the relay is another machine.
    let pairedDevice: string | null = laravelRelayDeviceId();
    subscribeLaravelRelayDevice((deviceId) => {
      if (deviceId === pairedDevice) return;
      pairedDevice = deviceId;
      this.changes.emit();
      void this.ensure(0);
    });
  }

  private machineOf(channel: LaneCapabilityChannel): string {
    return channel === 'direct' ? wordNewPycoreLink.getSnapshot().selectedUrl : laravelRelayDeviceId() ?? '';
  }

  /** The capability of the machine the channel talks to now; null when unknown. */
  capability(channel: LaneCapabilityChannel): PycoreLaneCapability | null {
    const entry = this.entries[channel];
    return entry.machine !== '' && entry.machine === this.machineOf(channel) ? entry.capability : null;
  }

  /** Can the channel's pycore serve this lane in this language? Unknown capability: yes. */
  coversLane(channel: LaneCapabilityChannel, lane: AudioLaneKey, language: string): boolean {
    const capability = this.capability(channel);
    return capability === null || pycoreLaneCovers(capability, lane, language);
  }

  /** Can the channel's pycore generate this kind and language? Unknown capability: yes. */
  canGenerate(channel: LaneCapabilityChannel, kind: OrchResourceKind, language: string): boolean {
    return this.coversLane(channel, laneOfKind(kind), language);
  }

  /** Changes whenever `canGenerate` of the channel can answer differently. */
  signature(channel: LaneCapabilityChannel): string {
    return signatureOf(this.capability(channel));
  }

  /** Work-node sid of the direct pycore ('' when unknown or not a work node). */
  directNodeSid(): string {
    return this.capability('direct')?.nodeSid ?? '';
  }

  /** Reads the capability of every usable channel that has none fresh (a run start / a change waits for it, bounded). */
  async ensure(maxAgeMs = CAPABILITY_TTL_MS): Promise<void> {
    const pending: Promise<void>[] = [];
    (['direct', 'relay'] as const).forEach((channel) => {
      if (!wordNewChannels[channel]() || this.machineOf(channel) === '') return;
      const entry = this.entries[channel];
      const now = Date.now();
      const stale = entry.machine !== this.machineOf(channel) || now - entry.readAt > maxAgeMs;
      if (stale && now - entry.failedAt >= FAILED_RETRY_MS) pending.push(this.read(channel));
    });
    if (pending.length === 0) return;
    await Promise.race([Promise.all(pending), new Promise<void>((resolve) => setTimeout(resolve, ENSURE_WAIT_MS))]);
  }

  private read(channel: LaneCapabilityChannel): Promise<void> {
    this.reads[channel] ??= this.fetch(channel).finally(() => { delete this.reads[channel]; });
    return this.reads[channel] as Promise<void>;
  }

  private async fetch(channel: LaneCapabilityChannel): Promise<void> {
    const machine = this.machineOf(channel);
    let capability: PycoreLaneCapability | null = null;
    let answered = false;
    try {
      if (channel === 'direct') {
        capability = parsePycoreLaneCapability(await pycoreApi.laneCapability());
      } else {
        const response = await relayPycoreFetch(pycoreLaneCapabilityRoute(), {});
        capability = response.ok ? parsePycoreLaneCapability(await response.json()) : null;
      }
      answered = true;
    } catch {
      answered = false;
    }
    // A selection that moved while the read was going keeps the newer read.
    if (machine !== this.machineOf(channel)) return;
    const before = signatureOf(this.capability(channel));
    const previous = this.entries[channel];
    this.entries[channel] = answered
      ? { machine, capability, readAt: Date.now(), failedAt: 0 }
      : { machine, capability: previous.machine === machine ? previous.capability : null, readAt: previous.machine === machine ? previous.readAt : 0, failedAt: Date.now() };
    if (signatureOf(this.capability(channel)) !== before || previous.machine !== machine) this.changes.emit();
  }
}

export const wordNewLaneCapability = new WordNewLaneCapabilityService();
