import { subscribe as httpSubscribe, dispatchEvent as httpDispatch } from './PycoreHttp';

export type PycoreEventHandler<T = any> = (payload: T) => void;

export type Unsubscribe = () => void;

export interface PycoreSubscribeOptions {
  /** Optional: auto-unsubscribe when aborted. */
  signal?: AbortSignal;
  /** Optional: run handler once. */
  once?: boolean;
}

class PycoreEventBusClass {
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
      try {
        handler(payload);
      } catch (err) {
        // PycoreHttp.ts already isolates per-handler exceptions, but keep this
        // wrapper for any future transport/dispatch changes.
        // eslint-disable-next-line no-console
        console.error(`[pycore-eventbus] handler for "${event}" failed`, err);
      }

      if (opts.once) {
        unsubscribed = true;
        off();
      }
    };

    off = httpSubscribe(event, wrapped);

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
    httpDispatch(event, payload);
  }
}

export const pycoreEventBus = new PycoreEventBusClass();
