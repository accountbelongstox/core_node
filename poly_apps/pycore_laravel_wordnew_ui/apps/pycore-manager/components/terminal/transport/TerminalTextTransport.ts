/** Text transport: the terminal's exported scrollback, received in full once and as line deltas after. */
import { relayRoutePolicyTimeoutMs } from '@/core/contracts/RelayContract';
import type { TerminalTextResult } from '@/apps/pycore-manager/api';

const FETCH_TIMEOUT_MS = relayRoutePolicyTimeoutMs('terminal_read');
const DEFAULT_COLUMNS = 80;

export interface TerminalTextDoc {
  windowId: string;
  terminalNumber: number;
  revision: number;
  digest: string;
  /** Terminal width in cells, the wrap column of the layout. */
  columns: number;
  exportedAt: number;
  /** The screen changed after this text was exported. */
  stale: boolean;
  lines: string[];
}

export type FetchTerminalText = (
  windowId: string,
  terminalNumber: number,
  revision: number,
  refresh: boolean,
  timeoutMs: number,
) => Promise<TerminalTextResult>;

/** Next document from a server answer; null when the text is unavailable or the delta does not fit what is held. */
export function applyTerminalText(
  previous: TerminalTextDoc | null,
  windowId: string,
  terminalNumber: number,
  result: TerminalTextResult,
): TerminalTextDoc | null {
  if (!result.success || typeof result.revision !== 'number') return null;
  const meta = {
    windowId,
    terminalNumber,
    revision: result.revision,
    digest: result.digest ?? '',
    columns: result.columns || DEFAULT_COLUMNS,
    exportedAt: result.exported_at ?? 0,
    stale: Boolean(result.stale),
  };
  if (result.mode === 'same') {
    return previous && previous.revision === result.revision ? { ...previous, ...meta } : null;
  }
  if (result.mode === 'delta') {
    if (!previous || previous.revision !== result.base_revision) return null;
    return { ...meta, lines: previous.lines.slice(0, result.keep ?? 0).concat(result.lines ?? []) };
  }
  return { ...meta, lines: result.lines ?? [] };
}

export class TerminalTextTransport {
  constructor(private readonly fetchText: FetchTerminalText) {}

  /** Bring `previous` up to date; a delta that no longer fits is retried as a full read. */
  async load(
    previous: TerminalTextDoc | null,
    windowId: string,
    terminalNumber: number,
    refresh: boolean,
  ): Promise<TerminalTextDoc | null> {
    const result = await this.fetchText(windowId, terminalNumber, previous?.revision ?? 0, refresh, FETCH_TIMEOUT_MS);
    const next = applyTerminalText(previous, windowId, terminalNumber, result);
    if (next || !result.success || !previous) return next;
    const full = await this.fetchText(windowId, terminalNumber, 0, false, FETCH_TIMEOUT_MS);
    return applyTerminalText(null, windowId, terminalNumber, full);
  }
}
