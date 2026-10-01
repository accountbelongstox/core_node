/**
 * Live stage of a pycore orchestration task: the shared client composer
 * (shared/orchestration, the code wordnew runs on the phone) plans the task,
 * reads its clips from this pycore's caches and plays the scrolling video in
 * the page - no ffmpeg, no rendered file. Word read states are not queried, so
 * "new words" are the words not yet read inside the task.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Radio } from 'lucide-react';
import { pycoreApi, type OrchTask, type OrchVideoPreset } from '@/apps/pycore-manager/api';
import { isOrchComposeAborted, runComposition, type OrchComposeSession } from '@/shared/orchestration/orchComposer';
import { buildOrchClipSchedule, orchPycoreDirectChannel } from '@/shared/orchestration/orchClipScheduler';
import { orchSentencesFromPycore, orchSpecFromPycoreTask } from '@/shared/orchestration/orchPycoreTask';
import { orchPlanHash } from '@/shared/orchestration/orchPlanner';
import { buildStageCards } from '@/shared/orchestration/orchStageLayout';
import { OrchStage } from '@/shared/orchestration/OrchStage';
import { useOrchSequencer } from '@/shared/orchestration/useOrchSequencer';
import { ORCH_L } from './orchShared';
import { ORCH_SMALL_BUTTON_CLASS } from './orchStyles';

interface Props {
  task: OrchTask;
  presets: OrchVideoPreset[];
  activePresetId: string;
}

async function loadSentences(task: OrchTask) {
  if (task.sentences?.length) return orchSentencesFromPycore(task.sentences, task.book?.language || 'en');
  if (!task.book?.source_key) return [];
  const answer = await pycoreApi.orchBookSentences(task.book.source_key);
  return answer.success ? orchSentencesFromPycore(answer.sentences ?? [], task.book.language || 'en') : [];
}

const LiveStage: React.FC<Props> = ({ task, presets, activePresetId }) => {
  const [session, setSession] = useState<OrchComposeSession | null>(null);
  const [segment, setSegment] = useState(0);
  const urls = useRef<string[]>([]);
  const taskRef = useRef(task);
  taskRef.current = task;
  const settings = useMemo(
    () => (presets.find((preset) => preset.id === (task.video_preset || activePresetId)) ?? presets[0])?.settings ?? null,
    [presets, task.video_preset, activePresetId],
  );
  const spec = useMemo(() => (settings ? orchSpecFromPycoreTask(task, settings.languages) : null), [task, settings]);
  // The detail re-polls the task while it runs: only a plan change recomposes.
  const planHash = spec ? orchPlanHash(spec) : '';

  useEffect(() => {
    if (!spec) return undefined;
    const controller = new AbortController();
    const durations = new Map<string, number>();
    setSegment(0);
    setSession(null);
    runComposition(spec, planHash, {
      loadInputs: async () => ({ sentences: await loadSentences(taskRef.current), wordStates: new Map(), fresh: true }),
      // The pycore UI runs on the pycore machine: the shared schedule over its own pycore only.
      sources: buildOrchClipSchedule({
        pycore: orchPycoreDirectChannel(async () => true),
        sink: {
          persist: async (_resource, blob) => {
            const url = URL.createObjectURL(blob);
            urls.current.push(url);
            return url;
          },
        },
      }).sources,
      durations: {
        get: async (key) => durations.get(key) ?? 0,
        set: async (key, ms) => { durations.set(key, ms); },
      },
      signal: controller.signal,
      onUpdate: (next) => { if (!controller.signal.aborted) setSession(next); },
    }).catch((error: unknown) => {
      if (controller.signal.aborted || isOrchComposeAborted(error)) return;
      setSession((current) => (current ? { ...current, phase: 'failed', error: ORCH_L.liveFailed } : current));
    });
    return () => {
      controller.abort();
      urls.current.forEach((url) => URL.revokeObjectURL(url));
      urls.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the plan, not the polled record
  }, [planHash]);

  const timeline = useMemo(() => session?.timelines[segment] ?? [], [session, segment]);
  const cards = useMemo(() => {
    if (!session?.plan || !settings) return [];
    const meanings = new Map(session.plan.resources
      .filter((resource) => resource.kind === 'word')
      .map((resource) => [resource.contentId, session.clips.get(resource.key)?.meaning ?? '']));
    return buildStageCards(timeline, session.plan.sentences, settings.languages, (word) => meanings.get(word) ?? '');
  }, [session, settings, timeline]);
  const sequencer = useOrchSequencer(timeline, 1);

  if (!settings) return <p className="text-[11px] text-slate-500">{ORCH_L.liveNoPreset}</p>;
  if (!session || session.phase !== 'ready') {
    return (
      <p className="text-[11px] text-slate-400" role="status">
        {session?.phase === 'failed'
          ? (session.error === ORCH_L.liveFailed ? ORCH_L.liveFailed : ORCH_L.liveNoSentences)
          : ORCH_L.liveResolving}
        {session && session.counts.total > 0 && ` · ${session.counts.pycore}/${session.counts.total}`}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-400">
        {ORCH_L.liveCounts.replace('{found}', String(session.counts.pycore)).replace('{total}', String(session.counts.total))}
      </p>
      {session.timelines.length > 1 && (
        <div className="flex flex-wrap gap-1" role="tablist">
          {session.timelines.map((_, index) => (
            <button key={index} type="button" role="tab" aria-selected={segment === index} onClick={() => setSegment(index)} className={`${ORCH_SMALL_BUTTON_CLASS} ${segment === index ? 'ring-1 ring-indigo-400' : ''}`}>
              {index + 1}
            </button>
          ))}
        </div>
      )}
      {timeline.length === 0 ? (
        <p className="text-[11px] text-slate-500">{ORCH_L.liveSegmentEmpty}</p>
      ) : (
        <>
          <OrchStage cards={cards} settings={settings} timeRef={sequencer.timeRef} duration={sequencer.duration} label={task.name} />
          <div className="flex items-center gap-2">
            <button type="button" onClick={sequencer.toggle} className={ORCH_SMALL_BUTTON_CLASS} aria-label={sequencer.playing ? ORCH_L.livePause : ORCH_L.livePlay}>
              {sequencer.playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {sequencer.playing ? ORCH_L.livePause : ORCH_L.livePlay}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0.1, sequencer.duration)}
              step={0.1}
              value={Math.min(sequencer.time, sequencer.duration)}
              onChange={(event) => sequencer.seek(Number(event.target.value))}
              className="flex-1 accent-indigo-400"
              aria-label={ORCH_L.liveSeek}
            />
          </div>
        </>
      )}
    </div>
  );
};

const OrchLiveStagePanel: React.FC<Props> = (props) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-400">{ORCH_L.liveTitle}</p>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className={ORCH_SMALL_BUTTON_CLASS}>
          <Radio className="w-3 h-3" /> {open ? ORCH_L.liveClose : ORCH_L.liveOpen}
        </button>
      </div>
      {open && <p className="text-[10px] text-slate-500">{ORCH_L.liveHint}</p>}
      {open && <LiveStage {...props} />}
    </div>
  );
};

export default OrchLiveStagePanel;
