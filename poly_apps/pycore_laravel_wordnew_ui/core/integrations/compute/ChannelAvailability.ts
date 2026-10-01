/**
 * The one availability view of the three delivery channels (pycore direct, pycore through the Laravel relay,
 * Laravel). The flags are derived and debounced once, in `ComputeAvailability`, from the path sources and the
 * relay inputs (relay mode, pairing), so every router (compute jobs, clip chains) reads the same state.
 */
import type { ComputeAvailability } from './ComputeAvailability';

export type DeliveryChannel = 'direct' | 'relay' | 'laravel';

export interface ChannelAvailability {
  /** The selected pycore answers over its own link. */
  direct: () => boolean;
  /** Not direct, Laravel up, and a pycore paired through the relay. */
  relay: () => boolean;
  laravel: () => boolean;
  /** `() => Promise<boolean>` of one channel, the shape clip-chain stages take. */
  available: (channel: DeliveryChannel) => () => Promise<boolean>;
  /** Fires on every change of any channel, including a pairing or relay-mode switch. */
  subscribe: (listener: () => void) => () => void;
}

export function createChannelAvailability(availability: ComputeAvailability): ChannelAvailability {
  const channels: Record<DeliveryChannel, () => boolean> = {
    direct: () => availability.getSnapshot().direct,
    relay: () => availability.getSnapshot().relay,
    laravel: () => availability.getSnapshot().laravel,
  };
  return {
    ...channels,
    available: (channel) => () => Promise.resolve(channels[channel]()),
    subscribe: availability.subscribe,
  };
}
