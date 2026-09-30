/**
 * PycoreConsoleLogStore — the single UI owner of the pycore console log.
 *
 * pycore sequences every console line (ColorPrint + raw stdout/stderr) in its
 * console log journal. Live `pycore_log` events arrive over whichever
 * transport is active (direct SSE or the Laravel relay tunnel); any gap in the
 * sequence, a reconnect, or a pycore restart is repaired by cursor replay
 * through `ui/console_log/history`, which the relay contract exposes, so the
 * same repair path runs through Laravel in relay mode (pyservice mode 2).
 */
import { pycoreApi } from './PycoreApi';
import { pycoreEventBus } from './PycoreEventBus';
import { PYCORE_EVENT_TOPICS } from './PycoreEventTopics';
import { onHttpStatus } from './PycoreHttp';
import { RingStore } from '../../events/RingStore';
import type { ConsoleLogEntry, ConsoleLogHistory } from './PycoreConsoleLogTypes';

const CONSOLE_LOG_CAP = 1000;
const CONSOLE_LOG_EMIT_MS = 250;
const CONSOLE_LOG_REPLAY_DELAY_MS = 300;
const CONSOLE_LOG_REPLAY_RETRY_MS = 5000;
const CONSOLE_LOG_PAGE_LIMIT = 1000;

export type ConsoleLogNoteKey = 'replayLost' | 'serverRestarted';

export interface ConsoleLogLine {
  seq: number | null;
  message: string;
  level: string;
  color: string;
  ts: number;
  source: string;
  noteKey?: ConsoleLogNoteKey;
  noteParams?: Record<string, number | string>;
}

let instanceId = '';
let contiguousSeq = 0;
let started = false;
let replayRunning = false;
let replayQueued = false;
let replayTimer: ReturnType<typeof setTimeout> | null = null;
const ring = new RingStore<ConsoleLogLine>({ capacity: CONSOLE_LOG_CAP, emitMs: CONSOLE_LOG_EMIT_MS });

function toLine(entry: ConsoleLogEntry): ConsoleLogLine {
  return {
    seq: Number(entry.seq),
    message: typeof entry.message === 'string' ? entry.message : String(entry.message ?? ''),
    level: typeof entry.level === 'string' ? entry.level : 'INFO',
    color: typeof entry.color === 'string' ? entry.color : '',
    ts: Number(entry.ts) || Date.now(),
    source: typeof entry.source === 'string' ? entry.source : '',
  };
}

function hasSeq(seq: number): boolean {
  const lines = ring.itemsRef;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const current = lines[i].seq;
    if (current === null) continue;
    if (current === seq) return true;
    if (current < seq) return false;
  }
  return false;
}

/** Insert by sequence (already-seen sequences are dropped); notes keep their position. */
function insert(line: ConsoleLogLine): void {
  const lines = ring.itemsRef;
  const seq = line.seq as number;
  if (seq <= contiguousSeq || hasSeq(seq)) return;
  let index = lines.length;
  while (index > 0) {
    const previous = lines[index - 1].seq;
    if (previous === null || previous < seq) break;
    index -= 1;
  }
  lines.splice(index, 0, line);
}

function advanceContiguous(): void {
  let next = contiguousSeq + 1;
  while (hasSeq(next)) {
    contiguousSeq = next;
    next += 1;
  }
}

function note(noteKey: ConsoleLogNoteKey, noteParams: Record<string, number | string> = {}, level = 'WARNING'): void {
  ring.itemsRef.push({ seq: null, message: '', level, color: '', ts: Date.now(), source: 'ui', noteKey, noteParams });
  ring.commit();
}

function adoptInstance(nextInstanceId: string): boolean {
  if (!nextInstanceId || nextInstanceId === instanceId) return false;
  const restarted = instanceId !== '';
  instanceId = nextInstanceId;
  contiguousSeq = 0;
  ring.mutate((items) => items.filter((line) => line.seq === null));
  if (restarted) note('serverRestarted', {}, 'INFO');
  return true;
}

function applyHistory(page: ConsoleLogHistory, sinceSeq: number): boolean {
  if (!page || !page.instance_id) return false;
  if (page.instance_id !== instanceId) {
    adoptInstance(page.instance_id);
    return true;
  }
  if (page.replay_lost) {
    note('replayLost', { count: Math.max(0, page.earliest_seq - 1 - sinceSeq) });
    contiguousSeq = Math.max(contiguousSeq, page.earliest_seq - 1);
  }
  if (page.cursor_ahead) contiguousSeq = 0;
  (page.entries || []).forEach((entry) => insert(toLine(entry)));
  if (sinceSeq === 0) {
    contiguousSeq = Math.max(contiguousSeq, Number(page.seq) || 0);
  }
  advanceContiguous();
  ring.commit();
  return Boolean(page.has_more) || page.cursor_ahead;
}

async function runReplay(): Promise<void> {
  if (replayRunning) {
    replayQueued = true;
    return;
  }
  replayRunning = true;
  let again = true;
  while (again) {
    replayQueued = false;
    const sinceSeq = contiguousSeq;
    const page = await pycoreApi.getConsoleLogHistory(sinceSeq, CONSOLE_LOG_PAGE_LIMIT)
      .catch(() => null);
    if (!page) {
      replayRunning = false;
      scheduleReplay(CONSOLE_LOG_REPLAY_RETRY_MS);
      return;
    }
    again = applyHistory(page, sinceSeq) || replayQueued;
  }
  replayRunning = false;
}

function scheduleReplay(delayMs = CONSOLE_LOG_REPLAY_DELAY_MS): void {
  if (replayTimer) return;
  replayTimer = setTimeout(() => {
    replayTimer = null;
    void runReplay();
  }, delayMs);
}

function ingest(entry: ConsoleLogEntry): void {
  if (!entry || !Number.isFinite(Number(entry.seq))) return;
  if (adoptInstance(String(entry.instance_id || ''))) {
    scheduleReplay();
    return;
  }
  const line = toLine(entry);
  const seq = line.seq as number;
  insert(line);
  if (seq === contiguousSeq + 1) advanceContiguous();
  else if (seq > contiguousSeq + 1) scheduleReplay();
  ring.commit();
}

function start(): void {
  if (started) return;
  started = true;
  pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.pycoreLog, (data: unknown) => ingest(data as ConsoleLogEntry));
  onHttpStatus((connected) => { if (connected) scheduleReplay(); });
  scheduleReplay(0);
}

export const pycoreConsoleLogStore = {
  start,
  subscribe(listener: () => void): () => void {
    return ring.subscribe(listener);
  },
  getSnapshot(): ConsoleLogLine[] {
    return ring.getSnapshot();
  },
  /** Local line (HTTP diagnostics); never sequenced, never replayed. */
  pushLocal(message: string, level: string): void {
    ring.itemsRef.push({ seq: null, message, level, color: '', ts: Date.now(), source: 'ui' });
    ring.commit();
  },
  clear(): void {
    ring.clear();
  },
};
