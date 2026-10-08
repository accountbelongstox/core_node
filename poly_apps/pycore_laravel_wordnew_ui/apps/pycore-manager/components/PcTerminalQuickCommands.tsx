import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Search, SquareTerminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { usePcTerminalNode } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import type { TerminalQuickCommand, TerminalQuickCommands, TerminalShellOs } from '@/apps/pycore-manager/api';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';

interface PcTerminalQuickCommandsProps {
  /** Shell OS of the selected terminal as pycore detected it; the inline toggle can override it. */
  shellOs?: TerminalShellOs;
  disabled: boolean;
  busy: boolean;
  /** Sends the command line at once (the panel's one-shot options apply). */
  onRun: (command: string) => Promise<boolean>;
}

/** The recent command is a logical reference shared by every node and terminal; each node maps it to its own command line. */
export interface RecentCommandRef {
  kind: TerminalQuickCommand['kind'];
  id: string;
  /** Command line last run, shown when this node's list is not loaded yet. */
  label?: string;
}

/** Command lists per pycore node, kept for the page session (pycore caches its scan as well). */
const catalogCache = new Map<string, TerminalQuickCommands>();
/** One list request per node at a time, shared by the panel and every card header. */
const catalogRequests = new Map<string, Promise<TerminalQuickCommands | null>>();
const RECENT_COMMAND_EVENT = 'pc-terminal-recent-command';

const SHELL_OSES: readonly TerminalShellOs[] = ['windows', 'linux'];
/** Always one tap away in the collapsed row (kind + id), when the node offers them. */
const PINNED_COMMANDS: ReadonlyArray<{ kind: TerminalQuickCommand['kind']; id: string }> = [
  { kind: 'custom', id: 'claudeteam' },
  { kind: 'preset', id: 'dd_gitsync' },
];

/** The entry's command line for a shell OS; null when that OS has no such command. */
export function lineFor(entry: TerminalQuickCommand, os: TerminalShellOs, hostOs: string | undefined): string | null {
  const perOs = entry.commands?.[os];
  if (perOs !== undefined) return perOs;
  return os === hostOs ? entry.command : null;
}

const chipClass = 'inline-flex max-w-full items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] disabled:opacity-40';

/** The shell a command line is picked for: the terminal's detected shell, else the node's own OS. */
export function resolveShellOs(shellOs: TerminalShellOs | undefined, hostOs: string | undefined): TerminalShellOs {
  return shellOs ?? (hostOs === 'linux' ? 'linux' : 'windows');
}

export function readRecent(): RecentCommandRef | null {
  try {
    const value = JSON.parse(StorageManager.getRaw(StorageKeys.PYCORE_TERMINAL_RECENT_COMMAND) || 'null');
    return value && typeof value.kind === 'string' && typeof value.id === 'string' ? value : null;
  } catch {
    return null;
  }
}

export function entryId(entry: TerminalQuickCommand): string {
  return entry.id || entry.command || '';
}

function writeRecent(ref: RecentCommandRef): void {
  StorageManager.setRaw(StorageKeys.PYCORE_TERMINAL_RECENT_COMMAND, JSON.stringify(ref));
  window.dispatchEvent(new Event(RECENT_COMMAND_EVENT));
}

/** The shared recent command, kept in step across the panel and every card header. */
export function useRecentCommand(): [RecentCommandRef | null, (entry: TerminalQuickCommand, line: string) => void] {
  const [recent, setRecent] = useState<RecentCommandRef | null>(readRecent);
  useEffect(() => {
    const sync = () => setRecent(readRecent());
    window.addEventListener(RECENT_COMMAND_EVENT, sync);
    return () => window.removeEventListener(RECENT_COMMAND_EVENT, sync);
  }, []);
  const remember = useCallback((entry: TerminalQuickCommand, line: string) => {
    writeRecent({ kind: entry.kind, id: entryId(entry), label: line });
  }, []);
  return [recent, remember];
}

