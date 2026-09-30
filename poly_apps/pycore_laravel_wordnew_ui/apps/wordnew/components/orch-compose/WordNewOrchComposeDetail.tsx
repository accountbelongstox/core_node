import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Pause, Pencil, Play, RefreshCw, SkipBack, SkipForward, Sparkles, Trash2 } from 'lucide-react';
import type { OrchVideoSettings } from '../../../../core/integrations/pycore';
import type { ElementTheme } from '../../WfNewThemes';
import { formatClockTime } from '../../utils/WordNewTimeFormat';
import { WfNewLoadingDots } from '../WfNewLoadingDots';
import { wordNewOrchTaskStore } from '../../services/orchestration/WordNewOrchTaskStore';
import { wordNewOrchComposer, type OrchComposeSession } from '../../services/orchestration/WordNewOrchComposer';
import { wordNewOrchPresetStore } from '../../services/orchestration/WordNewOrchPresetStore';
import { orchResourceKey } from '../../../../shared/orchestration/orchPlanner';
import { buildStageCards } from '../../../../shared/orchestration/orchStageLayout';
import type { OrchComposeTask } from '../../../../shared/orchestration/orchTypes';
import { WordNewOrchComposeEditor } from './WordNewOrchComposeEditor';
import { WordNewOrchResolveProgress } from './WordNewOrchResolveProgress';
import { WordNewOrchNewWords, orchNewWords } from './WordNewOrchNewWords';
import { WordNewOrchReadStateField } from './WordNewOrchReadStateField';
import { WfNewOrchSection } from './WfNewOrchSection';
import { wordNewOrchVirtualReads } from '../../services/orchestration/WordNewOrchVirtualReads';
import { orchTaskVirtualBatch } from '../../../../shared/orchestration/orchPlanner';
import { navigateToWordNewTab } from '../../routing/WordNewHashRoutes';
import { OrchStage } from '../../../../shared/orchestration/OrchStage';
import { useOrchSequencer } from '../../../../shared/orchestration/useOrchSequencer';

interface Props {
  taskId: string;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onBack: () => void;
}

const RATES = [0.75, 1, 1.25, 1.5];

