import React from 'react';
import { Code, Fish, Moon, Pi, Server, SquareTerminal, UsersRound, type LucideIcon } from 'lucide-react';
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

/** Icon names of config/terminal_quick_commands.json `card`; an unknown name falls back to the terminal icon. */
const CARD_COMMAND_ICONS: Record<string, LucideIcon> = {
  claude_team: UsersRound,
  codex: Code,
  pi: Pi,
  kimi: Moon,
  deepseek: Fish,
  ssh: Server,
};

const iconClass = 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border disabled:opacity-40';

/** Card title quick commands: one icon per configured card command, on a single row that never wraps. */
export const PcTerminalCardCommands: React.FC<PcTerminalCardCommandsProps> = ({
  shellOs, disabled, busy, onRun,
}) => {
  const { t } = useTranslation('pc');
  const { catalog, findEntry, pinned, card } = useQuickCommandCatalog();
  const [recent] = useRecentCommand();
  const hostOs = catalog?.platform;
  const os = resolveShellOs(shellOs, hostOs);
  const recentEntry = recent ? findEntry(recent) : null;
  const items = catalog?.card ? card : pinned.map((entry) => ({ entry, icon: '' }));
  if (!catalog || !items.length) return null;

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map(({ entry, icon }) => {
        const line = lineFor(entry, os, hostOs);
        const Icon = CARD_COMMAND_ICONS[icon] ?? SquareTerminal;
        const label = line
          ? commandLabel(entry, os, hostOs)
          : t('terminal.commands.noLineForShell', { os: t(`terminal.commands.shellOs.${os}`) });
        return (
          <button
            key={entry.key}
            type="button"
            onClick={() => { if (line) onRun({ entry, platform: os, line, interrupt: catalog.interrupt }); }}
            disabled={disabled || busy || line === null}
            title={label}
            aria-label={label}
            className={`${iconClass} ${entry === recentEntry
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
              : 'border-indigo-400/40 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25'}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
};
