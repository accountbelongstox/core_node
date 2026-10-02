/** Payload-free change notifier: the one subscribe / emit pair behind every `useSyncExternalStore` store. */
export class ChangeSignal {
  private readonly listeners = new Set<() => void>();

  /** Stable arrow so `signal.subscribe` can be handed to `useSyncExternalStore` unbound. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  readonly emit = (): void => {
    this.listeners.forEach((listener) => listener());
  };

  get size(): number {
    return this.listeners.size;
  }
}
