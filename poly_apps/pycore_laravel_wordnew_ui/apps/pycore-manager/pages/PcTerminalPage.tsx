import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isHttpConnected } from '../../../core/integrations/pycore/PycoreEventClient';
import {
  AlertTriangle,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Clock3,
  CornerDownLeft,
  Crosshair,
  FileText,
  Hand,
  ImageIcon,
  Layers,
  LayoutGrid,
  Monitor,
  Eraser,
  History,
  Info,
  Loader2,
  Maximize2,
  MousePointer2,
  Pencil,
  Plus,
  RefreshCw,
  ScrollText,
  Send,
  Terminal,
  Timer,
  TimerOff,
  Trash2,
  X,
  ArrowLeft,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  completeTerminalScheduleClearAll,
  createTerminalScheduleEntryId,
  ensureTerminalScheduleQueue,
  getBrowserId,
  isTerminalScheduleClearAllPending,
  onHttpStatus,
  pycoreEventBus,
  PYCORE_EVENT_TOPICS,
  readTerminalScheduleQueue,
  removeTerminalScheduleQueues,
  setTerminalScheduleScope,
  stageTerminalScheduleClearAll,
  mergeTerminalScheduleRuntime,
  writeTerminalScheduleQueue,
} from '@/apps/pycore-manager/api';
import { PcMachineSendDock } from '@/apps/pycore-manager/components/machine-send/PcMachineSendDock';
import { PcTerminalInputBox } from '@/apps/pycore-manager/components/PcTerminalInputBox';
import {
  PcTerminalCapturePanel,
  captureRecordFromResult,
} from '@/apps/pycore-manager/components/PcTerminalCapturePanel';
import type { PcTerminalCaptureRecord } from '@/apps/pycore-manager/components/PcTerminalCapturePanel';
import { stripImagePlaceholders, usePcTerminalImages } from '@/apps/pycore-manager/components/usePcTerminalImages';
import PcTerminalDesktopIntegration from '@/apps/pycore-manager/components/PcTerminalDesktopIntegration';
import PcTerminalBackupPanel from '@/apps/pycore-manager/components/PcTerminalBackupPanel';
import PcTerminalSpecialStates from '@/apps/pycore-manager/components/PcTerminalSpecialStates';
import { PcTerminalGlobalCountdown, PcTerminalStatusMarks, PcTerminalTileCountdown } from '@/apps/pycore-manager/components/terminal/PcTerminalStatusMarks';
import { PcTerminalWatchProvider, usePcTerminalWatch } from '@/apps/pycore-manager/components/terminal/PcTerminalWatchContext';
import PcTerminalAgentDoneToasts from '@/apps/pycore-manager/components/terminal/PcTerminalAgentDoneToasts';
import PcPycoreRestartButton from '@/apps/pycore-manager/components/PcPycoreRestartButton';
import { getPycoreProbe, getPycoreTarget, pycoreNodeClient, subscribePycoreProbes } from '@/apps/pycore-manager/api';
import { usePcTerminalFrames } from '@/apps/pycore-manager/components/terminal/usePcTerminalFrames';
import type { TerminalViewMode } from '@/apps/pycore-manager/components/terminal/terminalFrames';
import { PcTerminalNavActionsProvider } from '@/apps/pycore-manager/components/terminal/PcTerminalNavContext';
import { PcTerminalNavControls } from '@/apps/pycore-manager/components/terminal/PcTerminalNavControls';
import { terminalNavHistoryFor, useTerminalNavSnapshot } from '@/apps/pycore-manager/components/terminal/terminalNavigation';
import { baseGridColumns, layoutTerminalRows } from '@/apps/pycore-manager/components/terminal/terminalGridLayout';
import { pickIdleAgentTerminal, useTerminalDispatchSetting } from '@/apps/pycore-manager/components/terminal/terminalAgentDispatch';
import { PcTerminalDispatchToggle } from '@/apps/pycore-manager/components/PcTerminalDispatchToggle';
import PcTerminalLogDialog from '@/apps/pycore-manager/components/PcTerminalLogDialog';
import { PcTerminalSubmissionHistory } from '@/apps/pycore-manager/components/PcTerminalSubmissionHistory';
import { PcTerminalQuickCommands } from '@/apps/pycore-manager/components/PcTerminalQuickCommands';
import { PcTerminalCardCommands } from '@/apps/pycore-manager/components/PcTerminalCardCommands';
import { PcTerminalChoicePicker } from '@/apps/pycore-manager/components/PcTerminalChoicePicker';
import { useIsMobile } from '@/apps/pycore-manager/hooks/useIsMobile';
import { pycoreManagerUiStateSync } from '@/apps/pycore-manager/persistence/PycoreManagerUiStateSync';
import { PcTerminalApiProvider, usePcTerminalApi, usePcTerminalNode } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import { PcTerminalNodeTabs } from '@/apps/pycore-manager/components/terminal/PcTerminalNodeTabs';
import { PcTerminalLauncherBar } from '@/apps/pycore-manager/components/terminal/PcTerminalLauncherBar';
import { PcTerminalSentSearch, type PcSentSearchHit } from '@/apps/pycore-manager/components/terminal/PcTerminalSentSearch';
import PcTerminalDesktopView from '@/apps/pycore-manager/components/terminal/PcTerminalDesktopView';
import PcTerminalFrameView from '@/apps/pycore-manager/components/terminal/PcTerminalFrameView';
import { createNodeTerminalScheduleSync, primaryTerminalScheduleSync } from '@/apps/pycore-manager/persistence/PcNodeScheduleSync';
import { PycoreManagerStorageKeys as StorageKeys } from '@/apps/pycore-manager/persistence/PycoreManagerStorageKeys';
import {
  emptyPcUiSessionNode,
  readPcUiSessionNode,
  readPcUiSessionTerminalNodeUrl,
  updatePcUiSessionNode,
  updatePcUiSessionTerminalNodeUrl,
  type PcUiSessionInput,
  type PcUiSessionNode,
  type PcUiSessionTerminalIdentity,
} from '@/apps/pycore-manager/persistence/PcUiSessionStore';
import { restoreScrollTop, trackScrollTop } from '@/apps/pycore-manager/persistence/PcUiSessionDom';
import {
  matchPcTerminalWindow,
  pcTerminalIdentityOf,
} from '@/apps/pycore-manager/persistence/PcUiSessionTerminal';
import { StorageManager } from '../../../core/persistence';
import type {
  TerminalActionResult,
  TerminalDesktopIntegrationAction,
  TerminalKeyAction,
  TerminalLogSearchHit,
  TerminalScheduleDefinition,
  TerminalScheduleEntry,
  TerminalSnapshot,
  TerminalWindowInfo,
} from '@/apps/pycore-manager/api';


const POLL_INTERVAL_MS = 2000;
const DRAFT_SAVE_DELAY_MS = 500;
/** How long a restored terminal selection keeps waiting for its window to show up in a snapshot. */
const SESSION_RESTORE_GRACE_MS = 15_000;
const INPUT_SLOT_PANEL = 'panel';
const INPUT_SLOT_OVERLAY = 'overlay';
const CANVAS_PADDING_PX = 16;
const TILE_GRID_GAP_PX = 8;
const TILE_ASPECT_RATIO = 4 / 3;
const ALL_SCHEDULES_ACTION_ID = 'terminal:schedules:all';
/** Gap kept between the sticky jump bar and a card scrolled to by number. */
const MOBILE_JUMP_GAP_PX = 8;
/** Jump-bar label: titles longer than head + tail characters show head…tail. */
const SHORT_TITLE_HEAD_CHARS = 5;
const SHORT_TITLE_TAIL_CHARS = 5;
const SHORT_TITLE_ELLIPSIS = '…';
/** Jump bar keeps at most this many rows; labels shrink through the levels below to fit. */
const JUMP_BAR_MAX_ROWS = 3;
const JUMP_BAR_GAP_PX = 6;
/** chars: null = head…tail title, 0 = icon only, n = first n characters. */
const JUMP_BAR_LEVELS: readonly { chars: number | null; minWidthPx: number }[] = [
  { chars: null, minWidthPx: 120 },
  { chars: 5, minWidthPx: 76 },
  { chars: 3, minWidthPx: 52 },
  { chars: 2, minWidthPx: 40 },
  { chars: 1, minWidthPx: 30 },
  { chars: 0, minWidthPx: 26 },
];
const TITLE_LEADING_SYMBOLS = /^[^\p{L}\p{N}]+/u;
/** Keys sent as-is from the quick-key row, in display order. */
const TERMINAL_QUICK_KEYS: readonly TerminalKeyAction[] = ['escape', 'ctrl_c', 'tab', 'shift_tab'];
/** Keyboard glyphs shown on the icon toolbar (key symbols, not language text). */
const TERMINAL_KEY_GLYPHS: Record<TerminalKeyAction, string> = {
  escape: 'Esc',
  ctrl_c: '^C',
  tab: '⇥',
  shift_tab: '⇤',
};
type TerminalScrollMode = 'page_up' | 'page_down' | 'bottom';
const SCROLL_SUCCESS_TRANSLATION_KEYS: Record<TerminalScrollMode, string> = {
  page_up: 'terminal.pageScrolledUp',
  page_down: 'terminal.pageScrolledDown',
  bottom: 'terminal.scrolledBottom',
};
const ERROR_TRANSLATION_KEYS: Record<string, string> = {
  graphical_session_unavailable: 'terminal.errors.graphicalSession',
  x11_display_unset: 'terminal.errors.x11DisplayUnset',
  x11_connect_failed: 'terminal.errors.x11Connect',
  x11_xtest_unavailable: 'terminal.errors.x11Xtest',
  x11_ewmh_unavailable: 'terminal.errors.x11Ewmh',
  gnome_bridge_not_gnome: 'terminal.errors.bridgeNotGnome',
  gnome_bridge_session_bus_unavailable: 'terminal.errors.bridgeNoBus',
  gnome_bridge_not_installed: 'terminal.errors.bridgeNotInstalled',
  gnome_bridge_outdated: 'terminal.errors.bridgeOutdated',
  gnome_bridge_disabled: 'terminal.errors.bridgeDisabled',
  gnome_bridge_user_extensions_disabled: 'terminal.errors.bridgeUserExtensionsDisabled',
  gnome_bridge_relogin_required: 'terminal.errors.bridgeRelogin',
  gnome_bridge_requires_desktop_user: 'terminal.errors.bridgeRootUser',
  gnome_bridge_source_missing: 'terminal.errors.bridgeSourceMissing',
  gnome_bridge_settings_failed: 'terminal.errors.bridgeSettings',
  gnome_bridge_not_applicable: 'terminal.errors.bridgeNotApplicable',
  gnome_introspect_denied: 'terminal.errors.introspectDenied',
  gnome_introspect_unavailable: 'terminal.errors.introspectUnavailable',
  gnome_introspect_not_needed: 'terminal.errors.introspectNotNeeded',
  portal_unavailable: 'terminal.errors.portalUnavailable',
  portal_authorization_required: 'terminal.errors.portalAuthorization',
  portal_request_denied: 'terminal.errors.portalDenied',
  portal_request_timeout: 'terminal.errors.portalTimeout',
  portal_stream_unavailable: 'terminal.errors.portalStream',
  portal_key_unmapped: 'terminal.errors.portalKey',
  portal_not_applicable: 'terminal.errors.portalNotApplicable',
  session_bus_unavailable: 'terminal.errors.sessionBus',
  dbus_timeout: 'terminal.errors.dbusTimeout',
  terminal_paste_failed: 'terminal.errors.paste',
  terminal_window_not_controllable: 'terminal.errors.notControllable',
  terminal_windows_not_controllable: 'terminal.errors.windowsNotControllable',
  desktop_integration_action_invalid: 'terminal.errors.integrationAction',
  launcher_mode_invalid: 'terminal.errors.launcherMode',
  launcher_start_failed: 'terminal.errors.launcherStart',
  launcher_kill_partial: 'terminal.errors.launcherKillPartial',
  terminal_enumeration_failed: 'terminal.errors.enumeration',
  unsupported_platform: 'terminal.errors.unsupportedPlatform',
  terminal_window_not_found: 'terminal.errors.windowNotFound',
  terminal_window_id_required: 'terminal.errors.windowRequired',
  terminal_number_required: 'terminal.errors.numberRequired',
  terminal_state_not_found: 'terminal.errors.stateNotFound',
  terminal_window_online: 'terminal.errors.windowOnline',
  terminal_text_required: 'terminal.errors.textRequired',
  terminal_text_too_long: 'terminal.errors.textTooLong',
  terminal_coordinates_unavailable: 'terminal.errors.coordinates',
  terminal_raise_failed: 'terminal.errors.raise',
  terminal_focus_failed: 'terminal.errors.focus',
  terminal_click_failed: 'terminal.errors.click',
  terminal_click_coordinates_invalid: 'terminal.errors.clickCoordinates',
  terminal_history_direction_invalid: 'terminal.errors.historyDirection',
  terminal_history_key_failed: 'terminal.errors.historyKey',
  terminal_key_invalid: 'terminal.errors.keyInvalid',
  terminal_key_failed: 'terminal.errors.key',
  terminal_permission_mode_invalid: 'terminal.errors.permissionModeInvalid',
  terminal_permission_mode_unknown: 'terminal.errors.permissionModeUnknown',
  terminal_permission_mode_unchanged: 'terminal.errors.permissionModeUnchanged',
  terminal_permission_mode_unavailable: 'terminal.errors.permissionModeUnavailable',
  terminal_prompt_waiting: 'terminal.errors.promptWaiting',
  terminal_clear_failed: 'terminal.errors.clear',
  terminal_choice_invalid: 'terminal.errors.choiceInvalid',
  terminal_scroll_mode_invalid: 'terminal.errors.scrollMode',
  terminal_scroll_failed: 'terminal.errors.scroll',
  terminal_screenshot_failed: 'terminal.errors.screenshot',
  terminal_enter_failed: 'terminal.errors.enter',
  terminal_input_failed: 'terminal.errors.input',
  terminal_window_offline: 'terminal.errors.windowOffline',
  terminal_input_desktop_unavailable: 'terminal.errors.inputDesktopUnavailable',
  terminal_target_elevated: 'terminal.errors.targetElevated',
  terminal_viewer_id_required: 'terminal.errors.viewerIdRequired',
  terminal_viewer_window_limit_exceeded: 'terminal.errors.viewerWindowLimit',
  terminal_viewer_limit_exceeded: 'terminal.errors.viewerLimit',
  terminal_schedule_mode_invalid: 'terminal.errors.scheduleMode',
  terminal_schedule_time_invalid: 'terminal.errors.scheduleTime',
  terminal_schedule_interval_invalid: 'terminal.errors.scheduleInterval',
  terminal_schedule_entry_invalid: 'terminal.errors.scheduleEntry',
  terminal_schedule_entry_not_found: 'terminal.errors.scheduleEntry',
  terminal_schedule_json_invalid: 'terminal.errors.scheduleJsonInvalid',
  terminal_schedule_json_not_cleared: 'terminal.errors.scheduleJsonNotCleared',
  terminal_schedule_runtime_not_cleared: 'terminal.errors.scheduleRuntimeNotCleared',
  terminal_select_all_failed: 'terminal.errors.selectAll',
  terminal_copy_failed: 'terminal.errors.copy',
  terminal_capture_empty: 'terminal.errors.captureEmpty',
  terminal_capture_write_failed: 'terminal.errors.captureWrite',
  clipboard_write_failed: 'terminal.errors.clipboardWrite',
  clipboard_restore_failed: 'terminal.errors.clipboardRestore',
  request_failed: 'terminal.errors.request',
};

interface ActionNotice {
  kind: 'success' | 'error';
  translationKey: string;
  translationValues?: Record<string, string | number>;
  responseJson?: string;
}

interface CanvasSize {
  width: number;
  height: number;
}

interface DesktopBounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

interface CanvasLayout {
  left: number;
  top: number;
  scale: number;
}

