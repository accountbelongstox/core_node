/**
 * Image worker base: a registered SimpleWorkerBase worker (typed global-task
 * pulls, Mercure wake, heartbeat) that also drains Laravel's assist claim pool
 * on a slow cadence for background maintenance of missing covers/posters.
 * Subclasses declare their lanes/task types plus how to produce one assist
 * item; claiming, stats and image result submission live here once.
 */
import { SimpleWorkerBase, type SimpleWorkerConfig } from './SimpleWorkerBase';
import { IntervalController } from '@/utils/async';
import { logger } from '@/utils/logger';
import {
  claimAssistItems,
  type AssistClaimItem,
  type AssistItemType,
} from '@/services/assist-image-api';
import { imageTaskResult, type ImageArtifact } from '../assist-cover-pipeline';

const ASSIST_CLAIM_LIMIT = 3;
const ASSIST_ITEM_GAP_MS = 1200;

export abstract class AssistPollingWorkerBase extends SimpleWorkerBase {
  private readonly assistPolling = new IntervalController();
  private assistBusy = false;

  protected readonly assistStats = {
    assistSubmitted: 0,
    assistFailed: 0,
    lastAssistRun: null as number | null,
    lastAssistError: null as string | null,
    currentAssistItem: null as string | null,
    currentAssistStage: 'idle',
  };

  protected get assistPollIntervalMs(): number {
    return 30_000;
  }

  /** Assist pool item types this worker claims. */
  protected abstract get assistItemTypes(): AssistItemType[];

  /** Claimer id Laravel records on assist claims and submits. */
  protected abstract get assistClaimer(): string;

  /** Produce and submit one claimed item, reporting through noteAssistOutcome. */
  protected abstract processAssistItem(item: AssistClaimItem): Promise<void>;

  async start(config: SimpleWorkerConfig): Promise<void> {
    await super.start({ ...config, pollWait: 0 });
    this.startAssistPolling();
    logger.info(this.workerLabel, 'Assist polling activated', {
      apiUrl: config.apiUrl,
      types: this.assistItemTypes,
      intervalMs: this.assistPollIntervalMs,
    });
  }

  stop(): void {
    this.assistPolling.stop();
    super.stop();
  }

  getStatus() {
    const base = super.getStatus();
    return { ...base, stats: { ...base.stats, ...this.assistStats } };
  }

  protected setAssistStage(stage: string): void {
    this.assistStats.currentAssistStage = stage;
  }

  protected noteAssistOutcome(submitted: boolean): void {
    if (submitted) {
      this.assistStats.assistSubmitted += 1;
      this.assistStats.currentAssistStage = 'completed';
      this.stats.translated += 1;
      return;
    }
    this.assistStats.assistFailed += 1;
    this.stats.failed += 1;
  }

  /**
   * Submit one produced image as a global-task result through the worker
   * client (typed result route; transient failures are owned by the durable
   * outbox inside submitResult). No image, or bytes failing the magic check,
   * submit 'failed' so Laravel can re-route or fall back.
   */
  protected async submitImageTaskResult(
    taskId: string,
    artifact: ImageArtifact | null,
    startedAt: number,
    missingError: string,
    fields: Record<string, unknown> = {},
  ): Promise<void> {
    if (!artifact) {
      await this.submitResult(taskId, 'failed', undefined, { error: missingError });
      return;
    }
    const result = imageTaskResult(artifact, startedAt);
    if (!result) {
      await this.submitResult(taskId, 'failed', undefined, {
        error: `image from ${artifact.provider} failed magic validation`,
      });
      return;
    }
    await this.submitResult(taskId, 'completed', { ...fields, ...result });
    logger.info(this.workerLabel, `Image task ${taskId} completed`, {
      provider: result.provider,
      latencyMs: result.latency_ms,
    });
  }

  private startAssistPolling(): void {
    if (this.assistPolling.isRunning) return;

    const tick = (): void => {
      if (!this.isRunning || this.assistBusy) return;
      void this.runAssistCycle();
    };

    tick();
    this.assistPolling.start(tick, this.assistPollIntervalMs);
  }

  private async runAssistCycle(): Promise<void> {
    const apiUrl = this.config?.apiUrl;
    if (!apiUrl || this.assistBusy) return;

    this.assistBusy = true;
    const stats = this.assistStats;
    stats.lastAssistRun = Date.now();
    stats.lastAssistError = null;
    stats.currentAssistStage = 'claiming';
    this.stats.lastRun = stats.lastAssistRun;
    try {
      const items = await claimAssistItems(apiUrl, this.assistItemTypes, this.assistClaimer, ASSIST_CLAIM_LIMIT);
      this.noteBackendSuccess();
      if (!items.length) {
        logger.debug(this.workerLabel, 'Assist claim returned no work');
        return;
      }
      logger.info(this.workerLabel, `Assist claimed ${items.length} item(s)`, {
        items: items.map((item) => ({
          type: item.type,
          mediaType: item.media_type || null,
          id: item.id,
          title: String(item.payload?.title || item.payload?.name || ''),
        })),
      });
      for (const item of items) {
        if (!this.isRunning) break;
        await this.runAssistItem(item);
        await this.delay(ASSIST_ITEM_GAP_MS);
      }
    } catch (error) {
      const message = this.describeError(error);
      this.noteBackendFailure(error);
      stats.lastAssistError = message;
      stats.currentAssistStage = 'failed';
      logger.error(this.workerLabel, `Assist cycle failed: ${message}`, { apiUrl });
    } finally {
      if (stats.currentAssistStage !== 'failed') stats.currentAssistStage = 'idle';
      this.assistBusy = false;
    }
  }

  private async runAssistItem(item: AssistClaimItem): Promise<void> {
    const itemKey = `${item.type}:${item.media_type || 'library'}:${item.id}`;
    const assistTaskId = `assist:${itemKey}`;
    this.assistStats.currentAssistItem = itemKey;
    this.assistStats.currentAssistStage = 'processing';
    // A global task dispatched concurrently owns currentTaskId; never clobber it.
    if (!this.stats.currentTaskId) this.stats.currentTaskId = assistTaskId;
    try {
      await this.processAssistItem(item);
    } finally {
      this.assistStats.currentAssistItem = null;
      if (this.stats.currentTaskId === assistTaskId) this.stats.currentTaskId = null;
    }
  }
}
