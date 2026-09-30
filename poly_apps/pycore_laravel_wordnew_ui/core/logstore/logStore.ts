/** Shared in-memory log ring for application-owned log panels (never persisted). */
import { RingStore } from '../events/RingStore';

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  /** Epoch ms. */
  ts: number;
  level: LogLevel;
  /** Short origin tag, e.g. 'api', 'db-manager'. */
  source: string;
  message: string;
}

export const MAX_LOG_ENTRIES = 1000;

let nextId = 1;
const ring = new RingStore<LogEntry>({ capacity: MAX_LOG_ENTRIES });

/** Snapshot for useSyncExternalStore — stable reference between appends. */
export function getLogEntries(): LogEntry[] {
  return ring.getSnapshot();
}

export function subscribeLogs(listener: () => void): () => void {
  return ring.subscribe(listener);
}

export function appendLog(level: LogLevel, source: string, message: string): void {
  ring.append({ id: nextId++, ts: Date.now(), level, source, message });
}

export function clearLogs(): void {
  ring.clear();
}

export const logInfo = (source: string, message: string) => appendLog('info', source, message);
export const logSuccess = (source: string, message: string) => appendLog('success', source, message);
export const logWarn = (source: string, message: string) => appendLog('warn', source, message);
export const logError = (source: string, message: string) => appendLog('error', source, message);
