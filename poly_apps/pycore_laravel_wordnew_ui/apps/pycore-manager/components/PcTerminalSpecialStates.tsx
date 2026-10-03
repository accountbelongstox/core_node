import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, Hourglass, MessageSquareWarning, Moon, ScanSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { usePcTerminalApi } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import type { TerminalSpecialEntry } from '@/apps/pycore-manager/api';
import { formatClock } from '../../../core/utils/formatters';

const POLL_INTERVAL_MS = 5000;
const TICK_INTERVAL_MS = 1000;
const MS_PER_SECOND = 1000;
const STATE_PROMPT_WAITING = 'prompt_waiting';
const STATE_PROMPT_FOLLOW_UP = 'prompt_follow_up';
const STATE_RESUME_PENDING = 'resume_pending';

interface SpecialSnapshot {
  entries: TerminalSpecialEntry[];
  clockOffset: number;
  idleSeconds: number | null;
  promptIdleSeconds: number;
  receivedAt: number;
}

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
  const terminalApi = usePcTerminalApi();
  const [snapshot, setSnapshot] = useState<SpecialSnapshot | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const aliveRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const result = await terminalApi.terminalBackupState();
      if (!aliveRef.current) return;
      if (!result.success) {
        setSnapshot(null);
        return;
      }
      const receivedAt = Date.now();
      const serverTime = Number(result.server_time);
      const idle = result.idle_seconds;
      setSnapshot({
        entries: Array.isArray(result.special_terminals) ? result.special_terminals : [],
        clockOffset: Number.isFinite(serverTime) ? serverTime - receivedAt / MS_PER_SECOND : 0,
        idleSeconds: typeof idle === 'number' && Number.isFinite(idle) ? idle : null,
        promptIdleSeconds: Number(result.prompt_idle_seconds) || 0,
        receivedAt,
      });
      setNowMs(receivedAt);
    } catch {
      if (aliveRef.current) setSnapshot(null);
    }
  }, [terminalApi]);

  useEffect(() => {
    aliveRef.current = true;
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      aliveRef.current = false;
      window.clearInterval(timer);
    };
  }, [poll]);

  const hasEntries = Boolean(snapshot?.entries.length);
  useEffect(() => {
    if (!hasEntries) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), TICK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hasEntries]);

  if (!snapshot || !snapshot.entries.length) return null;

  const serverNow = nowMs / MS_PER_SECOND + snapshot.clockOffset;
  const idleNow = snapshot.idleSeconds === null
    ? null
    : snapshot.idleSeconds + Math.max(0, (nowMs - snapshot.receivedAt) / MS_PER_SECOND);
  const inactiveEnough = idleNow === null || idleNow >= snapshot.promptIdleSeconds;

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
          {snapshot.entries.length}
        </span>
        {idleNow !== null && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-500">
            <Moon className="h-3 w-3" />
            {t('terminal.special.idle', { time: formatClock(idleNow) })}
          </span>
        )}
      </div>
      <ul className="space-y-1">
        {snapshot.entries.map((entry) => {
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
