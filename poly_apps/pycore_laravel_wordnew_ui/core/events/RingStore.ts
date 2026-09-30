/** Generic capped pub/sub store; snapshots are useSyncExternalStore-friendly. */

export type RingStoreListener = () => void;

export interface RingStoreOptions<T> {
  capacity: number;
  /** Throttle listener notification (ms); 0 notifies synchronously per change. */
  emitMs?: number;
  /** Per-item hook fired synchronously on append (e.g. streaming observers). */
  onAppend?: (item: T) => void;
}

export class RingStore<T> {
  private items: T[] = [];
  private snapshot: T[] = [];
  private readonly listeners = new Set<RingStoreListener>();
  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly capacity: number;
  private readonly emitMs: number;
  private readonly onAppend?: (item: T) => void;

  constructor(options: RingStoreOptions<T>) {
    this.capacity = Math.max(1, options.capacity);
    this.emitMs = options.emitMs ?? 0;
    this.onAppend = options.onAppend;
  }

  /** Current contents; stable reference between emissions. */
  getSnapshot(): T[] {
    return this.emitMs > 0 ? this.snapshot : this.items;
  }

  getItems(): T[] {
    return this.items.slice();
  }

  /** Mutable view for ordered stores; call commit() after in-place edits. */
  get itemsRef(): T[] {
    return this.items;
  }

  subscribe(listener: RingStoreListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  append(item: T): void {
    const next = this.items.length >= this.capacity
      ? this.items.slice(this.items.length - this.capacity + 1)
      : this.items.slice();
    next.push(item);
    this.items = next;
    this.onAppend?.(item);
    this.emit();
  }

  /** Replace contents via a mapping function; emits once. */
  mutate(fn: (items: T[]) => T[]): void {
    this.items = fn(this.items);
    this.trim();
    this.emit();
  }

  /** Trim + emit after in-place edits through itemsRef. */
  commit(): void {
    this.trim();
    this.emit();
  }

  clear(): void {
    this.items = [];
    if (this.emitTimer) {
      clearTimeout(this.emitTimer);
      this.emitTimer = null;
    }
    this.snapshot = this.emitMs > 0 ? [] : this.items;
    this.listeners.forEach((listener) => listener());
  }

  private trim(): void {
    if (this.items.length > this.capacity) {
      this.items = this.items.slice(this.items.length - this.capacity);
    }
  }

  private emit(): void {
    if (this.emitMs <= 0) {
      this.snapshot = this.items;
      this.listeners.forEach((listener) => listener());
      return;
    }
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null;
      this.snapshot = this.items.slice();
      this.listeners.forEach((listener) => listener());
    }, this.emitMs);
  }
}
