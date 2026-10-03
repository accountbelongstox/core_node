import React, { useEffect, useRef, useState } from 'react';
import { CircleCheck, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { TerminalWindowInfo } from '@/apps/pycore-manager/api';

const DISMISS_MS = 15000;
const MAX_TOASTS = 5;

interface AgentDoneToast {
  key: string;
  terminalNumber: number;
  name: string;
}

interface PcTerminalAgentDoneToastsProps {
  windows: TerminalWindowInfo[];
  nameFor: (windowInfo: TerminalWindowInfo) => string;
  onOpen: (terminalNumber: number) => void;
}

/** One toast per AI-agent working -> idle transition seen in snapshots (the first snapshot only seeds). */
export const PcTerminalAgentDoneToasts: React.FC<PcTerminalAgentDoneToastsProps> = ({ windows, nameFor, onOpen }) => {
  const { t } = useTranslation('pc');
  const [toasts, setToasts] = useState<AgentDoneToast[]>([]);
  const seenRef = useRef<Map<number, number> | null>(null);

  useEffect(() => {
    const finished = new Map<number, number>();
    for (const windowInfo of windows) {
      const finishedAt = windowInfo.online ? windowInfo.agent_activity?.finished_at : null;
      if (typeof finishedAt === 'number') finished.set(windowInfo.terminal_number, finishedAt);
    }
    const seen = seenRef.current;
    seenRef.current = finished;
    if (seen === null) return;
    const fresh = windows
      .filter((windowInfo) => {
        const finishedAt = finished.get(windowInfo.terminal_number);
        return finishedAt !== undefined && finishedAt > (seen.get(windowInfo.terminal_number) ?? 0);
      })
      .map((windowInfo) => ({
        key: `${windowInfo.terminal_number}:${finished.get(windowInfo.terminal_number)}`,
        terminalNumber: windowInfo.terminal_number,
        name: nameFor(windowInfo),
      }));
    if (!fresh.length) return;
    setToasts((previous) => [...fresh, ...previous].slice(0, MAX_TOASTS));
    window.setTimeout(() => {
      setToasts((previous) => previous.filter((toast) => !fresh.some((item) => item.key === toast.key)));
    }, DISMISS_MS);
  }, [windows, nameFor]);

  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed right-3 top-16 z-50 flex max-w-xs flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.key}
          className="pc-glass pointer-events-auto flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 shadow-lg"
        >
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <button
            type="button"
            onClick={() => {
              onOpen(toast.terminalNumber);
              setToasts((previous) => previous.filter((item) => item.key !== toast.key));
            }}
            className="min-w-0 flex-1 text-left text-xs"
          >
            <p className="font-semibold text-emerald-600 dark:text-emerald-300">{t('terminal.marks.doneToastTitle')}</p>
            <p className="truncate text-slate-700 dark:text-slate-200">
              {t('terminal.marks.doneToastBody', { number: toast.terminalNumber, name: toast.name })}
            </p>
          </button>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => setToasts((previous) => previous.filter((item) => item.key !== toast.key))}
            className="shrink-0 p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default PcTerminalAgentDoneToasts;
