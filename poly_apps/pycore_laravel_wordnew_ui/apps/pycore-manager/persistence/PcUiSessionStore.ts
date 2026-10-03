import { StorageManager } from '../../../core/persistence';
import { PycoreManagerSessionStorageKeys } from './PycoreManagerStorageKeys';

const SESSION_STORAGE_KEY = PycoreManagerSessionStorageKeys.PYCORE_UI_SESSION;
const SESSION_SCHEMA_VERSION = 1;
const WRITE_DEBOUNCE_MS = 300;
const MAX_NODE_SESSIONS = 16;
const MAX_TEXT_LENGTH = 512;
const PRIMARY_NODE_SESSION_KEY = 'primary';

export interface PcUiSessionTerminalIdentity {
  number: number;
  id: string;
  nativeId: string;
  processId: number;
  title: string;
  app: string;
}

export interface PcUiSessionInput {
  slot: string;
  focused: boolean;
  selectionStart: number;
  selectionEnd: number;
  scrollTop: number;
}

export interface PcUiSessionNode {
  selected: PcUiSessionTerminalIdentity | null;
  previewOpen: boolean;
  operationsExpanded: boolean | null;
  scheduleOpen: boolean;
  logDialogOpen: boolean;
  overlayScrollTop: number;
  input: PcUiSessionInput | null;
  savedAt: number;
}

export interface PcUiSessionPage {
  id: string;
  search: string;
  scrollTop: number;
}

export interface PcUiSession {
  v: typeof SESSION_SCHEMA_VERSION;
  savedAt: number;
  page: PcUiSessionPage | null;
  terminalNodeUrl: string | null;
  nodes: Record<string, PcUiSessionNode>;
}

function emptySession(): PcUiSession {
  return { v: SESSION_SCHEMA_VERSION, savedAt: 0, page: null, terminalNodeUrl: null, nodes: {} };
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function boundedText(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT_LENGTH) : '';
}

function parseIdentity(raw: unknown): PcUiSessionTerminalIdentity | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.number !== 'number' || !Number.isFinite(value.number)) return null;
  return {
    number: value.number,
    id: boundedText(value.id),
    nativeId: boundedText(value.nativeId),
    processId: finiteNumber(value.processId),
    title: boundedText(value.title),
    app: boundedText(value.app),
  };
}

function parseInput(raw: unknown): PcUiSessionInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const selectionStart = Math.max(0, finiteNumber(value.selectionStart));
  return {
    slot: boundedText(value.slot),
    focused: value.focused === true,
    selectionStart,
    selectionEnd: Math.max(selectionStart, finiteNumber(value.selectionEnd, selectionStart)),
    scrollTop: Math.max(0, finiteNumber(value.scrollTop)),
  };
}

function parseNode(raw: unknown): PcUiSessionNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  return {
    selected: parseIdentity(value.selected),
    previewOpen: value.previewOpen === true,
    operationsExpanded: typeof value.operationsExpanded === 'boolean' ? value.operationsExpanded : null,
    scheduleOpen: value.scheduleOpen === true,
    logDialogOpen: value.logDialogOpen === true,
    overlayScrollTop: Math.max(0, finiteNumber(value.overlayScrollTop)),
    input: parseInput(value.input),
    savedAt: finiteNumber(value.savedAt),
  };
}

function parseSession(raw: unknown): PcUiSession {
  if (!raw || typeof raw !== 'object') return emptySession();
  const value = raw as Record<string, unknown>;
  if (value.v !== SESSION_SCHEMA_VERSION) return emptySession();
  const session = emptySession();
  session.savedAt = finiteNumber(value.savedAt);
  const page = value.page as Record<string, unknown> | null | undefined;
  if (page && typeof page === 'object' && typeof page.id === 'string' && page.id) {
    session.page = {
      id: boundedText(page.id),
      search: boundedText(page.search),
      scrollTop: Math.max(0, finiteNumber(page.scrollTop)),
    };
  }
  session.terminalNodeUrl = typeof value.terminalNodeUrl === 'string' && value.terminalNodeUrl
    ? value.terminalNodeUrl
    : null;
  if (value.nodes && typeof value.nodes === 'object') {
    for (const [key, node] of Object.entries(value.nodes as Record<string, unknown>)) {
      const parsed = parseNode(node);
      if (parsed) session.nodes[key] = parsed;
    }
  }
  return session;
}

