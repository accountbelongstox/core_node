import {
  type PycoreHttpBinaryResult,
  PYCORE_HTTP_ROUTES,
} from './PycoreApiTransport';
import { primaryPycoreHttp, type PycoreHttpApi } from './PycoreHttp';
import { relayRoutePolicyTimeoutMs } from '../../contracts/RelayContract';


const TERMINAL_DESKTOP_INTEGRATION_TIMEOUT_MS = relayRoutePolicyTimeoutMs('terminal_integration');

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

export interface TerminalScreenshotResourceMeta {
  window_id: string;
  mime: string;
  digest: string;
  etag?: string;
  width: number;
  height: number;
  byte_length: number;
  captured_at: number;
  revision: number;
  resource: { window_id: string; digest: string };
}

export interface TerminalScreenshotTextResult {
  success: boolean;
  error_code?: string | null;
  window_id?: string;
  digest?: string;
  text?: string;
  engine?: string | null;
}

/** Exported scrollback text: `full` for a new viewer, `delta` (keep N lines, then `lines`) or `same` after. */
export interface TerminalTextResult {
  success: boolean;
  error_code?: string | null;
  terminal_number?: number;
  window_id?: string;
  revision?: number;
  digest?: string;
  columns?: number;
  exported_at?: number;
  source?: 'export' | 'backup';
  line_count?: number;
  /** The screen changed after this text was exported. */
  stale?: boolean;
  mode?: 'full' | 'delta' | 'same';
  base_revision?: number;
  keep?: number;
  lines?: string[];
  refresh_skip_code?: string | null;
}

export type TerminalLogSource = 'input' | 'enter' | 'schedule' | 'quick';

export interface TerminalLogEntry {
  id: string;
  terminal_number: number;
  title: string;
  date: string;
  status: 'pending' | 'sent' | 'failed';
  source?: TerminalLogSource;
  preview?: string;
  success: boolean;
  error_code?: string | null;
}

export type TerminalSearchHitKind = 'sent' | 'draft';

/** Machine a MeshSync search hit was written on. */
export interface TerminalSearchMachine {
  machine_id: string;
  machine_name: string;
  platform: string;
}

/** A sent message or unsent draft found by the history search, with its full text. */
export interface TerminalLogSearchHit extends Omit<TerminalLogEntry, 'status'> {
  status: TerminalLogEntry['status'] | 'draft';
  kind: TerminalSearchHitKind;
  content: string;
  /** MeshSync hits only: the machine it was written on. */
  machine?: TerminalSearchMachine;
}

export interface TerminalLogSearchResult {
  success: boolean;
  query: string;
  results: TerminalLogSearchHit[];
  error_code?: string | null;
}

export type TerminalScheduleMode = 'once' | 'interval';

export type TerminalKeyAction = 'escape' | 'ctrl_c' | 'tab' | 'shift_tab';
export type TerminalPermissionModeName = 'manual' | 'auto' | 'accept_edits' | 'plan' | 'bypass' | 'yolo';
export type TerminalPermissionModeTarget = 'manual' | 'auto' | 'accept_edits' | 'plan';

/** Agent permission mode read from the footer of the last text scan; auto_supported is null until auto mode is seen or a full shift+tab cycle passed without it. */
export interface TerminalPermissionMode {
  mode: TerminalPermissionModeName;
  auto_supported: boolean | null;
  cycle: TerminalPermissionModeName[] | null;
}

export interface TerminalRemoveResult {
  success: boolean;
  error_code?: string | null;
  terminal_number?: number;
  removed_terminal_numbers?: number[];
  removed_capture_count?: number;
  removed_schedule_count?: number;
}

export interface TerminalRenameResult {
  success: boolean;
  error_code?: string | null;
  terminal_number: number;
  custom_title: string;
  os_title_applied: boolean;
  os_error_code?: string | null;
}

export type TerminalShellOs = 'windows' | 'linux';

