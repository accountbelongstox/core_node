export interface PycoreTransportHealth {
  connected: boolean;
  fastAvailable: boolean;
}

export type PycoreTransportHealthHandler = (health: PycoreTransportHealth) => void;

/** Fetch-shaped delivery contract shared by every pycore relay transport. */
export interface PycoreTransport {
  deliver(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response>;
  subscribe(handler: PycoreTransportHealthHandler): () => void;
  health(): PycoreTransportHealth;
}
