import { ref, type Ref } from 'vue';
import { localStorage } from '@/services/ExtensionStorage';
import { STORAGE_KEYS } from '@/utils/storage-keys';
import { logger, type LogEntry } from '@/utils/logger';
import { usePersistedRef } from '@/composables/usePersistedRef';

interface DebugLog {
  time: string;
  level: string;
  message: string;
}

const debugLogs = ref<DebugLog[]>([]);
let showDebugInfo: Ref<boolean> | null = null;
let unsubscribe: (() => void) | null = null;

function renderLogs(entries: LogEntry[]): void {
  debugLogs.value = entries
    .slice(-100)
    .map((entry) => ({
      time: new Date(entry.ts).toLocaleTimeString(),
      level: entry.level,
      message: `[${entry.source}] ${entry.message}${entry.data ? ` ${entry.data}` : ''}`,
    }))
    .reverse();
}

export function useDebugCenter() {
  const debugView = showDebugInfo ??= usePersistedRef('debugView', false);

  const initialize = async () => {
    await logger.init();
    const stored = await localStorage.get<LogEntry[]>(STORAGE_KEYS.GLOBAL_LOGS, []);
    renderLogs(Array.isArray(stored) ? stored : []);
    unsubscribe ??= localStorage.subscribe<LogEntry[]>(STORAGE_KEYS.GLOBAL_LOGS, (entries) => {
      if (Array.isArray(entries)) renderLogs(entries);
    });
  };

  const clearDebugLogs = () => {
    logger.clearLogs();
    debugLogs.value = [];
  };

  const dispose = () => {
    unsubscribe?.();
    unsubscribe = null;
  };

  return { debugLogs, showDebugInfo: debugView, initialize, clearDebugLogs, dispose };
}
