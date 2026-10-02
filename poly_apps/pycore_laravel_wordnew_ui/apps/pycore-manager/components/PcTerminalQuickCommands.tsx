import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Play, RefreshCw, Search, SquareTerminal, X, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { usePcTerminalNode } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import type { TerminalQuickCommand, TerminalQuickCommands } from '@/apps/pycore-manager/api';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';

interface PcTerminalQuickCommandsProps {
  terminalNumber: number | null;
  disabled: boolean;
  busy: boolean;
  /** force: Ctrl+C stops the running command before the input line is cleared and the command runs. */
  onRun: (command: string, force: boolean) => Promise<boolean>;
}

/** Command lists per pycore node, kept for the page session (pycore caches its scan as well). */
const catalogCache = new Map<string, TerminalQuickCommands>();
const PRIMARY_NODE_KEY = 'primary';

const chipClass = 'inline-flex max-w-full items-center rounded-lg border px-2 py-1 font-mono text-[11px] disabled:opacity-40';

/** Quick commands: one tap re-runs the last command; the list holds system commands and the claudeteam scripts. */
export const PcTerminalQuickCommands: React.FC<PcTerminalQuickCommandsProps> = ({
  terminalNumber, disabled, busy, onRun,
}) => {
  const { t } = useTranslation('pc');
  const { api: terminalApi, nodeUrl } = usePcTerminalNode();
  const nodeKey = nodeUrl ?? PRIMARY_NODE_KEY;
  const [expanded, setExpanded] = useState(false);
  const [catalog, setCatalog] = useState<TerminalQuickCommands | null>(() => catalogCache.get(nodeKey) ?? null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState('');
  const [pending, setPending] = useState('');
  const [recent, setRecent] = useState<string>(() => StorageManager.getRaw(StorageKeys.PYCORE_TERMINAL_RECENT_COMMAND) || '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await terminalApi.listTerminalCommands();
      setLoadFailed(!result.success);
      if (result.success) {
        catalogCache.set(nodeKey, result);
        setCatalog(result);
      }
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [nodeKey, terminalApi]);

  useEffect(() => {
    if (expanded && !catalog && !loading) void load();
  }, [catalog, expanded, load, loading]);

  const matches = useCallback((entry: TerminalQuickCommand) => (
    !filter.trim() || entry.command.toLowerCase().includes(filter.trim().toLowerCase())
  ), [filter]);
  const presetCommands = useMemo(() => (catalog?.preset ?? []).filter(matches), [catalog, matches]);
  const systemCommands = useMemo(() => (catalog?.system ?? []).filter(matches), [catalog, matches]);
  const customCommands = useMemo(() => (catalog?.custom ?? []).filter(matches), [catalog, matches]);

  const confirmRun = async (force: boolean) => {
    const command = pending;
    if (!command) return;
    if (await onRun(command, force)) {
      setRecent(command);
      StorageManager.setRaw(StorageKeys.PYCORE_TERMINAL_RECENT_COMMAND, command);
    }
    setPending('');
  };

  const renderChips = (entries: TerminalQuickCommand[], tone: string) => (
    <div className="flex flex-wrap gap-1">
      {entries.map((entry) => (
        <button
          key={`${entry.kind}:${entry.command}`}
          type="button"
          onClick={() => setPending(entry.command)}
          disabled={disabled}
          title={entry.script || entry.command}
          className={`${chipClass} ${tone} ${pending === entry.command ? 'ring-1 ring-indigo-500' : ''}`}
        >
          <span className="truncate">{entry.command}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-2 rounded-xl border border-slate-500/15 bg-white/40 p-1.5 dark:bg-slate-950/20">
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          onClick={() => setPending(recent)}
          disabled={disabled || !recent}
          title={recent ? t('terminal.commands.recentHint', { command: recent }) : t('terminal.commands.noRecent')}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-2 text-left text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-40 dark:text-emerald-400"
        >
          <Play className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate font-mono">{recent || t('terminal.commands.noRecent')}</span>
        </button>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-500/10 dark:text-slate-300"
        >
          <SquareTerminal className="h-4 w-4" />
          {t('terminal.commands.title')}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {pending && (
        <div className="space-y-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-2">
          <p className="text-[10px] text-slate-500">
            {t('terminal.commands.confirm', { number: terminalNumber ?? '-' })}
          </p>
          <code className="block break-all rounded bg-slate-950/[0.06] px-2 py-1 font-mono text-[12px] text-slate-800 dark:bg-slate-950/50 dark:text-slate-100">
            {pending}
          </code>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => void confirmRun(false)}
              disabled={disabled || busy}
              title={t('terminal.commands.runHint')}
              className="inline-flex flex-[1_0_auto] items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {t('terminal.commands.run')}
            </button>
            <button
              type="button"
              onClick={() => void confirmRun(true)}
              disabled={disabled || busy}
              title={t('terminal.commands.forceRunHint')}
              className="inline-flex flex-[1_0_auto] items-center justify-center gap-1 rounded-lg bg-rose-500/15 px-3 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-500/25 disabled:opacity-40 dark:text-rose-400"
            >
              <Zap className="h-3.5 w-3.5" />
              {t('terminal.commands.forceRun')}
            </button>
            <button
              type="button"
              onClick={() => setPending('')}
              className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-500/10"
            >
              <X className="h-3.5 w-3.5" />
              {t('common.cancel')}
            </button>
          </div>
          <p className="text-[10px] text-slate-500">{t('terminal.commands.forceRunHint')}</p>
        </div>
      )}

      {expanded && (
        <div className="space-y-2 px-0.5 pb-0.5">
          <div className="flex items-center gap-1">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t('terminal.commands.filter')}
              className="w-full rounded-lg border border-slate-500/20 bg-white/60 py-1.5 pl-7 pr-2 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950/40 dark:text-slate-100"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            title={t('terminal.commands.reload')}
            aria-label={t('terminal.commands.reload')}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-500/10 hover:text-indigo-500 disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          </div>
          {loading && (
            <div className="flex justify-center py-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /></div>
          )}
          {loadFailed && !loading && (
            <button type="button" onClick={() => void load()} className="w-full rounded-lg bg-rose-500/10 p-2 text-[11px] text-rose-500">
              {t('terminal.commands.loadFailed')} · {t('common.retry')}
            </button>
          )}
          {catalog && (
            <div className="max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
              {presetCommands.length > 0 && (
                <section className="space-y-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('terminal.commands.preset')}</h4>
                  <div className="space-y-1">
                    {presetCommands.map((entry) => (
                      <button
                        key={`${entry.kind}:${entry.command}`}
                        type="button"
                        onClick={() => setPending(entry.command)}
                        disabled={disabled}
                        className={`block w-full rounded-lg border border-emerald-500/25 px-2 py-1.5 text-left hover:bg-emerald-500/10 disabled:opacity-40 ${
                          pending === entry.command ? 'ring-1 ring-indigo-500' : ''
                        }`}
                      >
                        <span className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          {t(`terminal.commands.presets.${entry.id}`)}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-emerald-600 dark:text-emerald-400">{entry.command}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section className="space-y-1">
                <h4 className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('terminal.commands.system')}</h4>
                {renderChips(systemCommands, 'border-slate-500/20 text-slate-700 hover:bg-slate-500/10 dark:text-slate-200')}
              </section>
              <section className="space-y-1">
                <h4 className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400" title={catalog.script_dir}>
                  {t('terminal.commands.custom', { count: catalog.custom.length })}
                </h4>
                {customCommands.length
                  ? renderChips(customCommands, 'border-indigo-500/25 text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-300')
                  : <p className="text-[10px] text-slate-400">{t('terminal.commands.empty')}</p>}
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
