import {
  requestPycoreHttp,
  requestPycoreHttpGet,
  requestPycoreHttpText,
  PYCORE_HTTP_ROUTES,
} from './PycoreApiTransport';


export interface TerminalWindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TerminalWindowPoint {
  x: number;
  y: number;
}

export interface TerminalWindowScreenshot {
  mime: string;
  content_base64: string;
  width: number;
  height: number;
  captured_at: number;
}

export interface TerminalLogEntry {
  id: string;
  terminal_number: number;
  title: string;
  date: string;
  status: 'pending' | 'sent' | 'failed';
  success: boolean;
  error_code?: string | null;
}

export type TerminalScheduleMode = 'once' | 'interval';

export interface TerminalScheduleEntry {
  id: string;
  mode: TerminalScheduleMode;
  next_run_at: number | null;
  interval_seconds: number;
  has_message: boolean;
  preview: string;
  fire_count: number;
  last_run_at: number | null;
  created_at?: string;
}

export interface TerminalWindowInfo {
  id: string;
  native_id: number | string;
  title: string;
  app: string;
  class_name: string;
  process_id: number;
  active: boolean;
  online: boolean;
  terminal_number: number;
  rect: TerminalWindowRect;
  center: TerminalWindowPoint;
  screenshot?: TerminalWindowScreenshot | null;
  preview_expanded: boolean;
  has_draft: boolean;
  log_count: number;
  logs: TerminalLogEntry[];
  schedule_queue?: TerminalScheduleEntry[];
  state_updated_at?: string;
  last_seen_at?: string;
}

export interface TerminalSnapshot {
  success: boolean;
  platform: string;
  session: string;
  supported: boolean;
  error_code?: string | null;
  count: number;
  online_count: number;
  stored_count: number;
  windows: TerminalWindowInfo[];
  refreshed_at: number;
}

export interface TerminalActionResult {
  success: boolean;
  error_code?: string | null;
  clipboard_restored?: boolean;
  window?: TerminalWindowInfo;
  log?: TerminalLogEntry | null;
  point?: TerminalWindowPoint;
  screenshot?: TerminalWindowScreenshot | null;
}

export interface TerminalDraftResult {
  success: boolean;
  error_code?: string | null;
  terminal_number?: number;
  has_draft?: boolean;
}

export interface TerminalViewResult {
  success: boolean;
  error_code?: string | null;
  terminal_number?: number;
  preview_expanded?: boolean;
}

export interface TerminalScheduleEntryResult {
  success: boolean;
  error_code?: string | null;
  terminal_number?: number;
  entry?: TerminalScheduleEntry | null;
  entry_id?: string;
}

export const pycoreApiTerminal = {
  getTerminalWindows: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalWindows, {}) as Promise<TerminalSnapshot>,
  activateTerminal: (windowId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalActivate, {
      window_id: windowId,
    }) as Promise<TerminalActionResult>,
  navigateTerminalHistory: (windowId: string, direction: 'up' | 'down') =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalCommandHistory, {
      window_id: windowId,
      direction,
    }) as Promise<TerminalActionResult>,
  scrollTerminal: (
    windowId: string,
    mode: 'page_up' | 'page_down' | 'bottom',
  ) => requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalScroll, {
    window_id: windowId,
    mode,
  }) as Promise<TerminalActionResult>,
  clickTerminal: (
    windowId: string,
    horizontalRatio: number,
    verticalRatio: number,
  ) => requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalClick, {
    window_id: windowId,
    horizontal_ratio: horizontalRatio.toFixed(8),
    vertical_ratio: verticalRatio.toFixed(8),
  }) as Promise<TerminalActionResult>,
  saveTerminalDraft: (terminalNumber: number, text: string) =>
    requestPycoreHttpText(PYCORE_HTTP_ROUTES.terminalDraft, text, {
      terminal_number: terminalNumber,
    }) as Promise<TerminalDraftResult>,
  inputTerminalText: (windowId: string, terminalNumber: number, text: string) =>
    requestPycoreHttpText(PYCORE_HTTP_ROUTES.terminalInput, text, {
      window_id: windowId,
      terminal_number: terminalNumber,
    }) as Promise<TerminalActionResult>,
  saveTerminalViewState: (terminalNumber: number, expanded: boolean) =>
    requestPycoreHttpText(
      PYCORE_HTTP_ROUTES.terminalView,
      expanded ? '1' : '0',
      { terminal_number: terminalNumber },
    ) as Promise<TerminalViewResult>,
  addTerminalScheduleEntry: (
    terminalNumber: number,
    options: {
      mode: TerminalScheduleMode;
      runAt?: number;
      intervalSeconds?: number;
      message?: string;
    },
  ) => requestPycoreHttpText(
    PYCORE_HTTP_ROUTES.terminalScheduleQueueAdd,
    options.message || '',
    {
      terminal_number: terminalNumber,
      mode: options.mode,
      run_at: options.runAt || 0,
      interval_seconds: options.intervalSeconds || 0,
    },
  ) as Promise<TerminalScheduleEntryResult>,
  removeTerminalScheduleEntry: (terminalNumber: number, entryId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalScheduleQueueRemove, {
      terminal_number: terminalNumber,
      entry_id: entryId,
    }) as Promise<TerminalScheduleEntryResult>,
  updateTerminalScheduleEntry: (
    terminalNumber: number,
    entryId: string,
    options: {
      mode: TerminalScheduleMode;
      runAt?: number;
      intervalSeconds?: number;
      message?: string;
    },
  ) => requestPycoreHttpText(
    PYCORE_HTTP_ROUTES.terminalScheduleQueueUpdate,
    options.message || '',
    {
      terminal_number: terminalNumber,
      entry_id: entryId,
      mode: options.mode,
      run_at: options.runAt || 0,
      interval_seconds: options.intervalSeconds || 0,
    },
  ) as Promise<TerminalScheduleEntryResult>,
  getTerminalContent: (
    terminalNumber: number,
    kind: 'draft' | 'log' | 'schedule',
    logId = '',
    entryId = '',
  ) => requestPycoreHttpGet(PYCORE_HTTP_ROUTES.terminalContent, {
    terminal_number: terminalNumber,
    kind,
    log_id: logId || undefined,
    entry_id: entryId || undefined,
  }) as Promise<string>,
};
