/**
 * PcLogPanel - the LOG tab of the global PcDebugDock: terminal-style live log
 * (monospace, colour per level) with HTTP-event connection state and Clear.
 * Reads the console log through usePcLogs(), which holds the log topic while mounted.
 * Following pins the view to the newest line; "Load older" slides the 1000-line window back
 * (live paused, viewport kept on the same line) and "Back to live" re-syncs with the tail.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsDown, ChevronsUp, Copy, OctagonAlert, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { backToLivePcLogs, loadOlderPcLogs, usePcLive, usePcLogs, usePcLogState } from '../PcLiveContext';
import { PcLogLineRow, pcLogLineKey } from './PcLogLineRow';
import type { PcLogLine } from '../PcLiveContext';
import { copyTextToSystemClipboard } from '../../../core/browser/SystemClipboard';
import { UI_DURATIONS } from '../../../core/config/NetworkTiming';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';

const COPY_COUNT_OPTIONS = [50, 100, 200, 500, 1000] as const;
const DEFAULT_COPY_COUNT = 100;
const ERROR_LEVELS = new Set(['error', 'critical', 'fatal']);
const ERROR_COLOR = 'red';

/** "Red and above": ERROR/CRITICAL levels and every line pycore prints in red. */
function isErrorLine(line: PcLogLine): boolean {
  return ERROR_LEVELS.has(line.level.toLowerCase()) || line.color.toLowerCase() === ERROR_COLOR;
}

function storedCopyCount(): number {
  const value = Number(StorageManager.getRaw(StorageKeys.PYCORE_LOG_COPY_COUNT));
  return (COPY_COUNT_OPTIONS as readonly number[]).includes(value) ? value : DEFAULT_COPY_COUNT;
}

function lineText(line: PcLogLine, translate: (key: string, params?: Record<string, number | string>) => string): string {
  const time = line.ts ? new Date(line.ts).toLocaleTimeString(undefined, { hour12: false }) : '';
  const message = line.noteKey ? translate(`floatingLog.${line.noteKey}`, line.noteParams) : line.message;
  return time ? `${time} ${message}` : message;
}

interface ScrollAnchor {
  key: string;
  top: number;
}

function firstSequencedIndex(logs: PcLogLine[]): number {
  return logs.findIndex((line) => line.seq !== null);
}

function contentTop(container: HTMLDivElement, index: number): number | null {
  const child = container.children[index] as HTMLElement | undefined;
  if (!child) return null;
  return child.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
}

