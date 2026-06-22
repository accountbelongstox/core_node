/**
 * Global in-memory log store for the laravel-manager end.
 *
 * Framework-free pub/sub ring buffer: BaseAPI (every HTTP operation) and
 * feature code (e.g. DB Manager backup/restore) append entries; the
 * GlobalLogPanel subscribes and renders them above every view. Capped at the
 * last MAX_LOG_ENTRIES entries — old entries are dropped, never persisted.
 *
 * NOTE: this lives in `core/logstore/` (NOT `core/logs/`) on purpose — a bare
 * `logs` rule in .gitignore was excluding `core/logs/`, so this source file went
 * untracked and was missing on fresh / Linux clones (Vite: "Failed to resolve
 * import ../../logstore/logStore"). Keep it here so git tracks it.
 */

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
let entries: LogEntry[] = [];
const listeners = new Set<() => void>();

/** Snapshot for useSyncExternalStore — stable reference between appends. */
export function getLogEntries(): LogEntry[] {
  return entries;
}

export function subscribeLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function appendLog(level: LogLevel, source: string, message: string): void {
  // Replace (not mutate) the array so React snapshot comparison sees a change.
  const next = entries.length >= MAX_LOG_ENTRIES ? entries.slice(entries.length - MAX_LOG_ENTRIES + 1) : entries.slice();
  next.push({ id: nextId++, ts: Date.now(), level, source, message });
  entries = next;
  listeners.forEach((l) => l());
}

export function clearLogs(): void {
  entries = [];
  listeners.forEach((l) => l());
}

export const logInfo = (source: string, message: string) => appendLog('info', source, message);
export const logSuccess = (source: string, message: string) => appendLog('success', source, message);
export const logWarn = (source: string, message: string) => appendLog('warn', source, message);
export const logError = (source: string, message: string) => appendLog('error', source, message);
