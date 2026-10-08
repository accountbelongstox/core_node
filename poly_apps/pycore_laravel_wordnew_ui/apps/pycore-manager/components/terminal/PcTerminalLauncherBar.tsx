/**
 * Desktop-icon launcher controls for the node: run the launcher in a chosen mode, undo a launch
 * (close every terminal window and stop the launcher's apps) or restart everything.
 */
import React, { useCallback, useState } from 'react';
import { Loader2, Power, Rocket, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  TerminalLauncherAction,
  TerminalLauncherMode,
  TerminalLauncherResult,
} from '@/apps/pycore-manager/api';
import { usePcTerminalApi } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';

const LAUNCHER_MODES: TerminalLauncherMode[] = ['device', 'windows', 'both'];
const CONFIRMED_ACTIONS: ReadonlySet<TerminalLauncherAction> = new Set(['kill', 'restart']);

export interface PcTerminalLauncherNotice {
  kind: 'success' | 'error';
  translationKey: string;
  translationValues?: Record<string, string | number>;
}

interface PcTerminalLauncherBarProps {
  errorTranslationKey: (errorCode?: string | null) => string;
  onNotice: (notice: PcTerminalLauncherNotice) => void;
  onDone: () => void;
}

export const PcTerminalLauncherBar: React.FC<PcTerminalLauncherBarProps> = ({ errorTranslationKey, onNotice, onDone }) => {
  const { t } = useTranslation('pc');
  const terminalApi = usePcTerminalApi();
  const [mode, setMode] = useState<TerminalLauncherMode>('device');
  const [busy, setBusy] = useState<TerminalLauncherAction | null>(null);

  const run = useCallback(async (action: TerminalLauncherAction) => {
    if (busy) return;
    if (CONFIRMED_ACTIONS.has(action) && !window.confirm(t(`terminal.launcher.confirm.${action}`))) return;
    setBusy(action);
    try {
      let result: TerminalLauncherResult;
      if (action === 'launch') result = await terminalApi.launchTerminalLauncher(mode);
      else if (action === 'kill') result = await terminalApi.killTerminalLauncher();
      else result = await terminalApi.restartTerminalLauncher(mode);
      onNotice(result.success
        ? {
          kind: 'success',
          translationKey: `terminal.launcher.done.${action}`,
          translationValues: {
            terminals: result.closed_terminals?.length ?? 0,
            apps: result.stopped_apps?.length ?? 0,
          },
        }
        : { kind: 'error', translationKey: errorTranslationKey(result.error_code) });
    } catch {
      onNotice({ kind: 'error', translationKey: 'terminal.errors.request' });
    } finally {
      setBusy(null);
      onDone();
    }
  }, [busy, errorTranslationKey, mode, onDone, onNotice, t, terminalApi]);

  const actions: Array<{ id: TerminalLauncherAction; icon: React.ElementType; tone: string }> = [
    { id: 'launch', icon: Rocket, tone: 'bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-300' },
    { id: 'restart', icon: RotateCcw, tone: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400' },
    { id: 'kill', icon: Power, tone: 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400' },
  ];

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5" aria-label={t('terminal.launcher.title')}>
      <select
        value={mode}
        onChange={(event) => setMode(event.target.value as TerminalLauncherMode)}
        disabled={Boolean(busy)}
        title={t('terminal.launcher.modeHint')}
        aria-label={t('terminal.launcher.modeHint')}
        className="min-w-0 rounded-lg border border-slate-500/20 bg-transparent px-1.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
      >
        {LAUNCHER_MODES.map((value) => (
          <option key={value} value={value}>{t(`terminal.launcher.modes.${value}`)}</option>
        ))}
      </select>
      {actions.map(({ id, icon: Icon, tone }) => (
        <button
          key={id}
          type="button"
          onClick={() => void run(id)}
          disabled={Boolean(busy)}
          title={t(`terminal.launcher.hints.${id}`)}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold disabled:opacity-50 ${tone}`}
        >
          {busy === id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
          {t(`terminal.launcher.actions.${id}`)}
        </button>
      ))}
    </div>
  );
};
