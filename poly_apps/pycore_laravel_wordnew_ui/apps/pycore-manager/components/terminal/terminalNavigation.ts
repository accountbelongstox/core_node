import { useSyncExternalStore } from 'react';
import { ChangeSignal } from '../../../../core/events/ChangeSignal';
import { StorageManager } from '../../../../core/persistence';
import { PycoreManagerSessionStorageKeys } from '../../persistence/PycoreManagerStorageKeys';

const MAX_ENTRIES = 50;

interface NavState {
  entries: number[];
  index: number;
}

export interface TerminalNavSnapshot {
  current: number | null;
  canBack: boolean;
  canForward: boolean;
}

function emptyState(): NavState {
  return { entries: [], index: -1 };
}

/**
 * Visit history of the terminal operation view, like browser history: opening a terminal appends it
 * (dropping the forward part), back / forward only move the pointer. Terminals that left the node
 * are skipped. Kept per node in the session so a reload continues where the user was.
 */
export class TerminalNavHistory {
  private readonly changes = new ChangeSignal();
  private state: NavState;
  private snapshot: TerminalNavSnapshot;

  constructor(private readonly storageKey: string) {
    this.state = this.restore();
    this.snapshot = this.compute();
  }

  readonly subscribe = this.changes.subscribe;

  readonly getSnapshot = (): TerminalNavSnapshot => this.snapshot;

  visit(terminalNumber: number): void {
    const { entries, index } = this.state;
    if (entries[index] === terminalNumber) return;
    const next = [...entries.slice(0, index + 1), terminalNumber].slice(-MAX_ENTRIES);
    this.commit({ entries: next, index: next.length - 1 });
  }

  /** Previous terminal that still exists; null when there is none (the pointer stays). */
  back(exists: (terminalNumber: number) => boolean): number | null {
    return this.move(-1, exists);
  }

  forward(exists: (terminalNumber: number) => boolean): number | null {
    return this.move(1, exists);
  }

  private move(step: 1 | -1, exists: (terminalNumber: number) => boolean): number | null {
    const { entries } = this.state;
    for (let index = this.state.index + step; index >= 0 && index < entries.length; index += step) {
      if (!exists(entries[index])) continue;
      this.commit({ entries, index });
      return entries[index];
    }
    return null;
  }

  private compute(): TerminalNavSnapshot {
    const { entries, index } = this.state;
    return { current: entries[index] ?? null, canBack: index > 0, canForward: index >= 0 && index < entries.length - 1 };
  }

  private commit(next: NavState): void {
    this.state = next;
    this.snapshot = this.compute();
    StorageManager.setSession(this.storageKey, next);
    this.changes.emit();
  }

  private restore(): NavState {
    const stored = StorageManager.getSession<Partial<NavState> | null>(this.storageKey, null);
    const entries = Array.isArray(stored?.entries) ? stored.entries.filter((value): value is number => Number.isInteger(value)) : [];
    const index = Number.isInteger(stored?.index) ? Math.min(Math.max(stored?.index as number, -1), entries.length - 1) : entries.length - 1;
    return entries.length ? { entries, index } : emptyState();
  }
}

const histories = new Map<string, TerminalNavHistory>();

/** One history per node (shared by every mount of that node's view). */
export function terminalNavHistoryFor(nodeKey: string): TerminalNavHistory {
  let history = histories.get(nodeKey);
  if (!history) {
    history = new TerminalNavHistory(`${PycoreManagerSessionStorageKeys.PYCORE_TERMINAL_NAV_PREFIX}${nodeKey}`);
    histories.set(nodeKey, history);
  }
  return history;
}

export function useTerminalNavSnapshot(history: TerminalNavHistory): TerminalNavSnapshot {
  return useSyncExternalStore(history.subscribe, history.getSnapshot, history.getSnapshot);
}
