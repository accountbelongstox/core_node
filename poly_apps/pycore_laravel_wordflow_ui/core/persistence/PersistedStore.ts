/**
 * PersistedStore — reusable base class for a localStorage-backed, reactive
 * settings/state store.
 *
 * The project had no shared base for "persisted + reactive" state: SettingsModel
 * and logStore each hand-rolled their own `Set<listener>` + StorageManager calls.
 * This consolidates that pattern ONCE so feature stores just subclass it:
 *
 *   - persistence: one consolidated `StorageKey` (no scattered raw keys),
 *   - reactivity : `subscribe` + `getSnapshot` in the project's
 *     `useSyncExternalStore` shape (same as core/logstore + core/notify), so the
 *     snapshot reference is STABLE between writes and a NEW object on every write.
 *
 * Subclasses pass their storage key + a defaults factory to `super(...)` and
 * expose typed accessors on top of `get` / `patch` / `replace` / `reset`.
 */
import { StorageManager } from './StorageManager';
import type { StorageKey } from './StorageKeys';

export abstract class PersistedStore<T extends object> {
  /** Memoized current value; null until first read. Replaced (not mutated) on write. */
  private cache: T | null = null;
  private readonly listeners = new Set<() => void>();

  protected constructor(
    private readonly storageKey: StorageKey,
    private readonly makeDefaults: () => T,
  ) {}

  /** Current value = stored value merged over defaults (lazy + memoized). */
  protected read(): T {
    if (this.cache === null) {
      const defaults = this.makeDefaults();
      const stored = StorageManager.get<Partial<T> | null>(this.storageKey, null);
      this.cache =
        stored && typeof stored === 'object' ? { ...defaults, ...stored } : defaults;
    }
    return this.cache;
  }

  /** Stable snapshot for `useSyncExternalStore` (same ref until the next write). */
  getSnapshot = (): T => this.read();

  /** Subscribe to writes; returns an unsubscribe. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Notify subscribers (call after the cache reference has been replaced). */
  protected notify(): void {
    this.listeners.forEach((l) => l());
  }

  /** Read one field. */
  get<K extends keyof T>(key: K): T[K] {
    return this.read()[key];
  }

  /** Merge a partial patch, persist, notify. Returns the new value. */
  patch(updates: Partial<T>): T {
    const next = { ...this.read(), ...updates };
    this.cache = next;
    StorageManager.set(this.storageKey, next);
    this.notify();
    return next;
  }

  /** Replace the whole value, persist, notify. */
  replace(value: T): void {
    this.cache = value;
    StorageManager.set(this.storageKey, value);
    this.notify();
  }

  /** Reset to defaults. */
  reset(): void {
    this.replace(this.makeDefaults());
  }
}
