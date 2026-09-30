/**
 * wordnew's composition runs: the shared composer with Laravel inputs, the
 * device -> pycore -> Laravel clip chain and the device duration memory; the
 * task record is updated with the result.
 */
import {
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
    await wordNewOrchTaskStore.update(task.id, { status: 'resolving' });
    const session = await runComposition(task, task.planHash, {
      loadInputs: () => wordNewOrchSources.load(task),
      sources: WORDNEW_ORCH_CLIP_SOURCES,
      durations: wordNewOrchClipStore,
      signal,
      onUpdate: (next) => {
        this.sessions.set(task.id, next);
        onUpdate(next);
      },
    });
    if (session.phase === 'ready' && session.plan) {
      await wordNewOrchTaskStore.update(task.id, {
        status: session.counts.missing > 0 ? 'partial' : 'ready',
        segmentCount: session.plan.segments.length,
        itemCount: session.plan.segments.reduce((total, segment) => total + segment.items.length, 0),
        durationMs: totalDurationMs(session.timelines),
      });
    } else if (session.phase === 'failed') {
      await wordNewOrchTaskStore.update(task.id, { status: 'draft' });
    }
    return session;
  }
}

export const wordNewOrchComposer = new WordNewOrchComposerService();
