import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  CheckCircle2,
  ChevronsDown,
  ChevronsUp,
  Clock3,
  CornerDownLeft,
  Crosshair,
  Loader2,
  Maximize2,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  RefreshCw,
  Send,
  Terminal,
  Timer,
  TimerOff,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  completeTerminalScheduleClearAll,
  createTerminalScheduleEntryId,
  isTerminalScheduleClearAllPending,
  onHttpStatus,
  pycoreApi,
  readTerminalScheduleBackup,
  stageTerminalScheduleClearAll,
  terminalScheduleDefinitionMetadata,
  writeTerminalScheduleBackup,
} from '@/apps/pycore-manager/api';
import { useIsMobile } from '@/apps/pycore-manager/hooks/useIsMobile';
import type {
  TerminalActionResult,
  TerminalScheduleDefinition,
  TerminalScheduleEntry,
  TerminalSnapshot,
  TerminalWindowScreenshot,
  TerminalWindowInfo,
} from '@/apps/pycore-manager/api';


const POLL_INTERVAL_MS = 2000;
const DRAFT_SAVE_DELAY_MS = 500;
const CANVAS_PADDING_PX = 16;
const ALL_SCHEDULES_ACTION_ID = 'terminal:schedules:all';
/** Height reserved above the mobile terminal grid (top bar + page header). */
const MOBILE_GRID_OFFSET_REM = 15.5;
type TerminalScrollMode = 'page_up' | 'page_down' | 'bottom';
const SCROLL_SUCCESS_TRANSLATION_KEYS: Record<TerminalScrollMode, string> = {
  page_up: 'terminal.pageScrolledUp',
  page_down: 'terminal.pageScrolledDown',
  bottom: 'terminal.scrolledBottom',
};
const ERROR_TRANSLATION_KEYS: Record<string, string> = {
  wayland_global_control_unavailable: 'terminal.errors.wayland',
  graphical_session_unavailable: 'terminal.errors.graphicalSession',
  wmctrl_unavailable: 'terminal.errors.wmctrl',
  xdotool_unavailable: 'terminal.errors.xdotool',
  terminal_enumeration_failed: 'terminal.errors.enumeration',
  unsupported_platform: 'terminal.errors.unsupportedPlatform',
  terminal_window_not_found: 'terminal.errors.windowNotFound',
  terminal_window_id_required: 'terminal.errors.windowRequired',
  terminal_number_required: 'terminal.errors.numberRequired',
  terminal_state_not_found: 'terminal.errors.stateNotFound',
  terminal_text_required: 'terminal.errors.textRequired',
  terminal_text_too_long: 'terminal.errors.textTooLong',
  terminal_coordinates_unavailable: 'terminal.errors.coordinates',
  terminal_restore_failed: 'terminal.errors.restore',
  terminal_raise_failed: 'terminal.errors.raise',
  terminal_pointer_move_failed: 'terminal.errors.pointer',
  terminal_click_failed: 'terminal.errors.click',
  terminal_click_coordinates_invalid: 'terminal.errors.clickCoordinates',
  terminal_history_direction_invalid: 'terminal.errors.historyDirection',
  terminal_history_key_failed: 'terminal.errors.historyKey',
  terminal_scroll_mode_invalid: 'terminal.errors.scrollMode',
  terminal_scroll_failed: 'terminal.errors.scroll',
  terminal_screenshot_failed: 'terminal.errors.screenshot',
  terminal_right_click_failed: 'terminal.errors.rightClick',
  terminal_enter_failed: 'terminal.errors.enter',
  terminal_input_failed: 'terminal.errors.input',
  terminal_window_offline: 'terminal.errors.windowOffline',
  terminal_schedule_mode_invalid: 'terminal.errors.scheduleMode',
  terminal_schedule_time_invalid: 'terminal.errors.scheduleTime',
  terminal_schedule_interval_invalid: 'terminal.errors.scheduleInterval',
  terminal_schedule_entry_invalid: 'terminal.errors.scheduleEntry',
  terminal_schedule_entry_not_found: 'terminal.errors.scheduleEntry',
  clipboard_write_failed: 'terminal.errors.clipboardWrite',
  clipboard_restore_failed: 'terminal.errors.clipboardRestore',
  request_failed: 'terminal.errors.request',
};

