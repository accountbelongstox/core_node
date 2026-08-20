import { StorageManager } from '../../../core/persistence';
import { PycoreManagerUiStorageKeys } from '../persistence/PycoreManagerStorageKeys';
import type {
  TerminalScheduleDefinition,
  TerminalScheduleEntry,
} from '../../../core/integrations/pycore/PycoreApiTerminal';


interface TerminalScheduleRecord {
  entries: TerminalScheduleDefinition[];
  updated_at: number;
}

interface TerminalScheduleState {
  version: 3;
  terminals: Record<string, TerminalScheduleRecord>;
  clear_all_pending: boolean;
}

export interface TerminalScheduleClearLocalResult {
  cleared_entry_count: number;
  terminal_numbers: number[];
}

const EMPTY_STATE_VERSION = 3;

function emptyState(): TerminalScheduleState {
  return {
    version: EMPTY_STATE_VERSION,
    terminals: {},
    clear_all_pending: false,
  };
}

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

function normalizeState(value: unknown): TerminalScheduleState {
  const candidate = value as Partial<TerminalScheduleState> | null;
  const terminals: Record<string, TerminalScheduleRecord> = {};
  if (candidate?.version !== EMPTY_STATE_VERSION || !candidate.terminals) {
    return emptyState();
  }
  Object.entries(candidate.terminals).forEach(([key, record]) => {
    if (!/^\d+$/.test(key) || !record || !Array.isArray(record.entries)) return;
    terminals[key] = {
      entries: record.entries
        .map(normalizeDefinition)
        .filter((entry): entry is TerminalScheduleDefinition => entry !== null),
      updated_at: Math.max(0, Number(record.updated_at) || 0),
    };
  });
  return {
    version: EMPTY_STATE_VERSION,
    terminals,
    clear_all_pending: Boolean(candidate.clear_all_pending),
  };
}

function readState(): TerminalScheduleState {
  return normalizeState(StorageManager.get(
    PycoreManagerUiStorageKeys.PYCORE_TERMINAL_SCHEDULES,
    emptyState(),
  ));
}

function definitionsEqual(
  left: TerminalScheduleDefinition[],
  right: TerminalScheduleDefinition[],
): boolean {
  return left.length === right.length && left.every((entry, index) => {
    const candidate = right[index];
    return candidate !== undefined
      && entry.id === candidate.id
      && entry.mode === candidate.mode
      && entry.run_at === candidate.run_at
      && entry.interval_seconds === candidate.interval_seconds
      && entry.message === candidate.message;
  });
}

export function readTerminalScheduleQueue(
  terminalNumber: number,
): TerminalScheduleRecord | null {
  const state = readState();
  const record = state.terminals[String(terminalNumber)];
  return record
    ? { ...record, entries: record.entries.map((entry) => ({ ...entry })) }
    : null;
}

export function writeTerminalScheduleQueue(
  terminalNumber: number,
  entries: TerminalScheduleDefinition[],
): TerminalScheduleRecord {
  const state = readState();
  const normalizedEntries = entries
    .map(normalizeDefinition)
    .filter((entry): entry is TerminalScheduleDefinition => entry !== null);
  const current = state.terminals[String(terminalNumber)];
  if (current && definitionsEqual(current.entries, normalizedEntries)) {
    return { ...current, entries: current.entries.map((entry) => ({ ...entry })) };
  }
  const previousUpdatedAt = Number(
    current?.updated_at || 0,
  );
  const record: TerminalScheduleRecord = {
    entries: normalizedEntries,
    updated_at: Math.max(Date.now(), previousUpdatedAt + 1),
  };
  state.terminals[String(terminalNumber)] = record;
  StorageManager.set(PycoreManagerUiStorageKeys.PYCORE_TERMINAL_SCHEDULES, state);
  return { ...record, entries: record.entries.map((entry) => ({ ...entry })) };
}

export function ensureTerminalScheduleQueue(
  terminalNumber: number,
): TerminalScheduleRecord {
  return readTerminalScheduleQueue(terminalNumber)
    || writeTerminalScheduleQueue(terminalNumber, []);
}

export function stageTerminalScheduleClearAll(): TerminalScheduleClearLocalResult {
  const state = readState();
  const clearedTerminalNumbers: number[] = [];
  let clearedEntryCount = 0;
  let changed = false;
  Object.keys(state.terminals).forEach((key) => {
    const current = state.terminals[key];
    if (current.entries.length === 0) return;
    clearedEntryCount += current.entries.length;
    clearedTerminalNumbers.push(Number(key));
    state.terminals[key] = {
      entries: [],
      updated_at: Math.max(Date.now(), Number(current.updated_at || 0) + 1),
    };
    changed = true;
  });
  if (!state.clear_all_pending) {
    state.clear_all_pending = true;
    changed = true;
  }
  if (changed) {
    StorageManager.set(PycoreManagerUiStorageKeys.PYCORE_TERMINAL_SCHEDULES, state);
  }
  return {
    cleared_entry_count: clearedEntryCount,
    terminal_numbers: clearedTerminalNumbers.sort((left, right) => left - right),
  };
}

export function isTerminalScheduleClearAllPending(): boolean {
  return readState().clear_all_pending;
}

export function completeTerminalScheduleClearAll(): void {
  const state = readState();
  if (!state.clear_all_pending) return;
  state.clear_all_pending = false;
  StorageManager.set(PycoreManagerUiStorageKeys.PYCORE_TERMINAL_SCHEDULES, state);
}

export function createTerminalScheduleEntryId(): string {
  const randomValues = new Uint32Array(1);
  const randomPart = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(randomValues)[0] % 1_000_000
    : Math.floor(Math.random() * 1_000_000);
  return `${Date.now()}${String(randomPart).padStart(6, '0')}`;
}

export function mergeTerminalScheduleRuntime(
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
    run_at: definition.mode === 'once' ? definition.run_at : 0,
    next_run_at: nextRunAt,
    interval_seconds: definition.interval_seconds,
    has_message: Boolean(definition.message),
    preview: definition.message.replace(/\s+/g, ' ').trim().slice(0, 80),
    fire_count: current?.fire_count || 0,
    last_run_at: current?.last_run_at || null,
    created_at: current?.created_at,
  };
}
