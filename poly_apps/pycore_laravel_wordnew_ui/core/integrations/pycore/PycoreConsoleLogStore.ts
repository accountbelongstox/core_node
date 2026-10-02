/**
 * PycoreConsoleLogStore — the single UI owner of the pycore console log.
 *
 * pycore sequences every console line (ColorPrint + raw stdout/stderr) in its
 * console log journal. Live `pycore_log` events arrive over whichever
 * transport is active (direct SSE or the Laravel relay tunnel); any gap in the
 * sequence, a reconnect, or a pycore restart is repaired by cursor replay
 * through `ui/console_log/history`, which the relay contract exposes, so the
 * same repair path runs through Laravel in relay mode (pyservice mode 2).
 * The live topic is held only while a log view is mounted.
 *
 * The display window never exceeds CONSOLE_LOG_CAP lines. While `following`,
 * it is the newest tail. loadOlder() slides it back through the journal
 * (`before_seq` pages, newest lines leave the window) and pauses live
 * insertion and replay; backToLive() re-syncs with the tail.
 */
import { pycoreApi } from './PycoreApi';
import { pycoreEventBus } from './PycoreEventBus';
import { PYCORE_EVENT_TOPICS } from './PycoreEventTopics';
import { onHttpStatus } from './PycoreEventClient';
import { RingStore } from '../../events/RingStore';
import type { ConsoleLogEntry, ConsoleLogHistory } from './PycoreConsoleLogTypes';

const CONSOLE_LOG_CAP = 1000;
const CONSOLE_LOG_EMIT_MS = 250;
const CONSOLE_LOG_REPLAY_DELAY_MS = 300;
const CONSOLE_LOG_REPLAY_RETRY_MS = 5000;
const CONSOLE_LOG_PAGE_LIMIT = 1000;
const CONSOLE_LOG_OLDER_PAGE_LIMIT = 500;

export type ConsoleLogNoteKey = 'replayLost' | 'serverRestarted';

export interface ConsoleLogViewState {
  following: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
}

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
let consumers = 0;
let offTopic: (() => void) | null = null;
let offStatus: (() => void) | null = null;
let replayRunning = false;
let replayQueued = false;
let replayTimer: ReturnType<typeof setTimeout> | null = null;
let following = true;
let olderExhausted = false;
let pausedHasOlder = false;
let loadingOlder = false;
let windowGeneration = 0;
let viewState: ConsoleLogViewState = { following: true, hasOlder: false, loadingOlder: false };
let deferredLines: ConsoleLogLine[] = [];
const viewListeners = new Set<() => void>();
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

function oldestSeq(): number {
  const lines = ring.itemsRef;
  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i].seq;
    if (current !== null) return current;
  }
  return 0;
}

function computeHasOlder(): boolean {
  if (!following) return pausedHasOlder;
  return !olderExhausted && oldestSeq() > 1;
}

function getViewState(): ConsoleLogViewState {
  const hasOlder = computeHasOlder();
  if (viewState.following !== following || viewState.hasOlder !== hasOlder || viewState.loadingOlder !== loadingOlder) {
    viewState = { following, hasOlder, loadingOlder };
  }
  return viewState;
}

function notifyView(): void {
  viewListeners.forEach((listener) => listener());
}

function appendLocalLine(line: ConsoleLogLine): void {
  if (!following) {
    deferredLines.push(line);
    return;
  }
  ring.itemsRef.push(line);
  ring.commit();
}

function resumeLive(): void {
  windowGeneration += 1;
  following = true;
  olderExhausted = false;
  pausedHasOlder = false;
  loadingOlder = false;
  contiguousSeq = 0;
  const pending = deferredLines;
  deferredLines = [];
  ring.mutate((items) => items.filter((line) => line.seq === null).concat(pending));
  notifyView();
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
  appendLocalLine({ seq: null, message: '', level, color: '', ts: Date.now(), source: 'ui', noteKey, noteParams });
}

