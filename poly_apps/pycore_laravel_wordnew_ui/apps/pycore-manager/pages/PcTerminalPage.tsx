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
  Crosshair,
  Loader2,
  Maximize2,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Send,
  Terminal,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { pycoreApi } from '@/apps/pycore-manager/api';
import type {
  TerminalActionResult,
  TerminalSnapshot,
  TerminalWindowScreenshot,
  TerminalWindowInfo,
} from '@/apps/pycore-manager/api';


const POLL_INTERVAL_MS = 2000;
const DRAFT_SAVE_DELAY_MS = 500;
const CANVAS_PADDING_PX = 16;
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
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const refreshInFlightRef = useRef(false);
  const draftsRef = useRef<Record<string, string>>({});
  const dirtyDraftsRef = useRef<Set<number>>(new Set());
  const draftTimersRef = useRef<Record<string, number>>({});
  const loadedDraftsRef = useRef<Set<number>>(new Set());

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

  const refresh = useCallback(async (showLoading = false) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const nextSnapshot = await pycoreApi.getTerminalWindows();
      if (!mountedRef.current) return;
      setSnapshot(nextSnapshot);
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
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh(true);
    const pollTimer = window.setInterval(() => void refresh(false), POLL_INTERVAL_MS);
    return () => {
      Object.values(draftTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      dirtyDraftsRef.current.forEach((terminalNumber) => {
        const key = terminalDraftKey(terminalNumber);
        void pycoreApi.saveTerminalDraft(terminalNumber, draftsRef.current[key] || '');
      });
      mountedRef.current = false;
      window.clearInterval(pollTimer);
    };
  }, [refresh]);

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
  }, []);

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
  const desktopBounds = useMemo(
    () => calculateDesktopBounds(snapshot?.windows || []),
    [snapshot?.windows],
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

  const sendInput = useCallback(async () => {
    if (!selectedWindow || !selectedWindow.online || !selectedDraft) return;
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
        selectedDraft,
      ),
      'terminal.sent',
    );
    if (result?.log?.id) {
      setSelectedLogId(result.log.id);
      dirtyDraftsRef.current.delete(terminalNumber);
      setDraftStatuses((current) => ({ ...current, [key]: 'saved' }));
    } else if (!result?.success) {
      void persistDraft(terminalNumber, selectedDraft);
    }
    if (result?.success) {
      draftsRef.current = { ...draftsRef.current, [key]: '' };
      setDrafts(draftsRef.current);
      setDraftStatuses((current) => ({ ...current, [key]: 'saved' }));
    }
  }, [persistDraft, runAction, selectedDraft, selectedWindow]);

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
      <button
        type="button"
        onClick={() => void sendInput()}
        disabled={
          !selectedWindow?.online
          || !selectedDraft
          || Boolean(actionWindowId)
          || !snapshot?.supported
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {actionWindowId === selectedWindow?.id
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Send className="h-4 w-4" />}
        {t('terminal.send')}
      </button>
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

  const snapshotError = snapshot?.error_code
    ? errorTranslationKey(snapshot.error_code)
    : null;
  const live = Boolean(snapshot?.success && snapshot?.supported);

  return (
    <div className="p-6 md:p-8 space-y-5">
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
        <button
          type="button"
          onClick={() => void refresh(true)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </header>

      <section className="pc-glass px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {t('terminal.detected', {
            count: snapshot?.count || 0,
            online: snapshot?.online_count || 0,
            stored: snapshot?.stored_count || 0,
          })}
        </span>
        <span className="text-slate-500">
          {t('terminal.platform')}: {snapshot?.platform || '—'}
        </span>
        <span className="text-slate-500">
          {t('terminal.session')}: {snapshot?.session || '—'}
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
            <p className="text-[11px] text-slate-500 mt-0.5">{t('terminal.windowsHint')}</p>
          </div>
          <div
            ref={canvasRef}
            className="relative h-[52vh] min-h-[22rem] max-h-[38rem] overflow-hidden bg-slate-950/[0.03] dark:bg-slate-950/40"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
              style={{
                backgroundImage: 'linear-gradient(to right, rgb(100 116 139 / 0.18) 1px, transparent 1px), linear-gradient(to bottom, rgb(100 116 139 / 0.18) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
            {!snapshot?.windows.length ? (
              <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-xs text-slate-400">
                {loading ? t('common.loading') : t('terminal.empty')}
              </div>
            ) : canvasLayout && desktopBounds && snapshot.windows.map((windowInfo) => {
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
                          disabled={busy || !snapshot.supported}
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
        </section>

        <section className="pc-glass h-fit">
          {renderOperationPanel(false)}
        </section>
      </div>

      {previewWindow?.screenshot?.content_base64 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t('terminal.previewDialog', {
            number: previewWindow.terminal_number,
          })}
          onClick={() => setPreviewTerminalNumber(null)}
        >
          <div
            className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
              <p className="min-w-0 truncate text-sm font-semibold">
                #{previewWindow.terminal_number} · {terminalName(previewWindow, t('terminal.untitled'))}
              </p>
              {previewWindow.online && (
                <p className="flex shrink-0 items-center gap-1.5 text-[10px] text-slate-300">
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
              {previewExpanded && (
                <aside className="dark absolute inset-y-0 right-0 z-20 w-1/2 overflow-hidden border-l border-white/15 bg-slate-950/60 shadow-2xl backdrop-blur-md">
                  {renderOperationPanel(true)}
                </aside>
              )}
              <div className="absolute bottom-3 right-3 z-40 flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePreviewExpanded}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-slate-950/65 px-3 text-[10px] font-semibold text-white shadow-lg backdrop-blur hover:bg-slate-900/80"
                  aria-label={t(
                    previewExpanded
                      ? 'terminal.collapsePreviewOperations'
                      : 'terminal.expandPreviewOperations',
                  )}
                >
                  {previewExpanded
                    ? <PanelRightClose className="h-4 w-4" />
                    : <PanelRightOpen className="h-4 w-4" />}
                  {t(
                    previewExpanded
                      ? 'terminal.collapseOperations'
                      : 'terminal.expandOperations',
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTerminalNumber(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-950/65 text-slate-200 shadow-lg backdrop-blur hover:bg-slate-900/80 hover:text-white"
                  aria-label={t('common.close')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PcTerminalPage;
