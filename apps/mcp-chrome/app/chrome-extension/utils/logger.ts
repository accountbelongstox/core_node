import { STORAGE_KEYS } from './storage-keys';

/**
 * Global logger (extension-wide).
 *
 * One shared, persistent log buffer for the whole extension. Every subsystem
 * routes its diagnostics through `logger.{debug,info,warn,error}(source, msg,
 * data?)` instead of calling console directly, so:
 *   - logs are MIRRORED to the devtools console (same as before), AND
 *   - kept in a bounded ring buffer (the last MAX_ENTRIES only), AND
 *   - persisted to chrome.storage.local (the extension's "file cache") so they
 *     survive an MV3 service-worker restart and can be read from the popup.
 *
 * Persistence is debounced and merge-on-init, so multiple contexts (background
 * SW + popup) sharing the one storage key don't clobber each other's history.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: number; // epoch ms
  level: LogLevel;
  source: string; // subsystem tag, e.g. 'Bing Worker'
  message: string;
  data?: string; // truncated JSON/string of extra context (optional)
}

// Keep only the most recent 100 entries (memory + persisted) — the DEBUG center
// shows this same bounded ring, newest first.
const MAX_ENTRIES = 100;
/** Storage key for the persisted ring buffer. Exported so the popup DEBUG
 *  center can subscribe to chrome.storage.onChanged for live cross-context logs. */
export const LOG_STORAGE_KEY = STORAGE_KEYS.GLOBAL_LOGS;
const MAX_DATA_CHARS = 1000;
// Short debounce so logs surface in the DEBUG center in near-real-time while
// still coalescing bursts (per-word crawl logging is high-frequency).
const PERSIST_DEBOUNCE_MS = 250;

type LogListener = (entries: LogEntry[]) => void;

class GlobalLogger {
  private entries: LogEntry[] = [];
  private loaded = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** Same-context live subscribers (e.g. a panel rendering in this context). */
  private listeners = new Set<LogListener>();

  /**
   * Subscribe to live log updates within THIS JS context. Returns an
   * unsubscribe function. Cross-context (background -> popup) live updates ride
   * chrome.storage.onChanged[LOG_STORAGE_KEY] instead (the SW and popup are
   * separate contexts with their own buffers, unified only through storage).
   */
  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    if (this.listeners.size === 0) return;
    const snapshot = [...this.entries];
    this.listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch {
        // a bad listener must never break logging.
      }
    });
  }

  /**
   * Load any persisted history into the ring. Idempotent; MERGES stored entries
   * before whatever this context already buffered so an early log() isn't lost.
   * Safe to call in any context — a no-op where chrome.storage is unavailable.
   */
  async init(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.hasStorage()) return;
    try {
      const stored = (await chrome.storage.local.get(LOG_STORAGE_KEY))[LOG_STORAGE_KEY];
      if (Array.isArray(stored) && stored.length) {
        this.entries = [...stored, ...this.entries].slice(-MAX_ENTRIES);
      }
    } catch {
      // Storage unavailable — stay in-memory only.
    }
  }

  debug(source: string, message: string, data?: unknown): void {
    this.add('debug', source, message, data);
  }
  info(source: string, message: string, data?: unknown): void {
    this.add('info', source, message, data);
  }
  warn(source: string, message: string, data?: unknown): void {
    this.add('warn', source, message, data);
  }
  error(source: string, message: string, data?: unknown): void {
    this.add('error', source, message, data);
  }

  /** Snapshot of the buffered logs (oldest first). */
  getLogs(): LogEntry[] {
    return [...this.entries];
  }

  clearLogs(): void {
    this.entries = [];
    this.notify();
    this.flush();
  }

  private add(level: LogLevel, source: string, message: string, data?: unknown): void {
    const entry: LogEntry = { ts: Date.now(), level, source, message };
    if (data !== undefined) {
      entry.data = this.serialize(data);
    }
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
    this.mirror(entry, data);
    this.notify();
    this.schedulePersist();
  }

  /** Mirror to the devtools console so nothing is lost from the dev experience. */
  private mirror(entry: LogEntry, data?: unknown): void {
    const tag = `[${entry.source}] ${entry.message}`;
    let fn: (...a: any[]) => void = console.log;
    if (entry.level === 'debug') fn = console.debug;
    else if (entry.level === 'warn') fn = console.warn;
    else if (entry.level === 'error') fn = console.error;
    if (data !== undefined) fn(tag, data);
    else fn(tag);
  }

  private serialize(data: unknown): string {
    try {
      if (typeof data === 'string') return data.slice(0, MAX_DATA_CHARS);
      if (data instanceof Error) {
        return (data.stack || data.message || String(data)).slice(0, MAX_DATA_CHARS);
      }
      return JSON.stringify(data).slice(0, MAX_DATA_CHARS);
    } catch {
      return String(data).slice(0, MAX_DATA_CHARS);
    }
  }

  private hasStorage(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
  }

  private schedulePersist(): void {
    if (!this.hasStorage()) return;
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.flush();
    }, PERSIST_DEBOUNCE_MS);
  }

  private flush(): void {
    if (!this.hasStorage()) return;
    try {
      chrome.storage.local.set({ [LOG_STORAGE_KEY]: this.entries }).catch(() => undefined);
    } catch {
      // ignore persistence failures — logging must never throw.
    }
  }
}

export const logger = new GlobalLogger();