export interface TerminalQuickCommand {
  kind: 'preset' | 'system' | 'custom';
  /** Command line for the host OS's own shells (null: the script exists for the other OS only). */
  command: string | null;
  /** Command line per shell OS: a host can show terminals of the other OS (e.g. WSL on Windows). */
  commands?: Partial<Record<TerminalShellOs, string | null>>;
  /** Stable, OS-neutral id: preset/system names are mapped from it, scripts use their name. */
  id: string;
  /** Library address (kind:id): the only value pycore accepts to run the command. */
  key: string;
}

/** Interrupt policy pycore applies before every quick command (config/terminal_quick_commands.json). */
export interface TerminalQuickCommandInterruptPolicy {
  ctrl_c_count: number;
  interval_ms: number;
  max_wait_ms: number;
}

export type TerminalQuickCommandState = 'idle' | 'running' | 'done' | 'failed';
export type TerminalQuickCommandPhase = 'interrupting' | 'waiting' | 'typing' | 'done';

/** Run state of the latest quick command of one terminal; the run itself continues in pycore. */
export interface TerminalQuickCommandRun {
  success: boolean;
  error_code?: string | null;
  state: TerminalQuickCommandState;
  terminal_number: number;
  phase?: TerminalQuickCommandPhase;
  run_id?: string;
  key?: string;
  line?: string;
  ctrl_c_sent?: number;
}

export interface TerminalQuickCommands {
  success: boolean;
  error_code?: string | null;
  platform: string;
  script_dir: string;
  interrupt: TerminalQuickCommandInterruptPolicy;
  /** Keys of the commands kept in the collapsed row. */
  pinned: string[];
  preset: TerminalQuickCommand[];
  system: TerminalQuickCommand[];
  custom: TerminalQuickCommand[];
}

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

export type TerminalControlMode =
  | 'win32'
  | 'x11'
  | 'xwayland'
  | 'gnome_bridge'
  | 'portal'
  | 'virtual'
  | 'none';

/** AI CLIs a virtual agent window can run (headless turns resumed by conversation id; no desktop needed). */
export type TerminalAgentKind = 'claudeteam' | 'codexyolo' | 'deepseek' | 'agyyolo';

export interface TerminalAgentKindInfo {
  kind: TerminalAgentKind;
  binary: string;
  /** The CLI is installed on the pycore machine. */
  available: boolean;
}

/** State of a virtual agent window; its transcript arrives as the window text. */
export interface TerminalVirtualAgent {
  kind: TerminalAgentKind;
  conversation_id: string;
  status: 'idle' | 'running';
  turn_count: number;
  created_at: string;
}

export interface TerminalAgentResult {
  success: boolean;
  error_code?: string | null;
  window_id?: string;
  kind?: TerminalAgentKind;
  removed_terminal_numbers?: number[];
}

/** AI agent recognized in the terminal by the scan text rules or the window title. */
export interface TerminalAiAgent {
  rule: string;
  source: 'text' | 'title';
}

/** AI-agent working state from the title spinner or scan text; finished_at stamps the last working -> idle transition. */
export interface TerminalAgentActivity {
  busy: boolean;
  /** Wall-clock seconds on the pycore machine; null before the first finished task. */
  finished_at: number | null;
}

export interface TerminalWindowInfo {
  id: string;
  native_id: number | string;
  title: string;
  /** Title without the prefix all titles share and leading status glyphs (pycore-computed). */
  short_title?: string;
  app: string;
  class_name: string;
  process_id: number;
  active: boolean;
  online: boolean;
  control?: TerminalControlMode;
  controllable?: boolean;
  terminal_number: number;
  rect: TerminalWindowRect;
  center: TerminalWindowPoint;
  screenshot_resource?: TerminalScreenshotResourceMeta | null;
  preview_expanded: boolean;
  /** Name given in the UI; shown instead of the window title when set. */
  custom_title?: string;
  /** OS of the shell inside the terminal (WSL tabs on a Windows host are linux). */
  shell_os?: TerminalShellOs;
  has_draft: boolean;
  log_count: number;
  logs: TerminalLogEntry[];
  schedule_queue?: TerminalScheduleEntry[];
  ai_agent?: TerminalAiAgent | null;
  /** True once a text scan of this window decided the agent state (false: title-only or not scanned yet). */
  agent_scanned?: boolean;
  agent_activity?: TerminalAgentActivity | null;
  permission_mode?: TerminalPermissionMode | null;
  /** Present on a virtual agent window (no desktop window behind it). */
  virtual?: TerminalVirtualAgent | null;
  state_updated_at?: string;
  last_seen_at?: string;
}

