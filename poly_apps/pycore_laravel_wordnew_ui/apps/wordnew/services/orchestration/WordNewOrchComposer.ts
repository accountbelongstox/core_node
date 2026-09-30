/**
 * wordnew's composition runs: the shared composer with Laravel inputs, the
 * device -> pycore -> Laravel clip chain and the device duration memory.
 *
 * Only the latest run of a task counts: an aborted or superseded run is never
 * cached and never written to the task; a result is written only while the
 * task still has the plan the run composed. A failed run is published as
 * `failed` (retry stays possible). A clip-root change drops cached sessions
 * (their playable URLs point at the old root).
 */
import {
  isOrchComposeAborted,
  ORCH_EMPTY_COUNTS,
  runComposition,
  totalDurationMs,
  type OrchComposeSession,
} from '../../../../shared/orchestration/orchComposer';
import type { OrchComposeTask } from '../../../../shared/orchestration/orchTypes';
import { WORDNEW_ORCH_CLIP_SOURCES } from './WordNewOrchClipSources';
import { wordNewOrchClipStore } from './WordNewOrchClipStore';
import { wordNewOrchSources } from './WordNewOrchSources';
import { wordNewOrchTaskStore } from './WordNewOrchTaskStore';

export type { OrchComposeSession } from '../../../../shared/orchestration/orchComposer';

export const ORCH_COMPOSE_ERROR_FAILED = 'orchCompose.error.failed';

class WordNewOrchComposerService {
  private readonly sessions = new Map<string, OrchComposeSession>();
  private readonly latestRun = new Map<string, symbol>();

  constructor() {
    wordNewOrchClipStore.onRootChanged(() => this.sessions.clear());
  }

  cached(task: OrchComposeTask): OrchComposeSession | null {
    const session = this.sessions.get(task.id);
    return session && session.planHash === task.planHash ? session : null;
  }

  private async stillCurrent(task: OrchComposeTask, run: symbol, signal?: AbortSignal): Promise<boolean> {
    if (signal?.aborted || this.latestRun.get(task.id) !== run) return false;
    return (await wordNewOrchTaskStore.get(task.id))?.planHash === task.planHash;
  }

  async run(
    task: OrchComposeTask,
    onUpdate: (session: OrchComposeSession) => void,
    signal?: AbortSignal,
  ): Promise<OrchComposeSession | null> {
    const run = Symbol(task.id);
    this.latestRun.set(task.id, run);
    this.sessions.delete(task.id);
    await wordNewOrchTaskStore.update(task.id, { status: 'resolving' });
    let last: OrchComposeSession | null = null;
    const publish = (next: OrchComposeSession): void => {
      last = next;
      if (signal?.aborted || this.latestRun.get(task.id) !== run) return;
      onUpdate(next);
    };
    try {
      const session = await runComposition(task, task.planHash, {
        loadInputs: () => wordNewOrchSources.load(task),
        sources: WORDNEW_ORCH_CLIP_SOURCES,
        durations: wordNewOrchClipStore,
        signal,
        onUpdate: publish,
      });
      if (!(await this.stillCurrent(task, run, signal))) return null;
      this.sessions.set(task.id, session);
      if (session.phase === 'ready' && session.plan) {
        await wordNewOrchTaskStore.update(task.id, {
          status: session.counts.missing > 0 ? 'partial' : 'ready',
          segmentCount: session.plan.segments.length,
          itemCount: session.plan.segments.reduce((total, segment) => total + segment.items.length, 0),
          durationMs: totalDurationMs(session.timelines),
        });
      } else {
        await wordNewOrchTaskStore.update(task.id, { status: 'draft' });
      }
      return session;
    } catch (error) {
      if (isOrchComposeAborted(error) || !(await this.stillCurrent(task, run, signal))) {
        if (this.latestRun.get(task.id) === run) await wordNewOrchTaskStore.update(task.id, { status: 'draft' });
        return null;
      }
      const failed: OrchComposeSession = {
        ...(last ?? {
          planHash: task.planHash,
          inputsFresh: false,
          plan: null,
          wordStates: new Map(),
          clips: new Map(),
          counts: ORCH_EMPTY_COUNTS,
          timelines: [],
        }),
        phase: 'failed',
        error: ORCH_COMPOSE_ERROR_FAILED,
      };
      publish(failed);
      await wordNewOrchTaskStore.update(task.id, { status: 'draft' });
      return failed;
    }
  }
}

export const wordNewOrchComposer = new WordNewOrchComposerService();