export const PcLogPanel: React.FC = () => {
  const { t } = useTranslation('pc');
  const logs = usePcLogs();
  const { httpConnected, clearLogs } = usePcLive();
  const { following, hasOlder, loadingOlder } = usePcLogState();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<ScrollAnchor | null>(null);
  const [errorsOnly, setErrorsOnly] = useState(() => StorageManager.getRaw(StorageKeys.PYCORE_LOG_ERRORS_ONLY) === '1');
  const [copyCount, setCopyCount] = useState(storedCopyCount);
  const [copyState, setCopyState] = useState<'' | 'copied' | 'failed'>('');
  const shownLogs = useMemo(() => (errorsOnly ? logs.filter(isErrorLine) : logs), [errorsOnly, logs]);

  useEffect(() => {
    if (!copyState) return undefined;
    const timer = window.setTimeout(() => setCopyState(''), UI_DURATIONS.copyFeedbackMs);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const toggleErrorsOnly = () => {
    setErrorsOnly((value) => {
      StorageManager.setRaw(StorageKeys.PYCORE_LOG_ERRORS_ONLY, value ? '0' : '1');
      return !value;
    });
  };

  const changeCopyCount = (value: number) => {
    setCopyCount(value);
    StorageManager.setRaw(StorageKeys.PYCORE_LOG_COPY_COUNT, String(value));
  };

  // Copies the newest lines of the current view (the errors-only filter applies).
  const copyLatest = async () => {
    const text = shownLogs.slice(-copyCount).map((line) => lineText(line, t)).join('\n');
    setCopyState(text && await copyTextToSystemClipboard(text) ? 'copied' : 'failed');
  };

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (following) {
      container.scrollTop = container.scrollHeight;
    } else if (anchorRef.current) {
      const anchor = anchorRef.current;
      const index = shownLogs.findIndex((line, i) => pcLogLineKey(line, i) === anchor.key);
      const top = index >= 0 ? contentTop(container, index) : null;
      if (top !== null) container.scrollTop += top - anchor.top;
    }
    const anchorIndex = firstSequencedIndex(shownLogs);
    const top = anchorIndex >= 0 ? contentTop(container, anchorIndex) : null;
    anchorRef.current = top === null ? null : { key: pcLogLineKey(shownLogs[anchorIndex], anchorIndex), top };
  }, [shownLogs, following]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-2 py-1.5 border-b border-[var(--pc-glass-border)]">
        <span className={`text-[11px] font-medium inline-flex items-center gap-1 ${httpConnected ? 'text-emerald-500' : 'text-slate-400'}`}>
          {httpConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {httpConnected ? t('floatingLog.connected') : t('floatingLog.disconnected')}
        </span>
        <span className="flex-1 min-w-0 truncate text-[10px] text-amber-500">
          {!following && t('floatingLog.pausedHint')}
        </span>
        {hasOlder && (
          <button
            type="button"
            onClick={loadOlderPcLogs}
            disabled={loadingOlder}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-slate-500/10 text-slate-500 hover:text-sky-500 hover:bg-sky-500/10 transition-colors disabled:opacity-50"
          >
            <ChevronsUp className="w-3 h-3" /> {loadingOlder ? t('floatingLog.loadingOlder') : t('floatingLog.loadOlder')}
          </button>
        )}
        {!following && (
          <button
            type="button"
            onClick={backToLivePcLogs}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
          >
            <ChevronsDown className="w-3 h-3" /> {t('floatingLog.backToLive')}
          </button>
        )}
        <button
          type="button"
          onClick={toggleErrorsOnly}
          aria-pressed={errorsOnly}
          title={t(errorsOnly ? 'floatingLog.showAll' : 'floatingLog.errorsOnly')}
          aria-label={t(errorsOnly ? 'floatingLog.showAll' : 'floatingLog.errorsOnly')}
          className={`inline-flex items-center px-1.5 py-0.5 rounded-md transition-colors ${
            errorsOnly ? 'bg-rose-500/20 text-rose-500' : 'bg-slate-500/10 text-slate-500 hover:text-rose-500'
          }`}
        >
          <OctagonAlert className="w-3.5 h-3.5" />
        </button>
        <span className="inline-flex items-center overflow-hidden rounded-md bg-slate-500/10">
          <select
            value={copyCount}
            onChange={(event) => changeCopyCount(Number(event.target.value))}
            title={t('floatingLog.copyCount')}
            aria-label={t('floatingLog.copyCount')}
            className="bg-transparent py-0.5 pl-1 text-[10px] font-semibold text-slate-500 focus:outline-none"
          >
            {COPY_COUNT_OPTIONS.map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
          <button
            type="button"
            onClick={() => void copyLatest()}
            disabled={!shownLogs.length}
            title={t('floatingLog.copyLast', { count: copyCount })}
            aria-label={t('floatingLog.copyLast', { count: copyCount })}
            className={`inline-flex items-center px-1.5 py-0.5 transition-colors disabled:opacity-40 ${
              copyState === 'failed' ? 'text-rose-500' : 'text-slate-500 hover:text-sky-500'
            }`}
          >
            {copyState === 'copied' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </span>
        <button
          type="button"
          onClick={clearLogs}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-slate-500/10 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 className="w-3 h-3" /> {t('floatingLog.clear')}
        </button>
      </div>
      <div ref={containerRef} style={{ overflowAnchor: 'none' }} className="flex-1 min-h-0 overflow-auto bg-slate-950 p-3 text-[11px] font-mono leading-relaxed">
        {shownLogs.length === 0 ? (
          <div className="text-slate-600">{t(errorsOnly && logs.length ? 'floatingLog.noErrors' : 'floatingLog.empty')}</div>
        ) : (
          shownLogs.map((line, index) => <PcLogLineRow key={pcLogLineKey(line, index)} line={line} />)
        )}
      </div>
    </div>
  );
};

export default PcLogPanel;
