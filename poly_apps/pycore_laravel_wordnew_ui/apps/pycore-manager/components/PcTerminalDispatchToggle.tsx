import React from 'react';
import { Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  DISPATCH_AGENT_KINDS,
  type DispatchAgentKind,
  type TerminalDispatchSetting,
} from '@/apps/pycore-manager/components/terminal/terminalAgentDispatch';

interface PcTerminalDispatchToggleProps {
  setting: TerminalDispatchSetting;
  disabled?: boolean;
}

/** Composer toggle: send each message to an idle agent terminal of the chosen kind instead of the current one. */
export const PcTerminalDispatchToggle: React.FC<PcTerminalDispatchToggleProps> = ({ setting, disabled = false }) => {
  const { t } = useTranslation('pc');
  const label = t('terminal.dispatch.toggle');
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1">
      <label title={`${label}: ${t('terminal.dispatch.hint')}`} className="shrink-0 cursor-pointer">
        <input
          type="checkbox"
          className="peer sr-only"
          aria-label={label}
          checked={setting.enabled}
          disabled={disabled}
          onChange={(event) => setting.setEnabled(event.target.checked)}
        />
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-500/20 text-emerald-600 peer-checked:bg-emerald-600 peer-checked:text-white peer-disabled:opacity-50 dark:text-emerald-400">
          <Share2 className="h-4 w-4" />
        </span>
      </label>
      <select
        value={setting.agent}
        disabled={disabled}
        onChange={(event) => setting.setAgent(event.target.value as DispatchAgentKind)}
        title={t('terminal.dispatch.agentHint')}
        aria-label={t('terminal.dispatch.agentLabel')}
        className="h-8 w-[5.5rem] min-w-0 rounded-lg border border-slate-500/20 bg-transparent px-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:text-slate-200"
      >
        {DISPATCH_AGENT_KINDS.map((kind) => (
          <option key={kind} value={kind} className="text-slate-900">{t(`terminal.dispatch.agents.${kind}`)}</option>
        ))}
      </select>
    </div>
  );
};