export interface TerminalPlatformProfile {
  platform: string;
  distro: string;
  version: string;
  codename: string;
  desktop: string;
  session: string;
  xwayland: boolean;
  supported_profile: boolean;
}

export interface TerminalCapability {
  available: boolean;
  error_code?: string | null;
  state?: string | null;
  mode?: string;
  installed_version?: number;
  bundled_version?: number;
  authorized?: boolean;
  session_active?: boolean;
}

export type TerminalCapabilityName = 'x11' | 'gnome_bridge' | 'gnome_introspect' | 'portal';

export type TerminalDesktopIntegrationAction =
  | 'status'
  | 'install_bridge'
  | 'enable_bridge'
  | 'disable_bridge'
  | 'authorize_portal'
  | 'revoke_portal';

export interface TerminalDesktopIntegrationResult {
  success: boolean;
  error_code?: string | null;
  action: TerminalDesktopIntegrationAction;
  platform_profile?: TerminalPlatformProfile;
  capabilities?: Partial<Record<TerminalCapabilityName, TerminalCapability>>;
}

export interface TerminalViewerDemandOptions {
  /** The one terminal being operated: only it is captured, once per second. */
  focusWindowId?: string;
  /** Windows captured right now (the last frame of a terminal that is opened). */
  forceWindowIds?: string[];
}

export interface TerminalViewerDemandResult {
  success?: boolean;
  error_code?: string | null;
  viewer_id?: string;
  window_ids?: string[];
  lease_seconds?: number;
  /** Current frame metadata of every leased and forced window. */
  screenshots?: Record<string, TerminalScreenshotResourceMeta>;
}

export interface TerminalSnapshot {
  success: boolean;
  platform: string;
  session: string;
  supported: boolean;
  error_code?: string | null;
  notice_code?: string | null;
  platform_profile?: TerminalPlatformProfile;
  control_modes?: TerminalControlMode[];
  capabilities?: Partial<Record<TerminalCapabilityName, TerminalCapability>>;
  count: number;
  online_count: number;
  stored_count: number;
  windows: TerminalWindowInfo[];
  /** Kinds of virtual agent windows this machine can create. */
  agent_kinds?: TerminalAgentKindInfo[];
  refreshed_at: number;
}

/** Answer of `ui/terminal/image/upload`; `display_path` is appended to the message exactly as returned. */
export interface TerminalImageUploadResult {
  success: boolean;
  error_code?: string | null;
  path?: string;
  display_path?: string;
  name?: string;
  bytes?: number;
  mime?: string;
  /** Set with `terminal_image_too_large`. */
  max_bytes?: number;
}

/** Desktop-icon launcher modes pycore can run: [1] plain claudeteam grid, [2] grid only, [4] grid + module. */
export type TerminalLauncherMode = 'device' | 'windows' | 'both';
export type TerminalLauncherAction = 'launch' | 'kill' | 'restart';

export interface TerminalLauncherResult {
  success: boolean;
  error_code?: string | null;
  mode?: TerminalLauncherMode;
  pid?: number;
  closed_terminals?: string[];
  failed_terminals?: string[];
  stopped_apps?: string[];
}

