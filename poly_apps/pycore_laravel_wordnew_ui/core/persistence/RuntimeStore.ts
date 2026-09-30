/**
 * createRuntimeStore — shared base for module-singleton runtime stores
 * (subscribe / patch / debounced persist / errorMessage), replacing the
 * hand-rolled window-CustomEvent + Set<listener> copies.
 */

export interface RuntimeStoreOptions<T extends object> {
  defaults: () => T;
  /** Restore a persisted snapshot; merged over defaults. */
  restore?: () => T | null;
  /** Debounced writer invoked with the latest state after persisted patches. */
  persist?: (state: T) => void;
  /** Debounce for persist (ms); 0 persists synchronously. */
  persistDebounceMs?: number;
  /** Fallback message for non-Error rejections. */
  errorFallback?: string;
}

export interface RuntimeStore<T extends object> {
  getState(): T;
  /** Merge a partial patch; save=false skips the persist writer. */
  patch(partial: Partial<T>, save?: boolean): void;
  subscribe(listener: () => void): () => void;
  errorMessage(error: unknown): string;
}

export function createRuntimeStore<T extends object>(options: RuntimeStoreOptions<T>): RuntimeStore<T> {
  const listeners = new Set<() => void>();
  const persistDebounceMs = options.persistDebounceMs ?? 0;
  const restored = options.restore?.();
  let state: T = restored ? { ...options.defaults(), ...restored } : options.defaults();
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  function notify(): void {
    listeners.forEach((listener) => listener());
  }

  function schedulePersist(): void {
    if (!options.persist) return;
    if (persistDebounceMs <= 0) {
      options.persist(state);
      return;
    }
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      options.persist?.(state);
    }, persistDebounceMs);
  }

  return {
    getState(): T {
      return state;
    },
    patch(partial: Partial<T>, save = true): void {
      state = { ...state, ...partial };
      if (save) schedulePersist();
      notify();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    errorMessage(error: unknown): string {
      return error instanceof Error ? error.message : (options.errorFallback ?? 'RUNTIME_STORE_ERROR');
    },
  };
}