/** The node's command list with its pinned entries; loads once per node and page session. */
export function useQuickCommandCatalog() {
  const { api: terminalApi, nodeKey } = usePcTerminalNode();
  const [catalog, setCatalog] = useState<TerminalQuickCommands | null>(() => catalogCache.get(nodeKey) ?? null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async (): Promise<TerminalQuickCommands | null> => {
    setLoading(true);
    let request = catalogRequests.get(nodeKey);
    if (!request) {
      request = terminalApi.listTerminalCommands()
        .then((result) => {
          if (!result.success) return null;
          catalogCache.set(nodeKey, result);
          return result;
        })
        .catch(() => null)
        .finally(() => catalogRequests.delete(nodeKey));
      catalogRequests.set(nodeKey, request);
    }
    const result = await request;
    setLoadFailed(result === null);
    if (result) setCatalog(result);
    setLoading(false);
    return result;
  }, [nodeKey, terminalApi]);

  // Pinned chips need the list, so it loads with the panel (pycore answers from its cache).
  useEffect(() => {
    if (!catalog && !loading && !loadFailed) void load();
  }, [catalog, load, loadFailed, loading]);

  const allEntries = useMemo(
    () => (catalog ? [...(catalog.preset ?? []), ...catalog.system, ...catalog.custom] : []),
    [catalog],
  );
  const findEntry = useCallback(
    (ref: { kind: string; id: string }, list: TerminalQuickCommand[] = allEntries) => (
      list.find((candidate) => candidate.kind === ref.kind && entryId(candidate) === ref.id) ?? null
    ),
    [allEntries],
  );
  const pinned = useMemo(
    () => PINNED_COMMANDS.map((ref) => findEntry(ref)).filter((entry): entry is TerminalQuickCommand => entry !== null),
    [findEntry],
  );
  return { catalog, loading, loadFailed, load, findEntry, pinned };
}

/** Shown name: the command line itself (PATH name plus arguments), never a description. */
export function commandLabel(entry: TerminalQuickCommand, os: TerminalShellOs, hostOs: string | undefined): string {
  return lineFor(entry, os, hostOs) ?? entryId(entry);
}

