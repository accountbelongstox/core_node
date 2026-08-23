import { isPycoreRelayMode } from './pycoreTarget';
import { deliverThroughLaravelRelay } from './PycoreLaravelRelayTransport';

export type PycoreDirectDelivery = () => Promise<Response>;

class PycoreTransportSelector {
  usesLaravelRelay(): boolean {
    return isPycoreRelayMode();
  }

  deliver(
    url: string,
    init: RequestInit,
    signal: AbortSignal | undefined,
    directDelivery: PycoreDirectDelivery,
  ): Promise<Response> {
    if (this.usesLaravelRelay()) {
      return deliverThroughLaravelRelay(url, init, signal);
    }
    return directDelivery();
  }
}

export const pycoreTransportSelector = new PycoreTransportSelector();