export interface TerminalImageUploadOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface TerminalActionResult {
  success: boolean;
  error_code?: string | null;
  clipboard_restored?: boolean;
  window?: TerminalWindowInfo;
  log?: TerminalLogEntry | null;
  point?: TerminalWindowPoint;
  screenshot_resource?: TerminalScreenshotResourceMeta | null;
}

/** Each shift+tab step with the changed tail lines of the export before and after it. */
export interface TerminalPermissionModeResult extends TerminalActionResult {
  mode?: TerminalPermissionModeName;
  modes?: TerminalPermissionModeName[];
  steps?: Array<{ from: TerminalPermissionModeName; to: TerminalPermissionModeName | null; changes: string[] }>;
  auto_supported?: boolean | null;
}

export interface TerminalCaptureResult extends TerminalActionResult {
  path?: string;
  name?: string;
  bytes?: number;
  line_count?: number;
  opened?: boolean;
  editor_requested?: boolean;
}

export const TERMINAL_BACKUP_PAGE_SIZE = 50;
export const TERMINAL_BACKUP_DELETE_CONFIRM = 'DEL';

export type TerminalBackupKind = 'full' | 'delta' | 'same' | '';

export interface TerminalBackupTerminal {
  number: number;
  name: string;
  /** Full text size. */
  bytes: number;
  /** Bytes this backup added to the archive (0 when the text matched the previous backup). */
  stored_bytes: number;
  kind: TerminalBackupKind;
  changed: boolean;
  error_code?: string | null;
}

export interface TerminalBackupMatch {
  number: number;
  line: number;
  snippet: string;
}

export interface TerminalBackupItem {
  id: string;
  /** Epoch milliseconds. */
  created_at: number;
  terminal_count: number;
  total_bytes: number;
  stored_bytes: number;
  terminals: TerminalBackupTerminal[];
  matches?: TerminalBackupMatch[];
}

export interface TerminalBackupListResult {
  success: boolean;
  error_code?: string | null;
  total: number;
  items: TerminalBackupItem[];
  archive?: { blob_count: number; blob_bytes: number };
}

export interface TerminalBackupReadResult {
  success: boolean;
  error_code?: string | null;
  text: string;
  /** Full reconstructed text size. */
  bytes: number;
  stored_bytes?: number;
  kind?: TerminalBackupKind;
  truncated: boolean;
}

export interface TerminalBackupOpenResult {
  success: boolean;
  error_code?: string | null;
  opened: number;
}

export interface TerminalBackupDeleteResult {
  success: boolean;
  error_code?: string | null;
  deleted: number;
}

export type TerminalSpecialState = 'prompt_waiting' | 'prompt_follow_up' | 'resume_pending';

export interface TerminalSpecialEntry {
  number: number;
  state: TerminalSpecialState | string;
  /** Wall-clock seconds on the pycore machine the countdown runs to; null when there is none. */
  due_at: number | null;
  misses?: number;
  miss_limit?: number;
  notice?: string;
}

export interface TerminalBackupState {
  success: boolean;
  error_code?: string | null;
  paused: boolean;
  running: boolean;
  interval_seconds: number;
  last_pass_at: number | null;
  /** Wall-clock seconds on the pycore machine when the state was read (client clock-skew correction). */
  server_time?: number;
  idle_seconds?: number | null;
  min_idle_seconds?: number;
  prompt_idle_seconds?: number;
  /** Terminals left in an interval pass that input paused; it resumes after min_idle_seconds of inactivity. */
  pass_paused_remaining?: number;
  special_terminals?: TerminalSpecialEntry[];
}

export interface TerminalBackupListParams {
  query?: string;
  limit?: number;
  offset?: number;
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
    json_entry_count?: number;
    remaining_entry_count?: number;
  }>;
  runtime_terminal_numbers?: number[];
  json_terminal_numbers?: number[];
  source?: string;
  source_revision?: number;
  source_updated_at?: string;
  json_entry_count?: number;
  json_clear_all_pending?: boolean;
  remaining_entry_count?: number;
}

