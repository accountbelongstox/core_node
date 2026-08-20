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
  run_at: number | null;
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

export interface TerminalScheduleDefinition {
  id: string;
  mode: TerminalScheduleMode;
  run_at: number;
  interval_seconds: number;
  message: string;
}

export interface TerminalScheduleSyncResult {
  success: boolean;
  error_code?: string | null;
  terminal_number?: number;
  entries?: TerminalScheduleEntry[];
  source?: string;
  source_revision?: number;
  runtime_entry_count?: number;
  terminal_results?: Array<Record<string, unknown>>;
}

export interface TerminalScheduleClearResult {
  success: boolean;
  error_code?: string | null;
  cleared_entry_count?: number;
  terminal_numbers?: number[];
  terminal_results?: Array<{
    terminal_number: number;
    cleared_entry_count: number;
    entry_ids: string[];
  }>;
  source?: string;
  source_revision?: number;
  source_updated_at?: string;
  json_entry_count?: number;
  json_clear_all_pending?: boolean;
  remaining_entry_count?: number;
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
  pressTerminalEnter: (windowId: string, terminalNumber: number) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalEnter, {
      window_id: windowId,
      terminal_number: terminalNumber,
    }) as Promise<TerminalActionResult>,
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
  clearTerminalScheduleEntries: () => requestPycoreHttp(
    PYCORE_HTTP_ROUTES.terminalScheduleQueueClear,
    {},
  ) as Promise<TerminalScheduleClearResult>,
  synchronizeTerminalSchedules: (
    terminalNumber = 0,
  ) => requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalScheduleQueueSync, {
    terminal_number: terminalNumber > 0 ? terminalNumber : undefined,
  }) as Promise<TerminalScheduleSyncResult>,
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
