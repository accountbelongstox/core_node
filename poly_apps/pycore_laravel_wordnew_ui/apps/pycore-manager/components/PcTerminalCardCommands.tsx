import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { TerminalQuickCommand, TerminalShellOs } from '@/apps/pycore-manager/api';
import {
  commandLabel,
  entryId,
  lineFor,
  resolveShellOs,
  useQuickCommandCatalog,
  useRecentCommand,
} from '@/apps/pycore-manager/components/PcTerminalQuickCommands';

interface PcTerminalCardCommandsProps {
  shellOs?: TerminalShellOs;
  disabled: boolean;
  busy: boolean;
  /** Runs the command line on this card's terminal; restart presses Ctrl+C several times first. */
  onRun: (command: string, restart: boolean) => Promise<boolean>;
}

const chipClass = 'inline-flex min-w-0 max-w-[12rem] items-center rounded border px-1.5 py-0.5 font-mono text-[10px] disabled:opacity-40';

/** Card title quick commands: pinned and recent commands, with a one-shot restart (Ctrl+C several times first). */
export const PcTerminalCardCommands: React.FC<PcTerminalCardCommandsProps> = ({
  shellOs, disabled, busy, onRun,
}) => {
  const { t } = useTranslation('pc');
  const { catalog, findEntry, pinned } = useQuickCommandCatalog();
  const [recent, rememberRecent] = useRecentCommand();
  const [restart, setRestart] = useState(false);
  const hostOs = catalog?.platform;
  const os = resolveShellOs(shellOs, hostOs);
  const recentEntry = recent ? findEntry(recent) : null;
  const entries = recentEntry && !pinned.includes(recentEntry) ? [recentEntry, ...pinned] : pinned;
  if (!entries.length) return null;

  const run = async (entry: TerminalQuickCommand, line: string) => {
    if (!await onRun(line, restart)) return;
    rememberRecent(entry, line);
    setRestart(false);
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {entries.map((entry) => {
        const line = lineFor(entry, os, hostOs);
        return (
          <button
            key={`${entry.kind}:${entryId(entry)}`}
            type="button"
            onClick={() => { if (line) void run(entry, line); }}
            disabled={disabled || busy || line === null}
            title={line ?? t('terminal.commands.noLineForShell', { os: t(`terminal.commands.shellOs.${os}`) })}
            className={`${chipClass} ${entry === recentEntry
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
              : 'border-indigo-400/40 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25'}`}
          >
            <span className="truncate">{commandLabel(entry, os, hostOs)}</span>
          </button>
        );
      })}
      <label
        title={t('terminal.commands.restartHint')}
        className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
          restart ? 'border-rose-400/60 bg-rose-500/20 text-rose-200' : 'border-white/15 text-slate-300 hover:bg-white/10'
        }`}
      >
        <input
          type="checkbox"
          checked={restart}
          onChange={(event) => setRestart(event.target.checked)}
          disabled={disabled}
          className="h-3 w-3 accent-rose-500"
        />
        <RotateCcw className="h-3 w-3" aria-hidden="true" />
        <span>{t('terminal.commands.restart')}</span>
      </label>
    </div>
  );
};
