/**
 * Mini widget of a run's resource loading (the run keeps going in the
 * background): a progress ring, the phase, and what is loading or missing.
 * A click opens the resources page.
 */
import React from 'react';
import { AlertCircle, CircleCheck, Loader2 } from 'lucide-react';
import type { OrchComposeSession } from '../../../../shared/orchestration/orchComposer';

interface Props {
  session: OrchComposeSession | null;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onOpen?: () => void;
  /** Light text on a dark translucent pill (over the fullscreen stage). */
  overlay?: boolean;
}

const RING_RADIUS = 9;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export const WordNewOrchLoadWidget: React.FC<Props> = ({ session, trans, onOpen, overlay = false }) => {
  const phase = session?.phase ?? 'inputs';
  const counts = session?.counts;
  const total = counts?.total ?? 0;
  const settled = total - (counts?.pending ?? 0);
  const percent = total > 0 ? Math.round((settled / total) * 100) : 0;
  const loading = session?.table?.loading.size ?? 0;
  const missing = counts?.missing ?? 0;
  const busy = phase !== 'ready' && phase !== 'failed';
  const label = trans(`orchCompose.phase.${phase === 'failed' ? 'inputs' : phase}`);
  const title = `${label} · ${trans('orchCompose.progress.resources', { done: settled, total })}`;
  const StateIcon = phase === 'failed' ? AlertCircle : busy ? Loader2 : CircleCheck;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      title={title}
      aria-label={title}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-[10px] font-mono leading-none backdrop-blur-md transition-colors disabled:cursor-default ${
        overlay
          ? 'border-white/15 bg-black/45 text-zinc-100 hover:bg-black/60'
          : 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/10'
      }`}
    >
      <span className="relative inline-flex h-6 w-6 items-center justify-center">
        <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="12" cy="12" r={RING_RADIUS} fill="none" strokeWidth="2.5" className="stroke-slate-400/25" />
          <circle
            cx="12"
            cy="12"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            className={`transition-[stroke-dashoffset] duration-500 ${phase === 'failed' ? 'stroke-rose-400' : busy ? 'stroke-sky-400' : 'stroke-emerald-400'}`}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - percent / 100)}
          />
        </svg>
        <StateIcon className={`h-3 w-3 ${busy ? 'animate-spin text-sky-400' : phase === 'failed' ? 'text-rose-400' : 'text-emerald-400'}`} aria-hidden />
      </span>
      <span className="font-bold">{percent}%</span>
      {loading > 0 && <span className="text-amber-500 dark:text-amber-300">↓{loading}</span>}
      {missing > 0 && <span className="text-rose-500 dark:text-rose-300">!{missing}</span>}
    </button>
  );
};