function adoptInstance(nextInstanceId: string): boolean {
  if (!nextInstanceId || nextInstanceId === instanceId) return false;
  const restarted = instanceId !== '';
  instanceId = nextInstanceId;
  resumeLive();
  if (restarted) note('serverRestarted', {}, 'INFO');
  return true;
}

function applyHistory(page: ConsoleLogHistory, sinceSeq: number): boolean {
  if (!page || !page.instance_id) return false;
  if (!following) return false;
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
  if (!following) return;
  if (replayRunning) {
    replayQueued = true;
    return;
  }
  replayRunning = true;
  let again = true;
  while (again) {
    replayQueued = false;
    if (!following) break;
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
  if (replayTimer || !following) return;
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
  if (!following) return;
  const line = toLine(entry);
  const seq = line.seq as number;
  insert(line);
  if (seq === contiguousSeq + 1) advanceContiguous();
  else if (seq > contiguousSeq + 1) scheduleReplay();
  ring.commit();
}

function acquire(): void {
  consumers += 1;
  if (consumers > 1) return;
  offTopic = pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.pycoreLog, (data: unknown) => ingest(data as ConsoleLogEntry));
  offStatus = onHttpStatus((connected) => { if (connected) scheduleReplay(); });
  scheduleReplay(0);
}

function release(): void {
  consumers -= 1;
  if (consumers > 0) return;
  offTopic?.();
  offStatus?.();
  offTopic = null;
  offStatus = null;
  if (replayTimer) clearTimeout(replayTimer);
  replayTimer = null;
}

async function loadOlder(): Promise<void> {
  if (loadingOlder) return;
  const oldest = oldestSeq();
  if (oldest <= 1) return;
  const generation = windowGeneration;
  const requestedInstance = instanceId;
  loadingOlder = true;
  notifyView();
  const page = await pycoreApi.getConsoleLogHistory(0, CONSOLE_LOG_OLDER_PAGE_LIMIT, oldest).catch(() => null);
  if (generation !== windowGeneration) return;
  loadingOlder = false;
  if (!page || !page.instance_id) {
    notifyView();
    return;
  }
  if (page.instance_id !== requestedInstance) {
    adoptInstance(page.instance_id);
    scheduleReplay(0);
    return;
  }
  const older = (page.entries || []).map(toLine).filter((line) => (line.seq as number) < oldest);
  const hasOlder = Boolean(page.has_older);
  olderExhausted = !hasOlder;
  if (older.length === 0 && following) {
    notifyView();
    return;
  }
  following = false;
  pausedHasOlder = hasOlder;
  ring.mutate((items) => older.concat(items).slice(0, CONSOLE_LOG_CAP));
  notifyView();
}

export const pycoreConsoleLogStore = {
  /** The `pycore_log` topic is subscribed only while a listener is attached. */
  subscribe(listener: () => void): () => void {
    const off = ring.subscribe(listener);
    viewListeners.add(listener);
    acquire();
    return () => {
      off();
      viewListeners.delete(listener);
      release();
    };
  },
  getSnapshot(): ConsoleLogLine[] {
    return ring.getSnapshot();
  },
  /** Follow/older-page state of the display window (stable object between changes). */
  getViewState,
  /** Slide the window back one `before_seq` page; pauses live insertion and replay. */
  loadOlder,
  /** Re-sync the window with the newest tail and resume live insertion. */
  backToLive(): void {
    if (following) return;
    resumeLive();
    scheduleReplay(0);
  },
  /** Local line (HTTP diagnostics); never sequenced, never replayed. */
  pushLocal(message: string, level: string): void {
    appendLocalLine({ seq: null, message, level, color: '', ts: Date.now(), source: 'ui' });
  },
  clear(): void {
    deferredLines = [];
    pausedHasOlder = false;
    ring.clear();
    notifyView();
  },
};
