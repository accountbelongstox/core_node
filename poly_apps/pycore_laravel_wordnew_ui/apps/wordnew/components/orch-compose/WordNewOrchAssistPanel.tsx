/**
 * Server-side assist state next to a run: the server pause (schema gate) as the one clear reason instead
 * of an endless pending count, the sentence gap per language (contract progress_template) and which pycore
 * nodes (GPU / CPU) are online and assisting each lane.
 */
import React, { useMemo } from 'react';
import { Cpu, PauseCircle, Server, Zap } from 'lucide-react';
import { queueProgressPercent } from '../../../../core/contracts/QueueProgress';
import type { OrchComposeSession } from '../../../../shared/orchestration/orchComposer';
import { useWordNewAssistStatus, type WordNewAssistLane } from '../../services/WordNewAssistStatus';
import type { ElementTheme } from '../../WfNewThemes';

interface Props {
  session: OrchComposeSession | null;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const SENTENCE_LANE = 'sentence_audio';
const WORD_LANE = 'word_audio';
const LANE_KEYS = [SENTENCE_LANE, WORD_LANE] as const;

function planLanguages(session: OrchComposeSession | null): string[] {
  const languages = new Set<string>();
  session?.plan?.resources.forEach((resource) => {
    if (resource.kind === 'sentence') languages.add(resource.language);
  });
  return [...languages];
}

function nodeSummary(lane: WordNewAssistLane | undefined, trans: Props['trans']): string {
  if (!lane) return '';
  const online = lane.online.gpu + lane.online.cpu;
  if (online === 0) return trans('orchAssist.noNode');
  return trans('orchAssist.nodes', {
    gpu: lane.online.gpu,
    cpu: lane.online.cpu,
    assistingGpu: lane.assisting.gpu,
    assistingCpu: lane.assisting.cpu,
    leased: lane.itemsLeased,
    rate: lane.donePerHour,
  });
}

export const WordNewOrchAssistPanel: React.FC<Props> = ({ session, theme, trans }) => {
  const plan = session?.plan ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the plan, not the republished session object
  const languages = useMemo(() => planLanguages(session), [plan]);
  const assist = useWordNewAssistStatus(languages);
  const paused = assist.gate.schema === 'pending';
  const progress = languages.map((language) => [language, assist.sentenceProgress[language]] as const).filter(([, row]) => row);

  if (!paused && progress.length === 0 && assist.nodes !== 'ready') return null;

  return (
    <section className={`space-y-1.5 rounded-2xl border border-slate-200 dark:border-white/5 p-3 text-[11px] ${theme.cardClass}`} aria-label={trans('orchAssist.title')}>
      <p className="flex items-center gap-1.5 font-extrabold text-zinc-700 dark:text-zinc-200"><Server className="h-3.5 w-3.5" aria-hidden />{trans('orchAssist.title')}</p>
      {paused && (
        <p className="flex items-start gap-1.5 text-amber-600 dark:text-amber-300" role="status">
          <PauseCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{trans('orchAssist.paused', { seconds: assist.gate.retryAfterSeconds })}</span>
        </p>
      )}
      {!paused && progress.map(([language, row]) => (
        <div key={language} className="space-y-0.5">
          <div className="flex items-center justify-between gap-2 text-zinc-600 dark:text-zinc-300">
            <span>{trans('orchAssist.sentences', { language, pending: row.pending, failed: row.failed, done: row.done, total: row.total })}</span>
            <span className="font-mono text-zinc-500">{queueProgressPercent(row)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={row.total} aria-valuenow={row.done}>
            <div className="h-full bg-sky-400 transition-[width] duration-300" style={{ width: `${row.total > 0 ? (row.done / row.total) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
      {!paused && assist.nodes === 'ready' && LANE_KEYS.map((lane) => (
        <p key={lane} className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
          {assist.lanes[lane] && assist.lanes[lane].online.gpu > 0 ? <Zap className="h-3 w-3 text-emerald-500" aria-hidden /> : <Cpu className="h-3 w-3 text-zinc-500" aria-hidden />}
          <span className="font-bold">{trans(`orchAssist.lane.${lane}`)}</span>
          <span>{nodeSummary(assist.lanes[lane], trans)}</span>
          {(assist.lanes[lane]?.poolReasons ?? []).map((code) => (
            <span key={code} className="rounded-full border border-slate-200 dark:border-white/10 px-1.5 text-[9px] text-amber-600 dark:text-amber-300">{trans(`orchAssist.reason.${code}`)}</span>
          ))}
        </p>
      ))}
      {!paused && assist.nodes === 'denied' && <p className="text-zinc-500">{trans('orchAssist.nodesDenied')}</p>}
    </section>
  );
};