/** Quick commands: a tap sends at once; pinned and recent commands stay in the collapsed row, the list holds every command. */
export const PcTerminalQuickCommands: React.FC<PcTerminalQuickCommandsProps> = ({
  shellOs, disabled, busy, onRun,
}) => {
  const { t } = useTranslation('pc');
  const { catalog, loading, loadFailed, load, findEntry, pinned } = useQuickCommandCatalog();
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('');
  const [recent, rememberRecent] = useRecentCommand();
  const [unavailable, setUnavailable] = useState('');
  const [osOverride, setOsOverride] = useState<TerminalShellOs | null>(null);
  const hostOs = catalog?.platform;
  const detectedOs = resolveShellOs(shellOs, hostOs);
  const activeOs = osOverride ?? detectedOs;

  // A new terminal starts on its own detected shell.
  useEffect(() => {
    setOsOverride(null);
  }, [shellOs]);

  const matches = useCallback((entry: TerminalQuickCommand) => {
    const needle = filter.trim().toLowerCase();
    return !needle
      || commandLabel(entry, activeOs, hostOs).toLowerCase().includes(needle)
      || entryId(entry).toLowerCase().includes(needle);
  }, [activeOs, filter, hostOs]);
  const presetCommands = useMemo(() => (catalog?.preset ?? []).filter(matches), [catalog, matches]);
  const systemCommands = useMemo(() => (catalog?.system ?? []).filter(matches), [catalog, matches]);
  const customCommands = useMemo(() => (catalog?.custom ?? []).filter(matches), [catalog, matches]);

  const run = async (entry: TerminalQuickCommand) => {
    const line = lineFor(entry, activeOs, hostOs);
    if (!line) {
      setUnavailable(commandLabel(entry, activeOs, hostOs));
      return;
    }
    setUnavailable('');
    if (await onRun(line)) rememberRecent(entry, line);
  };

  // The recent reference resolves against this node's list, so it runs the node's own command line.
  const runRecent = async () => {
    if (!recent) return;
    const list = catalog ?? await load();
    const entry = list ? findEntry(recent, [...(list.preset ?? []), ...list.system, ...list.custom]) : null;
    if (!entry) {
      setUnavailable(recent.label || recent.id);
      return;
    }
    await run(entry);
  };

  const chip = (entry: TerminalQuickCommand, tone: string) => {
    const line = lineFor(entry, activeOs, hostOs);
    return (
      <button
        key={`${entry.kind}:${entryId(entry)}`}
        type="button"
        onClick={() => void run(entry)}
        disabled={disabled || busy || line === null}
        title={line ?? t('terminal.commands.noLineForShell', { os: t(`terminal.commands.shellOs.${activeOs}`) })}
        className={`${chipClass} ${tone}`}
      >
        <span className="truncate">{commandLabel(entry, activeOs, hostOs)}</span>
      </button>
    );
  };

  const recentEntry = recent ? findEntry(recent) : null;
  const recentPinned = recentEntry !== null && pinned.some((entry) => entry === recentEntry);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <SquareTerminal className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        {recent && !recentPinned && (
          <button
            type="button"
            onClick={() => void runRecent()}
            disabled={disabled || busy}
            title={t('terminal.commands.recentHint', { command: recentEntry ? commandLabel(recentEntry, activeOs, hostOs) : recent.label || recent.id })}
            className={`${chipClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300`}
          >
            <span className="truncate">{recentEntry ? commandLabel(recentEntry, activeOs, hostOs) : recent.label || recent.id}</span>
          </button>
        )}
        {pinned.map((entry) => chip(entry, 'border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-300'))}
        <div role="radiogroup" aria-label={t('terminal.commands.shell')} className="ml-auto flex overflow-hidden rounded-md border border-slate-500/25 text-[10px]">
          {SHELL_OSES.map((os) => (
            <button
              key={os}
              type="button"
              role="radio"
              aria-checked={activeOs === os}
              onClick={() => setOsOverride(os)}
              title={os === detectedOs ? t('terminal.commands.shellDetected') : t('terminal.commands.shell')}
              className={`px-1.5 py-0.5 font-semibold ${activeOs === os ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-500/10'}`}
            >
              {t(`terminal.commands.shellOs.${os}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          title={t('terminal.commands.title')}
          aria-label={t('terminal.commands.title')}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-500/10"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {unavailable && (
        <p className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] text-amber-600 dark:text-amber-400">
          {t('terminal.commands.unavailableHere', { command: unavailable })}
        </p>
      )}

      {expanded && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <label className="relative block min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={t('terminal.commands.filter')}
                className="w-full rounded-md border border-slate-500/20 bg-white/60 py-1 pl-6 pr-2 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950/40 dark:text-slate-100"
              />
            </label>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              title={t('terminal.commands.reload')}
              aria-label={t('terminal.commands.reload')}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-500/10 hover:text-indigo-500 disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {loading && !catalog && (
            <div className="flex justify-center py-1 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /></div>
          )}
          {loadFailed && !loading && (
            <button type="button" onClick={() => void load()} className="w-full rounded-md bg-rose-500/10 p-1.5 text-[11px] text-rose-500">
              {t('terminal.commands.loadFailed')} · {t('common.retry')}
            </button>
          )}
          {catalog && (
            <div className="max-h-56 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
              {[
                { key: 'preset', entries: presetCommands, title: t('terminal.commands.preset'), tone: 'border-emerald-500/25 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300' },
                { key: 'system', entries: systemCommands, title: t('terminal.commands.system'), tone: 'border-slate-500/20 text-slate-700 hover:bg-slate-500/10 dark:text-slate-200' },
                { key: 'custom', entries: customCommands, title: t('terminal.commands.custom', { count: catalog.custom.length }), tone: 'border-indigo-500/25 text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-300' },
              ].filter((group) => group.entries.length > 0).map((group) => (
                <section key={group.key} className="space-y-1">
                  <h4 className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{group.title}</h4>
                  <div className="flex flex-wrap gap-1">{group.entries.map((entry) => chip(entry, group.tone))}</div>
                </section>
              ))}
              {!presetCommands.length && !systemCommands.length && !customCommands.length && (
                <p className="text-[10px] text-slate-400">{t('terminal.commands.empty')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
