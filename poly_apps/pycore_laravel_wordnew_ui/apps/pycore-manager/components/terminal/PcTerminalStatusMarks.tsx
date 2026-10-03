import React from 'react';
import { BellRing, CircleCheck, Hourglass, LoaderCircle, Moon, Pause, PenLine, ScanSearch, SquareTerminal, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PcTerminalAgentBadge } from '@/apps/pycore-manager/components/PcTerminalAgentBadge';
import {
  STATE_PROMPT_FOLLOW_UP,
  STATE_PROMPT_WAITING,
  STATE_RESUME_PENDING,
  usePcTerminalWatch,
} from '@/apps/pycore-manager/components/terminal/PcTerminalWatchContext';
import type { TerminalWindowInfo } from '@/apps/pycore-manager/api';
import { usePcTerminalNavActions } from '@/apps/pycore-manager/components/terminal/PcTerminalNavContext';
import { formatClock } from '../../../../core/utils/formatters';

type MarkSize = 'tile' | 'bar';

const ICON_CLASS: Record<MarkSize, string> = { tile: 'h-2 w-2', bar: 'h-3 w-3' };
const COUNTDOWN_CLASS: Record<MarkSize, string> = { tile: 'text-[7px] leading-none', bar: 'text-[9px] leading-none' };

interface TerminalCountdown {
  state: string;
  seconds: number;
  /** Local wall-clock time the countdown ends at. */
  endsAt: Date;
}

function clockText(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Nearest per-terminal countdown (usage-limit resume first, then prompt follow-up scan). */
function useTerminalCountdown(terminalNumber: number): { waiting: boolean; followUp: boolean; resume: boolean; countdown: TerminalCountdown | null } {
  const watch = usePcTerminalWatch();
  const entries = watch.entriesFor(terminalNumber);
  let countdown: TerminalCountdown | null = null;
  for (const state of [STATE_RESUME_PENDING, STATE_PROMPT_FOLLOW_UP]) {
    const entry = entries.find((item) => item.state === state && typeof item.due_at === 'number');
    if (entry && countdown === null) {
      countdown = {
        state,
        seconds: Math.max(0, Math.ceil(Number(entry.due_at) - watch.serverNow)),
        endsAt: watch.localDate(Number(entry.due_at)),
      };
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
  /** The UI holds an unsent draft for this terminal. */
  hasDraft?: boolean;
  className?: string;
}

/** Tiny per-terminal marks: AI agent / plain terminal, pending confirmation, usage-limit wait, with its countdown. */
export function PcTerminalStatusMarks({ windowInfo, size = 'bar', inlineCountdown = true, hasDraft = false, className = '' }: PcTerminalStatusMarksProps) {
  const { t } = useTranslation('pc');
  const watch = usePcTerminalWatch();
  const { openFinished } = usePcTerminalNavActions();
  const { waiting, followUp, resume, countdown } = useTerminalCountdown(windowInfo.terminal_number);
  const icon = ICON_CLASS[size];
  const draftMark = (hasDraft || windowInfo.has_draft) && (
    <PenLine className={`${icon} text-cyan-300`} aria-label={t('terminal.marks.draft')}><title>{t('terminal.marks.draft')}</title></PenLine>
  );
  if (!windowInfo.online) return draftMark ? <span className={`inline-flex shrink-0 items-center ${className}`}>{draftMark}</span> : null;
  const activity = windowInfo.agent_activity;
  const finishedAt = activity?.finished_at ?? null;
  const unseenFinish = !activity?.busy && finishedAt !== null && finishedAt > (watch.acknowledged[windowInfo.terminal_number] ?? 0);
  const finishedHint = finishedAt !== null ? t('terminal.marks.finished', { time: clockText(watch.localDate(finishedAt)) }) : '';
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
      {activity?.busy && (
        <LoaderCircle className={`${icon} animate-spin text-fuchsia-300`} aria-label={t('terminal.marks.working')}>
          <title>{t('terminal.marks.working')}</title>
        </LoaderCircle>
      )}
      {unseenFinish && (openFinished ? (
        <span
          role="button"
          tabIndex={0}
          title={`${finishedHint} - ${t('terminal.nav.openFinished')}`}
          aria-label={t('terminal.nav.openFinished')}
          onClick={(event) => { event.stopPropagation(); openFinished(windowInfo.terminal_number); }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            openFinished(windowInfo.terminal_number);
          }}
          className="inline-flex cursor-pointer items-center rounded-sm hover:bg-emerald-400/20"
        >
          <CircleCheck className={`${icon} text-emerald-400`} />
        </span>
      ) : (
        <CircleCheck className={`${icon} text-emerald-400`} aria-label={finishedHint}><title>{finishedHint}</title></CircleCheck>
      ))}
      {draftMark}
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
  const resume = countdown.state === STATE_RESUME_PENDING;
  const hint = resume
    ? t('terminal.marks.limitUntil', { time: clockText(countdown.endsAt) })
    : t('terminal.marks.followUp');
  return (
    <span
      title={hint}
      className={`font-mono font-semibold tabular-nums ${COUNTDOWN_CLASS[size]} ${
        resume ? 'text-sky-300' : 'text-amber-300'
      }`}
    >
      {formatClock(countdown.seconds, { padMinutes: false })}
      {resume && size === 'bar' && <span className="ml-0.5 opacity-70">→{clockText(countdown.endsAt)}</span>}
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
  if (!watch.available) return null;
  if (watch.passPausedRemaining > 0) {
    const pausedHint = t('terminal.marks.globalPaused', { count: watch.passPausedRemaining });
    return (
      <span
        title={pausedHint}
        aria-label={pausedHint}
        className={`pointer-events-auto inline-flex items-center gap-0.5 font-mono text-[9px] font-semibold tabular-nums text-amber-400 ${className}`}
      >
        <Pause className="h-2.5 w-2.5" />
        {watch.passPausedRemaining}
      </span>
    );
  }
  if (watch.nextPassAt === null) return null;
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