/** One composition: resolves its clips (device -> pycore -> Laravel) and plays it on the stage. */
export const WordNewOrchComposeDetail: React.FC<Props> = ({ taskId, theme, trans, onBack }) => {
  const [task, setTask] = useState<OrchComposeTask | null | undefined>(undefined);
  const [session, setSession] = useState<OrchComposeSession | null>(null);
  const [baseSettings, setBaseSettings] = useState<OrchVideoSettings | null>(null);
  const [editing, setEditing] = useState(false);
  const [segment, setSegment] = useState(0);
  const [rate, setRate] = useState(1);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const [wordsOpen, setWordsOpen] = useState(false);
  const runRef = useRef<AbortController | null>(null);
  const taskRef = useRef<OrchComposeTask | null | undefined>(undefined);

  useEffect(() => wordNewOrchTaskStore.subscribe((tasks) => setTask(tasks.find((entry) => entry.id === taskId) ?? null)), [taskId]);
  taskRef.current = task;

  const planHash = task?.planHash;
  const presetId = task?.config.presetId ?? '';
  useEffect(() => {
    void wordNewOrchPresetStore.load().then((document) => setBaseSettings(wordNewOrchPresetStore.settingsFor(document, presetId)));
  }, [presetId]);

  const compose = useCallback((current: OrchComposeTask, force: boolean): void => {
    const cached = force ? null : wordNewOrchComposer.cached(current);
    if (cached?.phase === 'ready') {
      setSession(cached);
      return;
    }
    runRef.current?.abort();
    const controller = new AbortController();
    runRef.current = controller;
    setSegment(0);
    void wordNewOrchComposer.run(current, (next) => {
      if (!controller.signal.aborted) setSession(next);
    }, controller.signal);
  }, []);

  // A plan-shaping edit (new plan hash) recomposes; other edits keep the session.
  useEffect(() => {
    if (taskRef.current) compose(taskRef.current, false);
  }, [taskId, planHash, compose]);

  useEffect(() => () => runRef.current?.abort(), []);

  const settings = useMemo<OrchVideoSettings | null>(
    () => (baseSettings && task ? { ...baseSettings, languages: task.config.languages } : null),
    [baseSettings, task],
  );
  const timeline = useMemo(() => session?.timelines[segment] ?? [], [session, segment]);
  const cards = useMemo(() => {
    if (!session?.plan || !settings) return [];
    const language = task?.language ?? 'en';
    return buildStageCards(timeline, session.plan.sentences, settings.languages, (word) => (
      session.clips.get(orchResourceKey('word', language, word))?.meaning
        || session.wordStates.get(word)?.meaning
        || ''
    ));
  }, [session, settings, timeline, task?.language]);

  const newWords = useMemo(
    () => new Set(orchNewWords(session?.plan ?? null, session?.wordStates ?? new Map(), task?.config.newOnlyMaxReadCount ?? 0)),
    [session, task?.config.newOnlyMaxReadCount],
  );
  const segmentCount = session?.timelines.length ?? 0;
  const sequencer = useOrchSequencer(timeline, rate, () => {
    if (segment + 1 < segmentCount) {
      setAutoPlayNext(true);
      setSegment(segment + 1);
    }
  });

  // Words the stage finished playing go into the task's virtual read batch (once per clip).
  const recordedRef = useRef(new Set<string>());
  useEffect(() => { recordedRef.current = new Set(); }, [timeline]);
  useEffect(() => {
    if (!task || !session || !sequencer.playing) return;
    const now = sequencer.time * 1000;
    const words: string[] = [];
    timeline.forEach((entry, index) => {
      if (entry.item.kind !== 'word' || entry.endMs > now) return;
      const key = `${segment}:${index}`;
      if (recordedRef.current.has(key)) return;
      recordedRef.current.add(key);
      words.push(entry.item.text.toLowerCase());
    });
    if (words.length > 0) wordNewOrchVirtualReads.played(task, words, session.wordStates);
  }, [sequencer.time, sequencer.playing, timeline, segment, task, session]);
  useEffect(() => {
    if (!autoPlayNext) return;
    // The flag is consumed by the segment it was set for, even an empty one.
    setAutoPlayNext(false);
    if (timeline.length > 0) sequencer.play();
  }, [autoPlayNext, timeline, sequencer]);

  if (task === undefined) return <WfNewLoadingDots className="text-indigo-600 dark:text-indigo-300" label={trans('content.loading')} />;
  if (task === null) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">
          <ArrowLeft className="h-3.5 w-3.5" />{trans('orchAudio.backToList')}
        </button>
        <p className="text-xs font-mono text-zinc-500">{trans('orchCompose.notFound')}</p>
      </div>
    );
  }

  const busy = session !== null && session.phase !== 'ready' && session.phase !== 'failed';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">
          <ArrowLeft className="h-3.5 w-3.5" />{trans('orchAudio.backToList')}
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-zinc-800 dark:text-zinc-100">{task.name}</h2>
        <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-lg border border-slate-200 dark:border-white/10 p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/10" aria-label={trans('orchCompose.edit')} title={trans('orchCompose.edit')}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" disabled={busy} onClick={() => compose(task, true)} className="rounded-lg border border-slate-200 dark:border-white/10 p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/10 disabled:opacity-40" aria-label={trans('orchCompose.reresolve')} title={trans('orchCompose.reresolve')}>
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(trans('orchCompose.deleteConfirm', { name: task.name }))) return;
            void wordNewOrchTaskStore.remove(task.id).then(onBack);
          }}
          className="rounded-lg border border-slate-200 dark:border-white/10 p-1.5 text-rose-600 dark:text-rose-300 hover:bg-slate-200/70 dark:hover:bg-white/10"
          aria-label={trans('orchCompose.delete')}
          title={trans('orchCompose.delete')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {editing && (
        <WordNewOrchComposeEditor theme={theme} trans={trans} task={task} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      )}

      <WordNewOrchResolveProgress session={session} theme={theme} trans={trans} onOpenStorage={() => navigateToWordNewTab('cache')} />

      <WfNewOrchSection
        icon={Sparkles}
        title={trans('orchCompose.field.newWords')}
        summary={trans('orchCompose.newWords.summary', { count: newWords.size, mode: trans(`orchCompose.readState.${task.config.readState}`) })}
        open={wordsOpen}
        onToggle={() => setWordsOpen((value) => !value)}
        theme={theme}
      >
        <WordNewOrchReadStateField
          value={{ groupId: task.config.wordGroupId, readState: task.config.readState, virtualBatch: task.config.virtualBatch }}
          taskBatch={orchTaskVirtualBatch(task.id)}
          onChange={({ groupId, readState, virtualBatch }) => {
            void wordNewOrchTaskStore.update(task.id, { config: { ...task.config, wordGroupId: groupId, readState, virtualBatch } });
          }}
          theme={theme}
          trans={trans}
        />
        {session?.plan && (
          <WordNewOrchNewWords task={task} plan={session.plan} wordStates={session.wordStates} theme={theme} trans={trans} />
        )}
      </WfNewOrchSection>

      {segmentCount > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {session?.timelines.map((_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={segment === index}
              onClick={() => setSegment(index)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${segment === index ? theme.accentBg : 'border-slate-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-white/10'}`}
            >
              {trans('orchAudio.segmentN', { n: index + 1 })}
            </button>
          ))}
        </div>
      )}

      {settings && session?.phase === 'ready' && (
        timeline.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-center text-xs font-mono text-zinc-500">{trans('orchCompose.segmentEmpty')}</p>
        ) : (
          <div className="space-y-3">
            <OrchStage
              cards={cards}
              settings={settings}
              timeRef={sequencer.timeRef}
              duration={sequencer.duration}
              label={task.name}
              newWords={newWords}
              newLabel={trans('orchCompose.newWords.badge')}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={segment === 0} onClick={() => setSegment(segment - 1)} className="rounded-lg p-2 text-zinc-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/10 disabled:opacity-30" aria-label={trans('orchAudio.prev')}>
                <SkipBack className="h-4 w-4" />
              </button>
              <button type="button" onClick={sequencer.toggle} className={`rounded-full border p-2.5 ${theme.accentBg}`} aria-label={trans(sequencer.playing ? 'orchAudio.pause' : 'orchAudio.play')}>
                {sequencer.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button type="button" disabled={segment + 1 >= segmentCount} onClick={() => setSegment(segment + 1)} className="rounded-lg p-2 text-zinc-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/10 disabled:opacity-30" aria-label={trans('orchAudio.next')}>
                <SkipForward className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(0.1, sequencer.duration)}
                step={0.1}
                value={Math.min(sequencer.time, sequencer.duration)}
                onChange={(event) => sequencer.seek(Number(event.target.value))}
                className="min-w-[8rem] flex-1 accent-indigo-400"
                aria-label={trans('orchCompose.seek')}
              />
              <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                {formatClockTime(sequencer.time)} / {formatClockTime(sequencer.duration)}
              </span>
              <select value={rate} onChange={(event) => setRate(Number(event.target.value))} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-2 py-1 text-[11px] text-zinc-600 dark:text-zinc-300" aria-label={trans('orchAudio.speed')}>
                {RATES.map((value) => <option key={value} value={value}>{value}x</option>)}
              </select>
            </div>
          </div>
        )
      )}
    </div>
  );
};