interface ActionNotice {
  kind: 'success' | 'error';
  translationKey: string;
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

function terminalName(windowInfo: TerminalWindowInfo, fallback: string): string {
  return windowInfo.title || windowInfo.app || fallback;
}

function terminalDraftKey(terminalNumber: number): string {
  return String(terminalNumber);
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
const SCHEDULE_EDITOR_STORAGE_KEY = 'pc.terminal.scheduleEditor.v1';

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
    const raw = window.localStorage.getItem(SCHEDULE_EDITOR_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
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

function replaceTerminalScreenshot(
  snapshot: TerminalSnapshot | null,
  windowId: string,
  screenshot: TerminalWindowScreenshot,
): TerminalSnapshot | null {
  if (!snapshot) return snapshot;
  return {
    ...snapshot,
    windows: snapshot.windows.map((windowInfo) => (
      windowInfo.id === windowId
        ? { ...windowInfo, screenshot }
        : windowInfo
    )),
  };
}

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
    backendById.get(definition.id)
    || terminalScheduleDefinitionMetadata(
      definition,
      currentById.get(definition.id),
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

function overlayTerminalScheduleBackups(snapshot: TerminalSnapshot): TerminalSnapshot {
  let nextSnapshot: TerminalSnapshot | null = snapshot;
  snapshot.windows.forEach((windowInfo) => {
    const backup = readTerminalScheduleBackup(windowInfo.terminal_number);
    if (!backup) return;
    nextSnapshot = replaceTerminalScheduleQueue(
      nextSnapshot,
      windowInfo.terminal_number,
      backup.entries,
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

const PcTerminalPage: React.FC = () => {
  const { t } = useTranslation('pc');
  const isMobile = useIsMobile();
  const [snapshot, setSnapshot] = useState<TerminalSnapshot | null>(null);
  const [selectedTerminalNumber, setSelectedTerminalNumber] = useState<number | null>(null);
  const [previewTerminalNumber, setPreviewTerminalNumber] = useState<number | null>(null);
  const [previewExpandedStates, setPreviewExpandedStates] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftStatuses, setDraftStatuses] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [selectedLogId, setSelectedLogId] = useState('');
  const [selectedLogContent, setSelectedLogContent] = useState('');
  const [logContentLoading, setLogContentLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionWindowId, setActionWindowId] = useState('');
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });
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
    ReturnType<typeof pycoreApi.syncTerminalScheduleEntries>
  >>(new Map());
  const scheduleClearAllInProgressRef = useRef(false);

  const errorTranslationKey = useCallback((errorCode?: string | null) => (
    ERROR_TRANSLATION_KEYS[String(errorCode || '')] || 'terminal.errors.unknown'
  ), []);

  const persistDraft = useCallback(async (terminalNumber: number, text: string) => {
    const key = terminalDraftKey(terminalNumber);
    setDraftStatuses((current) => ({ ...current, [key]: 'saving' }));
    try {
      const result = await pycoreApi.saveTerminalDraft(terminalNumber, text);
      if (!result.success) throw new Error(String(result.error_code || 'request_failed'));
      if (draftsRef.current[key] === text) {
        dirtyDraftsRef.current.delete(terminalNumber);
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
    setDraftStatuses((current) => ({ ...current, [key]: 'saving' }));
    draftTimersRef.current[key] = window.setTimeout(() => {
      delete draftTimersRef.current[key];
      void persistDraft(terminalNumber, text);
    }, DRAFT_SAVE_DELAY_MS);
  }, [persistDraft]);

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

  const initializeTerminalScheduleBackup = useCallback(async (
    windowInfo: TerminalWindowInfo,
  ) => {
    const terminalNumber = windowInfo.terminal_number;
    if (readTerminalScheduleBackup(terminalNumber)) return;
    const definitions = await Promise.all(
      (windowInfo.schedule_queue || []).map(async (entry) => ({
        id: entry.id,
        mode: entry.mode,
        run_at: entry.mode === 'once'
          ? Number(entry.run_at || entry.next_run_at || 0)
          : 0,
        interval_seconds: entry.mode === 'interval' ? entry.interval_seconds : 0,
        message: await pycoreApi.getTerminalContent(
          terminalNumber,
          'schedule',
          '',
          entry.id,
        ),
      })),
    );
    if (!readTerminalScheduleBackup(terminalNumber)) {
      writeTerminalScheduleBackup(terminalNumber, definitions);
    }
  }, []);

  const syncTerminalScheduleBackup = useCallback(async (
    terminalNumber: number,
  ) => {
    const backup = readTerminalScheduleBackup(terminalNumber);
    if (
      !backup
      || scheduleClearAllInProgressRef.current
      || scheduleSyncInFlightRef.current.has(terminalNumber)
    ) return null;
    const request = pycoreApi.syncTerminalScheduleEntries(
      terminalNumber,
      backup.entries,
    );
    scheduleSyncInFlightRef.current.set(terminalNumber, request);
    try {
      const result = await request;
      const currentBackup = readTerminalScheduleBackup(terminalNumber);
      if (
        result.success
        && currentBackup?.updated_at === backup.updated_at
        && mountedRef.current
      ) {
        setSnapshot((current) => replaceTerminalScheduleQueue(
          current,
          terminalNumber,
          currentBackup.entries,
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

  const reconcileScheduleBackups = useCallback(async (
    windows: TerminalWindowInfo[],
  ) => {
    if (isTerminalScheduleClearAllPending()) {
      windows.forEach((windowInfo) => {
        if (!readTerminalScheduleBackup(windowInfo.terminal_number)) {
          writeTerminalScheduleBackup(windowInfo.terminal_number, []);
        }
      });
      const clearResult = await pycoreApi.clearTerminalScheduleEntries()
        .catch(() => null);
      if (clearResult?.success) completeTerminalScheduleClearAll();
    }
    await Promise.all(windows.map((windowInfo) => (
      initializeTerminalScheduleBackup(windowInfo).catch(() => undefined)
    )));
    windows.forEach((windowInfo) => {
      const terminalNumber = windowInfo.terminal_number;
      const backup = readTerminalScheduleBackup(terminalNumber);
      if (!backup) return;
      const activeEntries = backup.entries.filter(
        (entry) => entry.mode === 'interval' || entry.run_at > Date.now(),
      );
      if (activeEntries.length !== backup.entries.length) {
        writeTerminalScheduleBackup(terminalNumber, activeEntries);
      }
      void syncTerminalScheduleBackup(terminalNumber).catch(() => undefined);
    });
  }, [initializeTerminalScheduleBackup, syncTerminalScheduleBackup]);

  const refresh = useCallback(async (showLoading = false) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const nextSnapshot = await pycoreApi.getTerminalWindows();
      if (!mountedRef.current) return;
      await reconcileScheduleBackups(nextSnapshot.windows);
      if (!mountedRef.current) return;
      setSnapshot(overlayTerminalScheduleBackups(nextSnapshot));
      setSelectedTerminalNumber((current) => (
        nextSnapshot.windows.some(
          (windowInfo) => windowInfo.terminal_number === current,
        )
          ? current
          : nextSnapshot.windows[0]?.terminal_number || null
      ));
    } catch {
      if (!mountedRef.current) return;
      setSnapshot((current) => current ? {
        ...current,
        success: false,
        error_code: 'request_failed',
      } : {
        success: false,
        platform: '',
        session: '',
        supported: false,
        error_code: 'request_failed',
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
  }, [reconcileScheduleBackups]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh(true);
    const pollTimer = window.setInterval(() => void refresh(false), POLL_INTERVAL_MS);
    return () => {
      Object.values(draftTimersRef.current).forEach((timer) => {
        window.clearTimeout(timer as number);
      });
      dirtyDraftsRef.current.forEach((terminalNumber) => {
        const key = terminalDraftKey(terminalNumber);
        void pycoreApi.saveTerminalDraft(terminalNumber, draftsRef.current[key] || '');
      });
      mountedRef.current = false;
      window.clearInterval(pollTimer);
    };
  }, [refresh]);

  useEffect(() => onHttpStatus((connected) => {
    if (connected) void refresh(false);
  }), [refresh]);

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
  }, [isMobile]);

  const selectedWindow = useMemo(() => (
    snapshot?.windows.find(
      (windowInfo) => windowInfo.terminal_number === selectedTerminalNumber,
    ) || null
  ), [selectedTerminalNumber, snapshot]);
  const previewWindow = useMemo(() => (
    snapshot?.windows.find(
      (windowInfo) => windowInfo.terminal_number === previewTerminalNumber,
    ) || null
  ), [previewTerminalNumber, snapshot]);
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
  const previewExpanded = previewWindow
    ? (
      Object.prototype.hasOwnProperty.call(
        previewExpandedStates,
        previewExpandedKey,
      )
        ? previewExpandedStates[previewExpandedKey]
        : previewWindow.preview_expanded
    )
    : false;
  const selectedDraftKey = selectedWindow
    ? terminalDraftKey(selectedWindow.terminal_number)
    : '';
  const selectedDraft = selectedDraftKey ? drafts[selectedDraftKey] || '' : '';
  const selectedDraftStatus = selectedDraftKey
    ? draftStatuses[selectedDraftKey]
    : undefined;
  const selectedLog = selectedWindow?.logs.find(
    (logEntry) => logEntry.id === selectedLogId,
  ) || null;
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
  const desktopBounds = useMemo(
    () => calculateDesktopBounds(onlineWindows),
    [onlineWindows],
  );
  const canvasLayout = useMemo(
    () => calculateCanvasLayout(desktopBounds, canvasSize),
    [canvasSize, desktopBounds],
  );

  useEffect(() => {
    if (!selectedWindow) return;
    const terminalNumber = selectedWindow.terminal_number;
    const key = terminalDraftKey(terminalNumber);
    if (loadedDraftsRef.current.has(terminalNumber)) return;
    loadedDraftsRef.current.add(terminalNumber);
    if (!selectedWindow.has_draft) {
      draftsRef.current = { ...draftsRef.current, [key]: '' };
      setDrafts(draftsRef.current);
      setDraftStatuses((current) => ({ ...current, [key]: 'saved' }));
      return;
    }
    setDraftStatuses((current) => ({ ...current, [key]: 'saving' }));
    void pycoreApi.getTerminalContent(terminalNumber, 'draft')
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
  }, [selectedWindow]);

  useEffect(() => {
    const logs = selectedWindow?.logs || [];
    setSelectedLogId((current) => (
      logs.some((logEntry) => logEntry.id === current)
        ? current
        : logs[0]?.id || ''
    ));
  }, [selectedWindow]);

  // The schedule editor (mode / time / interval) is global and shared by every
  // terminal; persist the last selection so all terminals inherit it.
  useEffect(() => {
    try {
      window.localStorage.setItem(SCHEDULE_EDITOR_STORAGE_KEY, JSON.stringify({
        mode: scheduleMode,
        timeText: scheduleTimeText,
        intervalText: scheduleIntervalText,
      }));
    } catch {
      // localStorage unavailable; in-memory sharing still applies.
    }
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

  useEffect(() => {
    let cancelled = false;
    if (!selectedWindow || !selectedLogId) {
      setSelectedLogContent('');
      return undefined;
    }
    const terminalNumber = selectedWindow.terminal_number;
    setLogContentLoading(true);
    void pycoreApi.getTerminalContent(terminalNumber, 'log', selectedLogId)
      .then((content) => {
        if (mountedRef.current && !cancelled) setSelectedLogContent(content);
      })
      .catch(() => {
        if (mountedRef.current && !cancelled) setSelectedLogContent('');
      })
      .finally(() => {
        if (mountedRef.current && !cancelled) setLogContentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLogId, selectedWindow?.terminal_number]);

  const runAction = useCallback(async (
    windowId: string,
    action: () => Promise<TerminalActionResult>,
    successTranslationKey: string,
  ) => {
    setActionWindowId(windowId);
    setActionNotice(null);
    try {
      const result = await action();
      if (result.screenshot) {
        setSnapshot((current) => replaceTerminalScreenshot(
          current,
          windowId,
          result.screenshot as TerminalWindowScreenshot,
        ));
      }
      if (result.success) {
        setActionNotice({ kind: 'success', translationKey: successTranslationKey });
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
      setActionWindowId('');
      void refresh(false);
    }
  }, [errorTranslationKey, refresh]);

  const commitTerminalScheduleDefinitions = useCallback(async (
    windowInfo: TerminalWindowInfo,
    definitions: TerminalScheduleDefinition[],
    successTranslationKey: string,
  ) => {
    const terminalNumber = windowInfo.terminal_number;
    writeTerminalScheduleBackup(terminalNumber, definitions);
    setSnapshot((current) => replaceTerminalScheduleQueue(
      current,
      terminalNumber,
      definitions,
    ));
    setActionWindowId(windowInfo.id);
    setActionNotice(null);
    try {
      const result = await syncTerminalScheduleBackup(terminalNumber);
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
  }, [errorTranslationKey, syncTerminalScheduleBackup]);

  const clearAllScheduleEntries = useCallback(async () => {
    const terminalNumbers = (snapshot?.windows || []).map(
      (windowInfo) => windowInfo.terminal_number,
    );
    scheduleClearAllInProgressRef.current = true;
    stageTerminalScheduleClearAll(terminalNumbers);
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
      const result = await pycoreApi.clearTerminalScheduleEntries();
      if (result.success) {
        completeTerminalScheduleClearAll();
        setActionNotice({
          kind: 'success',
          translationKey: 'terminal.scheduleAllCleared',
        });
      } else {
        setActionNotice({
          kind: 'success',
          translationKey: 'terminal.scheduleClearSavedLocally',
        });
      }
    } catch {
      setActionNotice({
        kind: 'success',
        translationKey: 'terminal.scheduleClearSavedLocally',
      });
    } finally {
      scheduleClearAllInProgressRef.current = false;
      setActionWindowId('');
    }
  }, [snapshot?.windows]);

  const activate = useCallback((windowId: string) => runAction(
    windowId,
    () => pycoreApi.activateTerminal(windowId),
    'terminal.activated',
  ), [runAction]);

  const navigateHistory = useCallback((direction: 'up' | 'down') => {
    if (!selectedWindow?.online) return;
    void runAction(
      selectedWindow.id,
      () => pycoreApi.navigateTerminalHistory(selectedWindow.id, direction),
      direction === 'up'
        ? 'terminal.historyNavigatedUp'
        : 'terminal.historyNavigatedDown',
    );
  }, [runAction, selectedWindow]);

  const scrollTerminal = useCallback((mode: TerminalScrollMode) => {
    if (!selectedWindow?.online) return;
    void runAction(
      selectedWindow.id,
      () => pycoreApi.scrollTerminal(selectedWindow.id, mode),
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
    void pycoreApi.saveTerminalViewState(terminalNumber, nextExpanded)
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
    if (
      !previewWindow?.online
      || !previewWindow.screenshot
      || actionWindowId
    ) {
      return;
    }
    const point = normalizedImagePoint(
      event,
      previewWindow.screenshot.width,
      previewWindow.screenshot.height,
    );
    if (!point) return;
    void runAction(
      previewWindow.id,
      () => pycoreApi.clickTerminal(
        previewWindow.id,
        point.horizontalRatio,
        point.verticalRatio,
      ),
      'terminal.clicked',
    );
  }, [actionWindowId, previewWindow, runAction]);

  const selectTerminal = useCallback((terminalNumber: number) => {
    if (
      selectedTerminalNumber !== null
      && selectedTerminalNumber !== terminalNumber
    ) {
      flushDraft(selectedTerminalNumber);
    }
    setSelectedTerminalNumber(terminalNumber);
  }, [flushDraft, selectedTerminalNumber]);

  const updateSelectedDraft = useCallback((text: string) => {
    if (!selectedWindow) return;
    const terminalNumber = selectedWindow.terminal_number;
    const key = terminalDraftKey(terminalNumber);
    draftsRef.current = { ...draftsRef.current, [key]: text };
    setDrafts(draftsRef.current);
    scheduleDraftSave(terminalNumber, text);
  }, [scheduleDraftSave, selectedWindow]);

  // Sends the current draft (or an explicit override such as '' for an
  // Enter-only submission); empty text is valid and presses Enter remotely.
  const sendInput = useCallback(async (textOverride?: string) => {
    if (!selectedWindow || !selectedWindow.online) return;
    const payload = textOverride === undefined ? selectedDraft : textOverride;
    const terminalNumber = selectedWindow.terminal_number;
    const key = terminalDraftKey(terminalNumber);
    const activeTimer = draftTimersRef.current[key];
    if (activeTimer) {
      window.clearTimeout(activeTimer);
      delete draftTimersRef.current[key];
    }
    const result = await runAction(
      selectedWindow.id,
      () => pycoreApi.inputTerminalText(
        selectedWindow.id,
        terminalNumber,
        payload,
      ),
      'terminal.sent',
    );
    if (result?.log?.id) {
      setSelectedLogId(result.log.id);
      dirtyDraftsRef.current.delete(terminalNumber);
      setDraftStatuses((current) => ({ ...current, [key]: 'saved' }));
    } else if (!result?.success) {
      void persistDraft(terminalNumber, payload);
    }
    if (result?.success) {
      draftsRef.current = { ...draftsRef.current, [key]: '' };
      setDrafts(draftsRef.current);
      setDraftStatuses((current) => ({ ...current, [key]: 'saved' }));
    }
  }, [persistDraft, runAction, selectedDraft, selectedWindow]);

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
    await initializeTerminalScheduleBackup(selectedWindow).catch(() => undefined);
    const backup = readTerminalScheduleBackup(terminalNumber);
    if (!backup) {
      setActionNotice({ kind: 'error', translationKey: 'terminal.errors.request' });
      return;
    }
    const entryPayload: TerminalScheduleDefinition = {
      id: isUpdate ? editingEntryId : createTerminalScheduleEntryId(),
      mode: scheduleMode,
      run_at: scheduleMode === 'once' ? runAt : 0,
      interval_seconds: scheduleMode === 'interval' ? intervalSeconds : 0,
      message,
    };
    const definitions = isUpdate
      ? backup.entries.map((entry) => (
        entry.id === editingEntryId ? entryPayload : entry
      ))
      : [...backup.entries, entryPayload];
    await commitTerminalScheduleDefinitions(
      selectedWindow,
      definitions,
      isUpdate ? 'terminal.scheduleEntryUpdated' : 'terminal.scheduleEntryAdded',
    );
    setEditingSchedule(null);
  }, [
    commitTerminalScheduleDefinitions,
    editingSchedule,
    initializeTerminalScheduleBackup,
    scheduleIntervalText,
    scheduleMode,
    scheduleTimeText,
    selectedDraft,
    selectedWindow,
  ]);

  const removeScheduleEntry = useCallback(async (entryId: string) => {
    if (!selectedWindow) return;
    const terminalNumber = selectedWindow.terminal_number;
    await initializeTerminalScheduleBackup(selectedWindow).catch(() => undefined);
    const backup = readTerminalScheduleBackup(terminalNumber);
    if (!backup) {
      setActionNotice({ kind: 'error', translationKey: 'terminal.errors.request' });
      return;
    }
    await commitTerminalScheduleDefinitions(
      selectedWindow,
      backup.entries.filter((entry) => entry.id !== entryId),
      'terminal.scheduleEntryRemoved',
    );
  }, [
    commitTerminalScheduleDefinitions,
    initializeTerminalScheduleBackup,
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
    if (!entry.has_message) {
      updateSelectedDraft('');
      return;
    }
    void pycoreApi.getTerminalContent(terminalNumber, 'schedule', '', entry.id)
      .then((content) => {
        if (mountedRef.current) updateSelectedDraft(content);
      })
      .catch(() => {
        if (mountedRef.current) {
          setActionNotice({ kind: 'error', translationKey: 'terminal.errors.request' });
        }
      });
  }, [actionWindowId, selectedWindow, updateSelectedDraft]);

  const renderOperationPanel = (overlay: boolean) => (
    <div className={`space-y-4 ${overlay ? 'h-full overflow-y-auto p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {t('terminal.inputTitle')}
          </h2>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {selectedWindow
              ? `#${selectedWindow.terminal_number} · ${terminalName(selectedWindow, t('terminal.untitled'))}`
              : t('terminal.selectPrompt')}
          </p>
          {selectedWindow && (
            <p className={`mt-1 text-[10px] ${
              selectedWindow.online ? 'text-emerald-500' : 'text-slate-500'
            }`}>
              {t(selectedWindow.online ? 'terminal.online' : 'terminal.offline')}
            </p>
          )}
        </div>
        {selectedWindow?.online && (
          <button
            type="button"
            onClick={() => void activate(selectedWindow.id)}
            disabled={Boolean(actionWindowId) || !snapshot?.supported}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-indigo-500 hover:bg-indigo-500/20 disabled:opacity-50"
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            {t('terminal.activate')}
          </button>
        )}
      </div>
      <textarea
        value={selectedDraft}
        onChange={(event) => updateSelectedDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            void sendInput();
          }
        }}
        disabled={!selectedWindow}
        rows={overlay ? 6 : 8}
        placeholder={t('terminal.inputPlaceholder')}
        className="w-full resize-y rounded-xl border border-slate-500/20 bg-white/60 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:bg-slate-950/40 dark:text-slate-100"
      />
      {selectedWindow && (
        <p className={`text-[10px] ${
          selectedDraftStatus === 'error'
            ? 'text-rose-500'
            : selectedDraftStatus === 'saving'
              ? 'text-amber-500'
              : 'text-emerald-500'
        }`}>
          {t(
            selectedDraftStatus === 'error'
              ? 'terminal.draftSaveFailed'
              : selectedDraftStatus === 'saving'
                ? 'terminal.draftSaving'
                : 'terminal.draftSaved',
          )}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => navigateHistory('up')}
          disabled={
            !selectedWindow?.online
            || Boolean(actionWindowId)
            || !snapshot?.supported
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2.5 text-xs font-semibold text-indigo-500 hover:bg-indigo-500/20 disabled:opacity-50"
        >
          <ArrowUp className="h-4 w-4" />
          {t('terminal.previousCommand')}
        </button>
        <button
          type="button"
          onClick={() => navigateHistory('down')}
          disabled={
            !selectedWindow?.online
            || Boolean(actionWindowId)
            || !snapshot?.supported
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2.5 text-xs font-semibold text-indigo-500 hover:bg-indigo-500/20 disabled:opacity-50"
        >
          <ArrowDown className="h-4 w-4" />
          {t('terminal.nextCommand')}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => scrollTerminal('page_up')}
          disabled={
            !selectedWindow?.online
            || Boolean(actionWindowId)
            || !snapshot?.supported
          }
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-2 py-2.5 text-[10px] font-semibold text-cyan-600 hover:bg-cyan-500/20 disabled:opacity-50 dark:text-cyan-400"
        >
          <ChevronsUp className="h-4 w-4" />
          {t('terminal.pageUp')}
        </button>
        <button
          type="button"
          onClick={() => scrollTerminal('page_down')}
          disabled={
            !selectedWindow?.online
            || Boolean(actionWindowId)
            || !snapshot?.supported
          }
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-2 py-2.5 text-[10px] font-semibold text-cyan-600 hover:bg-cyan-500/20 disabled:opacity-50 dark:text-cyan-400"
        >
          <ChevronsDown className="h-4 w-4" />
          {t('terminal.pageDown')}
        </button>
        <button
          type="button"
          onClick={() => scrollTerminal('bottom')}
          disabled={
            !selectedWindow?.online
            || Boolean(actionWindowId)
            || !snapshot?.supported
          }
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-2 py-2.5 text-[10px] font-semibold text-cyan-600 hover:bg-cyan-500/20 disabled:opacity-50 dark:text-cyan-400"
        >
          <ArrowDownToLine className="h-4 w-4" />
          {t('terminal.scrollBottom')}
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void sendInput('')}
          disabled={
            !selectedWindow?.online
            || Boolean(actionWindowId)
            || !snapshot?.supported
          }
          title={t('terminal.sendEnterHint')}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-600 px-4 py-3 text-xs font-bold text-white hover:bg-slate-500 disabled:opacity-50"
        >
          {actionWindowId === selectedWindow?.id
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <CornerDownLeft className="h-4 w-4" />}
          {t('terminal.sendEnter')}
        </button>
        <button
          type="button"
          onClick={() => void sendInput()}
          disabled={
            !selectedWindow?.online
            || Boolean(actionWindowId)
            || !snapshot?.supported
          }
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {actionWindowId === selectedWindow?.id
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Send className="h-4 w-4" />}
          {t('terminal.send')}
        </button>
      </div>
      {selectedWindow && (
        <div className="space-y-2.5 rounded-xl border border-slate-500/15 bg-white/40 p-3 dark:bg-slate-950/20">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
              <Timer className="h-3.5 w-3.5 text-indigo-500" />
              {t('terminal.scheduleTitle')}
            </h3>
            {selectedScheduleQueue.length > 0 && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-500">
                {t('terminal.scheduleQueueCount', { count: selectedScheduleQueue.length })}
              </span>
            )}
          </div>
          <div className="space-y-1 text-[10px] text-slate-500 dark:text-slate-400">
            <p>{t('terminal.scheduleNow')}: {new Date(nowMs).toLocaleString()}</p>
            <p className={nextQueueRunAt ? 'font-semibold text-indigo-500' : ''}>
              {t('terminal.scheduleNextRun')}: {
                nextQueueRunAt
                  ? `${formatScheduleTime(nextQueueRunAt)} · ${t('terminal.scheduleCountdown')} ${formatScheduleCountdown(nextQueueRunAt - nowMs)}`
                  : t('terminal.scheduleNone')
              }
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-600 dark:text-slate-300">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                checked={scheduleMode === 'once'}
                onChange={() => setScheduleMode('once')}
                className="accent-indigo-500"
              />
              {t('terminal.scheduleModeOnce')}
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                checked={scheduleMode === 'interval'}
                onChange={() => setScheduleMode('interval')}
                className="accent-indigo-500"
              />
              {t('terminal.scheduleModeInterval')}
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-500">
              {t('terminal.scheduleQuick')}:
            </span>
            {QUICK_SCHEDULE_DELAYS.map((delay) => (
              <button
                key={delay.label}
                type="button"
                onClick={() => applyQuickScheduleDelay(delay.seconds)}
                className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[9px] font-semibold text-indigo-500 hover:bg-indigo-500/20"
              >
                {delay.label}
              </button>
            ))}
          </div>
          {scheduleMode === 'once' ? (
            <input
              type="datetime-local"
              value={scheduleTimeText}
              onChange={(event) => setScheduleTimeText(event.target.value)}
              aria-label={t('terminal.scheduleTimeLabel')}
              className="w-full rounded-lg border border-slate-500/20 bg-white/60 px-2.5 py-1.5 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950/40 dark:text-slate-100"
            />
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={scheduleIntervalText}
                onChange={(event) => setScheduleIntervalText(event.target.value)}
                aria-label={t('terminal.scheduleIntervalLabel')}
                className="w-24 rounded-lg border border-slate-500/20 bg-white/60 px-2.5 py-1.5 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950/40 dark:text-slate-100"
              />
              <span className="text-[10px] text-slate-500">
                {t('terminal.scheduleIntervalLabel')}
              </span>
            </div>
          )}
          {editingSchedule
            && editingSchedule.terminalNumber === selectedWindow.terminal_number && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              <span className="min-w-0 truncate">
                {t('terminal.scheduleEditingHint')}
              </span>
              <button
                type="button"
                onClick={() => setEditingSchedule(null)}
                disabled={Boolean(actionWindowId)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 hover:bg-amber-500/25 disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                {t('terminal.scheduleEditCancel')}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => void addScheduleEntry()}
            disabled={Boolean(actionWindowId)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            <Timer className="h-3.5 w-3.5" />
            {editingSchedule
              && editingSchedule.terminalNumber === selectedWindow.terminal_number
              ? t('terminal.scheduleUpdate')
              : t('terminal.scheduleAdd')}
          </button>
          {selectedScheduleQueue.length > 0 && (
            <div className={`${overlay ? 'max-h-32' : 'max-h-40'} space-y-1.5 overflow-y-auto pr-0.5`}>
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
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors hover:border-indigo-400/40 dark:hover:border-indigo-400/40 ${
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
          <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t('terminal.scheduleHint')}
          </p>
        </div>
      )}
      <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
        {t('terminal.inputSequence')}
      </p>
      <p className="text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
        {t('terminal.rightClickHint')}
      </p>

      <div className="space-y-3 border-t border-slate-500/10 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
            <Clock3 className="h-3.5 w-3.5 text-indigo-500" />
            {t('terminal.historyTitle')}
          </h3>
          <span className="text-[10px] text-slate-500">
            {t('terminal.historyCount', { count: selectedWindow?.log_count || 0 })}
          </span>
        </div>
        {!selectedWindow?.logs.length ? (
          <p className="rounded-xl border border-dashed border-slate-500/20 p-4 text-center text-[11px] text-slate-500">
            {t('terminal.historyEmpty')}
          </p>
        ) : (
          <div className={`${overlay ? 'max-h-40' : 'max-h-52'} space-y-2 overflow-y-auto pr-1`}>
            {selectedWindow.logs.map((logEntry) => (
              <button
                key={logEntry.id}
                type="button"
                onClick={() => setSelectedLogId(logEntry.id)}
                className={`w-full rounded-xl border p-2.5 text-left transition-colors ${
                  selectedLogId === logEntry.id
                    ? 'border-indigo-500/50 bg-indigo-500/10'
                    : 'border-slate-500/15 bg-white/30 hover:border-indigo-400/40 dark:bg-slate-950/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                    #{logEntry.terminal_number} · {logEntry.title || t('terminal.untitled')}
                  </span>
                  <span className={`shrink-0 text-[9px] ${
                    logEntry.status === 'sent'
                      ? 'text-emerald-500'
                      : logEntry.status === 'failed'
                        ? 'text-rose-500'
                        : 'text-amber-500'
                  }`}>
                    {t(`terminal.logStatus.${logEntry.status}`)}
                  </span>
                </div>
                <p className="mt-1 text-[9px] text-slate-500">
                  {formatLogDate(logEntry.date)}
                </p>
              </button>
            ))}
          </div>
        )}
        {selectedLog && (
          <div className="rounded-xl border border-slate-500/15 bg-slate-950/[0.03] p-3 dark:bg-slate-950/30">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[9px] text-slate-500">
              <span>#{selectedLog.terminal_number} · {selectedLog.title || t('terminal.untitled')}</span>
              <span>{formatLogDate(selectedLog.date)}</span>
            </div>
            <pre className={`${overlay ? 'max-h-40' : 'max-h-64'} overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-700 dark:text-slate-200`}>
              {logContentLoading ? t('common.loading') : selectedLogContent}
            </pre>
            {selectedLog.error_code && (
              <p className="mt-2 text-[10px] text-rose-500">
                {t(errorTranslationKey(selectedLog.error_code))}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderGridWindowCard = (
    windowInfo: TerminalWindowInfo,
    compactLayout = false,
  ) => {
    const selected = windowInfo.terminal_number === selectedTerminalNumber;
    const busy = actionWindowId === windowInfo.id;
    return (
      <article
        key={windowInfo.terminal_number}
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
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-500/20 bg-slate-900 px-3 py-2 text-white">
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
              disabled={busy || !snapshot?.supported}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              aria-label={`${t('terminal.activate')}: ${terminalName(windowInfo, t('terminal.untitled'))}`}
            >
              {busy
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <MousePointer2 className="h-4 w-4" />}
              {!compactLayout && <span>{t('terminal.activate')}</span>}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            selectTerminal(windowInfo.terminal_number);
            if (windowInfo.screenshot?.content_base64) {
              setPreviewTerminalNumber(windowInfo.terminal_number);
            }
          }}
          className="relative min-h-0 flex-1 overflow-hidden bg-slate-950/80 text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
          aria-label={t('terminal.previewScreenshot', {
            number: windowInfo.terminal_number,
          })}
        >
          {windowInfo.screenshot?.content_base64 ? (
            <>
              <img
                src={`data:${windowInfo.screenshot.mime};base64,${windowInfo.screenshot.content_base64}`}
                alt={terminalName(windowInfo, t('terminal.untitled'))}
                decoding="async"
                className="h-full w-full object-contain"
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
  const live = Boolean(snapshot?.success && snapshot?.supported);

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-5">
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

      {snapshotError && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t(snapshotError)}</span>
        </div>
      )}

      {actionNotice && (
        <div className={`flex items-center gap-2 text-xs rounded-2xl p-3 border ${
          actionNotice.kind === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
        }`}>
          {actionNotice.kind === 'success'
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{t(actionNotice.translationKey)}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)] gap-5">
        <section className="pc-glass overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-500/10">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {t('terminal.windowsTitle')}
            </h2>
            <p className="mt-0.5 hidden text-[11px] text-slate-500 sm:block">{t('terminal.windowsHint')}</p>
          </div>
          {isMobile ? (
            <div
              className="flex flex-col overflow-y-auto overscroll-contain p-3"
              style={{ height: `calc(100dvh - ${MOBILE_GRID_OFFSET_REM}rem)` }}
            >
              {!snapshot?.windows.length ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-500/25 p-6 text-center text-xs text-slate-400">
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
                    <div className={`mt-auto grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2 ${
                      onlineWindows.length ? 'border-t border-slate-500/15' : ''
                    }`}>
                      {offlineWindows.map((windowInfo) => renderGridWindowCard(windowInfo, true))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
          <div className="flex h-[52vh] min-h-[22rem] max-h-[38rem] flex-col overflow-hidden bg-slate-950/[0.03] dark:bg-slate-950/40">
            <div ref={canvasRef} className="relative min-h-0 flex-1 overflow-hidden">
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
            ) : canvasLayout && desktopBounds && onlineWindows.map((windowInfo) => {
              const selected = windowInfo.terminal_number === selectedTerminalNumber;
              const busy = actionWindowId === windowInfo.id;
              const mappedWidth = windowInfo.rect.width * canvasLayout.scale;
              const mappedHeight = windowInfo.rect.height * canvasLayout.scale;
              const compact = mappedWidth < 180;
              const tiny = mappedWidth < 110;
              const titleBarHeight = Math.min(30, Math.max(18, mappedHeight * 0.22));
              return (
                <article
                  key={windowInfo.terminal_number}
                  className={`absolute overflow-hidden rounded-lg border shadow-sm transition-all ${
                    selected
                      ? 'z-30 border-indigo-500 bg-indigo-500/20 ring-2 ring-indigo-500/20'
                      : windowInfo.active
                        ? 'z-20 border-emerald-500/70 bg-emerald-500/15'
                        : 'z-10 border-slate-500/40 bg-white/80 hover:border-indigo-400 dark:bg-slate-900/80'
                  } ${windowInfo.online ? '' : 'border-dashed'}`}
                  style={{
                    left: canvasLayout.left
                      + (windowInfo.rect.x - desktopBounds.minX) * canvasLayout.scale,
                    top: canvasLayout.top
                      + (windowInfo.rect.y - desktopBounds.minY) * canvasLayout.scale,
                    width: mappedWidth,
                    height: mappedHeight,
                  }}
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
                          disabled={busy || !snapshot?.supported}
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
                        if (windowInfo.screenshot?.content_base64) {
                          setPreviewTerminalNumber(windowInfo.terminal_number);
                        }
                      }}
                      className="group relative min-h-0 flex-1 overflow-hidden bg-slate-950/80 text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                      aria-label={t('terminal.previewScreenshot', {
                        number: windowInfo.terminal_number,
                      })}
                    >
                      {windowInfo.screenshot?.content_base64 ? (
                        <>
                          <img
                            src={`data:${windowInfo.screenshot.mime};base64,${windowInfo.screenshot.content_base64}`}
                            alt={terminalName(windowInfo, t('terminal.untitled'))}
                            decoding="async"
                            className="h-full w-full object-contain"
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
            {offlineWindows.length > 0 && (
              <div className="relative z-40 max-h-[11rem] shrink-0 overflow-y-auto border-t border-slate-500/15 bg-slate-100/80 p-3 dark:bg-slate-950/70">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
                  {offlineWindows.map((windowInfo) => renderGridWindowCard(windowInfo, true))}
                </div>
              </div>
            )}
          </div>
          )}
        </section>

        <section className="pc-glass h-fit">
          {renderOperationPanel(false)}
        </section>
      </div>

      {previewWindow?.screenshot?.content_base64 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-0 backdrop-blur-sm md:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('terminal.previewDialog', {
            number: previewWindow.terminal_number,
          })}
          onClick={() => setPreviewTerminalNumber(null)}
        >
          <div
            className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-none border-white/15 bg-slate-950 shadow-2xl md:h-[94vh] md:rounded-2xl md:border"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
              <p className="min-w-0 truncate text-sm font-semibold">
                #{previewWindow.terminal_number} · {terminalName(previewWindow, t('terminal.untitled'))}
              </p>
              {previewNextRunAt && (
                <p className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold text-amber-300">
                  <Timer className="h-3.5 w-3.5" />
                  {t('terminal.scheduleCountdown')} {formatScheduleCountdown(previewNextRunAt - nowMs)}
                </p>
              )}
              {previewWindow.online && (
                <p className="hidden shrink-0 items-center gap-1.5 text-[10px] text-slate-300 lg:flex">
                  <Crosshair className="h-3.5 w-3.5" />
                  {t('terminal.directClickHint')}
                </p>
              )}
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <img
                src={`data:${previewWindow.screenshot.mime};base64,${previewWindow.screenshot.content_base64}`}
                alt={terminalName(previewWindow, t('terminal.untitled'))}
                onClick={clickPreview}
                className={`h-full w-full object-contain ${
                  previewWindow.online ? 'cursor-crosshair' : 'cursor-default'
                }`}
              />
              <div className="absolute bottom-3 right-3 z-40 flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePreviewExpanded}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-white/15 bg-slate-950/65 px-4 text-xs font-semibold text-white shadow-lg backdrop-blur hover:bg-slate-900/80 md:h-9 md:px-3 md:text-[10px]"
                  aria-label={t(
                    previewExpanded
                      ? 'terminal.collapsePreviewOperations'
                      : 'terminal.expandPreviewOperations',
                  )}
                >
                  {previewExpanded
                    ? <PanelRightClose className="h-5 w-5 md:h-4 md:w-4" />
                    : <PanelRightOpen className="h-5 w-5 md:h-4 md:w-4" />}
                  {t(
                    previewExpanded
                      ? 'terminal.collapseOperations'
                      : 'terminal.expandOperations',
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTerminalNumber(null)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-slate-950/65 text-slate-200 shadow-lg backdrop-blur hover:bg-slate-900/80 hover:text-white md:h-9 md:w-9"
                  aria-label={t('common.close')}
                >
                  <X className="h-5 w-5 md:h-4 md:w-4" />
                </button>
              </div>
            </div>
            {previewExpanded && (
              <aside className="dark h-[46%] max-h-[30rem] shrink-0 overflow-hidden border-t border-white/15 bg-slate-950/95 shadow-2xl">
                {renderOperationPanel(true)}
              </aside>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PcTerminalPage;
