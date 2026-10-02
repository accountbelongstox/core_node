import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Eye,
  History,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  SquareArrowOutUpRight,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  PYCORE_HTTP_ROUTES,
  TERMINAL_BACKUP_DELETE_CONFIRM,
  TERMINAL_BACKUP_PAGE_SIZE,
} from '@/apps/pycore-manager/api';
import { usePcTerminalApi } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import type { TerminalBackupItem, TerminalBackupState, TerminalBackupTerminal } from '@/apps/pycore-manager/api';
import { usePcDirectOnly } from '@/apps/pycore-manager/hooks/usePcDirectOnly';
import { pcErrorCodeMessage, pcGenericFailureMessage } from '@/apps/pycore-manager/utils/pcErrorCodes';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z } from '@/shared/styles/overlay';
import { copyTextToSystemClipboard } from '../../../core/browser/SystemClipboard';
import { formatBytes, formatTimestamp } from '../../../core/utils/formatters';

const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_HIGHLIGHT_ESCAPE = /[.*+?^${}()|[\]\\]/g;

type BackupNotice = { kind: 'success' | 'error'; text: string };

interface BackupViewer {
  id: string;
  number: number;
  name: string;
  text: string;
  bytes: number;
  truncated: boolean;
  loading: boolean;
  error: string | null;
}

interface DeleteTarget {
  item: TerminalBackupItem;
  terminal: TerminalBackupTerminal | null;
}

interface PcTerminalBackupPanelProps {
  errorTranslationKey: (errorCode?: string | null) => string;
  defaultExpanded?: boolean;
}

