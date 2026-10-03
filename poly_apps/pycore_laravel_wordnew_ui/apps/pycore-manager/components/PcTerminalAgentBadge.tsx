import React from 'react';
import { Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { TerminalAiAgent } from '@/apps/pycore-manager/api';

interface PcTerminalAgentBadgeProps {
  agent?: TerminalAiAgent | null;
  /** Icon only, for dense title bars and jump tiles. */
  iconOnly?: boolean;
  /** Icon size override (status marks). */
  iconClassName?: string;
  className?: string;
}

export function PcTerminalAgentBadge({ agent, iconOnly = false, iconClassName, className = '' }: PcTerminalAgentBadgeProps) {
  const { t } = useTranslation('pc');
  if (!agent) return null;
  const hint = t('terminal.agent.hint', {
    rule: t(`terminal.agent.rules.${agent.rule}`, { defaultValue: agent.rule }),
    source: t(`terminal.agent.sources.${agent.source}`, { defaultValue: agent.source }),
  });
  return (
    <span
      title={hint}
      aria-label={hint}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded font-semibold ${
        iconOnly ? 'text-fuchsia-300' : 'bg-fuchsia-500/25 px-1.5 py-0.5 text-[9px] text-fuchsia-200'
      } ${className}`}
    >
      <Bot className={iconClassName ?? (iconOnly ? 'h-3 w-3' : 'h-2.5 w-2.5')} />
      {!iconOnly && t('terminal.agent.badge')}
    </span>
  );
}