function readStoredSession(): PcUiSession {
  try {
    return parseSession(StorageManager.get<unknown>(SESSION_STORAGE_KEY, null));
  } catch {
    return emptySession();
  }
}

// The boot snapshot is what the previous page life left behind; it stays untouched while
// the live session (below) is rewritten by this life's operations.
const bootSession: PcUiSession = readStoredSession();
let liveSession: PcUiSession = parseSession(JSON.parse(JSON.stringify(bootSession)));
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let lifecycleInstalled = false;

export function pcUiSessionBoot(): PcUiSession {
  return bootSession;
}

export function pcUiSessionNodeKey(nodeUrl: string | null): string {
  return nodeUrl ?? PRIMARY_NODE_SESSION_KEY;
}

export function flushPcUiSession(): void {
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  liveSession.savedAt = Date.now();
  const nodeEntries = Object.entries(liveSession.nodes);
  if (nodeEntries.length > MAX_NODE_SESSIONS) {
    nodeEntries.sort((left, right) => right[1].savedAt - left[1].savedAt);
    liveSession.nodes = Object.fromEntries(nodeEntries.slice(0, MAX_NODE_SESSIONS));
  }
  StorageManager.setRaw(SESSION_STORAGE_KEY, JSON.stringify(liveSession));
}

function scheduleFlush(): void {
  installPcUiSessionLifecycle();
  if (writeTimer !== null) return;
  writeTimer = setTimeout(flushPcUiSession, WRITE_DEBOUNCE_MS);
}

export function installPcUiSessionLifecycle(): void {
  if (lifecycleInstalled || typeof window === 'undefined') return;
  lifecycleInstalled = true;
  const flushWhenHidden = () => {
    if (document.visibilityState === 'hidden') flushPcUiSession();
  };
  document.addEventListener('visibilitychange', flushWhenHidden);
  window.addEventListener('pagehide', flushPcUiSession);
  window.addEventListener('beforeunload', flushPcUiSession);
  import.meta.hot?.dispose(() => {
    if (writeTimer !== null) flushPcUiSession();
    document.removeEventListener('visibilitychange', flushWhenHidden);
    window.removeEventListener('pagehide', flushPcUiSession);
    window.removeEventListener('beforeunload', flushPcUiSession);
  });
}

export function updatePcUiSessionPage(patch: Partial<PcUiSessionPage> & { id: string }): void {
  const current = liveSession.page;
  const samePage = current !== null && current.id === patch.id;
  liveSession.page = {
    id: patch.id,
    search: patch.search ?? (samePage ? current.search : ''),
    scrollTop: patch.scrollTop ?? (samePage ? current.scrollTop : 0),
  };
  scheduleFlush();
}

export function updatePcUiSessionPageScroll(pageId: string, scrollTop: number): void {
  const current = liveSession.page;
  if (!current || current.id !== pageId) return;
  current.scrollTop = Math.max(0, Math.round(scrollTop));
  scheduleFlush();
}

export function updatePcUiSessionTerminalNodeUrl(nodeUrl: string | null): void {
  liveSession.terminalNodeUrl = nodeUrl;
  scheduleFlush();
}

export function readPcUiSessionTerminalNodeUrl(): string | null {
  return liveSession.terminalNodeUrl;
}

export function emptyPcUiSessionNode(): PcUiSessionNode {
  return {
    selected: null,
    previewOpen: false,
    operationsExpanded: null,
    scheduleOpen: false,
    logDialogOpen: false,
    overlayScrollTop: 0,
    input: null,
    savedAt: 0,
  };
}

export function updatePcUiSessionNode(nodeKey: string, patch: Partial<PcUiSessionNode>): void {
  const current = liveSession.nodes[nodeKey] ?? emptyPcUiSessionNode();
  liveSession.nodes[nodeKey] = { ...current, ...patch, savedAt: Date.now() };
  scheduleFlush();
}

export function readPcUiSessionNode(nodeKey: string): PcUiSessionNode | null {
  return liveSession.nodes[nodeKey] ?? null;
}
