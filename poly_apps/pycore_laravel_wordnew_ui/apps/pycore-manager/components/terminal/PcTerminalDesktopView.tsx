/** Full-screen view of this machine's desktop: one JPEG per second while mounted and visible, optional mouse / keyboard control. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Loader2, MousePointer2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePcTerminalApi } from './PcTerminalApiContext';

const DESKTOP_REFRESH_INTERVAL_MS = 1000;
const DESKTOP_FETCH_TIMEOUT_MS = 8000;
const DESKTOP_CONTROL_SETTLE_MS = 150;
const HTTP_OK = 200;
const SINGLE_KEY_PATTERN = /^[a-z0-9]$/;

const EVENT_KEY_IDS: Record<string, string> = {
  Enter: 'enter',
  Escape: 'escape',
  Tab: 'tab',
  Backspace: 'backspace',
  Delete: 'delete',
  ' ': 'space',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Home: 'home',
  End: 'end',
  PageUp: 'page_up',
  PageDown: 'page_down',
};

const QUICK_KEYS = ['enter', 'escape', 'tab', 'backspace', 'up', 'down', 'left', 'right'] as const;

/** Key ids pycore accepts for a keyboard event, or null for a key the desktop view does not carry (symbols, IME, lone modifiers). */
function desktopKeysFromEvent(event: React.KeyboardEvent): string[] | null {
  const lower = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const keyId = EVENT_KEY_IDS[event.key] ?? (SINGLE_KEY_PATTERN.test(lower) ? lower : null);
  if (!keyId) return null;
  const modifiers = [
    event.ctrlKey ? 'ctrl' : null,
    event.altKey ? 'alt' : null,
    event.shiftKey || (event.key.length === 1 && event.key !== lower) ? 'shift' : null,
  ].filter((modifier): modifier is string => modifier !== null);
  return [...modifiers, keyId];
}

const PcTerminalDesktopView: React.FC = () => {
  const { t } = useTranslation('pc');
  const terminalApi = usePcTerminalApi();
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [control, setControl] = useState(false);
  const [controlFailed, setControlFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameUrlRef = useRef<string | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const refreshNowRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let alive = true;
    let timer: number | null = null;
    let inFlight = false;
    const showFrame = (bytes: Uint8Array) => {
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }));
      if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
      frameUrlRef.current = url;
      setFrameUrl(url);
    };
    const schedule = (startedAt: number) => {
      if (!alive) return;
      const wait = Math.max(0, DESKTOP_REFRESH_INTERVAL_MS - (Date.now() - startedAt));
      timer = window.setTimeout(refresh, wait);
    };
    const refresh = () => {
      if (!alive || inFlight) return;
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      const startedAt = Date.now();
      if (document.visibilityState === 'hidden') {
        schedule(startedAt);
        return;
      }
      inFlight = true;
      terminalApi.getDesktopScreenshot(DESKTOP_FETCH_TIMEOUT_MS)
        .then((result) => {
          if (!alive) return;
          if (result.status === HTTP_OK && result.bytes) {
            showFrame(result.bytes);
            setFailed(false);
          } else {
            setFailed(true);
          }
        })
        .catch(() => { if (alive) setFailed(true); })
        .finally(() => {
          inFlight = false;
          schedule(startedAt);
        });
    };
    refreshNowRef.current = refresh;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    refresh();
    return () => {
      alive = false;
      if (timer !== null) window.clearTimeout(timer);
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
      if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
      frameUrlRef.current = null;
    };
  }, [terminalApi]);

  // Show the effect of an input soon instead of waiting for the next one-second tick.
  const refreshSoon = useCallback(() => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => refreshNowRef.current(), DESKTOP_CONTROL_SETTLE_MS);
  }, []);

  const report = useCallback((result: { success?: boolean } | null | undefined) => {
    setControlFailed(!result?.success);
    refreshSoon();
  }, [refreshSoon]);

  const pressKeys = useCallback((keys: string[]) => {
    terminalApi.pressDesktopKeys(keys).then(report).catch(() => report(null));
  }, [report, terminalApi]);

  const clickAt = useCallback((event: React.MouseEvent, button: 'left' | 'right') => {
    const image = imageRef.current;
    if (!control || !image || !image.naturalWidth || !image.naturalHeight) return;
    const box = image.getBoundingClientRect();
    const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
    const shownWidth = image.naturalWidth * scale;
    const shownHeight = image.naturalHeight * scale;
    const horizontal = (event.clientX - box.left - (box.width - shownWidth) / 2) / shownWidth;
    const vertical = (event.clientY - box.top - (box.height - shownHeight) / 2) / shownHeight;
    if (horizontal < 0 || horizontal > 1 || vertical < 0 || vertical > 1) return;
    terminalApi.clickDesktop(horizontal, vertical, button).then(report).catch(() => report(null));
  }, [control, report, terminalApi]);

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!control) return;
    const keys = desktopKeysFromEvent(event);
    if (!keys) return;
    event.preventDefault();
    pressKeys(keys);
  }, [control, pressKeys]);

  return (
    <div className="flex h-full min-h-[16rem] flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <label title={t('terminal.desktopView.controlHint')} className="cursor-pointer">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={control}
            onChange={(event) => setControl(event.target.checked)}
          />
          <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-500/20 px-2 text-[11px] font-semibold text-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white dark:text-indigo-300">
            <MousePointer2 className="h-3.5 w-3.5" />
            {t('terminal.desktopView.control')}
          </span>
        </label>
        {control && (
          <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label={t('terminal.desktopView.keyboard')}>
            <Keyboard className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {QUICK_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => pressKeys([key])}
                className="h-8 rounded-md border border-slate-500/20 px-2 font-mono text-[10px] font-bold text-slate-600 hover:bg-slate-500/10 dark:text-slate-300"
              >
                {t(`terminal.desktopView.keys.${key}`)}
              </button>
            ))}
          </div>
        )}
        <span className="min-w-0 flex-1 truncate text-right text-[10px] text-slate-400">
          {controlFailed ? t('terminal.desktopView.controlFailed') : t('terminal.desktopView.hint')}
        </span>
      </div>
      <div
        tabIndex={control ? 0 : -1}
        onKeyDown={onKeyDown}
        className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-slate-950/80 outline-none ${
          control ? 'cursor-crosshair ring-1 ring-indigo-500/60 focus:ring-2' : ''
        }`}
      >
        {frameUrl ? (
          <img
            ref={imageRef}
            src={frameUrl}
            alt=""
            draggable={false}
            decoding="async"
            onClick={(event) => clickAt(event, 'left')}
            onContextMenu={(event) => {
              if (!control) return;
              event.preventDefault();
              clickAt(event, 'right');
            }}
            className="max-h-full max-w-full select-none object-contain"
          />
        ) : (
          <span className="flex items-center gap-2 px-3 text-center text-xs text-slate-400">
            {!failed && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t(failed ? 'terminal.desktopView.unavailable' : 'terminal.desktopView.loading')}
          </span>
        )}
        {frameUrl && failed && (
          <span className="absolute bottom-2 left-2 rounded bg-rose-600/90 px-2 py-0.5 text-[10px] text-white">
            {t('terminal.desktopView.unavailable')}
          </span>
        )}
      </div>
    </div>
  );
};

export default PcTerminalDesktopView;