/** Terminal routes bound to one pycore (the selected target, or a parallel node). */
export function createPycoreApiTerminal(http: PycoreHttpApi) {
  const { requestPycoreHttp, requestPycoreHttpText, requestPycoreHttpBinary, requestPycoreHttpUpload } = http;
  return {
    getTerminalWindows: (
      viewerId: string,
      visibleWindowIds: string[] = [],
    ) => requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalWindows, {
      viewer_id: viewerId,
      visible_window_ids: visibleWindowIds,
    }) as Promise<TerminalSnapshot>,
    /** Cheap lease renewal that keeps screenshot capture running for the windows this viewer shows. */
    renewTerminalViewerDemand: (
      viewerId: string,
      visibleWindowIds: string[],
      options: TerminalViewerDemandOptions = {},
    ) => requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalViewerDemand, {
      viewer_id: viewerId,
      visible_window_ids: visibleWindowIds,
      ...(options.focusWindowId ? { focus_window_id: options.focusWindowId } : {}),
      ...(options.forceWindowIds?.length ? { force_window_ids: options.forceWindowIds } : {}),
    }) as Promise<TerminalViewerDemandResult>,
    getTerminalScreenshot: (
      windowId: string,
      digest: string,
      timeoutMs?: number,
    ) => requestPycoreHttpBinary(
      PYCORE_HTTP_ROUTES.terminalScreenshot,
      { window_id: windowId, digest },
      timeoutMs,
    ) as Promise<PycoreHttpBinaryResult>,
    /** OCR text of one frame; the UI shows it instead of the image when it succeeds. */
    getTerminalScreenshotText: (
      windowId: string,
      digest: string,
      timeoutMs?: number,
    ) => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalScreenshotText,
      { window_id: windowId, digest },
      timeoutMs,
    ) as Promise<TerminalScreenshotTextResult>,
    /** Scrollback text of a terminal; `refresh` asks pycore to export it now (idle-gated server side). */
    getTerminalText: (
      windowId: string,
      terminalNumber: number,
      revision: number,
      refresh: boolean,
      timeoutMs?: number,
    ) => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalText,
      { window_id: windowId, terminal_number: terminalNumber, revision, refresh },
      timeoutMs,
    ) as Promise<TerminalTextResult>,
    /** Sent messages and drafts of every terminal of this node containing `query`, newest first (contract-limited count). */
    searchTerminalLogs: (query: string, timeoutMs?: number) =>
      requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalLogsSearch, { query }, timeoutMs) as Promise<TerminalLogSearchResult>,
    /** Sent messages and drafts of every machine replicated through MeshSync (offline ones too), via this node's Laravel server. */
    searchTerminalMesh: (query: string, timeoutMs?: number) =>
      requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalMeshSearch, { query }, timeoutMs) as Promise<TerminalLogSearchResult>,
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
    /** option is 1-based; non-empty text is pasted into the chosen row before Enter. */
    chooseTerminalOption: (windowId: string, terminalNumber: number, option: number, text: string) =>
      requestPycoreHttpText(PYCORE_HTTP_ROUTES.terminalChoose, text, {
        window_id: windowId,
        terminal_number: terminalNumber,
        option,
      }) as Promise<TerminalActionResult>,
    renameTerminal: (terminalNumber: number, title: string) => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalRename,
      { terminal_number: terminalNumber, title },
    ) as Promise<TerminalRenameResult>,
    removeTerminal: (terminalNumber: number) => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalRemove,
      { terminal_number: terminalNumber },
    ) as Promise<TerminalRemoveResult>,
    pressTerminalKey: (windowId: string, key: TerminalKeyAction) =>
      requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalKey, {
        window_id: windowId,
        key,
      }) as Promise<TerminalActionResult>,
    switchTerminalPermissionMode: (windowId: string, terminalNumber: number, mode: TerminalPermissionModeTarget) =>
      requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalPermissionMode, {
        window_id: windowId,
        terminal_number: terminalNumber,
        mode,
      }) as Promise<TerminalPermissionModeResult>,
    clickTerminal: (
      windowId: string,
      horizontalRatio: number,
      verticalRatio: number,
    ) => requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalClick, {
      window_id: windowId,
      horizontal_ratio: horizontalRatio.toFixed(8),
      vertical_ratio: verticalRatio.toFixed(8),
    }) as Promise<TerminalActionResult>,
    /** Fresh JPEG of the whole primary monitor; pycore grabs it only for this request. */
    getDesktopScreenshot: (timeoutMs?: number) => requestPycoreHttpBinary(
      PYCORE_HTTP_ROUTES.terminalDesktopScreenshot,
      { t: String(Date.now()) },
      timeoutMs,
    ) as Promise<PycoreHttpBinaryResult>,
    clickDesktop: (
      horizontalRatio: number,
      verticalRatio: number,
      button: 'left' | 'right' = 'left',
    ) => requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalDesktopClick, {
      horizontal_ratio: horizontalRatio.toFixed(8),
      vertical_ratio: verticalRatio.toFixed(8),
      button: button === 'right' ? '3' : '1',
      clicks: '1',
    }) as Promise<TerminalActionResult>,
    /** Presses the keys together (modifiers first), e.g. ['ctrl', 'c']. */
    pressDesktopKeys: (keys: string[]) => requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalDesktopKey, {
      keys: keys.join(','),
    }) as Promise<TerminalActionResult>,
    saveTerminalDraft: (terminalNumber: number, text: string) =>
      requestPycoreHttpText(PYCORE_HTTP_ROUTES.terminalDraft, text, {
        terminal_number: terminalNumber,
      }) as Promise<TerminalDraftResult>,
    captureTerminalText: (windowId: string, terminalNumber: number, openEditor: boolean) =>
      requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalCapture, {
        window_id: windowId,
        terminal_number: terminalNumber,
        open_editor: openEditor ? '1' : '0',
      }) as Promise<TerminalCaptureResult>,
    pressTerminalEnter: (windowId: string, terminalNumber: number) =>
      requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalEnter, {
        window_id: windowId,
        terminal_number: terminalNumber,
      }) as Promise<TerminalActionResult>,
    inputTerminalText: (
      windowId: string,
      terminalNumber: number,
      text: string,
      clearFirst = false,
      interruptFirst = false,
    ) => requestPycoreHttpText(PYCORE_HTTP_ROUTES.terminalInput, text, {
      window_id: windowId,
      terminal_number: terminalNumber,
      clear_first: clearFirst ? '1' : '0',
      interrupt_first: interruptFirst ? '1' : '0',
    }) as Promise<TerminalActionResult>,
    /** Types recordings through the agent's own hold-to-talk dictation, appends text and submits. */
    dictateTerminalVoice: (
      windowId: string,
      terminalNumber: number,
      recordings: string[],
      text: string,
      clearFirst = false,
      interruptFirst = false,
    ) => requestPycoreHttpText(PYCORE_HTTP_ROUTES.terminalVoice, text, {
      window_id: windowId,
      terminal_number: terminalNumber,
      recordings: recordings.join('\n'),
      clear_first: clearFirst ? '1' : '0',
      interrupt_first: interruptFirst ? '1' : '0',
    }) as Promise<TerminalActionResult>,
    listTerminalCommands: () => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalCommands,
      {},
    ) as Promise<TerminalQuickCommands>,
    /** Starts a library command: pycore presses Ctrl+C, waits for the shell prompt and types it; follow it with the status. */
    runTerminalQuickCommand: (windowId: string, terminalNumber: number, commandKey: string, platform: TerminalShellOs) =>
      requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalQuickCommandRun, {
        window_id: windowId,
        terminal_number: terminalNumber,
        command_id: commandKey,
        platform,
      }) as Promise<TerminalQuickCommandRun>,
    terminalQuickCommandStatus: (terminalNumber: number) =>
      requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalQuickCommandStatus, {
        terminal_number: terminalNumber,
      }) as Promise<TerminalQuickCommandRun>,
    uploadTerminalImage: (windowId: string, file: File, options: TerminalImageUploadOptions = {}) => {
      const form = new FormData();
      form.append('file', file, file.name);
      form.append('window_id', windowId);
      return requestPycoreHttpUpload<TerminalImageUploadResult>(
        PYCORE_HTTP_ROUTES.terminalImageUpload,
        form,
        {},
        options,
      );
    },
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
    launchTerminalLauncher: (mode: TerminalLauncherMode) => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalLauncherLaunch,
      { mode },
    ) as Promise<TerminalLauncherResult>,
    /** Reverses a launch: closes every terminal window and stops the launcher's apps (pycore keeps running). */
    killTerminalLauncher: () => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalLauncherKill,
      {},
      TERMINAL_DESKTOP_INTEGRATION_TIMEOUT_MS,
    ) as Promise<TerminalLauncherResult>,
    restartTerminalLauncher: (mode: TerminalLauncherMode) => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalLauncherRestart,
      { mode },
      TERMINAL_DESKTOP_INTEGRATION_TIMEOUT_MS,
    ) as Promise<TerminalLauncherResult>,
    createTerminalAgent: (kind: TerminalAgentKind) => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalAgentCreate,
      { kind },
    ) as Promise<TerminalAgentResult>,
    /** Stops the running turn, forgets the conversation and removes the window's stored state. */
    closeTerminalAgent: (windowId: string) => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalAgentClose,
      { window_id: windowId },
    ) as Promise<TerminalAgentResult>,
    runTerminalDesktopIntegration: (
      action: TerminalDesktopIntegrationAction,
      timeoutMs = TERMINAL_DESKTOP_INTEGRATION_TIMEOUT_MS,
    ) => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalDesktopIntegration,
      { action },
      timeoutMs,
    ) as Promise<TerminalDesktopIntegrationResult>,
    listTerminalBackups: ({
      query = '',
      limit = TERMINAL_BACKUP_PAGE_SIZE,
      offset = 0,
    }: TerminalBackupListParams = {}) => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalBackupsList,
      { query: query.trim() || undefined, limit, offset },
    ) as Promise<TerminalBackupListResult>,
    readTerminalBackup: (id: string, terminalNumber: number) => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalBackupsRead,
      { id, terminal_number: terminalNumber },
    ) as Promise<TerminalBackupReadResult>,
    openTerminalBackup: (id: string, terminalNumber?: number) => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalBackupsOpen,
      { id, terminal_number: terminalNumber },
    ) as Promise<TerminalBackupOpenResult>,
    deleteTerminalBackup: (id: string, confirm: string, terminalNumber?: number) => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalBackupsDelete,
      { id, terminal_number: terminalNumber, confirm },
    ) as Promise<TerminalBackupDeleteResult>,
    /** Reads the automatic-backup state; with `paused` it pauses/resumes it until pycore restarts. */
    terminalBackupState: (paused?: boolean) => requestPycoreHttp(
      PYCORE_HTTP_ROUTES.terminalBackupsState,
      { paused: paused === undefined ? undefined : (paused ? '1' : '0') },
    ) as Promise<TerminalBackupState>,
    getTerminalContent: (
      terminalNumber: number,
      kind: 'draft' | 'log' | 'schedule' | 'capture',
      logId = '',
      entryId = '',
    ) => requestPycoreHttp(PYCORE_HTTP_ROUTES.terminalContent, {
      terminal_number: terminalNumber,
      kind,
      log_id: logId || undefined,
      entry_id: entryId || undefined,
    }) as Promise<string>,
  };
}

export type PycoreTerminalApi = ReturnType<typeof createPycoreApiTerminal>;

export const pycoreApiTerminal = createPycoreApiTerminal(primaryPycoreHttp);
