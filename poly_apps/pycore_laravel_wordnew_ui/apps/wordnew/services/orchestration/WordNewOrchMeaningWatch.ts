/**
 * Words whose meaning the server did not have at lookup (G1c): the planner reads a meaning clip only for a
 * word whose read state carries a meaning, so such a word would never get one. The watch asks them again
 * every `generation_recheck_seconds` (for at most `generation_watch_minutes`; a channel coming back resumes
 * the task later). Once any has a meaning the task is planned again (`onGained`) and its meaning clip joins
 * the plan; nothing already held is fetched again (R14).
 */
import { AUDIO_ORCH_TRANSFER } from '../../../../core/contracts/AudioOrchestrationContract';
import type { OrchComposeSession } from '../../../../shared/orchestration/orchComposer';
import type { OrchComposeTask } from '../../../../shared/orchestration/orchTypes';
import { wfNewApi } from '../../api';
import { wordNewOrchSources } from './WordNewOrchSources';

/** Words one re-check asks the server about. */
const RECHECK_WORDS = 200;
const WORD_STEP_TYPES: readonly string[] = ['words_new', 'words_all'];

interface MeaningWatch {
  /** When this wait began. */
  since: number;
  timer: ReturnType<typeof setTimeout> | null;
  /** Words already asked in this pass over the pending words (a word still without meaning waits for the pass to come around). */
  asked: Set<string>;
}

export interface OrchMeaningWatchHost {
  session: (taskId: string) => OrchComposeSession | null;
  isRunning: (taskId: string) => boolean;
  loadTask: (taskId: string) => Promise<OrchComposeTask | null | undefined>;
  /** Some words gained a meaning: plan the task again. */
  onGained: (task: OrchComposeTask) => void;
}

/** Words of the task's plan that a `meaning` word step cannot read yet: their lookup had no meaning. */
export function wordsWithoutMeaning(task: OrchComposeTask, session: OrchComposeSession | null | undefined): string[] {
  if (!session?.plan || !wfNewApi.isAuthenticated()) return [];
  if (!task.config.pattern.some((step) => step.meaning && WORD_STEP_TYPES.includes(step.type))) return [];
  return session.plan.resources
    .filter((resource) => resource.kind === 'word' && !session.wordStates.get(resource.text)?.meaning?.trim())
    .map((resource) => resource.text);
}

export class OrchMeaningWatchService {
  private readonly watches = new Map<string, MeaningWatch>();

  constructor(private readonly host: OrchMeaningWatchHost) {}

  stop(taskId: string): void {
    const watch = this.watches.get(taskId);
    if (watch?.timer) clearTimeout(watch.timer);
    this.watches.delete(taskId);
  }

  stopAll(): void {
    [...this.watches.keys()].forEach((taskId) => this.stop(taskId));
  }

  /** Arms the re-check when the task's current plan has words without a meaning (`progressed`: a re-check just gained some). */
  watch(task: OrchComposeTask, progressed = false): void {
    const previous = this.watches.get(task.id);
    if (previous?.timer) clearTimeout(previous.timer);
    const session = this.host.session(task.id);
    if (session?.planHash !== task.planHash || wordsWithoutMeaning(task, session).length === 0) {
      this.watches.delete(task.id);
      return;
    }
    const watch: MeaningWatch = { since: progressed ? Date.now() : previous?.since ?? Date.now(), timer: null, asked: previous?.asked ?? new Set() };
    this.watches.set(task.id, watch);
    if (Date.now() - watch.since <= AUDIO_ORCH_TRANSFER.generationWatchMs) {
      watch.timer = setTimeout(() => { void this.recheck(task.id, watch); }, AUDIO_ORCH_TRANSFER.generationRecheckMs);
    }
  }

  private async recheck(taskId: string, watch: MeaningWatch): Promise<void> {
    watch.timer = null;
    // A running task arms its own watch when it ends.
    if (this.watches.get(taskId) !== watch || this.host.isRunning(taskId)) return;
    const task = await this.host.loadTask(taskId);
    const session = this.host.session(taskId);
    if (!task || !session || session.planHash !== task.planHash) {
      this.stop(taskId);
      return;
    }
    const pending = wordsWithoutMeaning(task, session);
    if (pending.length === 0) {
      this.stop(taskId);
      return;
    }
    let words = pending.filter((word) => !watch.asked.has(word)).slice(0, RECHECK_WORDS);
    if (words.length === 0) {
      watch.asked.clear();
      words = pending.slice(0, RECHECK_WORDS);
    }
    words.forEach((word) => watch.asked.add(word));
    const gained = await wordNewOrchSources.refreshMeanings(task, words).catch(() => 0);
    if (this.watches.get(taskId) !== watch) return;
    if (gained === 0) {
      this.watch(task);
      return;
    }
    this.watch(task, true);
    if (!this.host.isRunning(taskId)) this.host.onGained(task);
  }
}
