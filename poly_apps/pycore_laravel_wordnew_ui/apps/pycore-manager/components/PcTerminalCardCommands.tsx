import React from 'react';
import { useTranslation } from 'react-i18next';

import type { TerminalShellOs } from '@/apps/pycore-manager/api';
import {
  commandLabel,
  lineFor,
  resolveShellOs,
  useQuickCommandCatalog,
  useRecentCommand,
  type QuickCommandChoice,
} from '@/apps/pycore-manager/components/PcTerminalQuickCommands';

interface PcTerminalCardCommandsProps {
  shellOs?: TerminalShellOs;
  disabled: boolean;
  busy: boolean;
  /** Asks to run the library command on this card's terminal (confirmed, then run by pycore's quick-command route). */
  onRun: (choice: QuickCommandChoice) => void;
}

const chipClass = 'inline-flex min-w-0 max-w-[12rem] items-center rounded border px-1.5 py-0.5 font-mono text-[10px] disabled:opacity-40';

/** Card title quick commands: the pinned and the recent library commands. */
export const PcTerminalCardCommands: React.FC<PcTerminalCardCommandsProps> = ({
  shellOs, disabled, busy, onRun,
}) => {
  const { t } = useTranslation('pc');
  const { catalog, findEntry, pinned } = useQuickCommandCatalog();
  const [recent] = useRecentCommand();
  const hostOs = catalog?.platform;
  const os = resolveShellOs(shellOs, hostOs);
  const recentEntry = recent ? findEntry(recent) : null;
  const entries = recentEntry && !pinned.includes(recentEntry) ? [recentEntry, ...pinned] : pinned;
  if (!catalog || !entries.length) return null;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {entries.map((entry) => {
        const line = lineFor(entry, os, hostOs);
        return (
          <button
            key={entry.key}
            type="button"
            onClick={() => { if (line) onRun({ entry, platform: os, line, interrupt: catalog.interrupt }); }}
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
    </div>
  );
};
