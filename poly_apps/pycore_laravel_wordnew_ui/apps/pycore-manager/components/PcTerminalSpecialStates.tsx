import React from 'react';
import { BellRing, Hourglass, MessageSquareWarning, Moon, ScanSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  STATE_PROMPT_FOLLOW_UP,
  STATE_PROMPT_WAITING,
  STATE_RESUME_PENDING,
  usePcTerminalWatch,
} from '@/apps/pycore-manager/components/terminal/PcTerminalWatchContext';
import type { TerminalSpecialEntry } from '@/apps/pycore-manager/api';
import { formatClock } from '../../../core/utils/formatters';

interface PcTerminalSpecialStatesProps {
  terminalNames: Record<number, string>;
}

function stateIcon(state: string): React.ReactNode {
  const className = 'h-3.5 w-3.5 shrink-0';
  if (state === STATE_PROMPT_WAITING) return <BellRing className={`${className} text-amber-500`} />;
  if (state === STATE_PROMPT_FOLLOW_UP) return <ScanSearch className={`${className} text-indigo-500`} />;
  if (state === STATE_RESUME_PENDING) return <Hourglass className={`${className} text-sky-500`} />;
  return <MessageSquareWarning className={`${className} text-slate-500`} />;
}

/** Terminals the backup service holds in a special state (confirmation prompt, follow-up scans, pending resume) with live countdowns. */
export const PcTerminalSpecialStates: React.FC<PcTerminalSpecialStatesProps> = ({ terminalNames }) => {
  const { t } = useTranslation('pc');
  const watch = usePcTerminalWatch();

  if (!watch.entries.length) return null;

  const serverNow = watch.serverNow;
  const idleNow = watch.idleNow;
  const inactiveEnough = idleNow === null || idleNow >= watch.promptIdleSeconds;

  const detail = (entry: TerminalSpecialEntry): { label: string; tone: string; extra: string } => {
    const neutral = 'text-slate-600 dark:text-slate-300';
    if (entry.state === STATE_PROMPT_WAITING) {
      return { label: t('terminal.special.promptWaiting'), tone: 'text-amber-600 dark:text-amber-400', extra: '' };
    }
    const remaining = typeof entry.due_at === 'number' ? entry.due_at - serverNow : null;
    const countdown = remaining !== null && remaining > 0;
    const waitingIdle = remaining !== null && !countdown && !inactiveEnough;
    const time = remaining !== null ? formatClock(Math.max(0, Math.ceil(remaining)), { padMinutes: true }) : '';
    let label: string;
    if (entry.state === STATE_PROMPT_FOLLOW_UP) {
      label = countdown ? t('terminal.special.nextScan', { time }) : t(waitingIdle ? 'terminal.special.waitingIdle' : 'terminal.special.scanDue');
    } else if (entry.state === STATE_RESUME_PENDING) {
      label = countdown ? t('terminal.special.resumeIn', { time }) : t(waitingIdle ? 'terminal.special.waitingIdle' : 'terminal.special.resumeDue');
    } else {
      label = countdown ? t('terminal.special.countdown', { time }) : t(waitingIdle ? 'terminal.special.waitingIdle' : 'terminal.special.due');
    }
    const parts: string[] = [];
    if (entry.state === STATE_PROMPT_FOLLOW_UP && typeof entry.misses === 'number') {
      parts.push(t('terminal.special.misses', { misses: entry.misses, limit: entry.miss_limit ?? '?' }));
    }
    if (entry.state === STATE_RESUME_PENDING && entry.notice) parts.push(entry.notice);
    return {
      label,
      tone: waitingIdle ? 'text-slate-500' : (countdown ? 'text-indigo-600 dark:text-indigo-400' : neutral),
      extra: parts.join(' · '),
    };
  };

  return (
    <section className="pc-glass space-y-2 px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Hourglass className="h-4 w-4 text-sky-500" />
        <span className="font-semibold text-slate-700 dark:text-slate-200">{t('terminal.special.title')}</span>
        <span className="rounded-md bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
          {watch.entries.length}
        </span>
        {idleNow !== null && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-500">
            <Moon className="h-3 w-3" />
            {t('terminal.special.idle', { time: formatClock(idleNow) })}
          </span>
        )}
      </div>
      <ul className="space-y-1">
        {watch.entries.map((entry) => {
          const info = detail(entry);
          const title = terminalNames[entry.number];
          return (
            <li
              key={`${entry.number}:${entry.state}`}
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-slate-500/15 px-2.5 py-1.5"
            >
              {stateIcon(entry.state)}
              <span className="shrink-0 font-semibold text-indigo-500">#{entry.number}</span>
              {title && <span className="min-w-0 max-w-[14rem] truncate text-slate-700 dark:text-slate-200">{title}</span>}
              <span className="shrink-0 rounded-md bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-500">
                {t(`terminal.special.state.${entry.state}`, { defaultValue: entry.state })}
              </span>
              <span className={`ml-auto shrink-0 font-mono text-[11px] font-semibold ${info.tone}`}>{info.label}</span>
              {info.extra && (
                <span className="w-full min-w-0 truncate pl-5 text-[10px] text-slate-500">{info.extra}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default PcTerminalSpecialStates;
