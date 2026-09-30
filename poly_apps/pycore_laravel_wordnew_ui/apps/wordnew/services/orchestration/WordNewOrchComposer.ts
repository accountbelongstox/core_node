/**
 * One composition run: inputs -> plan -> clip resolution -> clip durations ->
 * per-segment timelines the stage plays. No ffmpeg: the timeline is the
 * segment; the sequencer plays its clips and the stage draws the video.
 */
import { wordNewOrchClipStore } from './WordNewOrchClipStore';
import { wordNewOrchResolver } from './WordNewOrchResolver';
import { wordNewOrchSources } from './WordNewOrchSources';
import { wordNewOrchTaskStore } from './WordNewOrchTaskStore';
import { ORCH_CLIP_GAP_MS, orchResourceKey, planComposition } from './orchPlanner';
import { buildTimeline, type OrchTimelineEntry } from './orchStageLayout';
import type {
  OrchComposePlan,
  OrchComposeTask,
  OrchResolveCounts,
  OrchResolvedClip,
  OrchWordState,
} from './orchComposeTypes';

export type OrchComposePhase = 'inputs' | 'plan' | 'resolve' | 'measure' | 'ready' | 'failed';

export interface OrchComposeSession {
  taskId: string;
  planHash: string;
  phase: OrchComposePhase;
  inputsFresh: boolean;
  plan: OrchComposePlan | null;
  wordStates: ReadonlyMap<string, OrchWordState>;
  clips: ReadonlyMap<string, OrchResolvedClip>;
  counts: OrchResolveCounts;
  /** Per segment (plan order): the playable timeline. */
  timelines: OrchTimelineEntry[][];
  error: string;
}

const PROBE_CONCURRENCY = 6;
const PROBE_TIMEOUT_MS = 15_000;
const EMPTY_COUNTS: OrchResolveCounts = { total: 0, device: 0, pycore: 0, laravel: 0, missing: 0, pending: 0 };

function probeDurationMs(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const finish = (value: number): void => {
      clearTimeout(timer);
      audio.removeAttribute('src');
      audio.load();
      resolve(value);
    };
    const timer = setTimeout(() => finish(0), PROBE_TIMEOUT_MS);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration * 1000 : 0);
    audio.onerror = () => finish(0);
    audio.src = url;
  });
}

async function measure(clips: OrchResolvedClip[], signal?: AbortSignal): Promise<Map<string, number>> {
  const durations = new Map<string, number>();
  let cursor = 0;
  const lane = async (): Promise<void> => {
    while (cursor < clips.length && !signal?.aborted) {
      const clip = clips[cursor];
      cursor += 1;
      let ms = await wordNewOrchClipStore.durationMs(clip.key);
      if (!ms) {
        ms = await probeDurationMs(clip.url);
        await wordNewOrchClipStore.setDuration(clip.key, ms);
      }
      durations.set(clip.key, ms);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PROBE_CONCURRENCY, clips.length) }, lane));
  return durations;
}

class WordNewOrchComposerService {
  private readonly sessions = new Map<string, OrchComposeSession>();

  cached(task: OrchComposeTask): OrchComposeSession | null {
    const session = this.sessions.get(task.id);
    return session && session.planHash === task.planHash ? session : null;
  }

  async run(
    task: OrchComposeTask,
    onUpdate: (session: OrchComposeSession) => void,
    signal?: AbortSignal,
  ): Promise<OrchComposeSession> {
    let session: OrchComposeSession = {
      taskId: task.id,
      planHash: task.planHash,
      phase: 'inputs',
      inputsFresh: false,
      plan: null,
      wordStates: new Map(),
      clips: new Map(),
      counts: EMPTY_COUNTS,
      timelines: [],
      error: '',
    };
    const publish = (patch: Partial<OrchComposeSession>): OrchComposeSession => {
      session = { ...session, ...patch };
      this.sessions.set(task.id, session);
      onUpdate(session);
      return session;
    };
    publish({});
    await wordNewOrchTaskStore.update(task.id, { status: 'resolving' });

    const inputs = await wordNewOrchSources.load(task);
    if (inputs.sentences.length === 0) return publish({ phase: 'failed', error: 'orchCompose.error.noSentences' });
    publish({ phase: 'plan', inputsFresh: inputs.fresh, wordStates: inputs.wordStates });

    const plan = planComposition(task.source, task.config, task.language, inputs.sentences, inputs.wordStates);
    publish({ phase: 'resolve', plan, counts: { ...EMPTY_COUNTS, total: plan.resources.length, pending: plan.resources.length } });

    const resolved = await wordNewOrchResolver.resolve(plan.resources, {
      wordStates: inputs.wordStates,
      signal,
      onProgress: (progress) => publish({ counts: progress.counts, clips: new Map(progress.clips) }),
    });
    publish({ phase: 'measure', counts: resolved.counts, clips: new Map(resolved.clips) });

    const durations = await measure([...resolved.clips.values()], signal);
    const timelines = plan.segments.map((segment) => buildTimeline(segment.items, (item) => {
      const key = orchResourceKey(item.kind, item.language, item.text);
      const clip = resolved.clips.get(key);
      return clip ? { url: clip.url, durationMs: durations.get(key) ?? 0 } : null;
    }, ORCH_CLIP_GAP_MS));
    const durationMs = timelines.reduce((total, timeline) => total + (timeline[timeline.length - 1]?.endMs ?? 0), 0);
    await wordNewOrchTaskStore.update(task.id, {
      status: resolved.counts.missing > 0 ? 'partial' : 'ready',
      segmentCount: plan.segments.length,
      itemCount: plan.segments.reduce((total, segment) => total + segment.items.length, 0),
      durationMs,
    });
    return publish({ phase: 'ready', timelines });
  }
}

export const wordNewOrchComposer = new WordNewOrchComposerService();
