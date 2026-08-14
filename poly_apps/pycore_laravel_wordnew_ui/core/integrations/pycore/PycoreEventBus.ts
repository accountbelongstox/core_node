export type PycoreEventHandler<T = any> = (payload: T) => void;

export type Unsubscribe = () => void;

export interface PycoreSubscribeOptions {
  /** Optional: auto-unsubscribe when aborted. */
  signal?: AbortSignal;
  /** Optional: run handler once. */
  once?: boolean;
}

export class PycoreEventBus {
  private readonly handlers = new Map<string, Set<PycoreEventHandler>>();

  subscribe<T = any>(
    event: string,
    handler: PycoreEventHandler<T>,
    opts: PycoreSubscribeOptions = {},
  ): Unsubscribe {
    if (opts.signal?.aborted) return () => { /* already aborted */ };

    let unsubscribed = false;
    let off: Unsubscribe = () => { /* noop */ };

    const wrapped: PycoreEventHandler<T> = (payload: T) => {
      if (unsubscribed) return;
      handler(payload);

      if (opts.once) {
        unsubscribed = true;
        off();
      }
    };

    let handlers = this.handlers.get(event);
    if (!handlers) {
      handlers = new Set<PycoreEventHandler>();
      this.handlers.set(event, handlers);
    }
    handlers.add(wrapped as PycoreEventHandler);
    off = () => {
      const current = this.handlers.get(event);
      current?.delete(wrapped as PycoreEventHandler);
      if (current?.size === 0) this.handlers.delete(event);
    };

    if (opts.signal) {
      const onAbort = () => {
        unsubscribed = true;
        off();
      };
      opts.signal.addEventListener('abort', onAbort, { once: true });
    }

    return () => {
      unsubscribed = true;
      off();
    };
  }

  dispatch<T = any>(event: string, payload: T): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[pycore-eventbus] handler for "${event}" failed`, error);
      }
    });
  }
}

export const pycoreEventBus = new PycoreEventBus();
