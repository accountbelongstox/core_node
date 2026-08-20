import { StorageManager } from '../../../core/persistence';
import { PycoreStorageKeys } from '../../../core/integrations/pycore/PycoreStorageKeys';
import type {
  TerminalScheduleDefinition,
  TerminalScheduleEntry,
} from '../../../core/integrations/pycore/PycoreApiTerminal';


interface TerminalScheduleBackupRecord {
  entries: TerminalScheduleDefinition[];
  updated_at: number;
}

interface TerminalScheduleBackupState {
  version: 3;
  terminals: Record<string, TerminalScheduleBackupRecord>;
}

interface LegacyTerminalScheduleBackupEntry {
  backend_id?: unknown;
  mode?: unknown;
  run_at?: unknown;
  interval_seconds?: unknown;
  message?: unknown;
}

const LEGACY_STORAGE_KEY = 'pc.terminal.scheduleBackup.v2';
const EMPTY_STATE: TerminalScheduleBackupState = {
  version: 3,
  terminals: {},
};

function normalizeDefinition(value: unknown): TerminalScheduleDefinition | null {
  const candidate = value as Partial<TerminalScheduleDefinition> | null;
  const id = String(candidate?.id || '');
  const mode = candidate?.mode === 'once' ? 'once' : candidate?.mode === 'interval'
    ? 'interval'
    : null;
  const runAt = Number(candidate?.run_at || 0);
  const intervalSeconds = Number(candidate?.interval_seconds || 0);
  if (!/^\d+$/.test(id) || !mode) return null;
  if (mode === 'once' && (!Number.isFinite(runAt) || runAt <= 0)) return null;
  if (
    mode === 'interval'
    && (!Number.isFinite(intervalSeconds) || intervalSeconds < 1)
  ) return null;
  return {
    id,
    mode,
    run_at: mode === 'once' ? Math.floor(runAt) : 0,
    interval_seconds: mode === 'interval' ? Math.floor(intervalSeconds) : 0,
    message: String(candidate?.message || ''),
  };
}

function normalizeState(value: unknown): TerminalScheduleBackupState {
  const candidate = value as Partial<TerminalScheduleBackupState> | null;
  const terminals: Record<string, TerminalScheduleBackupRecord> = {};
  if (candidate?.version !== 3 || !candidate.terminals) return EMPTY_STATE;
  Object.entries(candidate.terminals).forEach(([key, record]) => {
    if (!/^\d+$/.test(key) || !record || !Array.isArray(record.entries)) return;
    terminals[key] = {
      entries: record.entries
        .map(normalizeDefinition)
        .filter((entry): entry is TerminalScheduleDefinition => entry !== null),
      updated_at: Number(record.updated_at || 0),
    };
  });
  return { version: 3, terminals };
}

function migrateLegacyState(): TerminalScheduleBackupState {
  const legacy = StorageManager.get<Record<string, LegacyTerminalScheduleBackupEntry[]>>(
    LEGACY_STORAGE_KEY,
    {},
  );
  const terminals: Record<string, TerminalScheduleBackupRecord> = {};
  Object.entries(legacy).forEach(([key, entries]) => {
    if (!/^\d+$/.test(key) || !Array.isArray(entries)) return;
    const normalizedEntries = entries
      .map((entry) => normalizeDefinition({
        id: String(entry.backend_id || ''),
        mode: entry.mode,
        run_at: entry.run_at,
        interval_seconds: entry.interval_seconds,
        message: entry.message,
      }))
      .filter((entry): entry is TerminalScheduleDefinition => entry !== null);
    terminals[key] = { entries: normalizedEntries, updated_at: Date.now() };
  });
  const state: TerminalScheduleBackupState = { version: 3, terminals };
  StorageManager.set(PycoreStorageKeys.TERMINAL_SCHEDULE_BACKUPS, state);
  return state;
}

function readState(): TerminalScheduleBackupState {
  if (!StorageManager.has(PycoreStorageKeys.TERMINAL_SCHEDULE_BACKUPS)) {
    return migrateLegacyState();
  }
  return normalizeState(StorageManager.get(
    PycoreStorageKeys.TERMINAL_SCHEDULE_BACKUPS,
    EMPTY_STATE,
  ));
}

export function readTerminalScheduleBackup(
  terminalNumber: number,
): TerminalScheduleBackupRecord | null {
  const state = readState();
  const record = state.terminals[String(terminalNumber)];
  return record
    ? { ...record, entries: record.entries.map((entry) => ({ ...entry })) }
    : null;
}

export function writeTerminalScheduleBackup(
  terminalNumber: number,
  entries: TerminalScheduleDefinition[],
): TerminalScheduleBackupRecord {
  const state = readState();
  const record: TerminalScheduleBackupRecord = {
    entries: entries
      .map(normalizeDefinition)
      .filter((entry): entry is TerminalScheduleDefinition => entry !== null),
    updated_at: Date.now(),
  };
  state.terminals[String(terminalNumber)] = record;
  StorageManager.set(PycoreStorageKeys.TERMINAL_SCHEDULE_BACKUPS, state);
  return { ...record, entries: record.entries.map((entry) => ({ ...entry })) };
}

export function createTerminalScheduleEntryId(): string {
  const randomValues = new Uint32Array(1);
  const randomPart = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(randomValues)[0] % 1_000_000
    : Math.floor(Math.random() * 1_000_000);
  return `${Date.now()}${String(randomPart).padStart(6, '0')}`;
}

export function terminalScheduleDefinitionMetadata(
  definition: TerminalScheduleDefinition,
  current?: TerminalScheduleEntry,
): TerminalScheduleEntry {
  const definitionChanged = !current
    || current.mode !== definition.mode
    || current.interval_seconds !== definition.interval_seconds;
  const nextRunAt = definition.mode === 'once'
    ? definition.run_at
    : definitionChanged
      ? Date.now() + definition.interval_seconds * 1000
      : current.next_run_at;
  return {
    id: definition.id,
    mode: definition.mode,
    next_run_at: nextRunAt,
    interval_seconds: definition.interval_seconds,
    has_message: Boolean(definition.message),
    preview: definition.message.replace(/\s+/g, ' ').trim().slice(0, 80),
    fire_count: current?.fire_count || 0,
    last_run_at: current?.last_run_at || null,
    created_at: current?.created_at,
  };
}