/** Automatic-backup switch: a pause lasts until pycore restarts (backups default to on). */
const BackupScheduleSwitch: React.FC = () => {
  const { t } = useTranslation('pc');
  const terminalApi = usePcTerminalApi();
  const [state, setState] = useState<TerminalBackupState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const apply = useCallback(async (paused?: boolean) => {
    setBusy(true);
    try {
      const result = await terminalApi.terminalBackupState(paused);
      setFailed(!result.success);
      if (result.success) setState(result);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void apply();
  }, [apply]);

  const paused = Boolean(state?.paused);
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border p-2 text-[11px] ${
      paused ? 'border-amber-500/30 bg-amber-500/10' : 'border-emerald-500/25 bg-emerald-500/5'
    }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${paused ? 'bg-amber-500' : 'bg-emerald-500'}`} />
      <span className="min-w-0 flex-1">
        <span className="font-semibold text-slate-700 dark:text-slate-200">{t('terminal.backup.auto')}</span>
        {' · '}
        {state
          ? (paused
            ? t('terminal.backup.autoPaused')
            : t('terminal.backup.autoOn', { seconds: state.interval_seconds }))
          : (failed ? t('terminal.backup.autoUnknown') : t('common.loading'))}
        {state?.last_pass_at ? ` · ${t('terminal.backup.lastPass', { time: formatTimestamp(state.last_pass_at * 1000) })}` : ''}
      </span>
      <button
        type="button"
        onClick={() => void apply(!paused)}
        disabled={busy || !state}
        title={t('terminal.backup.autoHint')}
        className={`${actionButton} whitespace-nowrap`}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        {t(paused ? 'terminal.backup.resume' : 'terminal.backup.pause')}
      </button>
    </div>
  );
};

function highlightedParts(text: string, query: string): Array<{ text: string; hit: boolean }> {
  const needle = query.trim();
  if (!needle) return [{ text, hit: false }];
  const pattern = new RegExp(`(${needle.replace(SEARCH_HIGHLIGHT_ESCAPE, '\\$&')})`, 'gi');
  return text.split(pattern).map((part, index) => ({ text: part, hit: index % 2 === 1 }));
}

const HighlightedText: React.FC<{ text: string; query: string }> = ({ text, query }) => (
  <>
    {highlightedParts(text, query).map((part, index) => (
      part.hit
        ? <mark key={index} className="rounded bg-amber-400/40 px-0.5 text-inherit">{part.text}</mark>
        : <React.Fragment key={index}>{part.text}</React.Fragment>
    ))}
  </>
);

const actionButton = 'inline-flex items-center gap-1 rounded-lg bg-slate-500/10 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-500/20 disabled:opacity-50 dark:text-slate-300';
const dangerButton = 'inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-500 hover:bg-rose-500/20 disabled:opacity-50';

interface DeleteDialogProps {
  target: DeleteTarget;
  busy: boolean;
  error: string | null;
  onConfirm: (confirm: string) => void;
  onClose: () => void;
}

const PcTerminalBackupDeleteDialog: React.FC<DeleteDialogProps> = ({ target, busy, error, onConfirm, onClose }) => {
  const { t } = useTranslation('pc');
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const confirmed = typed === TERMINAL_BACKUP_DELETE_CONFIRM;
  const date = formatTimestamp(target.item.created_at);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  const submit = () => {
    if (confirmed && !busy) onConfirm(typed);
  };

  return (
    <Portal>
      <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal}`}>
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
        <div
          className="relative w-full max-w-md space-y-3 rounded-2xl border border-slate-500/20 bg-white p-4 shadow-2xl dark:bg-slate-900"
          role="dialog"
          aria-modal="true"
          aria-label={t(target.terminal ? 'terminal.backup.deleteTitleTerminal' : 'terminal.backup.deleteTitleBackup')}
        >
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
            <Trash2 className="h-4 w-4 text-rose-500" />
            {t(target.terminal ? 'terminal.backup.deleteTitleTerminal' : 'terminal.backup.deleteTitleBackup')}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {target.terminal
              ? t('terminal.backup.deleteMessageTerminal', { number: target.terminal.number, date })
              : t('terminal.backup.deleteMessageBackup', { date, count: target.item.terminal_count })}
          </p>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {t('terminal.backup.deletePrompt', { word: TERMINAL_BACKUP_DELETE_CONFIRM })}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit();
              }}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-500/20 bg-white/60 px-2.5 py-1.5 font-mono text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:bg-slate-950/40 dark:text-slate-100"
            />
          </label>
          {error && (
            <p className="flex items-start gap-1.5 rounded-lg bg-rose-500/10 p-2 text-[11px] text-rose-500">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className={actionButton}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!confirmed || busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-500 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {t(busy ? 'terminal.backup.deleting' : 'terminal.backup.deleteConfirm')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

/** Terminal backup history: searchable list, per-terminal text viewer, host open, copy and typed-confirmation delete. */
export const PcTerminalBackupPanel: React.FC<PcTerminalBackupPanelProps> = ({ errorTranslationKey, defaultExpanded = false }) => {
  const { t } = useTranslation('pc');
  const terminalApi = usePcTerminalApi();
  const openDirectOnly = usePcDirectOnly(PYCORE_HTTP_ROUTES.terminalBackupsOpen);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<TerminalBackupItem[]>([]);
  const [total, setTotal] = useState(0);
  const [archiveBytes, setArchiveBytes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<BackupNotice | null>(null);
  const [openId, setOpenId] = useState('');
  const [viewer, setViewer] = useState<BackupViewer | null>(null);
  const [busyKey, setBusyKey] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const loadSeqRef = useRef(0);
  const viewSeqRef = useRef(0);
  const itemsRef = useRef<TerminalBackupItem[]>([]);
  itemsRef.current = items;

  const errorText = useCallback((code?: string | null) => (
    pcErrorCodeMessage(code) || t(errorTranslationKey(code))
  ), [errorTranslationKey, t]);

  const caughtText = useCallback((caught: unknown) => (
    pcErrorCodeMessage((caught as { code?: string } | null)?.code) || pcGenericFailureMessage()
  ), []);

  const load = useCallback(async (append: boolean) => {
    const seq = ++loadSeqRef.current;
    const offset = append ? itemsRef.current.length : 0;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await terminalApi.listTerminalBackups({ query, limit: TERMINAL_BACKUP_PAGE_SIZE, offset });
      if (seq !== loadSeqRef.current) return;
      if (!result.success) {
        setError(errorText(result.error_code));
        return;
      }
      const page = Array.isArray(result.items) ? result.items : [];
      setTotal(Number(result.total) || 0);
      setArchiveBytes(Number(result.archive?.blob_bytes) || 0);
      setItems((current) => {
        if (!append) return page;
        const known = new Set(current.map((item) => item.id));
        return [...current, ...page.filter((item) => !known.has(item.id))];
      });
    } catch (caught) {
      if (seq === loadSeqRef.current) setError(caughtText(caught));
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [caughtText, errorText, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(queryInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    if (expanded) void load(false);
  }, [expanded, load]);

  const clearSearch = useCallback(() => {
    setQueryInput('');
    setQuery('');
  }, []);

  const showViewer = useCallback(async (item: TerminalBackupItem, number: number) => {
    const terminal = item.terminals.find((entry) => entry.number === number);
    const seq = ++viewSeqRef.current;
    setOpenId(item.id);
    setViewer({
      id: item.id, number, name: terminal?.name || '', text: '', bytes: 0, truncated: false, loading: true, error: null,
    });
    try {
      const result = await terminalApi.readTerminalBackup(item.id, number);
      if (seq !== viewSeqRef.current) return;
      setViewer((current) => (current && current.id === item.id && current.number === number
        ? result.success
          ? {
            ...current,
            text: String(result.text ?? ''),
            bytes: Number(result.bytes) || 0,
            truncated: Boolean(result.truncated),
            loading: false,
          }
          : { ...current, loading: false, error: errorText(result.error_code) }
        : current));
    } catch (caught) {
      if (seq !== viewSeqRef.current) return;
      setViewer((current) => (current ? { ...current, loading: false, error: caughtText(caught) } : current));
    }
  }, [caughtText, errorText]);

  const closeViewer = useCallback(() => {
    viewSeqRef.current += 1;
    setViewer(null);
  }, []);

  const toggleItem = useCallback((id: string) => {
    setOpenId((current) => (current === id ? '' : id));
    setViewer((current) => (current && current.id === id ? null : current));
  }, []);

  const copyTerminal = useCallback(async (item: TerminalBackupItem, number: number) => {
    const key = `copy:${item.id}:${number}`;
    setBusyKey(key);
    setNotice(null);
    try {
      let text = viewer && viewer.id === item.id && viewer.number === number && !viewer.loading && !viewer.error
        ? viewer.text
        : null;
      if (text === null) {
        const result = await terminalApi.readTerminalBackup(item.id, number);
        if (!result.success) {
          setNotice({ kind: 'error', text: errorText(result.error_code) });
          return;
        }
        text = String(result.text ?? '');
      }
      const copied = await copyTextToSystemClipboard(text);
      setNotice({ kind: copied ? 'success' : 'error', text: t(copied ? 'terminal.backup.copied' : 'terminal.backup.copyFailed') });
    } catch (caught) {
      setNotice({ kind: 'error', text: caughtText(caught) });
    } finally {
      setBusyKey('');
    }
  }, [caughtText, errorText, t, viewer]);

  const openOnHost = useCallback(async (item: TerminalBackupItem, number?: number) => {
    const key = `open:${item.id}:${number ?? 'all'}`;
    setBusyKey(key);
    setNotice(null);
    try {
      const result = await terminalApi.openTerminalBackup(item.id, number);
      if (!result.success) {
        setNotice({ kind: 'error', text: errorText(result.error_code) });
        return;
      }
      const opened = Number(result.opened) || 0;
      setNotice(opened > 0
        ? { kind: 'success', text: t('terminal.backup.opened', { count: opened }) }
        : { kind: 'error', text: t('terminal.backup.notOpened') });
    } catch (caught) {
      setNotice({ kind: 'error', text: caughtText(caught) });
    } finally {
      setBusyKey('');
    }
  }, [caughtText, errorText, t]);

  const askDelete = useCallback((item: TerminalBackupItem, terminal: TerminalBackupTerminal | null) => {
    setDeleteError(null);
    setDeleteTarget({ item, terminal });
  }, []);

  const closeDelete = useCallback(() => {
    if (!deleteBusy) setDeleteTarget(null);
  }, [deleteBusy]);

  const confirmDelete = useCallback(async (confirm: string) => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const result = await terminalApi.deleteTerminalBackup(deleteTarget.item.id, confirm, deleteTarget.terminal?.number);
      if (!result.success) {
        setDeleteError(errorText(result.error_code));
        return;
      }
      setNotice({ kind: 'success', text: t('terminal.backup.deleted', { count: Number(result.deleted) || 0 }) });
      setDeleteTarget(null);
      if (viewer && viewer.id === deleteTarget.item.id
        && (!deleteTarget.terminal || deleteTarget.terminal.number === viewer.number)) {
        closeViewer();
      }
      await load(false);
    } catch (caught) {
      setDeleteError(caughtText(caught));
    } finally {
      setDeleteBusy(false);
    }
  }, [caughtText, closeViewer, deleteTarget, errorText, load, t, viewer]);

  const openTitle = openDirectOnly ? t('terminal.backup.openDirectOnly') : undefined;

  return (
    <section className="pc-glass space-y-2.5 px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          title={t(expanded ? 'terminal.backup.hide' : 'terminal.backup.show')}
          className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <History className="h-4 w-4 text-indigo-500" />
          {t('terminal.backup.title')}
        </button>
        <span className="min-w-0 flex-1 truncate text-slate-500">{t('terminal.backup.hint')}</span>
        {expanded && (
          <button
            type="button"
            onClick={() => void load(false)}
            disabled={loading}
            className={actionButton}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {t('common.refresh')}
          </button>
        )}
      </div>

      {expanded && (
        <div className="space-y-2.5">
          <BackupScheduleSwitch />
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder={t('terminal.backup.searchPlaceholder')}
              className="w-full rounded-lg border border-slate-500/20 bg-white/60 py-1.5 pl-8 pr-8 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950/40 dark:text-slate-100"
            />
            {queryInput && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label={t('terminal.backup.clearSearch')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </label>

          {notice && (
            <p className={`flex items-start gap-1.5 rounded-lg p-2 text-[11px] ${
              notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-500'
            }`}
            >
              {notice.kind === 'error' && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              <span>{notice.text}</span>
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1">{error}</span>
              <button type="button" onClick={() => void load(false)} className={actionButton}>{t('common.retry')}</button>
            </div>
          )}

          {loading && !items.length && (
            <div className="flex items-center justify-center py-4 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}

          {!loading && !error && !items.length && (
            <p className="rounded-xl border border-dashed border-slate-500/20 p-4 text-center text-[11px] text-slate-500">
              {t(query ? 'terminal.backup.emptySearch' : 'terminal.backup.empty')}
            </p>
          )}

          {items.length > 0 && (
            <div className="space-y-1.5">
              {items.map((item) => {
                const itemOpen = openId === item.id;
                const matches = item.matches || [];
                const itemViewer = viewer && viewer.id === item.id ? viewer : null;
                return (
                  <div key={item.id} className="rounded-xl border border-slate-500/15">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-2.5 py-2 leading-normal">
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        aria-expanded={itemOpen}
                        title={t(itemOpen ? 'terminal.backup.collapse' : 'terminal.backup.expand')}
                        className="flex min-w-[12rem] flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-left leading-normal"
                      >
                        {itemOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                        <span className="whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">{formatTimestamp(item.created_at)}</span>
                        <span className="whitespace-nowrap text-slate-500">{t('terminal.backup.terminals', { count: item.terminal_count })}</span>
                        <span className="whitespace-nowrap font-mono text-slate-500">{formatBytes(item.total_bytes)}</span>
                        {item.stored_bytes < item.total_bytes && (
                          <span className="whitespace-nowrap font-mono text-[10px] text-slate-400">
                            {t('terminal.backup.stored', { size: formatBytes(item.stored_bytes) })}
                          </span>
                        )}
                        {matches.length > 0 && (
                          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            {t('terminal.backup.matches', { count: matches.length })}
                          </span>
                        )}
                      </button>
                      <div className="ml-auto flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void openOnHost(item)}
                          disabled={openDirectOnly || busyKey === `open:${item.id}:all`}
                          title={openTitle}
                          className={`${actionButton} whitespace-nowrap`}
                        >
                          {busyKey === `open:${item.id}:all`
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <SquareArrowOutUpRight className="h-3 w-3" />}
                          {t('terminal.backup.openAll')}
                        </button>
                        <button
                          type="button"
                          onClick={() => askDelete(item, null)}
                          title={t('terminal.backup.deleteBackup')}
                          className={`${dangerButton} whitespace-nowrap`}
                        >
                          <Trash2 className="h-3 w-3" />
                          {t('terminal.backup.delete')}
                        </button>
                      </div>
                    </div>

                    {matches.length > 0 && (
                      <ul className="space-y-1 border-t border-slate-500/10 px-2.5 py-2">
                        {matches.map((match, index) => (
                          <li key={`${match.number}:${match.line}:${index}`}>
                            <button
                              type="button"
                              onClick={() => void showViewer(item, match.number)}
                              className="flex w-full min-w-0 items-baseline gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-500/10"
                            >
                              <span className="shrink-0 font-semibold text-indigo-500">#{match.number}</span>
                              <span className="shrink-0 text-[10px] text-slate-500">
                                {t('terminal.backup.matchLine', { line: match.line })}
                              </span>
                              <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-slate-700 dark:text-slate-200">
                                <HighlightedText text={match.snippet} query={query} />
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {itemOpen && (
                      <div className="space-y-2 border-t border-slate-500/10 px-2.5 py-2">
                        <ul className="space-y-1">
                          {item.terminals.map((terminal) => {
                            const selected = itemViewer?.number === terminal.number;
                            return (
                              <li
                                key={terminal.number}
                                className={`flex flex-wrap items-center gap-2 rounded-lg px-1.5 py-1 ${
                                  selected ? 'bg-indigo-500/10' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => void showViewer(item, terminal.number)}
                                  disabled={Boolean(terminal.error_code)}
                                  title={t('terminal.backup.view')}
                                  className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
                                >
                                  <span className="shrink-0 font-semibold text-indigo-500">#{terminal.number}</span>
                                  <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">
                                    {terminal.name || t('terminal.untitled')}
                                  </span>
                                  <span className="shrink-0 font-mono text-slate-500">{formatBytes(terminal.bytes)}</span>
                                  {(terminal.kind === 'same' || terminal.kind === 'delta') && (
                                    <span
                                      title={t('terminal.backup.stored', { size: formatBytes(terminal.stored_bytes) })}
                                      className="shrink-0 rounded-md bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-500"
                                    >
                                      {t(terminal.kind === 'same' ? 'terminal.backup.kindSame' : 'terminal.backup.kindDelta')}
                                    </span>
                                  )}
                                  {terminal.changed && (
                                    <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                                      {t('terminal.backup.changed')}
                                    </span>
                                  )}
                                  {terminal.error_code && (
                                    <span className="min-w-0 truncate text-[10px] text-rose-500">{errorText(terminal.error_code)}</span>
                                  )}
                                </button>
                                {!terminal.error_code && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => void showViewer(item, terminal.number)}
                                      className={actionButton}
                                    >
                                      <Eye className="h-3 w-3" />
                                      {t('terminal.backup.view')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void copyTerminal(item, terminal.number)}
                                      disabled={busyKey === `copy:${item.id}:${terminal.number}`}
                                      className={actionButton}
                                    >
                                      {busyKey === `copy:${item.id}:${terminal.number}`
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : <ClipboardCopy className="h-3 w-3" />}
                                      {t('terminal.backup.copy')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void openOnHost(item, terminal.number)}
                                      disabled={openDirectOnly || busyKey === `open:${item.id}:${terminal.number}`}
                                      title={openTitle}
                                      className={actionButton}
                                    >
                                      {busyKey === `open:${item.id}:${terminal.number}`
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : <SquareArrowOutUpRight className="h-3 w-3" />}
                                      {t('terminal.backup.openOne')}
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => askDelete(item, terminal)}
                                  title={t('terminal.backup.deleteTerminal')}
                                  className={dangerButton}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  {t('terminal.backup.delete')}
                                </button>
                              </li>
                            );
                          })}
                        </ul>

                        {itemViewer && (
                          <div className="space-y-1.5 rounded-lg border border-slate-500/15 p-2">
                            <div className="flex items-center gap-2">
                              <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                {t('terminal.backup.viewerTitle', {
                                  number: itemViewer.number,
                                  name: itemViewer.name || t('terminal.untitled'),
                                })}
                                {!itemViewer.loading && !itemViewer.error && (
                                  <span className="ml-2 font-mono font-normal text-slate-500">{formatBytes(itemViewer.bytes)}</span>
                                )}
                              </p>
                              <button
                                type="button"
                                onClick={closeViewer}
                                aria-label={t('common.close')}
                                className="rounded p-1 text-slate-500 hover:bg-slate-500/10"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {itemViewer.truncated && (
                              <p className="flex items-start gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                {t('terminal.backup.truncated')}
                              </p>
                            )}
                            {itemViewer.loading ? (
                              <div className="flex items-center justify-center py-4 text-slate-400">
                                <Loader2 className="h-4 w-4 animate-spin" />
                              </div>
                            ) : itemViewer.error ? (
                              <p className="text-[11px] text-rose-500">{itemViewer.error}</p>
                            ) : (
                              <pre
                                tabIndex={0}
                                className="max-h-96 overflow-auto whitespace-pre rounded-lg bg-slate-950 p-2.5 font-mono text-[10px] leading-relaxed text-slate-200"
                              >
                                {itemViewer.text || t('terminal.backup.viewerEmpty')}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {items.length > 0 && (
            <div className="flex items-center justify-center gap-3 text-[11px] text-slate-500">
              <span>{t('terminal.backup.count', { shown: items.length, total })}</span>
              {archiveBytes > 0 && (
                <span className="font-mono">{t('terminal.backup.archive', { size: formatBytes(archiveBytes) })}</span>
              )}
              {items.length < total && (
                <button type="button" onClick={() => void load(true)} disabled={loadingMore} className={actionButton}>
                  {loadingMore && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t('terminal.backup.loadMore')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <PcTerminalBackupDeleteDialog
          target={deleteTarget}
          busy={deleteBusy}
          error={deleteError}
          onConfirm={(confirm) => void confirmDelete(confirm)}
          onClose={closeDelete}
        />
      )}
    </section>
  );
};

export default PcTerminalBackupPanel;
