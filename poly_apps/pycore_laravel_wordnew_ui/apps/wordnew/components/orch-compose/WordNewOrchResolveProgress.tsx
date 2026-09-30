/**
 * Progress of loading a composition's resources: the phases (inputs, plan,
 * missing resources, measuring), resolved / total with a bar per origin
 * (device, pycore, Laravel, missing) and the state of the inputs.
 */
import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import type { OrchComposePhase, OrchComposeSession } from '../../../../shared/orchestration/orchComposer';

interface Props {
  session: OrchComposeSession | null;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const PHASES: OrchComposePhase[] = ['inputs', 'plan', 'resolve', 'measure', 'ready'];
const ORIGINS = ['device', 'pycore', 'laravel', 'missing'] as const;
const BAR_CLASS: Record<(typeof ORIGINS)[number], string> = {
  device: 'bg-emerald-400',
  pycore: 'bg-indigo-400',
  laravel: 'bg-sky-400',
  missing: 'bg-rose-400',
};
const TEXT_CLASS: Record<(typeof ORIGINS)[number], string> = {
  device: 'text-emerald-300',
  pycore: 'text-indigo-300',
  laravel: 'text-sky-300',
  missing: 'text-rose-300',
};

export const WordNewOrchResolveProgress: React.FC<Props> = ({ session, theme, trans }) => {
  const phase = session?.phase ?? 'inputs';
  const counts = session?.counts;
  const total = counts?.total ?? 0;
  const settled = total - (counts?.pending ?? 0);
  const percent = total > 0 ? Math.round((settled / total) * 100) : 0;
  const reached = PHASES.indexOf(phase === 'failed' ? 'inputs' : phase);

  return (
    <section className={`space-y-2 rounded-2xl border border-white/5 p-3 ${theme.cardClass}`} aria-live="polite" aria-label={trans('orchCompose.progress.title')}>
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {PHASES.map((step, index) => {
          const done = phase !== 'failed' && index < reached;
          const current = phase !== 'failed' && index === reached && step !== 'ready';
          return (
            <li key={step} className={`inline-flex items-center gap-1 ${done || (step === 'ready' && phase === 'ready') ? 'text-emerald-300' : current ? 'text-zinc-100 font-bold' : 'text-zinc-500'}`}>
              {current ? <Loader2 className="h-3 w-3 animate-spin" /> : done || (step === 'ready' && phase === 'ready') ? <Check className="h-3 w-3" /> : <span className="h-3 w-3" />}
              {trans(`orchCompose.phase.${step}`)}
            </li>
          );
        })}
      </ol>
      {total > 0 && (
        <>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-300">{trans('orchCompose.progress.resources', { done: settled, total })}</span>
            <span className="font-mono text-zinc-400">{percent}%</span>
          </div>
          <div
            className="flex h-2 overflow-hidden rounded-full bg-white/5"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={settled}
            aria-label={trans('orchCompose.progress.resources', { done: settled, total })}
          >
            {ORIGINS.map((key) => (
              <div key={key} className={`${BAR_CLASS[key]} transition-[width] duration-300`} style={{ width: `${((counts?.[key] ?? 0) / total) * 100}%` }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono">
            {ORIGINS.map((key) => (
              <span key={key} className={TEXT_CLASS[key]}>{trans(`orchCompose.count.${key}`, { count: counts?.[key] ?? 0 })}</span>
            ))}
            {(counts?.pending ?? 0) > 0 && <span className="text-zinc-400">{trans('orchCompose.count.pending', { count: counts?.pending ?? 0 })}</span>}
          </div>
        </>
      )}
      {session && !session.inputsFresh && phase !== 'inputs' && (
        <p className="text-[11px] text-amber-300">{trans('orchCompose.inputsOffline')}</p>
      )}
      {phase === 'failed' && session && <p className="text-[11px] text-rose-300">{trans(session.error)}</p>}
      {phase === 'ready' && (counts?.missing ?? 0) > 0 && (
        <p className="text-[11px] text-zinc-500">{trans('orchCompose.missingHint')}</p>
      )}
    </section>
  );
};
