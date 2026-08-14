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
  getTerminalContent: (
    terminalNumber: number,
    kind: 'draft' | 'log',
    logId = '',
  ) => requestPycoreHttpGet(PYCORE_HTTP_ROUTES.terminalContent, {
    terminal_number: terminalNumber,
    kind,
    log_id: logId || undefined,
  }) as Promise<string>,
};