interface NormalizedImagePoint {
  horizontalRatio: number;
  verticalRatio: number;
}

const PREVIEW_HISTORY_KEY = 'pcTerminalPreview';

function terminalName(windowInfo: TerminalWindowInfo, fallback: string): string {
  return windowInfo.custom_title || windowInfo.short_title || windowInfo.title || windowInfo.app || fallback;
}

function terminalShortTitle(windowInfo: TerminalWindowInfo): string {
  const characters = Array.from((windowInfo.custom_title || windowInfo.short_title || windowInfo.title || windowInfo.app || '').trim());
  if (characters.length <= SHORT_TITLE_HEAD_CHARS + SHORT_TITLE_TAIL_CHARS) return characters.join('');
  return `${characters.slice(0, SHORT_TITLE_HEAD_CHARS).join('')}${SHORT_TITLE_ELLIPSIS}${characters.slice(-SHORT_TITLE_TAIL_CHARS).join('')}`;
}

function terminalHeadTitle(windowInfo: TerminalWindowInfo, chars: number): string {
  const title = (windowInfo.custom_title || windowInfo.short_title || windowInfo.title || windowInfo.app || '').trim();
  return Array.from(title.replace(TITLE_LEADING_SYMBOLS, '') || title).slice(0, chars).join('');
}

function jumpBarLevelFor(count: number, widthPx: number): (typeof JUMP_BAR_LEVELS)[number] {
  return JUMP_BAR_LEVELS.find((level) => {
    const columns = Math.max(1, Math.floor((widthPx + JUMP_BAR_GAP_PX) / (level.minWidthPx + JUMP_BAR_GAP_PX)));
    return Math.ceil(count / columns) <= JUMP_BAR_MAX_ROWS;
  }) ?? JUMP_BAR_LEVELS[JUMP_BAR_LEVELS.length - 1];
}

function terminalDraftKey(terminalNumber: number): string {
  return String(terminalNumber);
}

// Every keystroke is mirrored synchronously into localStorage so a draft survives a reload,
// a closed tab or a failed server save; the entry is dropped once the server holds the same text.
function readCachedDrafts(): Record<string, string> {
  const stored = StorageManager.get<Record<string, unknown> | null>(DRAFT_CACHE_STORAGE_KEY, null);
  if (!stored || typeof stored !== 'object') return {};
  return Object.fromEntries(
    Object.entries(stored).filter(([, text]) => typeof text === 'string' && text !== ''),
  ) as Record<string, string>;
}

function writeCachedDraft(terminalNumber: number, text: string | null): void {
  const key = terminalDraftKey(terminalNumber);
  const drafts = readCachedDrafts();
  if (text === null || text === '') {
    if (!(key in drafts)) return;
    delete drafts[key];
  } else {
    if (drafts[key] === text) return;
    drafts[key] = text;
  }
  if (Object.keys(drafts).length === 0) StorageManager.remove(DRAFT_CACHE_STORAGE_KEY);
  else StorageManager.set(DRAFT_CACHE_STORAGE_KEY, drafts);
}

function terminalRequestErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return ERROR_TRANSLATION_KEYS[message] ? message : 'request_failed';
}

type TerminalScheduleEditorMode = 'once' | 'interval';

