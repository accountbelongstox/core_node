/** pycore availability for the compute scheduler: event connection, link state and health. */
import { connectPycoreHttp, isHttpConnected, onHttpStatus } from '../pycore/PycoreEventClient';
import { getPycoreHealth } from '../pycore/PycoreHealth';
import { PYCORE_HEALTH_EVENT } from '../pycore/PycoreNetwork';
import { pycoreLink } from '../pycore/PycoreServiceLink';
import { isPycoreRelayMode, subscribePycoreTarget } from '../pycore/pycoreTarget';
import { laravelRelayDeviceId, subscribeLaravelRelayDevice } from '../pycore/RelayPairing';
import type { AvailabilitySource, ChannelInputs } from './ComputeAvailability';

/** The relay inputs of the delivery channels: the target mode and the relay pairing, each through its own subscription. */
export function createPycoreChannelInputs(): ChannelInputs {
  return {
    relayMode: isPycoreRelayMode,
    relayPaired: () => laravelRelayDeviceId() !== null,
    subscribe: (listener) => {
      const offTarget = subscribePycoreTarget(listener);
      const offPairing = subscribeLaravelRelayDevice(listener);
      return () => {
        offTarget();
        offPairing();
      };
    },
  };
}

/** `gate` adds an app rule (e.g. a selected target) on top of the shared connection state. */
export function createPycoreAvailabilitySource(gate?: () => boolean): AvailabilitySource {
  return {
    isUp: () => (gate ? gate() : true)
      && isHttpConnected()
      && getPycoreHealth().up !== false
      && !pycoreLink.isReconnecting(),
    subscribe: (listener) => {
      connectPycoreHttp();
      const offStatus = onHttpStatus(listener);
      const offLink = pycoreLink.subscribe(listener);
      if (typeof window !== 'undefined') window.addEventListener(PYCORE_HEALTH_EVENT, listener);
      return () => {
        offStatus();
        offLink();
        if (typeof window !== 'undefined') window.removeEventListener(PYCORE_HEALTH_EVENT, listener);
      };
    },
  };
}
