import { isPycoreRelayMode } from './pycoreTarget';
import { deliverThroughRelay } from './RelayDelivery';

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
      return deliverThroughRelay(url, init, signal);
    }
    return directDelivery();
  }
}

export const pycoreTransportSelector = new PycoreTransportSelector();