function formatScheduleTime(value: number | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function toDatetimeLocalValue(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const DEFAULT_SCHEDULE_INTERVAL_TEXT = '60';
const SCHEDULE_EDITOR_STORAGE_KEY = StorageKeys.PYCORE_TERMINAL_SCHEDULE_EDITOR;
const DRAFT_CACHE_STORAGE_KEY = StorageKeys.PYCORE_TERMINAL_DRAFT_CACHE;

interface ScheduleEditorState {
  mode: TerminalScheduleEditorMode;
  timeText: string;
  intervalText: string;
}

// The schedule editor values (mode / time / interval) are global and shared by
// every terminal: the last selection is remembered in localStorage and each
// terminal's editor inherits it. A stale past "once" time falls back to the
// default offset so it never fires unexpectedly after a reload.
function readScheduleEditorState(): ScheduleEditorState {
  const fallback: ScheduleEditorState = {
    mode: 'interval',
    timeText: toDatetimeLocalValue(Date.now() + 5 * 60 * 1000),
    intervalText: DEFAULT_SCHEDULE_INTERVAL_TEXT,
  };
  try {
    const parsed = StorageManager.get<Partial<ScheduleEditorState> | null>(SCHEDULE_EDITOR_STORAGE_KEY, null);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const timeText = String(parsed.timeText || '');
    const storedRunAt = new Date(timeText).getTime();
    const intervalText = String(parsed.intervalText || '');
    return {
      mode: parsed.mode === 'once' ? 'once' : 'interval',
      intervalText: /^\d+$/.test(intervalText) ? intervalText : fallback.intervalText,
      timeText: timeText && Number.isFinite(storedRunAt) && storedRunAt > Date.now()
        ? timeText
        : fallback.timeText,
    };
  } catch {
    return fallback;
  }
}

let scheduleEditorBootstrap: ScheduleEditorState | null = null;

function bootstrapScheduleEditorState(): ScheduleEditorState {
  if (!scheduleEditorBootstrap) {
    scheduleEditorBootstrap = readScheduleEditorState();
  }
  return scheduleEditorBootstrap;
}

const QUICK_SCHEDULE_DELAYS: Array<{ label: string; seconds: number }> = [
  { label: '10M', seconds: 10 * 60 },
  { label: '30M', seconds: 30 * 60 },
  { label: '1H', seconds: 1 * 60 * 60 },
  { label: '2H', seconds: 2 * 60 * 60 },
  { label: '3H', seconds: 3 * 60 * 60 },
  { label: '4H', seconds: 4 * 60 * 60 },
  { label: '5H', seconds: 5 * 60 * 60 },
  { label: '6H', seconds: 6 * 60 * 60 },
  { label: '7H', seconds: 7 * 60 * 60 },
  { label: '8H', seconds: 8 * 60 * 60 },
  { label: '9H', seconds: 9 * 60 * 60 },
  { label: '10H', seconds: 10 * 60 * 60 },
];

function formatScheduleCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (part: number) => String(part).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

const NO_WINDOWS: TerminalWindowInfo[] = [];
const AGENT_NOTE_LANGUAGE = 'en';
// Dictation errors that leave nothing typed (or cleared again): the message falls back to the file path.
const VOICE_DICTATION_FALLBACK_ERRORS = new Set(['terminal_voice_dictation_unavailable', 'terminal_voice_no_transcript', 'terminal_voice_audio_invalid']);
const PREVIEW_VIEW_MODES: ReadonlyArray<{ mode: TerminalViewMode; icon: typeof Layers }> = [
  { mode: 'auto', icon: Layers },
  { mode: 'text', icon: FileText },
  { mode: 'image', icon: ImageIcon },
];
const OPERATION_HOLD_MS = 90_000;

function replaceTerminalScheduleQueue(
  snapshot: TerminalSnapshot | null,
  terminalNumber: number,
  definitions: TerminalScheduleDefinition[],
  backendEntries: TerminalScheduleEntry[] = [],
): TerminalSnapshot | null {
  if (!snapshot) return snapshot;
  const targetWindow = snapshot.windows.find(
    (windowInfo) => windowInfo.terminal_number === terminalNumber,
  );
  const backendById = new Map(backendEntries.map((entry) => [entry.id, entry]));
  const currentById = new Map(
    (targetWindow?.schedule_queue || []).map((entry) => [entry.id, entry]),
  );
  const scheduleQueue = definitions.map((definition) => (
    mergeTerminalScheduleRuntime(
      definition,
      backendById.get(definition.id) || currentById.get(definition.id),
    )
  )).sort((left, right) => (
    Number(left.next_run_at || Number.MAX_SAFE_INTEGER)
    - Number(right.next_run_at || Number.MAX_SAFE_INTEGER)
    || left.id.localeCompare(right.id)
  ));
  return {
    ...snapshot,
    windows: snapshot.windows.map((windowInfo) => {
      if (windowInfo.terminal_number !== terminalNumber) return windowInfo;
      return {
        ...windowInfo,
        schedule_queue: scheduleQueue,
      };
    }),
  };
}

function applyFrontendTerminalSchedules(snapshot: TerminalSnapshot): TerminalSnapshot {
  let nextSnapshot: TerminalSnapshot | null = snapshot;
  snapshot.windows.forEach((windowInfo) => {
    const schedule = readTerminalScheduleQueue(windowInfo.terminal_number);
    nextSnapshot = replaceTerminalScheduleQueue(
      nextSnapshot,
      windowInfo.terminal_number,
      schedule?.entries || [],
      windowInfo.schedule_queue || [],
    );
  });
  return nextSnapshot || snapshot;
}

function formatLogDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function normalizedImagePoint(
  event: React.MouseEvent<HTMLImageElement>,
  imageWidth: number,
  imageHeight: number,
): NormalizedImagePoint | null {
  const rectangle = event.currentTarget.getBoundingClientRect();
  const imageAspect = imageWidth / Math.max(1, imageHeight);
  const elementAspect = rectangle.width / Math.max(1, rectangle.height);
  const renderedWidth = elementAspect > imageAspect
    ? rectangle.height * imageAspect
    : rectangle.width;
  const renderedHeight = elementAspect > imageAspect
    ? rectangle.height
    : rectangle.width / imageAspect;
  const renderedLeft = rectangle.left + (rectangle.width - renderedWidth) / 2;
  const renderedTop = rectangle.top + (rectangle.height - renderedHeight) / 2;
  const horizontalRatio = (event.clientX - renderedLeft) / renderedWidth;
  const verticalRatio = (event.clientY - renderedTop) / renderedHeight;
  if (
    horizontalRatio < 0
    || horizontalRatio > 1
    || verticalRatio < 0
    || verticalRatio > 1
  ) {
    return null;
  }
  return { horizontalRatio, verticalRatio };
}

function calculateDesktopBounds(windows: TerminalWindowInfo[]): DesktopBounds | null {
  if (!windows.length) return null;

  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  windows.forEach((windowInfo) => {
    minX = Math.min(minX, windowInfo.rect.x);
    minY = Math.min(minY, windowInfo.rect.y);
    maxX = Math.max(maxX, windowInfo.rect.x + windowInfo.rect.width);
    maxY = Math.max(maxY, windowInfo.rect.y + windowInfo.rect.height);
  });
  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function calculateCanvasLayout(
  bounds: DesktopBounds | null,
  canvasSize: CanvasSize,
): CanvasLayout | null {
  if (!bounds || canvasSize.width <= 0 || canvasSize.height <= 0) return null;

  const availableWidth = Math.max(1, canvasSize.width - CANVAS_PADDING_PX * 2);
  const availableHeight = Math.max(1, canvasSize.height - CANVAS_PADDING_PX * 2);
  const scale = Math.min(
    availableWidth / bounds.width,
    availableHeight / bounds.height,
  );
  return {
    left: (canvasSize.width - bounds.width * scale) / 2,
    top: (canvasSize.height - bounds.height * scale) / 2,
    scale,
  };
}

// One node's terminals; re-mounted per node, so every piece of state belongs to that node.
interface PcNodeIdentity { hostname: string; lanIps: string }

function readPcNodeIdentity(nodeUrl: string | null): PcNodeIdentity {
  const probe = getPycoreProbe(nodeUrl ?? getPycoreTarget().url);
  return { hostname: probe?.hostname || '', lanIps: (probe?.lanIps || []).join(' · ') };
}

/** The shown node's system hostname and LAN IPs from its pycore probe; empty until the probe answers. */
function usePcNodeIdentity(nodeUrl: string | null): PcNodeIdentity {
  const [identity, setIdentity] = useState(() => readPcNodeIdentity(nodeUrl));
  useEffect(() => {
    const read = () => setIdentity((current) => {
      const next = readPcNodeIdentity(nodeUrl);
      return next.hostname === current.hostname && next.lanIps === current.lanIps ? current : next;
    });
    read();
    return subscribePycoreProbes(read);
  }, [nodeUrl]);
  return identity;
}

/** nodeUrl: the shown node, null is this machine; sentPick: a sent message picked in the all-machine search, applied once this node's terminals are loaded. */
const PcTerminalNodeView: React.FC<{
  nodeUrl: string | null;
  sentPick: PcSentSearchHit | null;
  onSentPickApplied: () => void;
}> = ({ nodeUrl, sentPick, onSentPickApplied }) => {
  const nodeIdentity = usePcNodeIdentity(nodeUrl);
  const { t, i18n } = useTranslation('pc');
  const terminalApi = usePcTerminalApi();
  const terminalWatch = usePcTerminalWatch();
  // Pushed terminal events come from the selected pycore only; every other piece of state is namespaced per node.
  const { isPrimary, nodeKey, http } = usePcTerminalNode();
  // Set during render so the first reads already use this node's schedule queue.
  setTerminalScheduleScope(isPrimary ? '' : nodeKey);
  const scheduleSync = useMemo(
    () => (isPrimary ? primaryTerminalScheduleSync : createNodeTerminalScheduleSync(http, terminalApi, nodeKey)),
    [http, isPrimary, nodeKey, terminalApi],
  );
  useEffect(() => () => setTerminalScheduleScope(''), []);
  const isMobile = useIsMobile();
  const dispatchSetting = useTerminalDispatchSetting();
  const dispatchActive = !isMobile && dispatchSetting.enabled;
  const terminalWatchRef = useRef(terminalWatch);
  terminalWatchRef.current = terminalWatch;
  const dispatchedAtRef = useRef<Map<number, number>>(new Map());
  const [snapshot, setSnapshot] = useState<TerminalSnapshot | null>(null);
  const [selectedTerminalNumber, setSelectedTerminalNumber] = useState<number | null>(null);
  const [jumpTitleVisible, setJumpTitleVisible] = useState(false);
  const [renameText, setRenameText] = useState<string | null>(null);
  const [sendOnce, setSendOnce] = useState<{ clear: boolean; force: boolean }>({ clear: false, force: false });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [previewTerminalNumber, setPreviewTerminalNumber] = useState<number | null>(null);
  const [previewExpandedStates, setPreviewExpandedStates] = useState<Record<string, boolean>>({});
  const [previewDirectClick, setPreviewDirectClick] = useState(false);
  const [previewViewMode, setPreviewViewMode] = useState<TerminalViewMode>('auto');
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftStatuses, setDraftStatuses] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [loading, setLoading] = useState(true);
  const [actionWindowId, setActionWindowId] = useState('');
  // Leaving a terminal always works: a send that never answers stops locking the main view.
  const closePreview = useCallback(() => {
    setPreviewTerminalNumber(null);
    setActionWindowId('');
  }, []);
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);
  const [removingTerminals, setRemovingTerminals] = useState(false);
  const mobileListRef = useRef<HTMLDivElement | null>(null);
  const mobileJumpBarRef = useRef<HTMLDivElement | null>(null);
  const jumpGridObserverRef = useRef<ResizeObserver | null>(null);
  const [jumpGridWidth, setJumpGridWidth] = useState(0);
  const jumpGridRef = useCallback((node: HTMLDivElement | null) => {
    jumpGridObserverRef.current?.disconnect();
    jumpGridObserverRef.current = null;
    if (!node) return;
    const observer = new ResizeObserver(() => setJumpGridWidth(node.clientWidth));
    observer.observe(node);
    jumpGridObserverRef.current = observer;
    setJumpGridWidth(node.clientWidth);
  }, []);
  const [captureRecords, setCaptureRecords] = useState<Record<number, PcTerminalCaptureRecord>>({});
  const [integrationAction, setIntegrationAction] = useState<TerminalDesktopIntegrationAction | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [commonView, setCommonView] = useState<'windows' | 'desktop'>('windows');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [scheduleMode, setScheduleMode] = useState<TerminalScheduleEditorMode>(
    () => bootstrapScheduleEditorState().mode,
  );
  const [scheduleTimeText, setScheduleTimeText] = useState(
    () => bootstrapScheduleEditorState().timeText,
  );
  const [scheduleIntervalText, setScheduleIntervalText] = useState(
    () => bootstrapScheduleEditorState().intervalText,
  );
  const [editingSchedule, setEditingSchedule] = useState<{
    terminalNumber: number;
    entryId: string;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const refreshInFlightRef = useRef(false);
  const draftsRef = useRef<Record<string, string>>({});
  const dirtyDraftsRef = useRef<Set<number>>(new Set());
  const draftTimersRef = useRef<Record<string, number>>({});
  const loadedDraftsRef = useRef<Set<number>>(new Set());
  const scheduleSyncInFlightRef = useRef<Map<
    number,
    ReturnType<typeof pycoreManagerUiStateSync.synchronizeTerminalSchedules>
  >>(new Map());
  const scheduleClearAllInProgressRef = useRef(false);
  const viewerIdRef = useRef('');
  const { nodeKey: sessionNodeKey } = usePcTerminalNode();
  const [savedSession] = useState<PcUiSessionNode | null>(() => readPcUiSessionNode(sessionNodeKey));
  const pendingSessionRef = useRef<PcUiSessionNode | null>(savedSession);
  const sessionRestoreDeadlineRef = useRef(Date.now() + SESSION_RESTORE_GRACE_MS);
  const overlayScrollRestoreRef = useRef(0);
  const overlayScrollCleanupRef = useRef<(() => void) | null>(null);
  const [inputRestore, setInputRestore] = useState<PcUiSessionInput | null>(null);

  // Desktop layouts operate the explicitly selected terminal from the side panel; the hold ends after
  // a quiet period so the other tiles resume. A preview dialog is operating by itself.
  const [operatedTerminalNumber, setOperatedTerminalNumber] = useState<number | null>(null);
  const operationTimerRef = useRef<number | null>(null);
  const touchOperation = useCallback((terminalNumber: number) => {
    setOperatedTerminalNumber(terminalNumber);
    if (operationTimerRef.current !== null) window.clearTimeout(operationTimerRef.current);
    operationTimerRef.current = window.setTimeout(() => {
      operationTimerRef.current = null;
      setOperatedTerminalNumber(null);
    }, OPERATION_HOLD_MS);
  }, []);
  useEffect(() => () => {
    if (operationTimerRef.current !== null) window.clearTimeout(operationTimerRef.current);
  }, []);
  const focusWindowId = useMemo(() => {
    const number = previewTerminalNumber ?? (isMobile ? null : operatedTerminalNumber);
    if (number === null) return null;
    return snapshot?.windows.find((windowInfo) => windowInfo.terminal_number === number)?.id ?? null;
  }, [isMobile, operatedTerminalNumber, previewTerminalNumber, snapshot]);
  // Text and picture are redundant: text by default, the picture where text is missing or outdated.
  // The previewed window follows its chosen mode, and click-through needs its picture.
  const previewWindowId = previewTerminalNumber !== null
    ? snapshot?.windows.find((windowInfo) => windowInfo.terminal_number === previewTerminalNumber)?.id ?? null
    : null;
  const forcedView = useMemo(
    () => ({ windowId: previewWindowId, mode: previewDirectClick ? 'image' as const : previewViewMode }),
    [previewDirectClick, previewViewMode, previewWindowId],
  );
  const frames = usePcTerminalFrames({ windows: snapshot?.windows ?? NO_WINDOWS, focusWindowId, forcedView });
  const screenshotImageFor = frames.imageFor;
  const terminalViewFor = frames.viewFor;
  const screenshotVersion = frames.version;

  // Latest snapshot without widening the refresh callback identity: the
  // polling interval must not be torn down on every snapshot update.
  const snapshotRef = useRef<TerminalSnapshot | null>(null);
  snapshotRef.current = snapshot;

  const errorTranslationKey = useCallback((errorCode?: string | null) => (
    ERROR_TRANSLATION_KEYS[String(errorCode || '')] || 'terminal.errors.unknown'
  ), []);

  const persistDraft = useCallback(async (terminalNumber: number, text: string) => {
    const key = terminalDraftKey(terminalNumber);
    setDraftStatuses((current) => ({ ...current, [key]: 'saving' }));
    try {
      const result = await terminalApi.saveTerminalDraft(terminalNumber, text);
      if (!result.success) throw new Error(String(result.error_code || 'request_failed'));
      if (draftsRef.current[key] === text) {
        dirtyDraftsRef.current.delete(terminalNumber);
        writeCachedDraft(terminalNumber, null);
        if (mountedRef.current) {
          setDraftStatuses((current) => ({ ...current, [key]: 'saved' }));
        }
      }
    } catch {
      if (mountedRef.current) {
        setDraftStatuses((current) => ({ ...current, [key]: 'error' }));
      }
    }
  }, []);

  const scheduleDraftSave = useCallback((terminalNumber: number, text: string) => {
    const key = terminalDraftKey(terminalNumber);
    const activeTimer = draftTimersRef.current[key];
    if (activeTimer) window.clearTimeout(activeTimer);
    dirtyDraftsRef.current.add(terminalNumber);
    touchOperation(terminalNumber);
    setDraftStatuses((current) => ({ ...current, [key]: 'saving' }));
    draftTimersRef.current[key] = window.setTimeout(() => {
      delete draftTimersRef.current[key];
      void persistDraft(terminalNumber, text);
    }, DRAFT_SAVE_DELAY_MS);
  }, [persistDraft, touchOperation]);

  const flushDraft = useCallback((terminalNumber: number) => {
    const key = terminalDraftKey(terminalNumber);
    const activeTimer = draftTimersRef.current[key];
    if (!dirtyDraftsRef.current.has(terminalNumber)) return;
    if (activeTimer) {
      window.clearTimeout(activeTimer);
      delete draftTimersRef.current[key];
    }
    void persistDraft(terminalNumber, draftsRef.current[key] || '');
  }, [persistDraft]);

  const syncTerminalScheduleQueue = useCallback(async (
    terminalNumber: number,
  ) => {
    const schedule = readTerminalScheduleQueue(terminalNumber);
    if (
      !schedule
      || scheduleClearAllInProgressRef.current
      || scheduleSyncInFlightRef.current.has(terminalNumber)
    ) return null;
    const request = scheduleSync.synchronizeTerminalSchedules(
      terminalNumber,
    );
    scheduleSyncInFlightRef.current.set(terminalNumber, request);
    try {
      const result = await request;
      const currentSchedule = readTerminalScheduleQueue(terminalNumber);
      if (
        result.success
        && currentSchedule?.updated_at === schedule.updated_at
        && mountedRef.current
      ) {
        setSnapshot((current) => replaceTerminalScheduleQueue(
          current,
          terminalNumber,
          currentSchedule.entries,
          result.entries || [],
        ));
      }
      return result;
    } finally {
      if (scheduleSyncInFlightRef.current.get(terminalNumber) === request) {
        scheduleSyncInFlightRef.current.delete(terminalNumber);
      }
    }
  }, []);

  const reconcileTerminalSchedules = useCallback(async (
    windows: TerminalWindowInfo[],
  ) => {
    if (isTerminalScheduleClearAllPending()) {
      windows.forEach((windowInfo) => {
        ensureTerminalScheduleQueue(windowInfo.terminal_number);
      });
      const clearResult = await scheduleSync.clearTerminalSchedules()
        .catch(() => null);
      if (clearResult?.success) {
        completeTerminalScheduleClearAll();
        void scheduleSync.pushTerminalScheduleJson()
          .catch(() => undefined);
      }
    }
    windows.forEach((windowInfo) => {
      const terminalNumber = windowInfo.terminal_number;
      const schedule = ensureTerminalScheduleQueue(terminalNumber);
      const activeEntries = schedule.entries.filter(
        (entry) => entry.mode === 'interval' || entry.run_at > Date.now(),
      );
      if (activeEntries.length !== schedule.entries.length) {
        writeTerminalScheduleQueue(terminalNumber, activeEntries);
      }
    });
  }, []);

  const commitSnapshot = useCallback(async (nextSnapshot: TerminalSnapshot) => {
    frames.offerSnapshot(nextSnapshot.windows);
    await reconcileTerminalSchedules(nextSnapshot.windows);
    if (!mountedRef.current) return;
    setSnapshot(applyFrontendTerminalSchedules(nextSnapshot));
    // The terminal the user last operated wins over the default selection; the match is retried
    // for a grace period because a restarted terminal host reports its windows gradually.
    let restoredNumber: number | null = null;
    const pendingSession = pendingSessionRef.current;
    if (pendingSession) {
      const matched = matchPcTerminalWindow(nextSnapshot.windows, pendingSession.selected);
      if (matched) {
        pendingSessionRef.current = null;
        restoredNumber = matched.terminal_number;
        const matchedKey = terminalDraftKey(matched.terminal_number);
        setPreviewTerminalNumber(pendingSession.previewOpen ? matched.terminal_number : null);
        if (pendingSession.operationsExpanded !== null) {
          setPreviewExpandedStates((current) => ({ ...current, [matchedKey]: pendingSession.operationsExpanded as boolean }));
        }
        setScheduleOpen(pendingSession.scheduleOpen);
        setLogDialogOpen(pendingSession.logDialogOpen);
        overlayScrollRestoreRef.current = pendingSession.previewOpen ? pendingSession.overlayScrollTop : 0;
        setInputRestore(pendingSession.input);
      } else if (!pendingSession.selected || Date.now() > sessionRestoreDeadlineRef.current) {
        pendingSessionRef.current = null;
      }
    }
    setSelectedTerminalNumber((current) => (
      restoredNumber !== null
        ? restoredNumber
        : nextSnapshot.windows.some(
          (windowInfo) => windowInfo.terminal_number === current,
        )
          ? current
          : nextSnapshot.windows[0]?.terminal_number || null
    ));
  }, [reconcileTerminalSchedules, frames.offerSnapshot]);

  // A pushed snapshot omits the per-window log lists; they are carried over
  // from the last full snapshot. Returns false, without
  // applying anything, when the push cannot stand alone (no base snapshot, a
  // new window, or a changed log count), so the caller fetches a full snapshot.
  const commitPushedSnapshot = useCallback((pushed: TerminalSnapshot): boolean => {
    const base = snapshotRef.current;
    if (!base) return false;
    const knownByNumber = new Map(
      base.windows.map((windowInfo) => [windowInfo.terminal_number, windowInfo]),
    );
    const windows: TerminalWindowInfo[] = [];
    for (const windowInfo of pushed.windows) {
      const known = knownByNumber.get(windowInfo.terminal_number);
      if (!known || known.log_count !== windowInfo.log_count) return false;
      windows.push({
        ...windowInfo,
        logs: known.logs,
        schedule_queue: windowInfo.schedule_queue || known.schedule_queue || [],
      });
    }
    void commitSnapshot({ ...pushed, windows });
    return true;
  }, [commitSnapshot]);
  const commitPushedSnapshotRef = useRef(commitPushedSnapshot);
  commitPushedSnapshotRef.current = commitPushedSnapshot;

  const refresh = useCallback(async (showLoading = false) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      if (!viewerIdRef.current) viewerIdRef.current = getBrowserId();
      const demandedWindowIds = frames.demandIdsRef.current;
      const nextSnapshot = await terminalApi.getTerminalWindows(
        viewerIdRef.current,
        demandedWindowIds,
      );
      if (!mountedRef.current) return;
      await commitSnapshot(nextSnapshot);
    } catch (error) {
      if (!mountedRef.current) return;
      const errorCode = terminalRequestErrorCode(error);
      setSnapshot((current) => current ? {
        ...current,
        success: false,
        error_code: errorCode,
      } : {
        success: false,
        platform: '',
        session: '',
        supported: false,
        error_code: errorCode,
        count: 0,
        online_count: 0,
        stored_count: 0,
        windows: [],
        refreshed_at: Date.now(),
      });
    } finally {
      refreshInFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, [commitSnapshot]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh(true);
    // Other nodes have no event stream here: they are polled.
    const unsubscribe = isPrimary
      ? pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.terminalChanged, (payload: { snapshot?: TerminalSnapshot | null } | null) => {
        const pushed = payload?.snapshot;
        if (pushed && Array.isArray(pushed.windows)
          && commitPushedSnapshotRef.current(pushed)) return;
        void refresh(false);
      })
      : () => undefined;
    const pollTimer = window.setInterval(() => {
      if (!isPrimary || !isHttpConnected()) void refresh(false);
    }, POLL_INTERVAL_MS);
    return () => {
      Object.values(draftTimersRef.current).forEach((timer) => {
        window.clearTimeout(timer as number);
      });
      dirtyDraftsRef.current.forEach((terminalNumber) => {
        const key = terminalDraftKey(terminalNumber);
        void terminalApi.saveTerminalDraft(terminalNumber, draftsRef.current[key] || '');
      });
      mountedRef.current = false;
      unsubscribe();
      window.clearInterval(pollTimer);
    };
  }, [refresh]);

  useEffect(() => onHttpStatus((connected) => {
    if (connected) void refresh(false);
  }), [refresh]);

  useEffect(() => {
    if (previewTerminalNumber === null || logDialogOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePreview();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closePreview, logDialogOpen, previewTerminalNumber]);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const updateCanvasSize = () => {
      const nextSize = {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      };
      setCanvasSize((current) => (
        current.width === nextSize.width && current.height === nextSize.height
          ? current
          : nextSize
      ));
    };
    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(canvas);
    updateCanvasSize();
    return () => resizeObserver.disconnect();
  }, [commonView, isMobile]);

  const selectedWindow = useMemo(() => (
    snapshot?.windows.find(
      (windowInfo) => windowInfo.terminal_number === selectedTerminalNumber,
    ) || null
  ), [selectedTerminalNumber, snapshot]);
  const selectedActionable = Boolean(
    selectedWindow?.online
    && selectedWindow.controllable !== false
    && snapshot?.supported
    && !actionWindowId,
  );
  const previewWindow = useMemo(() => (
    snapshot?.windows.find(
      (windowInfo) => windowInfo.terminal_number === previewTerminalNumber,
    ) || null
  ), [previewTerminalNumber, snapshot]);
  // Reads the image cache during render; screenshotVersion re-renders the
  // page when fetched resources change, so this stays fresh without effects.
  const previewScreenshot = screenshotVersion >= 0
    ? terminalViewFor(previewWindow)
    : null;
  const previewNextRunAt = (previewWindow?.schedule_queue || []).reduce<number | null>(
    (earliest, entry) => (
      entry.next_run_at && (earliest === null || entry.next_run_at < earliest)
        ? entry.next_run_at
        : earliest
    ),
    null,
  );
  const previewExpandedKey = previewWindow
    ? terminalDraftKey(previewWindow.terminal_number)
    : '';
  // Operations are open by default; a toggle in this session overrides it per terminal.
  const previewExpanded = previewWindow
    ? previewExpandedStates[previewExpandedKey] ?? true
    : false;
  const selectedDraftKey = selectedWindow
    ? terminalDraftKey(selectedWindow.terminal_number)
    : '';
  const selectedDraft = selectedDraftKey ? drafts[selectedDraftKey] || '' : '';
  const images = usePcTerminalImages(selectedWindow?.id);
  const selectedDraftStatus = selectedDraftKey
    ? draftStatuses[selectedDraftKey]
    : undefined;
  // A poll replaces the window objects every time, so the effect keys on the identity's value.
  const selectedIdentityJson = selectedWindow ? JSON.stringify(pcTerminalIdentityOf(selectedWindow)) : '';
  const previewOpen = previewTerminalNumber !== null;
  const previewExpandedSaved = previewWindow ? previewExpanded : null;
  // The saved node state is only rewritten once the restore has had its chance, so a reload that
  // starts with an empty snapshot cannot erase the terminal it is about to return to.
  useEffect(() => {
    if (pendingSessionRef.current || !selectedIdentityJson) return;
    const selected = JSON.parse(selectedIdentityJson) as PcUiSessionTerminalIdentity;
    const stored = readPcUiSessionNode(sessionNodeKey) ?? emptyPcUiSessionNode();
    const sameTerminal = stored.selected?.number === selected.number && stored.selected?.id === selected.id;
    updatePcUiSessionNode(sessionNodeKey, {
      selected,
      previewOpen,
      operationsExpanded: previewExpandedSaved,
      scheduleOpen,
      logDialogOpen,
      ...(sameTerminal ? {} : { input: null }),
      ...(previewOpen && sameTerminal ? {} : { overlayScrollTop: 0 }),
    });
  }, [logDialogOpen, previewExpandedSaved, previewOpen, scheduleOpen, selectedIdentityJson, sessionNodeKey]);
  const handleInputSnapshot = useCallback((input: PcUiSessionInput) => {
    updatePcUiSessionNode(sessionNodeKey, { input });
  }, [sessionNodeKey]);
  const handleInputRestored = useCallback(() => setInputRestore(null), []);
  const overlayPanelRef = useCallback((element: HTMLDivElement | null) => {
    overlayScrollCleanupRef.current?.();
    overlayScrollCleanupRef.current = null;
    if (!element) return;
    const stopTracking = trackScrollTop(element, (scrollTop) => {
      updatePcUiSessionNode(sessionNodeKey, { overlayScrollTop: Math.round(scrollTop) });
    });
    const restoreTop = overlayScrollRestoreRef.current;
    overlayScrollRestoreRef.current = 0;
    const stopRestoring = restoreScrollTop(element, restoreTop);
    overlayScrollCleanupRef.current = () => {
      stopTracking();
      stopRestoring();
    };
  }, [sessionNodeKey]);
  useEffect(() => () => overlayScrollCleanupRef.current?.(), []);
  const selectedScheduleQueue: TerminalScheduleEntry[] = selectedWindow?.schedule_queue || [];
  const nextQueueRunAt = selectedScheduleQueue.reduce<number | null>(
    (earliest, entry) => (
      entry.next_run_at && (earliest === null || entry.next_run_at < earliest)
        ? entry.next_run_at
        : earliest
    ),
    null,
  );
  const onlineWindows = useMemo(
    () => (snapshot?.windows || []).filter((windowInfo) => windowInfo.online),
    [snapshot?.windows],
  );
  const offlineWindows = useMemo(
    () => (snapshot?.windows || []).filter((windowInfo) => !windowInfo.online),
    [snapshot?.windows],
  );
  const terminalNames = useMemo(
    () => Object.fromEntries((snapshot?.windows || []).map((windowInfo) => [
      windowInfo.terminal_number,
      terminalName(windowInfo, ''),
    ])) as Record<number, string>,
    [snapshot?.windows],
  );
  const gridInnerWidth = Math.max(1, canvasSize.width - CANVAS_PADDING_PX * 2);
  const gridBaseColumns = baseGridColumns(gridInnerWidth);
  const tileRows = useMemo(
    () => layoutTerminalRows(onlineWindows, gridBaseColumns),
    [gridBaseColumns, onlineWindows],
  );

  useEffect(() => {
    if (!selectedWindow) return;
    const terminalNumber = selectedWindow.terminal_number;
    const key = terminalDraftKey(terminalNumber);
    if (loadedDraftsRef.current.has(terminalNumber)) return;
    loadedDraftsRef.current.add(terminalNumber);
    const cachedDraft = readCachedDrafts()[key];
    if (cachedDraft !== undefined && !dirtyDraftsRef.current.has(terminalNumber)) {
      draftsRef.current = { ...draftsRef.current, [key]: cachedDraft };
      setDrafts(draftsRef.current);
      scheduleDraftSave(terminalNumber, cachedDraft);
      return;
    }
    if (!selectedWindow.has_draft) {
      draftsRef.current = { ...draftsRef.current, [key]: '' };
      setDrafts(draftsRef.current);
      setDraftStatuses((current) => ({ ...current, [key]: 'saved' }));
      return;
    }
    setDraftStatuses((current) => ({ ...current, [key]: 'saving' }));
    void terminalApi.getTerminalContent(terminalNumber, 'draft')
      .then((content) => {
        if (!mountedRef.current || dirtyDraftsRef.current.has(terminalNumber)) return;
        draftsRef.current = { ...draftsRef.current, [key]: content };
        setDrafts(draftsRef.current);
        setDraftStatuses((current) => ({ ...current, [key]: 'saved' }));
      })
      .catch(() => {
        loadedDraftsRef.current.delete(terminalNumber);
        if (mountedRef.current) {
          setDraftStatuses((current) => ({ ...current, [key]: 'error' }));
        }
      });
  }, [scheduleDraftSave, selectedWindow]);

  // The schedule editor (mode / time / interval) is global and shared by every
  // terminal; persist the last selection so all terminals inherit it.
  useEffect(() => {
    StorageManager.set(SCHEDULE_EDITOR_STORAGE_KEY, {
      mode: scheduleMode,
      timeText: scheduleTimeText,
      intervalText: scheduleIntervalText,
    });
  }, [scheduleIntervalText, scheduleMode, scheduleTimeText]);

  // Editing targets one terminal's queued entry; leave edit mode when the
  // selected terminal changes.
  useEffect(() => {
    if (
      editingSchedule
      && selectedWindow
      && editingSchedule.terminalNumber !== selectedWindow.terminal_number
    ) {
      setEditingSchedule(null);
    }
  }, [editingSchedule, selectedWindow]);

  const runAction = useCallback(async (
    windowId: string,
    action: () => Promise<TerminalActionResult>,
    successTranslationKey: string,
    successTranslationValues?: Record<string, string | number>,
  ) => {
    setActionWindowId(windowId);
    setActionNotice(null);
    const operatedNumber = snapshotRef.current?.windows.find((windowInfo) => windowInfo.id === windowId)?.terminal_number;
    if (operatedNumber !== undefined) touchOperation(operatedNumber);
    try {
      const result = await action();
      if (result.screenshot_resource) frames.receive(result.screenshot_resource);
      if (result.success) {
        setActionNotice({ kind: 'success', translationKey: successTranslationKey, translationValues: successTranslationValues });
      } else {
        setActionNotice({
          kind: 'error',
          translationKey: errorTranslationKey(result.error_code),
        });
      }
      return result;
    } catch {
      setActionNotice({ kind: 'error', translationKey: 'terminal.errors.request' });
      return null;
    } finally {
      setActionWindowId((current) => (current === windowId ? '' : current));
      void refresh(false);
    }
  }, [errorTranslationKey, refresh, frames.receive, touchOperation]);

  const runDesktopIntegration = useCallback(async (
    action: TerminalDesktopIntegrationAction,
  ) => {
    setIntegrationAction(action);
    try {
      await runAction(
        `terminal:desktop:${action}`,
        () => terminalApi.runTerminalDesktopIntegration(action),
        'terminal.desktop.actionDone',
      );
    } finally {
      if (mountedRef.current) setIntegrationAction(null);
    }
  }, [runAction]);

  const commitTerminalScheduleDefinitions = useCallback(async (
    windowInfo: TerminalWindowInfo,
    definitions: TerminalScheduleDefinition[],
    successTranslationKey: string,
  ) => {
    const terminalNumber = windowInfo.terminal_number;
    writeTerminalScheduleQueue(terminalNumber, definitions);
    setSnapshot((current) => replaceTerminalScheduleQueue(
      current,
      terminalNumber,
      definitions,
    ));
    setActionWindowId(windowInfo.id);
    setActionNotice(null);
    try {
      const result = await syncTerminalScheduleQueue(terminalNumber);
      if (result?.success) {
        setActionNotice({ kind: 'success', translationKey: successTranslationKey });
      } else if (result) {
        setActionNotice({
          kind: 'error',
          translationKey: errorTranslationKey(result.error_code),
        });
      } else {
        setActionNotice({
          kind: 'success',
          translationKey: 'terminal.scheduleSavedLocally',
        });
      }
    } catch {
      setActionNotice({
        kind: 'success',
        translationKey: 'terminal.scheduleSavedLocally',
      });
    } finally {
      setActionWindowId('');
    }
  }, [errorTranslationKey, syncTerminalScheduleQueue]);

  // Removed terminals leave nothing behind on this page: drafts, timers, previews, captures, schedule queues.
  const forgetTerminalLocalState = useCallback((terminalNumbers: number[]) => {
    const removed = new Set(terminalNumbers);
    const keys = terminalNumbers.map(terminalDraftKey);
    keys.forEach((key) => {
      const timer = draftTimersRef.current[key];
      if (timer) window.clearTimeout(timer);
      delete draftTimersRef.current[key];
      delete draftsRef.current[key];
    });
    terminalNumbers.forEach((terminalNumber) => {
      dirtyDraftsRef.current.delete(terminalNumber);
      loadedDraftsRef.current.delete(terminalNumber);
      writeCachedDraft(terminalNumber, null);
      scheduleSyncInFlightRef.current.delete(terminalNumber);
    });
    const omitKeys = <T,>(record: Record<string, T>) => Object.fromEntries(
      Object.entries(record).filter(([key]) => !keys.includes(key)),
    ) as Record<string, T>;
    setDrafts(omitKeys);
    setDraftStatuses(omitKeys);
    setPreviewExpandedStates(omitKeys);
    setCaptureRecords((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => !removed.has(Number(key))),
    ));
    setSnapshot((current) => (current
      ? { ...current, windows: current.windows.filter((windowInfo) => !removed.has(windowInfo.terminal_number)) }
      : current));
    setSelectedTerminalNumber((current) => (current !== null && removed.has(current) ? null : current));
    setPreviewTerminalNumber((current) => (current !== null && removed.has(current) ? null : current));
    setEditingSchedule((current) => (current && removed.has(current.terminalNumber) ? null : current));
    if (removeTerminalScheduleQueues(terminalNumbers)) {
      void scheduleSync.pushTerminalScheduleJson().catch(() => undefined);
    }
  }, [scheduleSync]);

  const removeOfflineTerminals = useCallback(async (terminalNumbers: number[]) => {
    if (!terminalNumbers.length || removingTerminals) return;
    const confirmed = window.confirm(terminalNumbers.length === 1
      ? t('terminal.remove.confirmOne', { number: terminalNumbers[0] })
      : t('terminal.remove.confirmAll', { count: terminalNumbers.length }));
    if (!confirmed) return;
    setRemovingTerminals(true);
    setActionNotice(null);
    const removed = new Set<number>();
    let errorCode: string | null = null;
    try {
      for (const terminalNumber of terminalNumbers) {
        try {
          const result = await terminalApi.removeTerminal(terminalNumber);
          if (result.success) {
            (result.removed_terminal_numbers?.length ? result.removed_terminal_numbers : [terminalNumber])
              .forEach((number) => removed.add(number));
          } else {
            errorCode = errorCode ?? String(result.error_code || 'request_failed');
          }
        } catch (error) {
          errorCode = errorCode ?? terminalRequestErrorCode(error);
        }
      }
      if (removed.size) forgetTerminalLocalState([...removed]);
      if (!mountedRef.current) return;
      setActionNotice(errorCode
        ? { kind: 'error', translationKey: errorTranslationKey(errorCode) }
        : { kind: 'success', translationKey: 'terminal.remove.done', translationValues: { count: removed.size } });
    } finally {
      if (mountedRef.current) setRemovingTerminals(false);
      void refresh();
    }
  }, [errorTranslationKey, forgetTerminalLocalState, refresh, removingTerminals, t, terminalApi]);

  const renderRemoveOfflineBar = () => (
    <div className="col-span-full flex items-center justify-between gap-2">
      <span className="text-[11px] font-semibold text-slate-500">
        {t('terminal.remove.offlineCount', { count: offlineWindows.length })}
      </span>
      <button
        type="button"
        onClick={() => void removeOfflineTerminals(offlineWindows.map((windowInfo) => windowInfo.terminal_number))}
        disabled={removingTerminals}
        title={t('terminal.remove.allHint')}
        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/20 disabled:opacity-50"
      >
        {removingTerminals ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        {t('terminal.remove.all')}
      </button>
    </div>
  );

  const clearAllScheduleEntries = useCallback(async () => {
    if (!window.confirm(t('terminal.scheduleClearAllConfirm'))) return;
    scheduleClearAllInProgressRef.current = true;
    const localResult = stageTerminalScheduleClearAll();
    const localTerminalNumbers = localResult.terminal_numbers.join(', ')
      || t('terminal.scheduleNoTerminals');
    setSnapshot((current) => current ? {
      ...current,
      windows: current.windows.map((windowInfo) => ({
        ...windowInfo,
        schedule_queue: [],
      })),
    } : current);
    setEditingSchedule(null);
    setActionWindowId(ALL_SCHEDULES_ACTION_ID);
    setActionNotice(null);
    try {
      await Promise.allSettled([...scheduleSyncInFlightRef.current.values()]);
      const result = await scheduleSync.clearTerminalSchedules();
      const pycoreTerminalNumbers = (result.terminal_numbers || []).join(', ')
        || t('terminal.scheduleNoTerminals');
      if (result.success) {
        completeTerminalScheduleClearAll();
        void scheduleSync.pushTerminalScheduleJson().catch(() => undefined);
        setActionNotice({
          kind: 'success',
          translationKey: 'terminal.scheduleClearResult',
          translationValues: {
            frontendCount: localResult.cleared_entry_count,
            frontendTerminals: localTerminalNumbers,
            pycoreCount: Number(result.cleared_entry_count || 0),
            pycoreTerminals: pycoreTerminalNumbers,
            jsonCount: Number(result.json_entry_count || 0),
            runtimeRemaining: Number(result.remaining_entry_count || 0),
          },
          responseJson: JSON.stringify(result, null, 2),
        });
      } else {
        setActionNotice({
          kind: 'error',
          translationKey: 'terminal.scheduleClearPendingResult',
          translationValues: {
            frontendCount: localResult.cleared_entry_count,
            frontendTerminals: localTerminalNumbers,
            errorCode: String(result.error_code || 'request_failed'),
          },
          responseJson: JSON.stringify(result, null, 2),
        });
      }
    } catch {
      setActionNotice({
        kind: 'error',
        translationKey: 'terminal.scheduleClearPendingResult',
        translationValues: {
          frontendCount: localResult.cleared_entry_count,
          frontendTerminals: localTerminalNumbers,
          errorCode: 'request_failed',
        },
      });
    } finally {
      scheduleClearAllInProgressRef.current = false;
      setActionWindowId('');
    }
  }, [t]);

  const activate = useCallback((windowId: string) => runAction(
    windowId,
    () => terminalApi.activateTerminal(windowId),
    'terminal.activated',
  ), [runAction]);

  const navigateHistory = useCallback((direction: 'up' | 'down') => {
    if (!selectedWindow?.online) return;
    void runAction(
      selectedWindow.id,
      () => terminalApi.navigateTerminalHistory(selectedWindow.id, direction),
      direction === 'up'
        ? 'terminal.historyNavigatedUp'
        : 'terminal.historyNavigatedDown',
    );
  }, [runAction, selectedWindow]);

  const pressKey = useCallback((key: TerminalKeyAction) => {
    if (!selectedWindow?.online) return;
    void runAction(
      selectedWindow.id,
      () => terminalApi.pressTerminalKey(selectedWindow.id, key),
      `terminal.keySent.${key}`,
    );
  }, [runAction, selectedWindow]);

  const switchToManualMode = useCallback(() => {
    if (!selectedWindow?.online) return;
    void runAction(
      selectedWindow.id,
      () => terminalApi.switchTerminalPermissionMode(selectedWindow.id, selectedWindow.terminal_number, 'manual'),
      'terminal.permissionMode.switched',
    );
  }, [runAction, selectedWindow]);

  const scrollTerminal = useCallback((mode: TerminalScrollMode) => {
    if (!selectedWindow?.online) return;
    void runAction(
      selectedWindow.id,
      () => terminalApi.scrollTerminal(selectedWindow.id, mode),
      SCROLL_SUCCESS_TRANSLATION_KEYS[mode],
    );
  }, [runAction, selectedWindow]);

  const togglePreviewExpanded = useCallback(() => {
    if (!previewWindow) return;
    const terminalNumber = previewWindow.terminal_number;
    const key = terminalDraftKey(terminalNumber);
    const nextExpanded = !previewExpanded;
    setPreviewExpandedStates((current) => ({
      ...current,
      [key]: nextExpanded,
    }));
    void terminalApi.saveTerminalViewState(terminalNumber, nextExpanded)
      .then((result) => {
        if (!result.success && mountedRef.current) {
          setActionNotice({
            kind: 'error',
            translationKey: errorTranslationKey(result.error_code),
          });
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setActionNotice({
            kind: 'error',
            translationKey: 'terminal.errors.request',
          });
        }
      });
  }, [errorTranslationKey, previewExpanded, previewWindow]);

  const clickPreview = useCallback((event: React.MouseEvent<HTMLImageElement>) => {
    if (!previewDirectClick) {
      setPreviewTerminalNumber(null);
      return;
    }
    const view = terminalViewFor(previewWindow);
    if (!previewWindow?.online || view?.kind !== 'image' || actionWindowId) {
      return;
    }
    const image = view.frame;
    const point = normalizedImagePoint(
      event,
      image.width,
      image.height,
    );
    if (!point) return;
    void runAction(
      previewWindow.id,
      () => terminalApi.clickTerminal(
        previewWindow.id,
        point.horizontalRatio,
        point.verticalRatio,
      ),
      'terminal.clicked',
    );
  }, [actionWindowId, previewDirectClick, previewWindow, runAction, terminalViewFor]);

  const selectTerminal = useCallback((terminalNumber: number) => {
    if (
      selectedTerminalNumber !== null
      && selectedTerminalNumber !== terminalNumber
    ) {
      flushDraft(selectedTerminalNumber);
    }
    pendingSessionRef.current = null;
    setSelectedTerminalNumber(terminalNumber);
    touchOperation(terminalNumber);
  }, [flushDraft, selectedTerminalNumber, touchOperation]);

  // The full-screen preview is one browser history entry: the phone's back gesture closes it.
  useEffect(() => {
    if (!previewOpen) return undefined;
    window.history.pushState({ [PREVIEW_HISTORY_KEY]: true }, '');
    const onPopState = () => closePreview();
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if ((window.history.state as Record<string, unknown> | null)?.[PREVIEW_HISTORY_KEY]) window.history.back();
    };
  }, [closePreview, previewOpen]);

  // A terminal that failed and left the snapshot no longer holds the preview open.
  useEffect(() => {
    if (previewOpen && snapshot && !previewWindow && !pendingSessionRef.current) closePreview();
  }, [closePreview, previewOpen, previewWindow, snapshot]);

  const hasLocalDraft = (terminalNumber: number) => Boolean(drafts[terminalDraftKey(terminalNumber)]?.trim());
  const agentToastName = useCallback(
    (windowInfo: TerminalWindowInfo) => terminalName(windowInfo, t('terminal.untitled')),
    [t],
  );
  const { acknowledge } = terminalWatch;
  const selectedFinishedAt = selectedWindow?.agent_activity?.finished_at ?? null;
  useEffect(() => {
    if (selectedTerminalNumber !== null && selectedFinishedAt !== null) acknowledge(selectedTerminalNumber, selectedFinishedAt);
  }, [acknowledge, selectedTerminalNumber, selectedFinishedAt]);

  // Operation history: every terminal that enters the operation view is recorded once (like browser
  // history); back / forward only move the pointer, so the terminal left behind keeps its draft and
  // returns exactly as it was.
  const navHistory = useMemo(() => terminalNavHistoryFor(nodeKey), [nodeKey]);
  const navState = useTerminalNavSnapshot(navHistory);
  const operatingNumber = previewTerminalNumber ?? (isMobile ? null : operatedTerminalNumber);
  useEffect(() => {
    if (operatingNumber !== null) navHistory.visit(operatingNumber);
  }, [navHistory, operatingNumber]);

  const openTerminal = useCallback((terminalNumber: number) => {
    const target = snapshotRef.current?.windows.find((windowInfo) => windowInfo.terminal_number === terminalNumber);
    if (!target) return;
    selectTerminal(terminalNumber);
    setPreviewTerminalNumber(terminalNumber);
    const activity = target.agent_activity;
    if (activity && !activity.busy && typeof activity.finished_at === 'number') acknowledge(terminalNumber, activity.finished_at);
    // A finished terminal is static: its last frame is transferred once, when it is opened.
    if (target.online && (frames.isFrozen(target) || !frames.viewFor(target))) frames.forceLatest(target.id);
  }, [acknowledge, frames, selectTerminal]);

  const terminalExists = useCallback(
    (terminalNumber: number) => Boolean(snapshotRef.current?.windows.some((windowInfo) => windowInfo.terminal_number === terminalNumber)),
    [],
  );
  const navigateBack = useCallback(() => {
    const target = navHistory.back(terminalExists);
    if (target !== null) openTerminal(target);
  }, [navHistory, openTerminal, terminalExists]);
  const navigateForward = useCallback(() => {
    const target = navHistory.forward(terminalExists);
    if (target !== null) openTerminal(target);
  }, [navHistory, openTerminal, terminalExists]);

  // Finished terminals not opened yet, oldest first. Opening acknowledges the finish, so each one
  // leaves the queue once and the queue never cycles.
  const { acknowledged } = terminalWatch;
  const finishedQueue = useMemo(() => (snapshot?.windows ?? NO_WINDOWS)
    .filter((windowInfo) => {
      const activity = windowInfo.agent_activity;
      return windowInfo.online
        && Boolean(activity)
        && !activity?.busy
        && typeof activity?.finished_at === 'number'
        && activity.finished_at > (acknowledged[windowInfo.terminal_number] ?? 0)
        && windowInfo.terminal_number !== operatingNumber;
    })
    .sort((left, right) => Number(left.agent_activity?.finished_at) - Number(right.agent_activity?.finished_at))
    .map((windowInfo) => windowInfo.terminal_number), [acknowledged, operatingNumber, snapshot]);
  const openNextFinished = useCallback(() => {
    if (finishedQueue.length > 0) openTerminal(finishedQueue[0]);
  }, [finishedQueue, openTerminal]);
  const navActions = useMemo(() => ({ openFinished: openTerminal }), [openTerminal]);
  const renderNavControls = (className = '') => (
    <PcTerminalNavControls
      canBack={navState.canBack}
      canForward={navState.canForward}
      finishedCount={finishedQueue.length}
      onBack={navigateBack}
      onForward={navigateForward}
      onNextFinished={openNextFinished}
      className={className}
    />
  );

  const setDraftFor = useCallback((terminalNumber: number, text: string) => {
    const key = terminalDraftKey(terminalNumber);
    draftsRef.current = { ...draftsRef.current, [key]: text };
    setDrafts(draftsRef.current);
    writeCachedDraft(terminalNumber, text);
    scheduleDraftSave(terminalNumber, text);
  }, [scheduleDraftSave]);

  const updateSelectedDraft = useCallback((text: string) => {
    if (selectedWindow) setDraftFor(selectedWindow.terminal_number, text);
  }, [setDraftFor, selectedWindow]);

  // A sent message picked in the search: open its terminal with that message in the composer.
  const pickSentMessage = useCallback((hit: TerminalLogSearchHit) => {
    if (!terminalExists(hit.terminal_number)) {
      setActionNotice({ kind: 'error', translationKey: 'terminal.sentSearch.missing' });
      return;
    }
    openTerminal(hit.terminal_number);
    setDraftFor(hit.terminal_number, hit.content);
  }, [openTerminal, setDraftFor, terminalExists]);
  useEffect(() => {
    if (!sentPick || sentPick.node.url !== nodeUrl || !snapshot) return;
    onSentPickApplied();
    pickSentMessage(sentPick);
  }, [nodeUrl, onSentPickApplied, pickSentMessage, sentPick, snapshot]);

  // The composer on screen (the enlarged preview's or the side panel's): scrolled into view and focused, caret at the end.
  const focusComposer = useCallback(() => {
    window.requestAnimationFrame(() => {
      const composers = Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea[data-terminal-composer]'));
      const composer = composers.reverse().find((element) => element.offsetParent !== null);
      if (!composer) return;
      composer.scrollIntoView({ block: 'center', behavior: 'smooth' });
      composer.focus({ preventScroll: true });
      composer.setSelectionRange(composer.value.length, composer.value.length);
    });
  }, []);

  const reuseLogContent = useCallback((text: string) => {
    updateSelectedDraft(text);
    setLogDialogOpen(false);
    setActionNotice({ kind: 'success', translationKey: 'terminal.logs.reused' });
    focusComposer();
  }, [focusComposer, updateSelectedDraft]);

  const closeLogDialog = useCallback(() => setLogDialogOpen(false), []);

  // Sends the current draft or an explicit text override through clipboard paste;
  // clearFirst empties the terminal's own input line before the paste.
  const sendInput = useCallback(async (textOverride?: string, clearFirst = false, interruptFirst = false) => {
    if (!selectedWindow || !selectedWindow.online) return;
    const terminalNumber = selectedWindow.terminal_number;
    const key = terminalDraftKey(terminalNumber);
    // With dispatch on, the message goes to an idle agent terminal of the chosen kind; the draft stays with this terminal.
    let target = selectedWindow;
    if (dispatchActive) {
      const idleTarget = pickIdleAgentTerminal({
        windows: snapshotRef.current?.windows ?? NO_WINDOWS,
        excludeTerminalNumber: terminalNumber,
        agent: dispatchSetting.agent,
        watch: terminalWatchRef.current,
        recentDispatches: dispatchedAtRef.current,
        now: Date.now(),
      });
      if (!idleTarget) {
        setActionNotice({
          kind: 'error',
          translationKey: 'terminal.dispatch.noIdle',
          translationValues: { agent: t(`terminal.dispatch.agents.${dispatchSetting.agent}`) },
        });
        return;
      }
      target = idleTarget;
    }
    // Attachments belong to the draft message only, never to an explicit text resend.
    const attachments = textOverride === undefined ? await images.uploadAll() : [];
    if (attachments === null) {
      setActionNotice({ kind: 'error', translationKey: 'terminal.images.sendBlocked' });
      return;
    }
    // Read the draft after the uploads: typing during an upload is part of the message.
    const draftText = stripImagePlaceholders(textOverride === undefined ? (draftsRef.current[key] ?? selectedDraft) : textOverride);
    // A voice message leads with the instruction to the agent, always in English whatever the UI language.
    const voiceNote = attachments.some((attachment) => attachment.kind === 'audio')
      ? i18n.getFixedT(AGENT_NOTE_LANGUAGE, 'pc')('terminal.voice.agentNote')
      : '';
    const payload = [voiceNote, draftText, ...attachments.map((attachment) => attachment.displayPath)]
      .filter((part) => part !== '')
      .join(' ');
    const recordings = attachments.filter((attachment) => attachment.kind === 'audio').map((attachment) => attachment.displayPath);
    const dictationText = [draftText, ...attachments.filter((attachment) => attachment.kind !== 'audio').map((attachment) => attachment.displayPath)]
      .filter((part) => part !== '')
      .join(' ');
    const activeTimer = draftTimersRef.current[key];
    if (activeTimer) {
      window.clearTimeout(activeTimer);
      delete draftTimersRef.current[key];
    }
    const result = await runAction(
      target.id,
      async () => {
        // The agent types the recording itself where pycore can dictate into it; otherwise the file path is sent.
        if (recordings.length > 0) {
          const dictated = await terminalApi.dictateTerminalVoice(
            target.id,
            target.terminal_number,
            recordings,
            dictationText,
            clearFirst,
            interruptFirst,
          ).catch(() => null);
          if (dictated && (dictated.success || !VOICE_DICTATION_FALLBACK_ERRORS.has(dictated.error_code ?? ''))) return dictated;
        }
        return terminalApi.inputTerminalText(
          target.id,
          target.terminal_number,
          payload,
          clearFirst,
          interruptFirst,
        );
      },
      target !== selectedWindow
        ? 'terminal.dispatch.sent'
        : interruptFirst
          ? 'terminal.commands.forceSent'
          : clearFirst ? (payload === '' ? 'terminal.clearedOnly' : 'terminal.clearedAndSent') : 'terminal.sent',
      target !== selectedWindow ? { number: target.terminal_number } : undefined,
    );
    if (result?.log?.id) {
      dirtyDraftsRef.current.delete(terminalNumber);
      writeCachedDraft(terminalNumber, null);
      setDraftStatuses((current) => ({ ...current, [key]: 'saved' }));
    } else if (!result?.success) {
      void persistDraft(terminalNumber, draftText);
    }
    if (result?.success) {
      if (target !== selectedWindow) dispatchedAtRef.current.set(target.terminal_number, Date.now());
      frames.thaw(target.terminal_number);
      if (textOverride === undefined) images.clear();
      writeCachedDraft(terminalNumber, null);
      draftsRef.current = { ...draftsRef.current, [key]: '' };
      setDrafts(draftsRef.current);
      setDraftStatuses((current) => ({ ...current, [key]: 'saved' }));
    }
  }, [dispatchActive, dispatchSetting.agent, images, persistDraft, runAction, selectedDraft, selectedWindow, t]);

  // Saves the UI name (empty restores the window title) and asks pycore to retitle the OS window.
  const renameSelected = useCallback(async () => {
    if (!selectedWindow || renameText === null) return;
    const terminalNumber = selectedWindow.terminal_number;
    setActionWindowId(selectedWindow.id);
    try {
      const result = await terminalApi.renameTerminal(terminalNumber, renameText);
      if (!result.success) {
        setActionNotice({ kind: 'error', translationKey: errorTranslationKey(result.error_code) });
        return;
      }
      setRenameText(null);
      setActionNotice({
        kind: result.os_title_applied || !result.custom_title ? 'success' : 'error',
        translationKey: !result.custom_title
          ? 'terminal.rename.cleared'
          : result.os_title_applied ? 'terminal.rename.applied' : 'terminal.rename.savedOnly',
      });
    } catch {
      setActionNotice({ kind: 'error', translationKey: 'terminal.errors.request' });
    } finally {
      setActionWindowId('');
      void refresh(false);
    }
  }, [errorTranslationKey, refresh, renameText, selectedWindow]);

  const chooseOption = useCallback(async (option: number, text: string) => {
    if (!selectedWindow || !selectedWindow.online) return false;
    const result = await runAction(
      selectedWindow.id,
      () => terminalApi.chooseTerminalOption(selectedWindow.id, selectedWindow.terminal_number, option, text),
      'terminal.choice.sent',
    );
    if (result?.success) frames.thaw(selectedWindow.terminal_number);
    return Boolean(result?.success);
  }, [runAction, selectedWindow]);

  // Quick commands never touch the draft: the input line is cleared (force: Ctrl+C first) and the command runs.
  // Takes the one-shot options for this send and resets them to a plain send.
  const takeSendOnce = useCallback(() => {
    const options = sendOnce;
    setSendOnce({ clear: false, force: false });
    return options;
  }, [sendOnce]);

  const sendDraft = useCallback(() => {
    const options = takeSendOnce();
    void sendInput(undefined, options.clear, options.force);
  }, [sendInput, takeSendOnce]);

  // A logged message sent again: it becomes the draft and goes through the regular send.
  const resendLogContent = useCallback((text: string) => {
    updateSelectedDraft(text);
    setLogDialogOpen(false);
    focusComposer();
    sendDraft();
  }, [focusComposer, sendDraft, updateSelectedDraft]);

  // Commands send at once; the panel's one-shot options (clear first / Ctrl+C first) apply.
  const runQuickCommand = useCallback(async (command: string) => {
    if (!selectedWindow || !selectedWindow.online) return false;
    const options = takeSendOnce();
    const result = await runAction(
      selectedWindow.id,
      () => terminalApi.inputTerminalText(
        selectedWindow.id,
        selectedWindow.terminal_number,
        command,
        options.clear,
        options.force,
        true,
      ),
      options.force ? 'terminal.commands.forceSent' : 'terminal.commands.sent',
    );
    if (result?.success) frames.thaw(selectedWindow.terminal_number);
    return Boolean(result?.success);
  }, [runAction, selectedWindow, takeSendOnce]);

  // Card title commands run on that card's terminal; restart presses Ctrl+C several times before the command.
  const runCardCommand = useCallback(async (windowInfo: TerminalWindowInfo, command: string, restart: boolean) => {
    if (!windowInfo.online) return false;
    selectTerminal(windowInfo.terminal_number);
    const result = await runAction(
      windowInfo.id,
      () => terminalApi.inputTerminalText(
        windowInfo.id,
        windowInfo.terminal_number,
        command,
        false,
        false,
        true,
        restart,
      ),
      restart ? 'terminal.commands.restartSent' : 'terminal.commands.sent',
    );
    if (result?.success) frames.thaw(windowInfo.terminal_number);
    return Boolean(result?.success);
  }, [runAction, selectTerminal]);

  const sendEnter = useCallback(async () => {
    if (!selectedWindow || !selectedWindow.online) return;
    const result = await runAction(
      selectedWindow.id,
      () => terminalApi.pressTerminalEnter(
        selectedWindow.id,
        selectedWindow.terminal_number,
      ),
      'terminal.sent',
    );
    if (result?.success) frames.thaw(selectedWindow.terminal_number);
  }, [runAction, selectedWindow, frames.thaw]);

  const captureOutput = useCallback(async (openEditor: boolean) => {
    if (!selectedWindow || !selectedWindow.online) return null;
    const terminalNumber = selectedWindow.terminal_number;
    const result = await runAction(
      selectedWindow.id,
      () => terminalApi.captureTerminalText(selectedWindow.id, terminalNumber, openEditor),
      'terminal.capture.saved',
    );
    const record = result ? captureRecordFromResult(result) : null;
    if (record && mountedRef.current) {
      setCaptureRecords((current) => ({ ...current, [terminalNumber]: record }));
      setActionNotice({
        kind: record.editorRequested && !record.opened ? 'error' : 'success',
        translationKey: record.editorRequested && !record.opened
          ? 'terminal.capture.savedNotOpened'
          : 'terminal.capture.saved',
        translationValues: { lines: record.lineCount, name: record.name },
      });
    }
    return result;
  }, [runAction, selectedWindow]);

  const reportCaptureClipboard = useCallback((copied: boolean) => {
    setActionNotice({
      kind: copied ? 'success' : 'error',
      translationKey: copied ? 'terminal.capture.copied' : 'terminal.capture.copyFailed',
    });
  }, []);

  const addScheduleEntry = useCallback(async () => {
    if (!selectedWindow) return;
    const terminalNumber = selectedWindow.terminal_number;
    const intervalSeconds = Math.floor(Number(scheduleIntervalText));
    const runAt = scheduleMode === 'once' ? new Date(scheduleTimeText).getTime() : 0;
    if (scheduleMode === 'once' && (!Number.isFinite(runAt) || runAt <= 0)) {
      setActionNotice({ kind: 'error', translationKey: 'terminal.errors.scheduleTime' });
      return;
    }
    if (
      scheduleMode === 'interval'
      && (!Number.isFinite(intervalSeconds) || intervalSeconds < 1)
    ) {
      setActionNotice({ kind: 'error', translationKey: 'terminal.errors.scheduleInterval' });
      return;
    }
    const editingEntryId = editingSchedule && editingSchedule.terminalNumber === terminalNumber
      ? editingSchedule.entryId
      : '';
    const isUpdate = Boolean(editingEntryId);
    const message = selectedDraft;
    const schedule = ensureTerminalScheduleQueue(terminalNumber);
    const entryPayload: TerminalScheduleDefinition = {
      id: isUpdate ? editingEntryId : createTerminalScheduleEntryId(),
      mode: scheduleMode,
      run_at: scheduleMode === 'once' ? runAt : 0,
      interval_seconds: scheduleMode === 'interval' ? intervalSeconds : 0,
      message,
    };
    const definitions = isUpdate
      ? schedule.entries.map((entry) => (
        entry.id === editingEntryId ? entryPayload : entry
      ))
      : [...schedule.entries, entryPayload];
    await commitTerminalScheduleDefinitions(
      selectedWindow,
      definitions,
      isUpdate ? 'terminal.scheduleEntryUpdated' : 'terminal.scheduleEntryAdded',
    );
    setEditingSchedule(null);
  }, [
    commitTerminalScheduleDefinitions,
    editingSchedule,
    scheduleIntervalText,
    scheduleMode,
    scheduleTimeText,
    selectedDraft,
    selectedWindow,
  ]);

  const removeScheduleEntry = useCallback(async (entryId: string) => {
    if (!selectedWindow) return;
    const terminalNumber = selectedWindow.terminal_number;
    const schedule = ensureTerminalScheduleQueue(terminalNumber);
    await commitTerminalScheduleDefinitions(
      selectedWindow,
      schedule.entries.filter((entry) => entry.id !== entryId),
      'terminal.scheduleEntryRemoved',
    );
  }, [
    commitTerminalScheduleDefinitions,
    selectedWindow,
  ]);

  const applyQuickScheduleDelay = useCallback((seconds: number) => {
    if (scheduleMode === 'once') {
      setScheduleTimeText(toDatetimeLocalValue(Date.now() + seconds * 1000));
      return;
    }
    setScheduleIntervalText(String(seconds));
  }, [scheduleMode]);

  // Load a queued entry (mode / time / interval / message) into the shared
  // editor so it can be edited and saved back over the original entry.
  const editScheduleEntry = useCallback((entry: TerminalScheduleEntry) => {
    if (!selectedWindow || actionWindowId) return;
    const terminalNumber = selectedWindow.terminal_number;
    setEditingSchedule({ terminalNumber, entryId: entry.id });
    setScheduleMode(entry.mode);
    if (entry.mode === 'once') {
      setScheduleTimeText(
        toDatetimeLocalValue(entry.next_run_at || Date.now() + 5 * 60 * 1000),
      );
    } else {
      setScheduleIntervalText(String(Math.max(1, entry.interval_seconds)));
    }
    const schedule = readTerminalScheduleQueue(terminalNumber);
    const definition = schedule?.entries.find((item) => item.id === entry.id);
    updateSelectedDraft(definition?.message || '');
  }, [actionWindowId, selectedWindow, updateSelectedDraft]);

  const renderOperationPanel = (overlay: boolean) => (
    <div
      ref={overlay ? overlayPanelRef : undefined}
      className={`space-y-4 [&_button]:whitespace-nowrap ${overlay ? 'h-full overflow-y-auto p-3 md:p-4' : 'p-5'}`}
    >
      {selectedWindow && renameText !== null ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            void renameSelected();
          }}
        >
          <span className="shrink-0 text-[11px] text-slate-500">#{selectedWindow.terminal_number}</span>
          <input
            autoFocus
            value={renameText}
            onChange={(event) => setRenameText(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Escape') setRenameText(null); }}
            placeholder={selectedWindow.title || t('terminal.untitled')}
            maxLength={120}
            className="min-w-0 flex-1 rounded-lg border border-slate-500/25 bg-white/60 px-2 py-1 text-[12px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950/40 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={Boolean(actionWindowId)}
            title={t('terminal.rename.save')}
            aria-label={t('terminal.rename.save')}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setRenameText(null)}
            title={t('common.cancel')}
            aria-label={t('common.cancel')}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-500/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      ) : (
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
          {selectedWindow && (
            <span
              title={t(selectedWindow.online ? 'terminal.online' : 'terminal.offline')}
              className={`h-2 w-2 shrink-0 rounded-full ${selectedWindow.online ? 'bg-emerald-500' : 'bg-slate-400'}`}
            />
          )}
          <span className="min-w-0 truncate">
            {selectedWindow
              ? `#${selectedWindow.terminal_number} · ${terminalName(selectedWindow, t('terminal.untitled'))}`
              : t('terminal.selectPrompt')}
          </span>
          {selectedWindow && <PcTerminalStatusMarks windowInfo={selectedWindow} hasDraft={hasLocalDraft(selectedWindow.terminal_number)} />}
          {selectedWindow && (
            <button
              type="button"
              onClick={() => setRenameText(selectedWindow.custom_title || selectedWindow.title || '')}
              title={t('terminal.rename.action')}
              aria-label={t('terminal.rename.action')}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-500/10 hover:text-indigo-500"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </p>
      )}
      <PcTerminalInputBox
        value={selectedDraft}
        onChange={updateSelectedDraft}
        onSend={sendDraft}
        hasWindow={Boolean(selectedWindow)}
        rows={overlay ? 6 : 8}
        draftStatus={selectedDraftStatus}
        images={images}
        leading={isMobile ? undefined : <PcTerminalDispatchToggle setting={dispatchSetting} disabled={!selectedWindow} />}
        actions={(
          <>
            {([
              { key: 'clear', icon: Eraser, label: t('terminal.sendOnce.clear'), hint: t('terminal.clearAndSendHint'), tone: 'peer-checked:bg-indigo-600 peer-checked:text-white text-indigo-600 dark:text-indigo-300' },
              { key: 'force', icon: Zap, label: t('terminal.sendOnce.force'), hint: t('terminal.commands.forceRunHint'), tone: 'peer-checked:bg-rose-600 peer-checked:text-white text-rose-600 dark:text-rose-400' },
            ] as const).map(({ key, icon: Icon, label, hint, tone }) => (
              <label key={key} title={`${label}: ${hint} ${t('terminal.sendOnce.hint')}`} className="shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  aria-label={label}
                  checked={sendOnce[key]}
                  onChange={(event) => setSendOnce((current) => ({ ...current, [key]: event.target.checked }))}
                />
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-500/20 ${tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </label>
            ))}
          </>
        )}
        sendButton={(
          <button
            type="button"
            onClick={sendDraft}
            disabled={!selectedActionable}
            title={`${t('terminal.send')} (${t(isMobile ? 'terminal.sendShortcut' : 'terminal.sendShortcutDesktop')})`}
            aria-label={t('terminal.send')}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {actionWindowId === selectedWindow?.id
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />}
          </button>
        )}
        session={{
          slot: overlay ? INPUT_SLOT_OVERLAY : INPUT_SLOT_PANEL,
          restore: inputRestore,
          onRestored: handleInputRestored,
          onSnapshot: handleInputSnapshot,
        }}
      />
      {/* One compact panel: keys, commands and choice answers; send lives in the composer toolbar. */}
      <div className="space-y-1.5 rounded-xl border border-slate-500/15 bg-white/40 p-1.5 dark:bg-slate-950/20">
        <div
          className="grid grid-cols-6 gap-0.5 sm:grid-cols-12"
          role="toolbar"
          aria-label={t('terminal.quickKeys')}
        >
          {([
            { id: 'activate', label: t('terminal.activate'), icon: MousePointer2, tone: 'text-indigo-500 hover:bg-indigo-500/10', onClick: () => { if (selectedWindow) void activate(selectedWindow.id); } },
            { id: 'enter', label: t('terminal.sendEnterHint'), icon: CornerDownLeft, tone: 'text-slate-600 hover:bg-slate-500/10 dark:text-slate-300', onClick: () => void sendEnter() },
            ...TERMINAL_QUICK_KEYS.map((key) => ({
              id: key,
              label: t(`terminal.keyHints.${key}`),
              glyph: TERMINAL_KEY_GLYPHS[key],
              tone: 'text-amber-600 hover:bg-amber-500/10 dark:text-amber-400',
              onClick: () => pressKey(key),
            })),
            {
              id: 'manualMode',
              label: selectedWindow?.permission_mode
                ? t('terminal.permissionMode.switchHint', { mode: t(`terminal.permissionMode.modes.${selectedWindow.permission_mode.mode}`) })
                : t('terminal.permissionMode.switchHintUnknown'),
              icon: Hand,
              tone: selectedWindow?.permission_mode?.mode === 'manual'
                ? 'text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400'
                : 'text-rose-500 hover:bg-rose-500/10',
              onClick: switchToManualMode,
            },
            { id: 'previousCommand', label: t('terminal.previousCommand'), icon: ArrowUp, tone: 'text-indigo-500 hover:bg-indigo-500/10', onClick: () => navigateHistory('up') },
            { id: 'nextCommand', label: t('terminal.nextCommand'), icon: ArrowDown, tone: 'text-indigo-500 hover:bg-indigo-500/10', onClick: () => navigateHistory('down') },
            { id: 'pageUp', label: t('terminal.pageUp'), icon: ChevronsUp, tone: 'text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-400', onClick: () => scrollTerminal('page_up') },
            { id: 'pageDown', label: t('terminal.pageDown'), icon: ChevronsDown, tone: 'text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-400', onClick: () => scrollTerminal('page_down') },
            { id: 'scrollBottom', label: t('terminal.scrollBottom'), icon: ArrowDownToLine, tone: 'text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-400', onClick: () => scrollTerminal('bottom') },
          ] as Array<{ id: string; label: string; icon?: React.ComponentType<{ className?: string }>; glyph?: string; tone: string; onClick: () => void }>)
            .map(({ id, label, icon: Icon, glyph, tone, onClick }) => (
              <button
                key={id}
                type="button"
                onClick={onClick}
                disabled={!selectedActionable}
                title={label}
                aria-label={label}
                className={`flex h-7 items-center justify-center rounded-md font-mono text-[11px] font-bold disabled:opacity-40 ${tone}`}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" /> : glyph}
              </button>
            ))}
        </div>
        <PcTerminalQuickCommands
          shellOs={selectedWindow?.shell_os}
          disabled={!selectedActionable}
          busy={actionWindowId === selectedWindow?.id}
          onRun={runQuickCommand}
        />
        <PcTerminalChoicePicker
          disabled={!selectedActionable}
          busy={actionWindowId === selectedWindow?.id}
          onChoose={chooseOption}
        />
        {selectedWindow && (
          <PcTerminalCapturePanel
            terminalNumber={selectedWindow.terminal_number}
            actionable={selectedActionable}
            busy={Boolean(actionWindowId)}
            record={captureRecords[selectedWindow.terminal_number] ?? null}
            onCapture={captureOutput}
            onClipboardResult={reportCaptureClipboard}
          />
        )}
      </div>
      <PcTerminalSubmissionHistory
        windowInfo={selectedWindow}
        overlay={overlay}
        formatDate={formatLogDate}
        errorTranslationKey={errorTranslationKey}
        onOpenLogs={() => setLogDialogOpen(true)}
        onReuse={reuseLogContent}
        onResend={resendLogContent}
      />
      {selectedWindow && (
        <div className="rounded-xl border border-slate-500/15 bg-white/40 dark:bg-slate-950/20">
          <button
            type="button"
            onClick={() => setScheduleOpen((value) => !value)}
            aria-expanded={scheduleOpen || Boolean(editingSchedule && editingSchedule.terminalNumber === selectedWindow.terminal_number)}
            title={`${t('terminal.scheduleNow')}: ${new Date(nowMs).toLocaleString()}`}
            className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left"
          >
            <Timer className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
            <span className="shrink-0 text-[11px] font-bold text-slate-700 dark:text-slate-200">{t('terminal.scheduleTitle')}</span>
            {selectedScheduleQueue.length > 0 && (
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-500">
                {selectedScheduleQueue.length}
              </span>
            )}
            <span className={`min-w-0 flex-1 truncate text-right text-[10px] ${nextQueueRunAt ? 'font-semibold text-indigo-500' : 'text-slate-400'}`}>
              {nextQueueRunAt
                ? `${formatScheduleCountdown(nextQueueRunAt - nowMs)} · ${formatScheduleTime(nextQueueRunAt)}`
                : t('terminal.scheduleNone')}
            </span>
            {scheduleOpen || editingSchedule && editingSchedule.terminalNumber === selectedWindow.terminal_number
              ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
          </button>
          {(scheduleOpen || editingSchedule && editingSchedule.terminalNumber === selectedWindow.terminal_number) && (
            <div className="space-y-1.5 border-t border-slate-500/10 p-1.5">
              <div className="flex items-center gap-1">
                <div role="radiogroup" className="flex shrink-0 overflow-hidden rounded-md border border-slate-500/25 text-[10px]">
                  {(['once', 'interval'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={scheduleMode === mode}
                      onClick={() => setScheduleMode(mode)}
                      title={t(mode === 'once' ? 'terminal.scheduleModeOnce' : 'terminal.scheduleModeInterval')}
                      className={`inline-flex h-7 items-center gap-1 px-1.5 font-semibold ${scheduleMode === mode ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-500/10'}`}
                    >
                      {mode === 'once' ? <Clock3 className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                      <span className="hidden sm:inline">{t(mode === 'once' ? 'terminal.scheduleModeOnce' : 'terminal.scheduleModeInterval')}</span>
                    </button>
                  ))}
                </div>
                {scheduleMode === 'once' ? (
                  <input
                    type="datetime-local"
                    value={scheduleTimeText}
                    onChange={(event) => setScheduleTimeText(event.target.value)}
                    aria-label={t('terminal.scheduleTimeLabel')}
                    className="h-7 min-w-0 flex-1 rounded-md border border-slate-500/20 bg-white/60 px-1.5 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950/40 dark:text-slate-100"
                  />
                ) : (
                  <label className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-md border border-slate-500/20 bg-white/60 px-1.5 focus-within:ring-1 focus-within:ring-indigo-500 dark:bg-slate-950/40">
                    <input
                      type="number"
                      min={1}
                      value={scheduleIntervalText}
                      onChange={(event) => setScheduleIntervalText(event.target.value)}
                      aria-label={t('terminal.scheduleIntervalLabel')}
                      className="min-w-0 flex-1 bg-transparent text-[11px] text-slate-800 focus:outline-none dark:text-slate-100"
                    />
                    <span className="shrink-0 text-[10px] text-slate-400">{t('terminal.scheduleSecondsUnit')}</span>
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => void addScheduleEntry()}
                  disabled={Boolean(actionWindowId)}
                  title={editingSchedule && editingSchedule.terminalNumber === selectedWindow.terminal_number ? t('terminal.scheduleUpdate') : t('terminal.scheduleAdd')}
                  aria-label={editingSchedule && editingSchedule.terminalNumber === selectedWindow.terminal_number ? t('terminal.scheduleUpdate') : t('terminal.scheduleAdd')}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-indigo-600 px-2 text-[10px] font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {editingSchedule && editingSchedule.terminalNumber === selectedWindow.terminal_number ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">
                    {editingSchedule && editingSchedule.terminalNumber === selectedWindow.terminal_number ? t('terminal.scheduleUpdate') : t('terminal.scheduleAdd')}
                  </span>
                </button>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none]" aria-label={t('terminal.scheduleQuick')}>
                {QUICK_SCHEDULE_DELAYS.map((delay) => (
                  <button
                    key={delay.label}
                    type="button"
                    onClick={() => applyQuickScheduleDelay(delay.seconds)}
                    className="shrink-0 rounded-md border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-500 hover:bg-indigo-500/20"
                  >
                    {delay.label}
                  </button>
                ))}
              </div>
              {editingSchedule && editingSchedule.terminalNumber === selectedWindow.terminal_number && (
                <div className="flex items-center justify-between gap-2 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  <span className="min-w-0 truncate">{t('terminal.scheduleEditingHint')}</span>
                  <button
                    type="button"
                    onClick={() => setEditingSchedule(null)}
                    disabled={Boolean(actionWindowId)}
                    title={t('terminal.scheduleEditCancel')}
                    aria-label={t('terminal.scheduleEditCancel')}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {selectedScheduleQueue.length > 0 && (
                <div className={`${overlay ? 'max-h-32' : 'max-h-40'} space-y-1 overflow-y-auto pr-0.5`}>
                  {selectedScheduleQueue.map((entry) => (
                    <div
                      key={entry.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => editScheduleEntry(entry)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          editScheduleEntry(entry);
                        }
                      }}
                      aria-label={t('terminal.scheduleEdit')}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 transition-colors hover:border-indigo-400/40 dark:hover:border-indigo-400/40 ${
                        editingSchedule?.entryId === entry.id
                          ? 'border-amber-500/60 bg-amber-500/10'
                          : 'border-slate-500/15 bg-white/50 dark:bg-slate-950/30'
                      }`}
                    >
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                        entry.mode === 'interval'
                          ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}>
                        {t(
                          entry.mode === 'interval'
                            ? 'terminal.scheduleModeInterval'
                            : 'terminal.scheduleModeOnce',
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                          <span className="min-w-0 truncate">
                            {entry.preview || t('terminal.scheduleEmptyMessage')}
                          </span>
                          <Pencil className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                        </p>
                        <p className="text-[9px] text-slate-500">
                          {entry.next_run_at
                            ? `${formatScheduleCountdown(entry.next_run_at - nowMs)} · ${formatScheduleTime(entry.next_run_at)}`
                            : t('terminal.scheduleNone')}
                          {entry.mode === 'interval' && (
                            <>
                              {' · '}
                              {t('terminal.scheduleEvery', { seconds: entry.interval_seconds })}
                            </>
                          )}
                          {entry.fire_count > 0 && (
                            <>
                              {' · '}
                              {t('terminal.scheduleFires', { count: entry.fire_count })}
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeScheduleEntry(entry.id);
                        }}
                        disabled={Boolean(actionWindowId)}
                        aria-label={t('terminal.scheduleRemove')}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        <TimerOff className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[9px] leading-snug text-slate-400">{t('terminal.scheduleHint')}</p>
            </div>
          )}
        </div>
      )}
      <details className="group text-[10px] text-slate-500 dark:text-slate-400">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <Info className="h-3 w-3" />
          {t('terminal.howSendingWorks')}
        </summary>
        <p className="mt-1 leading-relaxed">{t('terminal.inputSequence')}</p>
        <p className="mt-1 leading-relaxed text-amber-600 dark:text-amber-400">{t('terminal.rightClickHint')}</p>
      </details>
    </div>
  );

  const jumpToTerminal = (terminalNumber: number) => {
    selectTerminal(terminalNumber);
    setJumpTitleVisible(true);
    const card = mobileListRef.current?.querySelector<HTMLElement>(`[data-terminal-number="${terminalNumber}"]`);
    if (!card) return;
    const barHeight = mobileJumpBarRef.current?.offsetHeight ?? 0;
    card.style.scrollMarginTop = `${barHeight + MOBILE_JUMP_GAP_PX}px`;
    card.scrollIntoView({ block: 'start' });
  };

  const renderMobileJumpBar = () => {
    const jumpWindows = [...onlineWindows, ...offlineWindows];
    const level = jumpBarLevelFor(jumpWindows.length, jumpGridWidth);
    const compact = level.chars !== null && level.chars <= 2;
    return (
    <div
      ref={mobileJumpBarRef}
      className="sticky top-0 z-20 -mx-3 -mt-3 mb-3 border-b border-slate-500/15 bg-white/90 px-3 py-2 backdrop-blur dark:bg-slate-950/90"
    >
      {jumpTitleVisible && selectedWindow && (
        <p className="mb-1.5 flex min-w-0 items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span className="min-w-0 truncate">
            {t('terminal.jumpTitle', {
              number: selectedWindow.terminal_number,
              title: terminalName(selectedWindow, t('terminal.untitled')),
            })}
          </span>
          <PcTerminalStatusMarks windowInfo={selectedWindow} hasDraft={hasLocalDraft(selectedWindow.terminal_number)} />
        </p>
      )}
      <div
        ref={jumpGridRef}
        className="grid"
        style={{ gap: JUMP_BAR_GAP_PX, gridTemplateColumns: `repeat(auto-fill,minmax(${level.minWidthPx}px,1fr))` }}
      >
        {jumpWindows.map((windowInfo) => {
          const selected = windowInfo.terminal_number === selectedTerminalNumber;
          const shortTitle = (level.chars === null
            ? terminalShortTitle(windowInfo)
            : terminalHeadTitle(windowInfo, level.chars)) || String(windowInfo.terminal_number);
          return (
            <button
              key={windowInfo.terminal_number}
              type="button"
              onClick={() => jumpToTerminal(windowInfo.terminal_number)}
              title={terminalName(windowInfo, t('terminal.untitled'))}
              aria-label={t('terminal.selectWindow', { number: windowInfo.terminal_number })}
              className={`relative inline-flex h-9 min-w-0 items-center justify-center rounded-lg ${compact || level.chars === 0 ? 'px-0.5' : 'px-2'} font-mono text-xs font-bold transition-colors ${
                selected
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/30'
                  : windowInfo.online
                    ? 'border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 active:bg-indigo-500/25 dark:text-indigo-300'
                    : 'border border-dashed border-slate-500/40 text-slate-400'
              }`}
            >
              {level.chars === 0
                ? <Terminal className="h-3.5 w-3.5 shrink-0" />
                : <span className="min-w-0 truncate whitespace-nowrap">{shortTitle}</span>}
              {windowInfo.online && (
                <span className={`absolute inline-flex items-center gap-px ${compact || level.chars === 0 ? 'right-0.5 top-0.5' : 'right-1 top-1'}`}>
                  <PcTerminalStatusMarks windowInfo={windowInfo} size="tile" inlineCountdown={false} hasDraft={hasLocalDraft(windowInfo.terminal_number)} />
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    windowInfo.active ? 'bg-emerald-400' : 'bg-emerald-500/50'
                  }`} />
                </span>
              )}
              <PcTerminalTileCountdown
                windowInfo={windowInfo}
                className={`absolute ${compact || level.chars === 0 ? 'bottom-0 right-0.5' : 'bottom-0.5 right-1'}`}
              />
            </button>
          );
        })}
      </div>
    </div>
    );
  };

  const renderGridWindowCard = (
    windowInfo: TerminalWindowInfo,
    compactLayout = false,
  ) => {
    const selected = windowInfo.terminal_number === selectedTerminalNumber;
    const busy = actionWindowId === windowInfo.id;
    const screenshotImage = terminalViewFor(windowInfo);
    return (
      <article
        key={windowInfo.terminal_number}
        ref={frames.refFor(windowInfo.id)}
        data-terminal-number={windowInfo.terminal_number}
        className={`flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-all ${
          compactLayout ? 'h-36' : 'min-h-[16rem] sm:min-h-[13rem]'
        } ${
          selected
            ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20'
            : windowInfo.active
              ? 'border-emerald-500/70 bg-emerald-500/10'
              : 'border-slate-500/40 bg-white/80 dark:bg-slate-900/80'
        } ${windowInfo.online ? '' : 'border-dashed'}`}
      >
        <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-slate-500/20 bg-slate-900 px-3 py-2 text-white">
          <button
            type="button"
            onClick={() => selectTerminal(windowInfo.terminal_number)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left focus:outline-none"
            aria-label={t('terminal.selectWindow', {
              number: windowInfo.terminal_number,
            })}
          >
            <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/25 px-1.5 font-mono text-xs font-bold text-indigo-200">
              #{windowInfo.terminal_number}
            </span>
            <span className="truncate text-sm font-semibold">
              {terminalName(windowInfo, t('terminal.untitled'))}
            </span>
            <PcTerminalStatusMarks windowInfo={windowInfo} hasDraft={hasLocalDraft(windowInfo.terminal_number)} />
            {windowInfo.online && windowInfo.control && !compactLayout && (
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                windowInfo.controllable === false
                  ? 'bg-amber-500/25 text-amber-200'
                  : 'bg-white/10 text-slate-300'
              }`}>
                {t(`terminal.desktop.control.${windowInfo.control}`)}
              </span>
            )}
            <span className={`h-2 w-2 shrink-0 rounded-full ${
              windowInfo.online ? 'bg-emerald-400' : 'bg-slate-400'
            }`} />
          </button>
          {windowInfo.online && (
            <button
              type="button"
              onClick={() => {
                selectTerminal(windowInfo.terminal_number);
                void activate(windowInfo.id);
              }}
              disabled={busy || !snapshot?.supported || windowInfo.controllable === false}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              aria-label={`${t('terminal.activate')}: ${terminalName(windowInfo, t('terminal.untitled'))}`}
            >
              {busy
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <MousePointer2 className="h-4 w-4" />}
              {!compactLayout && <span>{t('terminal.activate')}</span>}
            </button>
          )}
          {!windowInfo.online && (
            <button
              type="button"
              onClick={() => void removeOfflineTerminals([windowInfo.terminal_number])}
              disabled={removingTerminals}
              title={t('terminal.remove.one')}
              aria-label={`${t('terminal.remove.one')}: #${windowInfo.terminal_number}`}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {windowInfo.online && (
            <div className="basis-full">
              <PcTerminalCardCommands
                shellOs={windowInfo.shell_os}
                disabled={!snapshot?.supported || windowInfo.controllable === false}
                busy={busy}
                onRun={(command, restart) => runCardCommand(windowInfo, command, restart)}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            selectTerminal(windowInfo.terminal_number);
            setPreviewTerminalNumber(windowInfo.terminal_number);
          }}
          className="relative min-h-0 flex-1 overflow-hidden bg-slate-950/80 text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
          aria-label={t('terminal.previewScreenshot', {
            number: windowInfo.terminal_number,
          })}
        >
          {screenshotImage ? (
            <>
              <PcTerminalFrameView
                view={screenshotImage}
                alt={terminalName(windowInfo, t('terminal.untitled'))}
                size="card"
              />
              <Maximize2 className="absolute bottom-2 right-2 h-5 w-5 rounded bg-slate-950/70 p-0.5 text-white" />
            </>
          ) : (
            <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs">
              {t(windowInfo.online ? 'terminal.previewUnavailable' : 'terminal.offline')}
            </span>
          )}
        </button>
      </article>
    );
  };

  const snapshotError = snapshot?.error_code
    ? errorTranslationKey(snapshot.error_code)
    : null;
  const snapshotNotice = snapshot?.notice_code && snapshot.notice_code !== snapshot.error_code
    ? errorTranslationKey(snapshot.notice_code)
    : null;
  const live = Boolean(snapshot?.success && snapshot?.supported);

  return (
    <PcTerminalNavActionsProvider value={navActions}>
    <div className="px-3 pb-3 pt-0 sm:px-6 sm:pb-6 md:px-8 md:pb-8 space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)] gap-5">
        <section className="pc-glass overflow-clip">
          <div className="px-3 py-1.5 border-b border-slate-500/10 sm:px-4">
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 shrink">
                <h2 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                  {nodeIdentity.hostname || t('terminal.windowsTitle')}
                </h2>
                {nodeIdentity.lanIps && (
                  <p className="truncate font-mono text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                    {nodeIdentity.lanIps}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 rounded-lg border border-slate-500/20 p-0.5" role="tablist">
                {(['windows', 'desktop'] as const).map((view) => {
                  const label = t(view === 'windows' ? 'terminal.desktopView.windowsTab' : 'terminal.desktopView.tab');
                  const ViewIcon = view === 'windows' ? LayoutGrid : Monitor;
                  return (
                    <button
                      key={view}
                      type="button"
                      role="tab"
                      aria-selected={commonView === view}
                      aria-label={label}
                      title={label}
                      onClick={() => setCommonView(view)}
                      className={`rounded-md p-1 ${
                        commonView === view ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-500/10'
                      }`}
                    >
                      <ViewIcon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
              <PcTerminalLauncherBar
                errorTranslationKey={errorTranslationKey}
                onNotice={setActionNotice}
                onDone={() => void refresh()}
              />
              <PcTerminalGlobalCountdown className="ml-auto shrink-0" />
            </div>
            <p className="mt-0.5 hidden text-[11px] text-slate-500 sm:block">{t('terminal.windowsHint')}</p>
          </div>
          {commonView === 'desktop' ? (
            <div className="h-[52vh] min-h-[22rem] max-h-[38rem] bg-slate-950/[0.03] dark:bg-slate-950/40">
              <PcTerminalDesktopView />
            </div>
          ) : isMobile ? (
            <div
              ref={mobileListRef}
              className="relative flex flex-col p-3"
            >
              {(snapshot?.windows.length ?? 0) > 1 && renderMobileJumpBar()}
              {!snapshot?.windows.length ? (
                <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-dashed border-slate-500/25 p-6 text-center text-xs text-slate-400">
                  {loading ? t('common.loading') : t('terminal.empty')}
                </div>
              ) : (
                <>
                  {onlineWindows.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {onlineWindows.map((windowInfo) => renderGridWindowCard(windowInfo))}
                    </div>
                  )}
                  {offlineWindows.length > 0 && (
                    <div className={`grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2 ${
                      onlineWindows.length ? 'border-t border-slate-500/15' : ''
                    }`}>
                      {renderRemoveOfflineBar()}
                      {offlineWindows.map((windowInfo) => renderGridWindowCard(windowInfo, true))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
          <div className="flex h-[52vh] min-h-[22rem] max-h-[38rem] flex-col overflow-hidden bg-slate-950/[0.03] dark:bg-slate-950/40">
            <div ref={canvasRef} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            <div
              className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
              style={{
                backgroundImage: 'linear-gradient(to right, rgb(100 116 139 / 0.18) 1px, transparent 1px), linear-gradient(to bottom, rgb(100 116 139 / 0.18) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
            {!onlineWindows.length ? (
              <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-xs text-slate-400">
                {loading
                  ? t('common.loading')
                  : t(snapshot?.windows.length ? 'terminal.offline' : 'terminal.empty')}
              </div>
            ) : (
            <div className="relative flex flex-col" style={{ gap: TILE_GRID_GAP_PX, padding: CANVAS_PADDING_PX }}>
            {tileRows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="grid"
              style={{ gap: TILE_GRID_GAP_PX, gridTemplateColumns: `repeat(${row.columns}, minmax(0, 1fr))` }}
            >
            {row.items.map((windowInfo) => {
              const selected = windowInfo.terminal_number === selectedTerminalNumber;
              const busy = actionWindowId === windowInfo.id;
              const mappedWidth = (gridInnerWidth - TILE_GRID_GAP_PX * (row.columns - 1)) / row.columns;
              const mappedHeight = mappedWidth / TILE_ASPECT_RATIO;
              const compact = mappedWidth < 180;
              const tiny = mappedWidth < 110;
              const titleBarHeight = Math.min(30, Math.max(18, mappedHeight * 0.22));
              const screenshotImage = terminalViewFor(windowInfo);
              return (
                <article
                  key={windowInfo.terminal_number}
                  ref={frames.refFor(windowInfo.id)}
                  className={`relative aspect-[4/3] min-w-0 overflow-hidden rounded-lg border shadow-sm transition-all ${
                    selected
                      ? 'z-30 border-indigo-500 bg-indigo-500/20 ring-2 ring-indigo-500/20'
                      : windowInfo.active
                        ? 'z-20 border-emerald-500/70 bg-emerald-500/15'
                        : 'z-10 border-slate-500/40 bg-white/80 hover:border-indigo-400 dark:bg-slate-900/80'
                  } ${windowInfo.online ? '' : 'border-dashed'}`}
                >
                  <div className="flex h-full min-h-0 flex-col">
                    <div
                      className="z-10 flex shrink-0 items-center gap-1 border-b border-slate-500/20 bg-slate-900 px-1 text-white"
                      style={{ height: titleBarHeight }}
                    >
                      <button
                        type="button"
                        onClick={() => selectTerminal(windowInfo.terminal_number)}
                        className="flex min-w-0 flex-1 items-center gap-1 text-left focus:outline-none"
                        aria-label={t('terminal.selectWindow', {
                          number: windowInfo.terminal_number,
                        })}
                        title={t('terminal.coordinates', {
                          x: windowInfo.rect.x,
                          y: windowInfo.rect.y,
                          width: windowInfo.rect.width,
                          height: windowInfo.rect.height,
                        })}
                      >
                        <Terminal className="h-3 w-3 shrink-0 text-indigo-300" />
                        <span className="shrink-0 font-mono text-[9px] text-indigo-200">
                          #{windowInfo.terminal_number}
                        </span>
                        <span className="truncate text-[10px] font-semibold">
                          {terminalName(windowInfo, t('terminal.untitled'))}
                        </span>
                        <PcTerminalStatusMarks windowInfo={windowInfo} hasDraft={hasLocalDraft(windowInfo.terminal_number)} />
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          windowInfo.online ? 'bg-emerald-400' : 'bg-slate-400'
                        }`} />
                      </button>
                      {windowInfo.online && (
                        <button
                          type="button"
                          onClick={() => {
                            selectTerminal(windowInfo.terminal_number);
                            void activate(windowInfo.id);
                          }}
                          disabled={busy || !snapshot?.supported || windowInfo.controllable === false}
                          className="inline-flex h-4 shrink-0 items-center justify-center gap-1 rounded bg-indigo-600 px-1 text-[8px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                          aria-label={`${t('terminal.activate')}: ${terminalName(windowInfo, t('terminal.untitled'))}`}
                        >
                          {busy
                            ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            : <MousePointer2 className="h-2.5 w-2.5" />}
                          {!compact && <span>{t('terminal.activate')}</span>}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        selectTerminal(windowInfo.terminal_number);
                        setPreviewTerminalNumber(windowInfo.terminal_number);
                      }}
                      className="group relative min-h-0 flex-1 overflow-hidden bg-slate-950/80 text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                      aria-label={t('terminal.previewScreenshot', {
                        number: windowInfo.terminal_number,
                      })}
                    >
                      {screenshotImage ? (
                        <>
                          <PcTerminalFrameView
                            view={screenshotImage}
                            alt={terminalName(windowInfo, t('terminal.untitled'))}
                            size={compact ? 'tiny' : 'card'}
                          />
                          {!tiny && (
                            <Maximize2 className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded bg-slate-950/70 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                          )}
                        </>
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[9px]">
                          {t(windowInfo.online ? 'terminal.previewUnavailable' : 'terminal.offline')}
                        </span>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
            </div>
            ))}
            </div>
            )}
            </div>
            {offlineWindows.length > 0 && (
              <div className="relative z-40 shrink-0 border-t border-slate-500/15 bg-slate-100/80 p-3 dark:bg-slate-950/70">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
                  {renderRemoveOfflineBar()}
                  {offlineWindows.map((windowInfo) => renderGridWindowCard(windowInfo, true))}
                </div>
              </div>
            )}
          </div>
          )}
        </section>

        {/* Phones operate a terminal from its preview dialog; the side panel would mislead there. */}
        {!isMobile && (
          <section className="pc-glass h-fit">
            <div className="flex items-center gap-2 rounded-t-2xl bg-slate-900 px-3 py-2">{renderNavControls()}</div>
            {renderOperationPanel(false)}
          </section>
        )}
      </div>

      {actionNotice && (
        <div className={`flex items-start gap-2 text-xs rounded-2xl p-3 border ${
          actionNotice.kind === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
        }`}>
          {actionNotice.kind === 'success'
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <div className="min-w-0 flex-1">
            <span>{t(actionNotice.translationKey, actionNotice.translationValues)}</span>
            {actionNotice.responseJson && (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950/10 p-2 font-mono text-[10px] text-slate-700 dark:bg-black/20 dark:text-slate-200">
                {actionNotice.responseJson}
              </pre>
            )}
          </div>
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Terminal className="w-5 h-5 text-indigo-500" />
            {t('terminal.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('terminal.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void clearAllScheduleEntries()}
            disabled={Boolean(actionWindowId)}
            title={t('terminal.scheduleClearAllHint')}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 disabled:opacity-50"
          >
            {actionWindowId === ALL_SCHEDULES_ACTION_ID
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <TimerOff className="h-4 w-4" />}
            {t('terminal.scheduleClearAll')}
          </button>
          <button
            type="button"
            onClick={() => void refresh(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </button>
        </div>
      </header>

      <section className="pc-glass px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {t('terminal.detected', {
            count: snapshot?.count || 0,
            online: snapshot?.online_count || 0,
            stored: snapshot?.stored_count || 0,
          })}
        </span>
        <span className="hidden text-slate-500 sm:inline">
          {t('terminal.platform')}: {snapshot?.platform || '-'}
        </span>
        <span className="hidden text-slate-500 sm:inline">
          {t('terminal.session')}: {snapshot?.session || '-'}
        </span>
        <span className={`inline-flex items-center gap-1 ${live ? 'text-emerald-500' : 'text-amber-500'}`}>
          <span className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          {t(live ? 'terminal.live' : 'terminal.unavailable')}
        </span>
      </section>

      {[snapshotError, snapshotNotice].filter(Boolean).map((translationKey) => (
        <div
          key={String(translationKey)}
          className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t(String(translationKey))}</span>
        </div>
      ))}

      <PcTerminalDesktopIntegration
        snapshot={snapshot}
        busyAction={integrationAction}
        errorTranslationKey={errorTranslationKey}
        onAction={(action) => void runDesktopIntegration(action)}
      />


      <PcTerminalSpecialStates terminalNames={terminalNames} />
      <PcTerminalAgentDoneToasts windows={snapshot?.windows ?? []} nameFor={agentToastName} onOpen={openTerminal} />

      <PcMachineSendDock
        tabs={[{
          id: 'terminal-backup',
          label: t('terminal.backup.title'),
          icon: <History className="h-3.5 w-3.5 shrink-0" />,
          content: <PcTerminalBackupPanel errorTranslationKey={errorTranslationKey} defaultExpanded />,
        }]}
      />

      {previewWindow && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-0 backdrop-blur-sm md:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('terminal.previewDialog', {
            number: previewWindow.terminal_number,
          })}
          onClick={closePreview}
        >
          <div
            className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-none border-white/15 bg-slate-950 shadow-2xl md:h-[94vh] md:rounded-2xl md:border"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
              {renderNavControls()}
              <p className="min-w-0 truncate text-sm font-semibold">
                #{previewWindow.terminal_number} · {terminalName(previewWindow, t('terminal.untitled'))}
              </p>
              {previewNextRunAt && (
                <p className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold text-amber-300">
                  <Timer className="h-3.5 w-3.5" />
                  {t('terminal.scheduleCountdown')} {formatScheduleCountdown(previewNextRunAt - nowMs)}
                </p>
              )}
              <p className="hidden min-w-0 flex-1 truncate text-right text-[10px] text-slate-400 lg:block">
                {t(previewDirectClick && previewWindow.online
                  ? 'terminal.directClickHint'
                  : 'terminal.previewTapToClose')}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                {previewWindow.online && (
                  <button
                    type="button"
                    onClick={() => setPreviewDirectClick((current) => !current)}
                    aria-pressed={previewDirectClick}
                    title={t('terminal.directClickModeHint')}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-semibold ${
                      previewDirectClick
                        ? 'border-indigo-400 bg-indigo-600 text-white'
                        : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    {t('terminal.directClickMode')}
                  </button>
                )}
                {previewWindow.online && !previewDirectClick && (
                  <div
                    className="flex h-8 items-center rounded-lg border border-white/15 bg-white/5 p-0.5 text-[10px] font-semibold"
                    role="radiogroup"
                    title={t('terminal.frameModeHint')}
                  >
                    {PREVIEW_VIEW_MODES.map(({ mode, icon: Icon }) => (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={previewViewMode === mode}
                        onClick={() => setPreviewViewMode(mode)}
                        className={`inline-flex h-full items-center gap-1 rounded-md px-2 ${
                          previewViewMode === mode ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {t(`terminal.frameMode.${mode}`)}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    selectTerminal(previewWindow.terminal_number);
                    setLogDialogOpen(true);
                  }}
                  disabled={!previewWindow.logs.length}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 text-[10px] font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-50"
                >
                  <ScrollText className="h-3.5 w-3.5" />
                  {t('terminal.logs.open')}
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                  aria-label={t('common.close')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <button
                  type="button"
                  onClick={closePreview}
                  title={t('terminal.previewBack')}
                  aria-label={t('terminal.previewBack')}
                  className="absolute left-2 top-2 z-10 inline-flex h-9 items-center gap-1 rounded-full border border-white/20 bg-slate-900/80 px-3 text-xs font-semibold text-slate-100 shadow-lg backdrop-blur hover:bg-slate-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('terminal.previewBack')}
                </button>
                {previewScreenshot ? (
                  <PcTerminalFrameView
                    view={previewScreenshot}
                    alt={terminalName(previewWindow, t('terminal.untitled'))}
                    size="preview"
                    onImageClick={clickPreview}
                    imageClassName={previewDirectClick && previewWindow.online ? 'cursor-crosshair' : 'cursor-zoom-out'}
                  />
                ) : (
                  <div className="flex h-full min-h-[6rem] items-center justify-center gap-2 text-xs text-slate-400">
                    {previewWindow.online && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t(previewWindow.online ? 'terminal.previewLoading' : 'terminal.offline')}
                  </div>
                )}
              </div>
              <section
                className={`dark flex shrink-0 flex-col border-t border-white/15 bg-slate-950/95 md:border-l md:border-t-0 ${
                  previewExpanded ? 'h-[52%] md:h-auto md:w-[26rem]' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={togglePreviewExpanded}
                  aria-expanded={previewExpanded}
                  aria-label={t(
                    previewExpanded
                      ? 'terminal.collapsePreviewOperations'
                      : 'terminal.expandPreviewOperations',
                  )}
                  className="flex h-7 shrink-0 items-center justify-end gap-2 whitespace-nowrap border-b border-white/10 px-3 text-[11px] font-semibold text-slate-400 hover:bg-white/5"
                >
                  <span className="inline-flex items-center gap-1">
                    {t(previewExpanded ? 'terminal.collapseOperations' : 'terminal.expandOperations')}
                    {previewExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                  </span>
                </button>
                {previewExpanded && (
                  <div className="min-h-0 flex-1 overflow-hidden">
                    {renderOperationPanel(true)}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {logDialogOpen && selectedWindow && (
        <PcTerminalLogDialog
          windowInfo={selectedWindow}
          formatDate={formatLogDate}
          errorTranslationKey={errorTranslationKey}
          onReuse={reuseLogContent}
          onResend={resendLogContent}
          onClose={closeLogDialog}
        />
      )}
    </div>
    </PcTerminalNavActionsProvider>
  );
};

// Node tabs on top: this machine first, then every other online pycore; the view below is the same for all.
const PcTerminalPage: React.FC = () => {
  const [nodeUrl, setNodeUrl] = useState<string | null>(readPcUiSessionTerminalNodeUrl);
  const selectNode = useCallback((url: string | null) => {
    setNodeUrl(url);
    updatePcUiSessionTerminalNodeUrl(url);
  }, []);
  const [searchSlot, setSearchSlot] = useState<HTMLElement | null>(null);

  return (
    <>
      <div className="flex items-center gap-2 px-3 pt-2 sm:px-6 md:px-8">
        <div className="min-w-0 max-w-[50%] shrink-0">
          <PcTerminalNodeTabs activeUrl={nodeUrl} onSelect={selectNode} />
        </div>
        <div ref={setSearchSlot} className="min-w-0 flex-1" />
        <PcPycoreRestartButton key={nodeUrl ?? 'primary'} http={pycoreNodeClient(nodeUrl).http} compact />
      </div>
      <PcTerminalApiProvider key={nodeUrl ?? 'primary'} nodeUrl={nodeUrl}>
        <PcTerminalWatchProvider>
          <PcTerminalNodeView searchSlot={searchSlot} nodeUrl={nodeUrl} />
        </PcTerminalWatchProvider>
      </PcTerminalApiProvider>
    </>
  );
};

export default PcTerminalPage;
