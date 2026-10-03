import React from 'react';
import { BellRing, Hourglass, Moon, ScanSearch, SquareTerminal, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PcTerminalAgentBadge } from '@/apps/pycore-manager/components/PcTerminalAgentBadge';
import {
  STATE_PROMPT_FOLLOW_UP,
  STATE_PROMPT_WAITING,
  STATE_RESUME_PENDING,
  usePcTerminalWatch,
} from '@/apps/pycore-manager/components/terminal/PcTerminalWatchContext';
import type { TerminalWindowInfo } from '@/apps/pycore-manager/api';
import { formatClock } from '../../../../core/utils/formatters';

type MarkSize = 'tile' | 'bar';

const ICON_CLASS: Record<MarkSize, string> = { tile: 'h-2 w-2', bar: 'h-3 w-3' };
const COUNTDOWN_CLASS: Record<MarkSize, string> = { tile: 'text-[7px] leading-none', bar: 'text-[9px] leading-none' };

interface TerminalCountdown {
  state: string;
  seconds: number;
}

/** Nearest per-terminal countdown (usage-limit resume first, then prompt follow-up scan). */
function useTerminalCountdown(terminalNumber: number): { waiting: boolean; followUp: boolean; resume: boolean; countdown: TerminalCountdown | null } {
  const watch = usePcTerminalWatch();
  const entries = watch.entriesFor(terminalNumber);
  let countdown: TerminalCountdown | null = null;
  for (const state of [STATE_RESUME_PENDING, STATE_PROMPT_FOLLOW_UP]) {
    const entry = entries.find((item) => item.state === state && typeof item.due_at === 'number');
    if (entry && countdown === null) {
      countdown = { state, seconds: Math.max(0, Math.ceil(Number(entry.due_at) - watch.serverNow)) };
    }
  }
  return {
    waiting: entries.some((item) => item.state === STATE_PROMPT_WAITING),
    followUp: entries.some((item) => item.state === STATE_PROMPT_FOLLOW_UP),
    resume: entries.some((item) => item.state === STATE_RESUME_PENDING),
    countdown,
  };
}

interface PcTerminalStatusMarksProps {
  windowInfo: TerminalWindowInfo;
  size?: MarkSize;
  /** Render the countdown inline after the icons (title bars); tiles place it themselves. */
  inlineCountdown?: boolean;
  className?: string;
}

/** Tiny per-terminal marks: AI agent / plain terminal, pending confirmation, usage-limit wait, with its countdown. */
export function PcTerminalStatusMarks({ windowInfo, size = 'bar', inlineCountdown = true, className = '' }: PcTerminalStatusMarksProps) {
  const { t } = useTranslation('pc');
  const { waiting, followUp, resume, countdown } = useTerminalCountdown(windowInfo.terminal_number);
  if (!windowInfo.online) return null;
  const icon = ICON_CLASS[size];
  const plainHint = t(windowInfo.agent_scanned ? 'terminal.marks.plain' : 'terminal.marks.notScanned');
  return (
    <span className={`inline-flex shrink-0 items-center gap-px ${className}`}>
      {windowInfo.ai_agent ? (
        <PcTerminalAgentBadge agent={windowInfo.ai_agent} iconOnly iconClassName={icon} />
      ) : windowInfo.agent_scanned ? (
        <SquareTerminal className={`${icon} text-slate-400`} aria-label={plainHint}><title>{plainHint}</title></SquareTerminal>
      ) : (
        <Terminal className={`${icon} text-slate-500/50`} aria-label={plainHint}><title>{plainHint}</title></Terminal>
      )}
      {(waiting || followUp) && (
        <BellRing className={`${icon} ${waiting ? 'text-amber-400' : 'text-amber-300/70'}`} aria-label={t('terminal.marks.yesPending')}>
          <title>{t('terminal.marks.yesPending')}</title>
        </BellRing>
      )}
      {resume && (
        <Hourglass className={`${icon} text-sky-400`} aria-label={t('terminal.marks.limitWait')}>
          <title>{t('terminal.marks.limitWait')}</title>
        </Hourglass>
      )}
      {inlineCountdown && countdown && <PcTerminalCountdownText countdown={countdown} size={size} />}
    </span>
  );
}

function PcTerminalCountdownText({ countdown, size }: { countdown: TerminalCountdown; size: MarkSize }) {
  const { t } = useTranslation('pc');
  const hint = t(countdown.state === STATE_RESUME_PENDING ? 'terminal.marks.limitWait' : 'terminal.marks.followUp');
  return (
    <span
      title={hint}
      className={`font-mono font-semibold tabular-nums ${COUNTDOWN_CLASS[size]} ${
        countdown.state === STATE_RESUME_PENDING ? 'text-sky-300' : 'text-amber-300'
      }`}
    >
      {formatClock(countdown.seconds, { padMinutes: false })}
    </span>
  );
}

/** Countdown of one terminal on its own (tile corner); renders nothing without one. */
export function PcTerminalTileCountdown({ windowInfo, className = '' }: { windowInfo: TerminalWindowInfo; className?: string }) {
  const { countdown } = useTerminalCountdown(windowInfo.terminal_number);
  if (!windowInfo.online || !countdown) return null;
  return (
    <span className={`pointer-events-none ${className}`}>
      <PcTerminalCountdownText countdown={countdown} size="tile" />
    </span>
  );
}

/** Global next-pass countdown, absolutely positioned by the caller so it takes no layout space. */
export function PcTerminalGlobalCountdown({ className = '' }: { className?: string }) {
  const { t } = useTranslation('pc');
  const watch = usePcTerminalWatch();
  if (!watch.available || watch.nextPassAt === null) return null;
  const remaining = Math.ceil(watch.nextPassAt - watch.serverNow);
  const waitingIdle = remaining <= 0 && watch.idleNow !== null && watch.idleNow < watch.minIdleSeconds;
  const hint = remaining > 0
    ? t('terminal.marks.globalNext', { time: formatClock(remaining, { padMinutes: false }) })
    : t(waitingIdle ? 'terminal.marks.globalWaitingIdle' : 'terminal.marks.globalDue');
  return (
    <span
      title={hint}
      aria-label={hint}
      className={`pointer-events-auto inline-flex items-center gap-0.5 font-mono text-[9px] font-semibold tabular-nums text-slate-400 ${className}`}
    >
      {waitingIdle ? <Moon className="h-2.5 w-2.5" /> : <ScanSearch className="h-2.5 w-2.5" />}
      {remaining > 0 ? formatClock(remaining, { padMinutes: false }) : '--'}
    </span>
  );
}
